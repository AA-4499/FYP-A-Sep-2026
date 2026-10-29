from __future__ import annotations

import argparse
import datetime
import os
import re
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import requests
try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None
import torch
from torch import nn




PROJECT_DIR = Path(__file__).resolve().parents[2]
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

from models.training.supabase_io import supabase_headers

from models.training.t2dm.t2dm_pipeline import (
    FEATURE_COLUMNS,
    DEFAULT_OUTPUT_DIR,
    DEFAULT_TRAIN_WINDOW_STRIDE,
    MAX_SEQUENCE_GAP,
    _add_time_features,
    _fit_scalers,
    _mae_rmse,
    _parse_event_value,
    _parse_glucose,
    _predict_scaled,
    _scaled_features,
    _split_report,
    build_window_sets,
    calculate_boundaries,
    train_and_evaluate,
)

if load_dotenv:
    load_dotenv(Path(__file__).resolve().parent / ".env")
    load_dotenv(PROJECT_DIR / ".env")


DEFAULT_SUPABASE_URL = "https://dgtaujhgwxmoghqdqkti.supabase.co"
DEFAULT_SUPABASE_KEY = os.getenv("SUPABASE_KEY", "your_supabase_secret_key_here")



def _extract_patient_and_record_id(raw_patient_number: str) -> tuple[str, str]:
    """
    Extract patient_id (e.g. '2000') and record_id (e.g. '2000_0') from strings like '2000_0_20201230'.
    """
    cleaned = str(raw_patient_number).strip()
    match = re.match(r"(\d+)(?:_(\d+))?", cleaned)
    if match:
        p_id = match.group(1)
        r_id = f"{match.group(1)}_{match.group(2)}" if match.group(2) else match.group(1)
        return p_id, r_id
    return cleaned, cleaned


def fetch_all_supabase_rows(
    supabase_url: str,
    supabase_key: str,
    table_name: str = "patient_detail",
) -> list[dict[str, Any]]:
    """Fetch all rows from a Supabase table with pagination (1,000 rows per request)."""
    headers = supabase_headers(supabase_key)
    url = f"{supabase_url.rstrip('/')}/rest/v1/{table_name}"

    all_rows = []
    offset = 0
    page_size = 1000

    print(f"Fetching records from Supabase table '{table_name}'...")
    while True:
        resp = requests.get(
            url,
            headers={**headers, "Range": f"{offset}-{offset + page_size - 1}"},
            params={"order": '"Patient Number".asc,Date.asc'},
            timeout=30,
        )
        resp.raise_for_status()
        batch = resp.json()
        if not batch:
            break
        all_rows.extend(batch)
        print(f"  Loaded {len(all_rows)} rows...")
        if len(batch) < page_size:
            break
        offset += page_size

    print(f"Total raw records retrieved: {len(all_rows)}")
    return all_rows


