from __future__ import annotations

import json
import random
import re
from dataclasses import dataclass
from datetime import datetime, time
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset


PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_DATA_DIR = PROJECT_ROOT / "data" / "raw" / "t2dm_training" / "Shanghai_T2DM"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "models" / "evaluation" / "t2dm"
FEATURE_COLUMNS = (
    "glucose",
    "meal",
    "insulin",
    "meal_recent_1h",
    "meal_recent_3h",
    "insulin_recent_1h",
    "insulin_recent_3h",
    "hour_sin",
    "hour_cos",
)
SAMPLE_INTERVAL = pd.Timedelta(minutes=15)
MAX_SEQUENCE_GAP = pd.Timedelta(minutes=22.5)
DEFAULT_TRAIN_WINDOW_STRIDE = 4
MEAL_KEYWORDS = ("diet", "meal", "food", "carb", "\u98f2\u98df", "\u8fdb\u98df")
INSULIN_KEYWORDS = ("insulin", "csii")


def _add_time_features(frame: pd.DataFrame) -> pd.DataFrame:
    frame = frame.sort_values("timestamp").reset_index(drop=True).copy()
    hour = frame["timestamp"].dt.hour + frame["timestamp"].dt.minute / 60.0
    frame["meal_recent_1h"] = (
        frame.rolling("60min", on="timestamp", min_periods=1)["meal"].sum().to_numpy()
    )
    frame["meal_recent_3h"] = (
        frame.rolling("180min", on="timestamp", min_periods=1)["meal"].sum().to_numpy()
    )
    frame["insulin_recent_1h"] = (
        frame.rolling("60min", on="timestamp", min_periods=1)["insulin"].sum().to_numpy()
    )
    frame["insulin_recent_3h"] = (
        frame.rolling("180min", on="timestamp", min_periods=1)["insulin"].sum().to_numpy()
    )
    frame["hour_sin"] = np.sin(2 * np.pi * hour / 24.0)
    frame["hour_cos"] = np.cos(2 * np.pi * hour / 24.0)
    return frame


def next_scheduled_timestamp(
    forecast_start: pd.Timestamp,
    selected_time: time,
) -> pd.Timestamp:
    scheduled = pd.Timestamp(datetime.combine(forecast_start.date(), selected_time))
    if scheduled <= forecast_start:
        scheduled += pd.Timedelta(days=1)

    elapsed = scheduled - forecast_start
    steps = int(elapsed / SAMPLE_INTERVAL)
    if forecast_start + steps * SAMPLE_INTERVAL < scheduled:
        steps += 1
    return forecast_start + max(1, steps) * SAMPLE_INTERVAL


@dataclass(frozen=True)
class TimelineBoundary:
    patient_id: str
    start: pd.Timestamp
    end: pd.Timestamp
    train_end: pd.Timestamp
    validation_start: pd.Timestamp
    test_start: pd.Timestamp
    workbook_count: int
    observed_rows: int
    training_rows: int
    testing_rows: int


@dataclass(frozen=True)
class WindowBatch:
    features: np.ndarray
    targets: np.ndarray
    last_glucose: np.ndarray
    patient_ids: np.ndarray
    timestamps: np.ndarray

    def __len__(self) -> int:
        return len(self.targets)


def normalize_column_name(value: object) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value).strip().lower()).strip("_")


def _find_timestamp_column(columns: list[object]) -> object:
    normalized = {normalize_column_name(column): column for column in columns}
    for name in ("date", "datetime", "timestamp", "time"):
        if name in normalized:
            return normalized[name]
    for column in columns:
        name = normalize_column_name(column)
        if "date" in name or "time" in name:
            return column
    raise ValueError(f"No date/time column found. Available columns: {columns}")


def _find_glucose_column(columns: list[object]) -> object:
    normalized = {normalize_column_name(column): column for column in columns}
    for name in normalized:
        if "cgm" in name:
            return normalized[name]
    for name in normalized:
        if "glucose" in name or name in {"bg", "bg_level"}:
            return normalized[name]
    raise ValueError(f"No CGM/glucose column found. Available columns: {columns}")


def _find_event_columns(columns: list[object]) -> tuple[list[object], list[object]]:
    meal_columns = [
        column
        for column in columns
        if any(keyword in str(column).lower() for keyword in MEAL_KEYWORDS)
    ]
    insulin_columns = [
        column
        for column in columns
        if any(keyword in normalize_column_name(column) for keyword in INSULIN_KEYWORDS)
        and "non_insulin" not in normalize_column_name(column)
    ]

    english_meal = next(
        (column for column in meal_columns if normalize_column_name(column) == "dietary_intake"),
        None,
    )
    translated_meal = next(
        (column for column in meal_columns if any(token in str(column) for token in ("\u996e\u98df", "\u8fdb\u98df"))),
        None,
    )
    if english_meal is not None and translated_meal is not None:
        meal_columns = [column for column in meal_columns if column != translated_meal]
    return meal_columns, insulin_columns


