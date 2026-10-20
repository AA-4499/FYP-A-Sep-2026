from __future__ import annotations

import math
import hashlib
import os
from functools import lru_cache
from pathlib import Path

import pandas as pd
import requests

from models.training.t2dm.t2dm_pipeline import (
    DEFAULT_DATA_DIR, MAX_SEQUENCE_GAP, FEATURE_COLUMNS,
    forecast_from_history, load_forecaster_checkpoint, load_patient_timelines,
    predict_training_windows,
)
from models.training.train_from_supabase import prepare_supabase_timelines
from models.training.supabase_io import supabase_config, supabase_headers

ROOT = Path(__file__).resolve().parents[3]


@lru_cache(maxsize=2)
def _model(path: str, modified: int):
    model, checkpoint = load_forecaster_checkpoint(path, device_name="cpu")
    checkpoint["model_sha256"] = hashlib.sha256(Path(path).read_bytes()).hexdigest()
    return model, checkpoint


@lru_cache(maxsize=2)
def _local_timelines(path: str, signature: tuple):
    return load_patient_timelines(path)


def _cloud_timeline(patient_id: str):
    url, key = supabase_config()
    rows = []
    offset = 0
    while True:
        response = requests.get(
            f"{url}/rest/v1/patient_detail",
            headers={**supabase_headers(key), "Range": f"{offset}-{offset + 999}"},
            params={"Patient Number": f"eq.{patient_id}", "order": "Date.asc,id.asc"}, timeout=30,
        )
        response.raise_for_status()
        batch = response.json()
        rows.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000
    if not rows:
        raise LookupError("No CGM readings found for this patient record in Supabase.")
    timelines = prepare_supabase_timelines(rows)
    return next(iter(timelines.items()))


def _timeline(patient_id: str, source: str):
    if source == "supabase":
        return _cloud_timeline(patient_id)
    data_dir = Path(os.getenv("T2DM_DATA_DIR", str(DEFAULT_DATA_DIR))).resolve()
    if not data_dir.is_dir():
        raise RuntimeError("Local CGM workbooks are missing. Configure T2DM_DATA_DIR or choose Supabase.")
    signature = tuple((p.name, p.stat().st_mtime_ns) for p in sorted(data_dir.glob("*.xls*")))
    timelines = _local_timelines(str(data_dir), signature)
    # Use the source filename to resolve the exact record, including its date.
    for record_id, frame in timelines.items():
        filenames = frame.get("source_file", pd.Series(dtype=str)).astype(str).map(lambda value: Path(value).stem)
        if patient_id == record_id or filenames.eq(patient_id).any():
            return record_id, frame
    raise LookupError("No local CGM workbook matches this patient record.")


def validate_options(payload):
    if not isinstance(payload, dict):
        raise ValueError("Request body must be a JSON object.")
    source = payload.get("source", "supabase")
    if source not in ("local", "supabase"):
        raise ValueError("source must be local or supabase.")
    horizon = payload.get("horizon_hours", 3)
    if isinstance(horizon, bool) or horizon not in (3, 6, 12):
        raise ValueError("horizon_hours must be 3, 6 or 12.")
    events = payload.get("events", [])
    if not isinstance(events, list) or len(events) > 12:
        raise ValueError("Provide at most 12 scenario events.")
    for event in events:
        if not isinstance(event, dict) or event.get("kind") not in ("meal", "insulin"):
            raise ValueError("Each event must have kind meal or insulin.")
        amount = event.get("amount")
        minutes = event.get("minutes_ahead")
        if isinstance(amount, bool) or not isinstance(amount, (int, float)) or not math.isfinite(amount) or amount <= 0:
            raise ValueError("Event amounts must be positive finite numbers.")
        if isinstance(minutes, bool) or not isinstance(minutes, int) or minutes < 15 or minutes % 15 or minutes >= horizon * 60:
            raise ValueError("Event times must be 15-minute intervals before the final forecast step.")
    return source, int(horizon), events


def _points(frame, column):
    return [{"timestamp": pd.Timestamp(row["timestamp"]).isoformat(), "value": round(float(row[column]), 3)}
            for _, row in frame.iterrows() if pd.notna(row[column]) and math.isfinite(float(row[column]))]