def prepare_supabase_timelines(raw_rows: list[dict[str, Any]]) -> dict[str, pd.DataFrame]:
    """Parse raw records from Supabase into model-ready patient timeline DataFrames."""
    if not raw_rows:
        raise ValueError("No records found in Supabase table.")

    raw_df = pd.DataFrame(raw_rows)

    patient_col = "Patient Number"
    date_col = "Date"
    glucose_col = "CGM (mg / dl)"
    diet_col = "Dietary intake"
    insulin_cols = [
        "Insulin dose - s.c.",
        "Insulin dose - i.v.",
        "CSII - bolus insulin (Novolin R, IU)",
        "CSII - basal insulin (Novolin R, IU / H)",
    ]

    timelines: dict[str, pd.DataFrame] = {}
    grouped = raw_df.groupby(patient_col)
    print(f"Found {len(grouped)} distinct patient files: {list(grouped.groups.keys())}")

    for raw_p_num, group in grouped:
        patient_id, record_id = _extract_patient_and_record_id(raw_p_num)

        prepared = pd.DataFrame(
            {
                "timestamp": pd.to_datetime(group[date_col], errors="coerce"),
                "glucose": _parse_glucose(group[glucose_col]),
            }
        )
        prepared["meal"] = 0.0
        prepared["insulin"] = 0.0

        if diet_col in group.columns:
            prepared["meal"] = group[diet_col].map(lambda v: _parse_event_value(v, meal=True))

        for col in insulin_cols:
            if col in group.columns:
                prepared["insulin"] += group[col].map(lambda v: _parse_event_value(v, meal=False))

        prepared = prepared.dropna(subset=["timestamp", "glucose"]).copy()
        prepared = prepared.loc[np.isfinite(prepared["glucose"])].copy()

        if prepared.empty:
            print(f"Warning: Patient {record_id} has no valid CGM readings, skipping.")
            continue

        if prepared["timestamp"].dt.tz is not None:
            prepared["timestamp"] = prepared["timestamp"].dt.tz_localize(None)

        prepared = (
            prepared.groupby("timestamp", as_index=False)
            .agg(glucose=("glucose", "mean"), meal=("meal", "sum"), insulin=("insulin", "sum"))
            .sort_values("timestamp")
            .reset_index(drop=True)
        )

        prepared = _add_time_features(prepared)
        prepared["patient_id"] = patient_id
        prepared["record_id"] = record_id
        prepared["patient_record_id"] = str(raw_p_num)
        prepared["source_file"] = f"supabase.{raw_p_num}"
        prepared["workbook_count"] = 1

        timelines[record_id] = prepared
        print(f"  - Record ID '{record_id}' (Patient {patient_id}): {len(prepared)} valid time points")

    if not timelines:
        raise ValueError("Could not construct any usable patient timelines.")

    return timelines