def _parse_event_value(value: object, *, meal: bool) -> float:
    if pd.isna(value):
        return 0.0
    if isinstance(value, (int, float, np.number)):
        return float(value)
    text = str(value).replace(",", "").strip()
    if not text:
        return 0.0

    if meal:
        amounts = re.findall(
            r"(\d+(?:\.\d+)?)\s*(?:g\b|grams?\b|\u514b)",
            text,
            flags=re.IGNORECASE,
        )
        if amounts:
            return float(sum(map(float, amounts)))
    else:
        amounts = re.findall(
            r"(\d+(?:\.\d+)?)\s*(?:iu(?:\s*/\s*h)?|units?|u)\b",
            text,
            flags=re.IGNORECASE,
        )
        if amounts:
            return float(sum(map(float, amounts)))

    if re.fullmatch(r"[-+]?\d+(?:\.\d+)?", text):
        return float(text)
    return 0.0


def _parse_glucose(series: pd.Series) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce").to_numpy(
        dtype=np.float64,
        na_value=np.nan,
    ).copy()
    missing = np.isnan(numeric)
    if missing.any():
        extracted = (
            series.loc[missing]
            .astype("string")
            .str.replace(",", "", regex=False)
            .str.extract(r"([-+]?\d+(?:\.\d+)?)", expand=False)
        )
        numeric[missing] = pd.to_numeric(extracted, errors="coerce").to_numpy(
            dtype=np.float64,
            na_value=np.nan,
        )
    return pd.Series(numeric, index=series.index)


def _prepare_workbook(frame: pd.DataFrame, file_path: Path) -> pd.DataFrame:
    timestamp_column = _find_timestamp_column(list(frame.columns))
    glucose_column = _find_glucose_column(list(frame.columns))
    meal_columns, insulin_columns = _find_event_columns(list(frame.columns))

    prepared = pd.DataFrame(
        {
            "timestamp": pd.to_datetime(frame[timestamp_column], errors="coerce"),
            "glucose": _parse_glucose(frame[glucose_column]),
        }
    )
    prepared["meal"] = 0.0
    prepared["insulin"] = 0.0

    if meal_columns:
        meal_values = frame[meal_columns].copy()
        english_meal = next(
            (column for column in meal_columns if normalize_column_name(column) == "dietary_intake"),
            None,
        )
        translated_meal = next(
            (column for column in frame.columns if any(token in str(column) for token in ("\u996e\u98df", "\u8fdb\u98df"))),
            None,
        )
        if english_meal is not None and translated_meal is not None:
            meal_values[english_meal] = meal_values[english_meal].combine_first(
                frame[translated_meal]
            )
            meal_values = meal_values.drop(columns=[translated_meal], errors="ignore")
        for column in meal_values.columns:
            prepared["meal"] += meal_values[column].map(
                lambda value: _parse_event_value(value, meal=True)
            )

    for column in insulin_columns:
        prepared["insulin"] += frame[column].map(
            lambda value: _parse_event_value(value, meal=False)
        )

    prepared = prepared.dropna(subset=["timestamp", "glucose"]).copy()
    prepared = prepared.loc[np.isfinite(prepared["glucose"])].copy()
    if prepared.empty:
        raise ValueError(f"No timestamped CGM readings were found in '{file_path}'.")

    prepared = (
        prepared.groupby("timestamp", as_index=False)
        .agg(glucose=("glucose", "mean"), meal=("meal", "sum"), insulin=("insulin", "sum"))
        .sort_values("timestamp")
        .reset_index(drop=True)
    )
    prepared = _add_time_features(prepared)
    prepared["source_file"] = file_path.name
    return prepared


def _patient_id_from_path(file_path: Path) -> str:
    match = re.match(r"(\d+)", file_path.stem)
    if match is None:
        raise ValueError(
            f"Cannot identify a patient ID from '{file_path.name}'; "
            "expected a leading numeric patient ID."
        )
    return match.group(1)


def _record_id_from_path(file_path: Path) -> str:
    match = re.match(r"(\d+)(?:_(\d+))?", file_path.stem)
    if match is None:
        raise ValueError(
            f"Cannot identify a patient record ID from '{file_path.name}'; "
            "expected a leading numeric patient ID."
        )
    if match.group(2) is None:
        return match.group(1)
    return f"{match.group(1)}_{match.group(2)}"