def forecast_patient(patient_id: str, payload: dict):
    source, horizon, events = validate_options(payload)
    path = Path(os.getenv("T2DM_CHECKPOINT_PATH", str(ROOT / "models/weights/gru_t2dm_forecaster.pt"))).resolve()
    if not path.is_file():
        raise RuntimeError("The GRU checkpoint is missing. Train the model and deploy models/weights/gru_t2dm_forecaster.pt.")
    model, checkpoint = _model(str(path), path.stat().st_mtime_ns)
    record_id, timeline = _timeline(patient_id, source)
    timeline = timeline.sort_values("timestamp").reset_index(drop=True)
    gaps = timeline["timestamp"].diff().gt(MAX_SEQUENCE_GAP)
    starts = timeline.index[gaps].tolist()
    continuous = timeline.iloc[starts[-1] if starts else 0:]
    length = int(checkpoint["sequence_length"])
    history = continuous.tail(length).copy()
    if len(history) < length or not all(history[list(FEATURE_COLUMNS)].notna().all()):
        raise ValueError(f"The latest segment requires {length} consecutive complete CGM readings.")
    start = pd.Timestamp(history["timestamp"].iloc[-1])
    schedules = {"meal": {}, "insulin": {}}
    for event in events:
        when = start + pd.Timedelta(minutes=event["minutes_ahead"])
        schedule = schedules[event["kind"]]
        schedule[when] = schedule.get(when, 0) + event["amount"]
    baseline = forecast_from_history(model, checkpoint, history, horizon_steps=horizon * 4)
    scenario = forecast_from_history(model, checkpoint, history, horizon_steps=horizon * 4,
                                     meal_schedule=schedules["meal"], insulin_schedule=schedules["insulin"]) if events else baseline
    training = predict_training_windows(model, checkpoint, {record_id: timeline})
    # Evaluate the same checkpoint on this selected source's held-out windows.
    # This avoids combining exported predictions from a different training run/source.
    from models.training.t2dm.t2dm_pipeline import (
        build_window_sets, calculate_boundaries, _scaled_features, _predict_scaled,
    )
    import numpy as np
    import torch
    boundaries = calculate_boundaries({record_id: timeline})
    boundary = boundaries[record_id]
    windows = build_window_sets({record_id: timeline}, boundaries, sequence_length=length)["test"]
    testing = pd.DataFrame(columns=["timestamp", "actual_glucose_mg_dl", "predicted_glucose_mg_dl"])
    metrics = None
    if len(windows):
        features = _scaled_features(windows, np.asarray(checkpoint["feature_mean"]), np.asarray(checkpoint["feature_scale"]))
        predictions = _predict_scaled(model, features, batch_size=128, device=torch.device("cpu"))
        predictions = predictions * float(checkpoint["target_delta_scale"]) + float(checkpoint["target_delta_mean"]) + windows.last_glucose
        testing = pd.DataFrame({"timestamp": windows.timestamps, "actual_glucose_mg_dl": windows.targets, "predicted_glucose_mg_dl": predictions})
        error = windows.targets - predictions
        metrics = {"mae_mg_dl": float(np.abs(error).mean()), "rmse_mg_dl": float(np.sqrt((error ** 2).mean())), "test_windows": len(windows)}
    anchor = {"timestamp": start.isoformat(), "value": float(history["glucose"].iloc[-1])}
    return {
        "patient_id": patient_id, "record_id": record_id, "source": source, "horizon_hours": horizon,
        "sequence_length": length, "model_sha256": checkpoint["model_sha256"], "forecast_start": start.isoformat(), "latest_glucose": anchor["value"],
        "baseline_end": float(baseline["predicted_glucose_mg_dl"].iloc[-1]),
        "scenario_end": float(scenario["predicted_glucose_mg_dl"].iloc[-1]),
        "scenario_enabled": bool(events), "metrics": metrics,
        "forecast_semantics": "No supplied future events means unknown future inputs, not verified fasting or withheld insulin; scenario differences are predictive sensitivity, not identified causal effects.",
        "timeline_split": {
            "timeline_start": boundary.start.isoformat(), "timeline_end": boundary.end.isoformat(),
            "train_target_end_exclusive": boundary.train_end.isoformat(),
            "test_target_start": boundary.test_start.isoformat(),
            "observed_rows": boundary.observed_rows, "training_rows": boundary.training_rows,
            "testing_rows": boundary.testing_rows, "test_windows": len(windows),
        },
        "baseline": [anchor] + _points(baseline, "predicted_glucose_mg_dl"),
        "scenario": [anchor] + _points(scenario, "predicted_glucose_mg_dl"),
        "observed": _points(timeline, "glucose"),
        "training": _points(training.loc[training["split"] == "train"], "predicted_glucose_mg_dl"),
        "validation": _points(training.loc[training["split"] == "validation"], "predicted_glucose_mg_dl"),
        "testing": _points(testing, "predicted_glucose_mg_dl"),
        "testing_actual": _points(testing, "actual_glucose_mg_dl"),
    }