def train_on_supabase_timelines(
    timelines: dict[str, pd.DataFrame],
    output_dir: Path,
    epochs: int = 30,
    batch_size: int = 128,
    sequence_length: int = 24,
    hidden_dim: int = 64,
    learning_rate: float = 1e-3,
    training_stride: int = DEFAULT_TRAIN_WINDOW_STRIDE,
    seed: int = 2026,
    device_name: str | None = None,
    copy_to_weights: bool = True,
) -> dict[str, Any]:
    """Train GRU model and evaluate on held-out test windows."""
    import random
    from models.training.t2dm.t2dm_pipeline import GRUGlucoseForecaster
    from torch.utils.data import DataLoader, TensorDataset

    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)

    device = torch.device(
        device_name if device_name else ("cuda" if torch.cuda.is_available() else "cpu")
    )
    print(f"Using compute device: {device}")

    boundaries = calculate_boundaries(timelines)
    window_sets = build_window_sets(
        timelines,
        boundaries,
        sequence_length=sequence_length,
        training_stride=training_stride,
    )
    train_batch = window_sets["train"]
    validation_batch = window_sets["validation"]
    test_batch = window_sets["test"]

    if not len(train_batch):
        raise ValueError("Training window count is 0. Check data coverage and lookback window.")
    if not len(test_batch):
        raise ValueError("Test window count is 0. Cannot evaluate on held-out period.")

    print(f"Windows created: Train={len(train_batch)}, Validation={len(validation_batch)}, Test={len(test_batch)}")

    feature_mean, feature_scale, delta_mean, delta_scale = _fit_scalers(
        timelines, boundaries, train_batch
    )

    train_features = _scaled_features(train_batch, feature_mean, feature_scale)
    validation_features = _scaled_features(validation_batch, feature_mean, feature_scale)
    test_features = _scaled_features(test_batch, feature_mean, feature_scale)

    train_targets = ((train_batch.targets - train_batch.last_glucose - delta_mean) / delta_scale).astype(np.float32)
    validation_targets = ((validation_batch.targets - validation_batch.last_glucose - delta_mean) / delta_scale).astype(np.float32)

    train_loader = DataLoader(
        TensorDataset(torch.from_numpy(train_features), torch.from_numpy(train_targets)),
        batch_size=batch_size,
        shuffle=True,
    )

    model = GRUGlucoseForecaster(
        input_dim=train_features.shape[-1],
        hidden_dim=hidden_dim,
    ).to(device)

    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)
    criterion = nn.HuberLoss(delta=1.0)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="min", factor=0.5, patience=3)

    best_val_mae = float("inf")
    best_state = None

    print(f"Starting model training ({epochs} epochs)...")
    for epoch in range(1, epochs + 1):
        model.train()
        losses = []
        for x_b, y_b in train_loader:
            x_b, y_b = x_b.to(device), y_b.to(device)
            optimizer.zero_grad()
            preds = model(x_b)
            loss = criterion(preds, y_b)
            loss.backward()
            optimizer.step()
            losses.append(loss.item())

        train_loss = float(np.mean(losses))

        model.eval()
        if len(validation_batch):
            with torch.no_grad():
                val_scaled = _predict_scaled(model, validation_features, batch_size=batch_size, device=device)
            val_preds = val_scaled * delta_scale + delta_mean + validation_batch.last_glucose
            val_metrics = _mae_rmse(validation_batch.targets, val_preds)
            val_mae = val_metrics["mae_mg_dl"]
            scheduler.step(val_mae)

            if val_mae < best_val_mae:
                best_val_mae = val_mae
                best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
        else:
            scheduler.step(train_loss)
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}

        if epoch % 5 == 0 or epoch == epochs:
            print(f"  Epoch {epoch:02d}/{epochs} | train_loss={train_loss:.4f} | val_MAE={best_val_mae:.2f} mg/dL")

    if best_state is not None:
        model.load_state_dict(best_state)
    model.to(device)

    model.eval()
    with torch.no_grad():
        test_scaled = _predict_scaled(model, test_features, batch_size=batch_size, device=device)
    test_predictions = test_scaled * delta_scale + delta_mean + test_batch.last_glucose

    test_metrics = _mae_rmse(test_batch.targets, test_predictions)
    baseline_metrics = _mae_rmse(test_batch.targets, test_batch.last_glucose)
    test_metrics["persistence_baseline_mae_mg_dl"] = baseline_metrics["mae_mg_dl"]
    test_metrics["persistence_baseline_rmse_mg_dl"] = baseline_metrics["rmse_mg_dl"]
    test_metrics["patients"] = int(len(np.unique(test_batch.patient_ids)))
    test_metrics["windows"] = int(len(test_batch))

    output_dir.mkdir(parents=True, exist_ok=True)
    checkpoint_path = output_dir / "gru_t2dm_forecaster.pt"
    checkpoint_data = {
        "model_state_dict": {k: v.detach().cpu().clone() for k, v in model.state_dict().items()},
        "state_dict": {k: v.detach().cpu().clone() for k, v in model.state_dict().items()},
        "model_config": {
            "input_dim": len(FEATURE_COLUMNS),
            "hidden_dim": hidden_dim,
            "num_layers": 2,
            "dropout": 0.15,
        },
        "feature_columns": list(FEATURE_COLUMNS),
        "sequence_length": sequence_length,
        "feature_mean": [float(x) for x in feature_mean],
        "feature_scale": [float(x) for x in feature_scale],
        "target_delta_mean": float(delta_mean),
        "target_delta_scale": float(delta_scale),
        "delta_mean": float(delta_mean),
        "delta_scale": float(delta_scale),
        "hidden_dim": hidden_dim,
        "summary": test_metrics,
        "test_metrics": test_metrics,
    }
    torch.save(checkpoint_data, checkpoint_path)
    for model_copy_dir in ([PROJECT_DIR / "models" / "weights"] if copy_to_weights else []):
        model_copy_dir.mkdir(parents=True, exist_ok=True)
        torch.save(checkpoint_data, model_copy_dir / "gru_t2dm_forecaster.pt")
    print(f"Local model checkpoint saved: {checkpoint_path}")

    prediction_frame = pd.DataFrame(
        {
            "patient_id": test_batch.patient_ids,
            "timestamp": pd.to_datetime(test_batch.timestamps),
            "actual_glucose_mg_dl": test_batch.targets,
            "predicted_glucose_mg_dl": test_predictions,
            "persistence_baseline_mg_dl": test_batch.last_glucose,
        }
    )

    split_frame = _split_report(boundaries, window_sets)
    prediction_frame.to_csv(output_dir / "test_predictions.csv", index=False)
    split_frame.to_csv(output_dir / "timeline_splits.csv", index=False)
    import json
    (output_dir / "metrics.json").write_text(json.dumps({"test_metrics": test_metrics}, indent=2), encoding="utf-8")

    return {
        "test_metrics": test_metrics,
        "prediction_frame": prediction_frame,
        "split_frame": split_frame,
        "patient_records": {record_id: str(frame["patient_record_id"].iloc[0])
                            for record_id, frame in timelines.items() if "patient_record_id" in frame},
        "epochs": epochs,
        "batch_size": batch_size,
        "hidden_dim": hidden_dim,
    }