def load_patient_timelines(data_dir: str | Path = DEFAULT_DATA_DIR) -> dict[str, pd.DataFrame]:
    data_path = Path(data_dir).expanduser().resolve()
    if not data_path.is_dir():
        raise FileNotFoundError(f"T2DM data directory does not exist: {data_path}")

    files = sorted(
        path
        for path in data_path.glob("*")
        if path.is_file()
        and path.suffix.lower() in {".xlsx", ".xls", ".xlsm"}
        and not path.name.startswith(("~$", "."))
    )
    if not files:
        raise FileNotFoundError(f"No Excel workbooks were found in {data_path}.")

    timelines: dict[str, pd.DataFrame] = {}
    for file_path in files:
        record_id = _record_id_from_path(file_path)
        if record_id in timelines:
            raise ValueError(
                f"Duplicate patient record ID '{record_id}' from '{file_path.name}'. "
                "Record IDs are built from the patient and record number in the filename."
            )
        try:
            workbook = pd.read_excel(file_path)
        except Exception as error:
            raise RuntimeError(f"Could not read workbook '{file_path}': {error}") from error
        prepared = _prepare_workbook(workbook, file_path)
        prepared = (
            prepared.groupby("timestamp", as_index=False)
            .agg(glucose=("glucose", "mean"), meal=("meal", "sum"), insulin=("insulin", "sum"))
            .sort_values("timestamp")
            .reset_index(drop=True)
        )
        prepared = _add_time_features(prepared)
        prepared["patient_id"] = _patient_id_from_path(file_path)
        prepared["record_id"] = record_id
        prepared["source_file"] = file_path.name
        prepared["workbook_count"] = 1
        timelines[record_id] = prepared
    return timelines


def calculate_boundaries(
    timelines: dict[str, pd.DataFrame],
    *,
    train_fraction: float = 0.8,
) -> dict[str, TimelineBoundary]:
    if not 0.0 < train_fraction < 1.0:
        raise ValueError("train_fraction must be between 0 and 1.")

    boundaries: dict[str, TimelineBoundary] = {}
    for patient_id, frame in timelines.items():
        if frame.empty:
            raise ValueError(f"Patient {patient_id} has an empty timeline.")
        timestamps = pd.to_datetime(frame["timestamp"]).sort_values()
        start = pd.Timestamp(timestamps.iloc[0])
        end = pd.Timestamp(timestamps.iloc[-1])
        observed_row_count = len(timestamps)
        if observed_row_count <= 1:
            train_row_count = observed_row_count
            test_row_count = 0
            train_end = end + pd.Timedelta(nanoseconds=1)
        else:
            train_row_count = int(np.floor(observed_row_count * train_fraction))
            train_row_count = max(1, min(observed_row_count - 1, train_row_count))
            test_row_count = observed_row_count - train_row_count
            train_end = pd.Timestamp(timestamps.iloc[train_row_count])
        test_start = train_end
        if train_row_count <= 1:
            validation_start = train_end
        else:
            validation_row_count = int(np.floor(train_row_count * 0.8))
            validation_row_count = max(1, min(train_row_count, validation_row_count))
            validation_start = (
                pd.Timestamp(timestamps.iloc[validation_row_count])
                if validation_row_count < train_row_count
                else train_end
            )
        source_count = int(frame["workbook_count"].iloc[0]) if "workbook_count" in frame else 1
        boundaries[patient_id] = TimelineBoundary(
            patient_id=patient_id,
            start=start,
            end=end,
            train_end=train_end,
            validation_start=validation_start,
            test_start=test_start,
            workbook_count=source_count,
            observed_rows=observed_row_count,
            training_rows=train_row_count,
            testing_rows=test_row_count,
        )
    return boundaries


def _empty_window_batch(sequence_length: int) -> WindowBatch:
    return WindowBatch(
        features=np.empty((0, sequence_length, len(FEATURE_COLUMNS)), dtype=np.float32),
        targets=np.empty((0,), dtype=np.float32),
        last_glucose=np.empty((0,), dtype=np.float32),
        patient_ids=np.empty((0,), dtype=str),
        timestamps=np.empty((0,), dtype="datetime64[ns]"),
    )


def build_window_sets(
    timelines: dict[str, pd.DataFrame],
    boundaries: dict[str, TimelineBoundary],
    *,
    sequence_length: int = 24,
    training_stride: int = DEFAULT_TRAIN_WINDOW_STRIDE,
) -> dict[str, WindowBatch]:
    if sequence_length < 1:
        raise ValueError("sequence_length must be positive.")
    if training_stride < 1:
        raise ValueError("training_stride must be positive.")

    collected: dict[str, dict[str, list[Any]]] = {
        split_name: {
            "features": [],
            "targets": [],
            "last_glucose": [],
            "patient_ids": [],
            "timestamps": [],
        }
        for split_name in ("train", "validation", "test")
    }

    for patient_id, frame in timelines.items():
        boundary = boundaries[patient_id]
        timestamps = frame["timestamp"].to_numpy(dtype="datetime64[ns]")
        values = frame[list(FEATURE_COLUMNS)].to_numpy(dtype=np.float32)
        if len(frame) <= sequence_length:
            continue

        gap_positions = np.flatnonzero(
            np.diff(timestamps) > MAX_SEQUENCE_GAP.to_timedelta64()
        ) + 1
        run_edges = np.concatenate(([0], gap_positions, [len(frame)]))

        for run_start, run_end in zip(run_edges[:-1], run_edges[1:]):
            if run_end - run_start <= sequence_length:
                continue
            for target_index in range(run_start + sequence_length, run_end):
                target_time = pd.Timestamp(timestamps[target_index])
                if target_time < boundary.train_end:
                    split_name = (
                        "validation"
                        if target_time >= boundary.validation_start
                        else "train"
                    )
                elif target_time >= boundary.test_start:
                    split_name = "test"
                else:
                    continue
                if (
                    split_name != "test"
                    and (target_index - run_start - sequence_length) % training_stride != 0
                ):
                    continue

                sample = collected[split_name]
                history = values[target_index - sequence_length : target_index]
                sample["features"].append(history)
                sample["targets"].append(values[target_index, 0])
                sample["last_glucose"].append(history[-1, 0])
                sample["patient_ids"].append(patient_id)
                sample["timestamps"].append(target_time.to_datetime64())

    result: dict[str, WindowBatch] = {}
    for split_name, values in collected.items():
        if not values["targets"]:
            result[split_name] = _empty_window_batch(sequence_length)
            continue
        result[split_name] = WindowBatch(
            features=np.asarray(values["features"], dtype=np.float32),
            targets=np.asarray(values["targets"], dtype=np.float32),
            last_glucose=np.asarray(values["last_glucose"], dtype=np.float32),
            patient_ids=np.asarray(values["patient_ids"], dtype=str),
            timestamps=np.asarray(values["timestamps"], dtype="datetime64[ns]"),
        )
    return result


class GRUGlucoseForecaster(nn.Module):
    def __init__(
        self,
        input_dim: int,
        *,
        hidden_dim: int = 64,
        num_layers: int = 2,
        dropout: float = 0.15,
    ) -> None:
        super().__init__()
        if input_dim < 1 or hidden_dim < 1 or num_layers < 1:
            raise ValueError("Model dimensions and layer count must be positive.")
        self.gru = nn.GRU(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.head = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim // 2, 1),
        )

    def forward(self, history: torch.Tensor) -> torch.Tensor:
        encoded, _ = self.gru(history)
        return self.head(encoded[:, -1, :]).squeeze(-1)


def _fit_scalers(
    timelines: dict[str, pd.DataFrame],
    boundaries: dict[str, TimelineBoundary],
    training_batch: WindowBatch,
) -> tuple[np.ndarray, np.ndarray, float, float]:
    training_rows = [
        frame.loc[frame["timestamp"] < boundaries[patient_id].train_end, list(FEATURE_COLUMNS)]
        .to_numpy(dtype=np.float32)
        for patient_id, frame in timelines.items()
    ]
    training_rows = [values for values in training_rows if len(values)]
    if not training_rows or not len(training_batch):
        raise ValueError("No training rows/windows are available before the 80% split boundary.")

    feature_values = np.concatenate(training_rows, axis=0)
    feature_mean = feature_values.mean(axis=0)
    feature_scale = feature_values.std(axis=0)
    feature_scale[feature_scale < 1e-6] = 1.0
    training_deltas = training_batch.targets - training_batch.last_glucose
    delta_mean = float(training_deltas.mean())
    delta_scale = float(training_deltas.std())
    if delta_scale < 1e-6:
        delta_scale = 1.0
    return feature_mean, feature_scale, delta_mean, delta_scale


def _scaled_features(
    batch: WindowBatch,
    feature_mean: np.ndarray,
    feature_scale: np.ndarray,
) -> np.ndarray:
    return ((batch.features - feature_mean[None, None, :]) / feature_scale[None, None, :]).astype(
        np.float32
    )


def _predict_scaled(
    model: GRUGlucoseForecaster,
    features: np.ndarray,
    *,
    batch_size: int,
    device: torch.device,
) -> np.ndarray:
    model.eval()
    predictions: list[np.ndarray] = []
    with torch.no_grad():
        for start in range(0, len(features), batch_size):
            batch = torch.from_numpy(features[start : start + batch_size]).to(device)
            predictions.append(model(batch).cpu().numpy())
    return np.concatenate(predictions) if predictions else np.empty((0,), dtype=np.float32)


def _mae_rmse(actual: np.ndarray, predicted: np.ndarray) -> dict[str, float]:
    errors = actual.astype(np.float64) - predicted.astype(np.float64)
    return {
        "mae_mg_dl": float(np.mean(np.abs(errors))),
        "rmse_mg_dl": float(np.sqrt(np.mean(errors**2))),
    }


def predict_training_windows(
    model: GRUGlucoseForecaster,
    checkpoint: dict[str, Any],
    timelines: dict[str, pd.DataFrame],
    *,
    device_name: str = "cpu",
) -> pd.DataFrame:
    parameters = checkpoint.get("summary", {}).get("parameters", {})
    training_stride = int(
        parameters.get("training_window_stride", DEFAULT_TRAIN_WINDOW_STRIDE)
    )
    window_sets = build_window_sets(
        timelines,
        calculate_boundaries(timelines),
        sequence_length=int(checkpoint["sequence_length"]),
        training_stride=training_stride,
    )
    prediction_batches = [
        ("train", window_sets["train"]),
        ("validation", window_sets["validation"]),
    ]
    prediction_batches = [
        (split_name, batch) for split_name, batch in prediction_batches if len(batch)
    ]
    if not prediction_batches:
        return pd.DataFrame(
            columns=[
                "patient_id",
                "timestamp",
                "predicted_glucose_mg_dl",
                "split",
            ]
        )

    feature_mean = np.asarray(checkpoint["feature_mean"], dtype=np.float32)
    feature_scale = np.asarray(checkpoint["feature_scale"], dtype=np.float32)
    batch_size = int(parameters.get("batch_size", 128))
    device = torch.device(device_name)
    prediction_frames = []
    for split_name, batch in prediction_batches:
        scaled_features = _scaled_features(batch, feature_mean, feature_scale)
        predicted_deltas = _predict_scaled(
            model,
            scaled_features,
            batch_size=batch_size,
            device=device,
        )
        predicted_glucose = (
            predicted_deltas * float(checkpoint["target_delta_scale"])
            + float(checkpoint["target_delta_mean"])
            + batch.last_glucose
        )
        prediction_frames.append(
            pd.DataFrame(
                {
                    "patient_id": batch.patient_ids,
                    "timestamp": pd.to_datetime(batch.timestamps),
                    "predicted_glucose_mg_dl": predicted_glucose,
                    "split": split_name,
                }
            )
        )
    return pd.concat(prediction_frames, ignore_index=True)