def post_to_supabase(
    supabase_url: str,
    supabase_key: str,
    table_name: str,
    records: list[dict[str, Any]],
    chunk_size: int = 500,
) -> None:
    """Post list of dictionary records to Supabase table in chunks."""
    headers = {
        **supabase_headers(supabase_key),
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    endpoint = f"{supabase_url.rstrip('/')}/rest/v1/{table_name}"

    for i in range(0, len(records), chunk_size):
        chunk = records[i : i + chunk_size]
        res = requests.post(endpoint, headers=headers, json=chunk, timeout=30)
        res.raise_for_status()


def upload_results_to_supabase(
    supabase_url: str,
    supabase_key: str,
    results: dict[str, Any],
    run_id: str,
) -> None:
    """Upload predictions, metrics, and timeline splits directly to Supabase via REST API."""
    pred_df: pd.DataFrame = results["prediction_frame"].copy()
    split_df: pd.DataFrame = results["split_frame"].copy()
    test_metrics = results["test_metrics"]
    patient_records = results.get("patient_records", {})

    print("\n================ Syncing Results to Supabase ================")

    # Create the shared parent before any child output rows are inserted.
    post_to_supabase(supabase_url, supabase_key, "model_runs", [
        {"run_id": run_id, "run_type": "training", "source": "supabase"}
    ])

    # 1. Upload predictions
    pred_records = []
    for _, row in pred_df.iterrows():
        ts_val = pd.to_datetime(row["timestamp"])
        if ts_val.tzinfo is None:
            ts_str = ts_val.strftime("%Y-%m-%dT%H:%M:%SZ")
        else:
            ts_str = ts_val.isoformat()
        pred_records.append(
            {
                "run_id": run_id,
                "patient_id": str(row["patient_id"]),
                "patient_record_id": patient_records.get(str(row["patient_id"])),
                "timestamp": ts_str,
                "actual_glucose_mg_dl": round(float(row["actual_glucose_mg_dl"]), 2),
                "predicted_glucose_mg_dl": round(float(row["predicted_glucose_mg_dl"]), 2),
                "persistence_baseline_mg_dl": round(float(row["persistence_baseline_mg_dl"]), 2),
            }
        )

    print(f"1. Inserting {len(pred_records)} predictions into 'training_predictions'...")
    post_to_supabase(supabase_url, supabase_key, "training_predictions", pred_records)
    print("   -> Predictions uploaded successfully.")

    # 2. Upload evaluation metrics
    metrics_records = [
        {
            "run_id": run_id,
            "patient_id": "ALL",
            "patient_record_id": None,
            "mae_mg_dl": round(float(test_metrics["mae_mg_dl"]), 4),
            "rmse_mg_dl": round(float(test_metrics["rmse_mg_dl"]), 4),
            "baseline_mae_mg_dl": round(float(test_metrics["persistence_baseline_mae_mg_dl"]), 4),
            "baseline_rmse_mg_dl": round(float(test_metrics["persistence_baseline_rmse_mg_dl"]), 4),
            "test_windows": int(test_metrics["windows"]),
            "epochs": int(results["epochs"]),
            "batch_size": int(results["batch_size"]),
            "hidden_dim": int(results["hidden_dim"]),
        }
    ]

    for patient_id, group in pred_df.groupby("patient_id"):
        p_metrics = _mae_rmse(group["actual_glucose_mg_dl"].to_numpy(), group["predicted_glucose_mg_dl"].to_numpy())
        b_metrics = _mae_rmse(group["actual_glucose_mg_dl"].to_numpy(), group["persistence_baseline_mg_dl"].to_numpy())
        metrics_records.append(
            {
                "run_id": run_id,
                "patient_id": str(patient_id),
                "patient_record_id": patient_records.get(str(patient_id)),
                "mae_mg_dl": round(float(p_metrics["mae_mg_dl"]), 4),
                "rmse_mg_dl": round(float(p_metrics["rmse_mg_dl"]), 4),
                "baseline_mae_mg_dl": round(float(b_metrics["mae_mg_dl"]), 4),
                "baseline_rmse_mg_dl": round(float(b_metrics["rmse_mg_dl"]), 4),
                "test_windows": int(len(group)),
                "epochs": int(results["epochs"]),
                "batch_size": int(results["batch_size"]),
                "hidden_dim": int(results["hidden_dim"]),
            }
        )

    print(f"2. Inserting {len(metrics_records)} metrics into 'training_metrics'...")
    post_to_supabase(supabase_url, supabase_key, "training_metrics", metrics_records)
    print("   -> Metrics uploaded successfully.")

    # 3. Upload timeline splits
    split_records = []
    for _, row in split_df.iterrows():
        split_records.append(
            {
                "run_id": run_id,
                "patient_id": str(row["patient_id"]),
                "patient_record_id": patient_records.get(str(row["patient_id"])),
                "timeline_start": pd.to_datetime(row["timeline_start"]).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "timeline_end": pd.to_datetime(row["timeline_end"]).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "train_target_end_exclusive": pd.to_datetime(row["train_target_end_exclusive"]).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "test_target_start": pd.to_datetime(row["test_target_start"]).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "observed_rows": int(row["observed_rows"]),
                "training_rows": int(row["training_rows"]),
                "testing_rows": int(row["testing_rows"]),
                "test_windows": int(row["test_windows"]),
            }
        )

    print(f"3. Inserting {len(split_records)} records into 'training_timeline_splits'...")
    post_to_supabase(supabase_url, supabase_key, "training_timeline_splits", split_records)
    print("   -> Timeline splits uploaded successfully.")
    print("================ Sync Completed Successfully ================\n")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Train GRU model using Supabase patient_detail data and upload predictions back to Supabase"
    )
    parser.add_argument("--supabase-url", default=None, help="Supabase project URL")
    parser.add_argument("--supabase-key", default=None, help="Supabase API key / service key")
    parser.add_argument("--epochs", type=int, default=25)
    parser.add_argument("--batch-size", type=int, default=128)
    parser.add_argument("--sequence-length", type=int, default=24)
    parser.add_argument("--hidden-dim", type=int, default=64)
    parser.add_argument("--learning-rate", type=float, default=1e-3)
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument("--skip-upload", action="store_true", help="Run local training only, skip database sync")
    args = parser.parse_args()

    supabase_url = args.supabase_url or os.getenv("SUPABASE_URL") or DEFAULT_SUPABASE_URL
    supabase_key = args.supabase_key or os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or DEFAULT_SUPABASE_KEY

    # 1. Fetch raw rows from Supabase
    raw_rows = fetch_all_supabase_rows(supabase_url, supabase_key, "patient_detail")

    # 2. Prepare patient timelines
    timelines = prepare_supabase_timelines(raw_rows)

    # 3. Train and evaluate
    output_dir = DEFAULT_OUTPUT_DIR
    results = train_on_supabase_timelines(
        timelines,
        output_dir=output_dir,
        epochs=args.epochs,
        batch_size=args.batch_size,
        sequence_length=args.sequence_length,
        hidden_dim=args.hidden_dim,
        learning_rate=args.learning_rate,
        seed=args.seed,
    )

    print(
        f"\nTraining completed! Test evaluation: MAE = {results['test_metrics']['mae_mg_dl']:.2f} mg/dL, "
        f"RMSE = {results['test_metrics']['rmse_mg_dl']:.2f} mg/dL"
    )

    # 4. Upload results back to Supabase
    if not args.skip_upload:
        run_id = f"run_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
        upload_results_to_supabase(supabase_url, supabase_key, results, run_id=run_id)
    else:
        print("Flag --skip-upload set. Skipped uploading results to Supabase.")


if __name__ == "__main__":
    main()