def load_forecaster_checkpoint(
    checkpoint_path: str | Path,
    *,
    device_name: str = "cpu",
) -> tuple[GRUGlucoseForecaster, dict[str, Any]]:
    path = Path(checkpoint_path).expanduser().resolve()
    if not path.is_file():
        raise FileNotFoundError(
            f"Trained GRU checkpoint not found: {path}. "
            "Run `python -m models.training.t2dm.train_t2dm` first."
        )

    device = torch.device(device_name)
    try:
        checkpoint = torch.load(path, map_location=device, weights_only=False)
    except Exception:
        checkpoint = torch.load(path, map_location=device)

    # Normalize checkpoint keys for cross-version compatibility
    if "model_state_dict" not in checkpoint and "state_dict" in checkpoint:
        checkpoint["model_state_dict"] = checkpoint["state_dict"]
    if "feature_columns" not in checkpoint:
        checkpoint["feature_columns"] = list(FEATURE_COLUMNS)
    if "target_delta_mean" not in checkpoint and "delta_mean" in checkpoint:
        checkpoint["target_delta_mean"] = checkpoint["delta_mean"]
    if "target_delta_scale" not in checkpoint and "delta_scale" in checkpoint:
        checkpoint["target_delta_scale"] = checkpoint["delta_scale"]
    if "model_config" not in checkpoint:
        checkpoint["model_config"] = {
            "input_dim": len(FEATURE_COLUMNS),
            "hidden_dim": int(checkpoint.get("hidden_dim", 64)),
            "num_layers": 2,
            "dropout": 0.15,
        }
    if list(checkpoint.get("feature_columns", ())) != list(FEATURE_COLUMNS):
        raise ValueError("Checkpoint feature columns do not match the T2DM pipeline.")
    config = checkpoint.get("model_config", {})
    model = GRUGlucoseForecaster(
        input_dim=int(config.get("input_dim", len(FEATURE_COLUMNS))),
        hidden_dim=int(config.get("hidden_dim", 64)),
        num_layers=int(config.get("num_layers", 2)),
        dropout=float(config.get("dropout", 0.15)),
    ).to(device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()
    return model, checkpoint


def forecast_from_history(
    model: GRUGlucoseForecaster,
    checkpoint: dict[str, Any],
    history_frame: pd.DataFrame,
    *,
    horizon_steps: int,
    device_name: str = "cpu",
    meal_schedule: dict[pd.Timestamp, float] | None = None,
    insulin_schedule: dict[pd.Timestamp, float] | None = None,
) -> pd.DataFrame:
    if horizon_steps < 1:
        raise ValueError("horizon_steps must be positive.")
    sequence_length = int(checkpoint["sequence_length"])
    if len(history_frame) < sequence_length:
        raise ValueError(
            f"At least {sequence_length} consecutive CGM readings are required; "
            f"received {len(history_frame)}."
        )
    if "timestamp" not in history_frame.columns:
        raise ValueError("history_frame must contain a timestamp column.")

    history = history_frame.sort_values("timestamp").tail(sequence_length).copy()
    timestamps = pd.to_datetime(history["timestamp"], errors="coerce")
    if timestamps.isna().any():
        raise ValueError("History timestamps contain invalid values.")
    if timestamps.diff().iloc[1:].gt(MAX_SEQUENCE_GAP).any():
        raise ValueError("History contains a gap over 22.5 minutes; select a continuous segment.")
    missing_columns = sorted(set(FEATURE_COLUMNS) - set(history.columns))
    if missing_columns:
        raise ValueError(f"History is missing model features: {missing_columns}")

    feature_mean = np.asarray(checkpoint["feature_mean"], dtype=np.float32)
    feature_scale = np.asarray(checkpoint["feature_scale"], dtype=np.float32)
    delta_mean = float(checkpoint["target_delta_mean"])
    delta_scale = float(checkpoint["target_delta_scale"])
    if feature_mean.shape != (len(FEATURE_COLUMNS),) or feature_scale.shape != (
        len(FEATURE_COLUMNS),
    ):
        raise ValueError("Checkpoint feature scaling dimensions do not match the feature schema.")
    if not np.all(np.isfinite(feature_mean)) or not np.all(np.isfinite(feature_scale)):
        raise ValueError("Checkpoint contains invalid feature scaling values.")

    device = torch.device(device_name)
    window = history[list(FEATURE_COLUMNS)].to_numpy(dtype=np.float32)
    feature_index = {column: index for index, column in enumerate(FEATURE_COLUMNS)}
    latest_timestamp = pd.Timestamp(timestamps.iloc[-1])
    current_glucose = float(window[-1, 0])
    forecast_rows = []
    normalized_meal_schedule = {
        pd.Timestamp(event_time): float(amount)
        for event_time, amount in (meal_schedule or {}).items()
    }
    normalized_insulin_schedule = {
        pd.Timestamp(event_time): float(amount)
        for event_time, amount in (insulin_schedule or {}).items()
    }
    if any(amount < 0 for amount in (*normalized_meal_schedule.values(), *normalized_insulin_schedule.values())):
        raise ValueError("Meal and insulin scenario amounts cannot be negative.")
    model.eval()
    for step in range(1, horizon_steps + 1):
        next_timestamp = latest_timestamp + step * SAMPLE_INTERVAL
        hour = next_timestamp.hour + next_timestamp.minute / 60.0
        meal_amount = normalized_meal_schedule.get(next_timestamp, 0.0)
        insulin_amount = normalized_insulin_schedule.get(next_timestamp, 0.0)
        recent_timestamps = list(pd.to_datetime(timestamps.iloc[-sequence_length:])) + [
            next_timestamp
        ]
        recent_meals = np.concatenate(
            (
                window[:, feature_index["meal"]],
                np.asarray([meal_amount], dtype=np.float32),
            )
        )
        recent_insulin = np.concatenate(
            (
                window[:, feature_index["insulin"]],
                np.asarray([insulin_amount], dtype=np.float32),
            )
        )
        recent_frame = pd.DataFrame(
            {
                "timestamp": recent_timestamps,
                "meal": recent_meals,
                "insulin": recent_insulin,
            }
        )
        meal_recent_1h = float(
            recent_frame.loc[
                recent_frame["timestamp"] >= next_timestamp - pd.Timedelta(hours=1),
                "meal",
            ].sum()
        )
        meal_recent_3h = float(
            recent_frame.loc[
                recent_frame["timestamp"] >= next_timestamp - pd.Timedelta(hours=3),
                "meal",
            ].sum()
        )
        insulin_recent_1h = float(
            recent_frame.loc[
                recent_frame["timestamp"] >= next_timestamp - pd.Timedelta(hours=1),
                "insulin",
            ].sum()
        )
        insulin_recent_3h = float(
            recent_frame.loc[
                recent_frame["timestamp"] >= next_timestamp - pd.Timedelta(hours=3),
                "insulin",
            ].sum()
        )
        next_feature = np.asarray(
            [
                current_glucose,
                meal_amount,
                insulin_amount,
                meal_recent_1h,
                meal_recent_3h,
                insulin_recent_1h,
                insulin_recent_3h,
                np.sin(2 * np.pi * hour / 24.0),
                np.cos(2 * np.pi * hour / 24.0),
            ],
            dtype=np.float32,
        )
        scaled_window = (window - feature_mean[None, :]) / feature_scale[None, :]
        with torch.no_grad():
            scaled_delta = float(
                model(torch.from_numpy(scaled_window[None, :, :]).to(device)).cpu().item()
            )
        predicted_glucose = current_glucose + scaled_delta * delta_scale + delta_mean
        forecast_rows.append(
            {
                "timestamp": next_timestamp,
                "predicted_glucose_mg_dl": predicted_glucose,
                "persistence_baseline_mg_dl": current_glucose,
                "meal_input": meal_amount,
                "insulin_input": insulin_amount,
                "meal_recent_1h": meal_recent_1h,
                "meal_recent_3h": meal_recent_3h,
                "insulin_recent_1h": insulin_recent_1h,
                "insulin_recent_3h": insulin_recent_3h,
            }
        )
        current_glucose = predicted_glucose
        # The appended row is stamped at next_timestamp, so its glucose must be
        # the prediction for that timestamp, not the previous glucose value.
        next_feature[feature_index["glucose"]] = predicted_glucose
        window = np.concatenate((window[1:], next_feature[None, :]), axis=0)
        timestamps = pd.Series(recent_timestamps[1:])
    return pd.DataFrame(forecast_rows)


def _split_report(
    boundaries: dict[str, TimelineBoundary],
    window_sets: dict[str, WindowBatch],
) -> pd.DataFrame:
    rows = []
    for patient_id, boundary in boundaries.items():
        end = boundary.end
        rows.append(
            {
                "patient_id": patient_id,
                "workbooks": boundary.workbook_count,
                "timeline_start": boundary.start,
                "timeline_end": boundary.end,
                "train_target_end_exclusive": boundary.train_end,
                "validation_target_start": boundary.validation_start,
                "test_target_start": boundary.test_start,
                "observed_span_days": (end - boundary.start).total_seconds() / 86400.0,
                "observed_rows": boundary.observed_rows,
                "training_rows": boundary.training_rows,
                "testing_rows": boundary.testing_rows,
                "train_windows": int(
                    np.sum(window_sets["train"].patient_ids == patient_id)
                ),
                "validation_windows": int(
                    np.sum(window_sets["validation"].patient_ids == patient_id)
                ),
                "test_windows": int(
                    np.sum(window_sets["test"].patient_ids == patient_id)
                ),
            }
        )
    return pd.DataFrame(rows).sort_values("patient_id").reset_index(drop=True)


def train_and_evaluate(
    *,
    data_dir: str | Path = DEFAULT_DATA_DIR,
    output_dir: str | Path = DEFAULT_OUTPUT_DIR,
    epochs: int = 30,
    batch_size: int = 128,
    sequence_length: int = 24,
    hidden_dim: int = 64,
    learning_rate: float = 1e-3,
    training_stride: int = DEFAULT_TRAIN_WINDOW_STRIDE,
    seed: int = 2026,
    device_name: str | None = None,
) -> dict[str, Any]:
    if epochs < 1 or batch_size < 1 or sequence_length < 1:
        raise ValueError("epochs, batch_size, and sequence_length must be positive.")
    if learning_rate <= 0:
        raise ValueError("learning_rate must be positive.")
    if training_stride < 1:
        raise ValueError("training_stride must be positive.")

    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.set_num_threads(max(1, min(8, torch.get_num_threads())))
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    device = torch.device(
        device_name if device_name else ("cuda" if torch.cuda.is_available() else "cpu")
    )

    timelines = load_patient_timelines(data_dir)
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
        raise ValueError("No training windows were created; check data coverage and lookback.")
    if not len(test_batch):
        raise ValueError(
            "No test windows were created from the final 20% of ordered records. "
            "No test score was produced."
        )

    feature_mean, feature_scale, delta_mean, delta_scale = _fit_scalers(
        timelines,
        boundaries,
        train_batch,
    )
    train_features = _scaled_features(train_batch, feature_mean, feature_scale)
    validation_features = _scaled_features(
        validation_batch,
        feature_mean,
        feature_scale,
    )
    test_features = _scaled_features(test_batch, feature_mean, feature_scale)
    train_targets = (
        (
            train_batch.targets
            - train_batch.last_glucose
            - delta_mean
        )
        / delta_scale
    ).astype(np.float32)
    validation_targets = (
        (
            validation_batch.targets
            - validation_batch.last_glucose
            - delta_mean
        )
        / delta_scale
    ).astype(np.float32)

    generator = torch.Generator().manual_seed(seed)
    train_loader = DataLoader(
        TensorDataset(
            torch.from_numpy(train_features),
            torch.from_numpy(train_targets),
        ),
        batch_size=batch_size,
        shuffle=True,
        generator=generator,
    )
    validation_loader = None
    if len(validation_batch):
        validation_loader = DataLoader(
            TensorDataset(
                torch.from_numpy(validation_features),
                torch.from_numpy(validation_targets),
            ),
            batch_size=batch_size,
            shuffle=False,
        )

    model = GRUGlucoseForecaster(
        len(FEATURE_COLUMNS),
        hidden_dim=hidden_dim,
    ).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=1e-4)
    criterion = nn.MSELoss()
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer,
        mode="min",
        factor=0.5,
        patience=3,
        min_lr=1e-5,
    )
    history: list[dict[str, float]] = []
    best_state: dict[str, torch.Tensor] | None = None
    best_validation_mae = float("inf")
    best_training_loss = float("inf")
    patience = 7
    epochs_without_improvement = 0

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        item_count = 0
        for feature_batch, target_batch in train_loader:
            feature_batch = feature_batch.to(device)
            target_batch = target_batch.to(device)
            optimizer.zero_grad(set_to_none=True)
            predictions = model(feature_batch)
            loss = criterion(predictions, target_batch)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            total_loss += float(loss.item()) * len(feature_batch)
            item_count += len(feature_batch)

        train_loss = total_loss / item_count
        epoch_metrics = {"epoch": float(epoch), "train_loss": train_loss}
        if validation_loader is not None:
            validation_scaled = _predict_scaled(
                model,
                validation_features,
                batch_size=batch_size,
                device=device,
            )
            validation_predicted = (
                validation_scaled * delta_scale
                + delta_mean
                + validation_batch.last_glucose
            )
            validation_metrics = _mae_rmse(
                validation_batch.targets,
                validation_predicted,
            )
            epoch_metrics["validation_mae_mg_dl"] = validation_metrics["mae_mg_dl"]
            scheduler.step(validation_metrics["mae_mg_dl"])
            if validation_metrics["mae_mg_dl"] < best_validation_mae:
                best_validation_mae = validation_metrics["mae_mg_dl"]
                best_state = {
                    name: tensor.detach().cpu().clone()
                    for name, tensor in model.state_dict().items()
                }
                epochs_without_improvement = 0
            else:
                epochs_without_improvement += 1
        else:
            scheduler.step(train_loss)
            if train_loss < best_training_loss:
                best_training_loss = train_loss
                best_state = {
                    name: tensor.detach().cpu().clone()
                    for name, tensor in model.state_dict().items()
                }
                epochs_without_improvement = 0
            else:
                epochs_without_improvement += 1

        history.append(epoch_metrics)
        print(
            f"Epoch {epoch:02d}/{epochs} | train_loss={train_loss:.5f}"
            + (
                f" | validation_MAE={epoch_metrics['validation_mae_mg_dl']:.2f} mg/dL"
                if "validation_mae_mg_dl" in epoch_metrics
                else ""
            )
        )
        if epochs_without_improvement >= patience:
            print(f"Early stopping after epoch {epoch}; the final test set remains untouched.")
            break

    if best_state is None:
        raise RuntimeError("Training did not produce a model checkpoint.")
    model.load_state_dict(best_state)
    model.to(device)

    test_scaled = _predict_scaled(
        model,
        test_features,
        batch_size=batch_size,
        device=device,
    )
    test_predictions = test_scaled * delta_scale + delta_mean + test_batch.last_glucose
    test_metrics = _mae_rmse(test_batch.targets, test_predictions)
    baseline_metrics = _mae_rmse(test_batch.targets, test_batch.last_glucose)
    test_metrics["persistence_baseline_mae_mg_dl"] = baseline_metrics["mae_mg_dl"]
    test_metrics["persistence_baseline_rmse_mg_dl"] = baseline_metrics["rmse_mg_dl"]
    test_metrics["patients"] = int(len(np.unique(test_batch.patient_ids)))
    test_metrics["windows"] = int(len(test_batch))

    output_path = Path(output_dir).expanduser().resolve()
    output_path.mkdir(parents=True, exist_ok=True)
    split_frame = _split_report(boundaries, window_sets)
    split_frame.to_csv(output_path / "timeline_splits.csv", index=False)

    prediction_frame = pd.DataFrame(
        {
            "patient_id": test_batch.patient_ids,
            "timestamp": pd.to_datetime(test_batch.timestamps),
            "actual_glucose_mg_dl": test_batch.targets,
            "predicted_glucose_mg_dl": test_predictions,
            "persistence_baseline_mg_dl": test_batch.last_glucose,
        }
    )
    prediction_frame.to_csv(output_path / "test_predictions.csv", index=False)

    summary: dict[str, Any] = {
        "model": "PyTorch GRU",
        "target": "next 15-minute CGM glucose value (mg/dL)",
        "output_representation": "predicted change from the most recent glucose input",
        "evaluation": "rolling one-step-ahead windows over held-out timeline rows",
        "split": {
            "unit": "patient record workbook; repeated patient IDs are split and trained separately",
            "training": "first 80% of each record's ordered rows",
            "testing": "remaining final 20% of each record's ordered rows",
            "validation": "last 20% of each record's available training-period windows",
            "short_timelines": (
                "Use each record's chronological 80/20 ordered-row split; very short "
                "or sparse records may still have few or no usable windows after lookback "
                "and gap checks."
            ),
            "sequence_gap_limit_minutes": MAX_SEQUENCE_GAP.total_seconds() / 60,
            "workbooks": int(sum(boundary.workbook_count for boundary in boundaries.values())),
            "patients": int(len(timelines)),
            "training_windows": int(len(train_batch)),
            "validation_windows": int(len(validation_batch)),
            "testing_windows": int(len(test_batch)),
        },
        "test_metrics": test_metrics,
        "parameters": {
            "epochs_requested": epochs,
            "epochs_completed": len(history),
            "batch_size": batch_size,
            "sequence_length": sequence_length,
            "lookback_minutes": sequence_length * 15,
            "hidden_dim": hidden_dim,
            "learning_rate": learning_rate,
            "training_window_stride": training_stride,
            "test_window_stride": 1,
            "seed": seed,
            "device": str(device),
            "feature_columns": list(FEATURE_COLUMNS),
        },
        "history": history,
    }
    (output_path / "metrics.json").write_text(
        json.dumps(summary, indent=2),
        encoding="utf-8",
    )
    checkpoint = {
        "model_state_dict": model.cpu().state_dict(),
        "model_config": {
            "input_dim": len(FEATURE_COLUMNS),
            "hidden_dim": hidden_dim,
            "num_layers": 2,
            "dropout": 0.15,
        },
        "feature_columns": list(FEATURE_COLUMNS),
        "sequence_length": sequence_length,
        "feature_mean": feature_mean.tolist(),
        "feature_scale": feature_scale.tolist(),
        "target_delta_mean": delta_mean,
        "target_delta_scale": delta_scale,
        "summary": summary,
    }
    torch.save(checkpoint, output_path / "gru_t2dm_forecaster.pt")
    weights_dir = PROJECT_ROOT / "models" / "weights"
    weights_dir.mkdir(parents=True, exist_ok=True)
    torch.save(checkpoint, weights_dir / "gru_t2dm_forecaster.pt")
    return summary
