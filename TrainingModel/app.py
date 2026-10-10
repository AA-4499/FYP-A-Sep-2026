from __future__ import annotations

import sys
from datetime import time, timedelta
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st
import torch

PROJECT_DIR = Path(__file__).resolve().parent
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

from FYP_A_new.t2dm_pipeline import (
    DEFAULT_DATA_DIR,
    DEFAULT_OUTPUT_DIR,
    FEATURE_COLUMNS,
    MAX_SEQUENCE_GAP,
    forecast_from_history,
    load_forecaster_checkpoint,
    load_patient_timelines,
    next_scheduled_timestamp,
    predict_training_windows,
)


PROJECT_DIR = Path(__file__).resolve().parent
DATA_DIR = PROJECT_DIR / "data" / "Shanghai_T2DM"
if not DATA_DIR.exists() and (PROJECT_DIR.parent / "data" / "Shanghai_T2DM").exists():
    DATA_DIR = PROJECT_DIR.parent / "data" / "Shanghai_T2DM"
CHECKPOINT_PATH = DEFAULT_OUTPUT_DIR / "gru_t2dm_forecaster.pt"
TEST_PREDICTIONS_PATH = DEFAULT_OUTPUT_DIR / "test_predictions.csv"


def default_scenario_time(forecast_start: pd.Timestamp, minutes_ahead: int) -> time:
    return (forecast_start + timedelta(minutes=minutes_ahead)).time().replace(
        second=0,
        microsecond=0,
    )


RISK_LINES = (
    (70, "Dangerous low", "#c2410c"),
    (140, "Healthy upper", "#16a34a"),
    (180, "Low risk upper", "#ca8a04"),
    (250, "High risk upper", "#dc2626"),
)


def add_glucose_risk_lines(chart: go.Figure) -> None:
    for glucose, label, color in RISK_LINES:
        chart.add_hline(
            y=glucose,
            line_width=1,
            line_dash="dot",
            line_color=color,
            annotation_text=f"{label}: {glucose} mg/dL",
            annotation_position="top left",
            annotation_font_size=11,
            annotation_font_color=color,
        )


st.set_page_config(
    page_title="Shanghai T2DM CGM Forecast",
    page_icon="🩸",
    layout="wide",
)
st.title("Shanghai T2DM CGM Forecast")
st.caption(
    "Single-model app using the chronological GRU in FYP_A_new. "
    "Research and education only; not for diagnosis, treatment, or insulin dosing."
)


@st.cache_data(show_spinner="Reading Shanghai T2DM workbooks...")
def cached_patient_timelines(data_dir: str) -> dict[str, pd.DataFrame]:
    return load_patient_timelines(data_dir)


@st.cache_data(show_spinner="Loading held-out test predictions...")
def cached_test_predictions(
    predictions_path: str,
    predictions_modified_ns: int,
) -> pd.DataFrame:
    del predictions_modified_ns
    predictions = pd.read_csv(predictions_path)
    required_columns = {
        "patient_id",
        "timestamp",
        "actual_glucose_mg_dl",
        "predicted_glucose_mg_dl",
    }
    missing_columns = required_columns.difference(predictions.columns)
    if missing_columns:
        raise ValueError(
            "Test predictions are missing required columns: "
            + ", ".join(sorted(missing_columns))
        )
    predictions["timestamp"] = pd.to_datetime(predictions["timestamp"], errors="raise")
    predictions["patient_id"] = predictions["patient_id"].astype(str)
    return predictions


@st.cache_data(show_spinner="Preparing training-period predictions...")
def cached_training_predictions(
    checkpoint_modified_ns: int,
    device_name: str,
    timelines: dict[str, pd.DataFrame],
    _model: torch.nn.Module,
    _checkpoint: dict,
) -> pd.DataFrame:
    del checkpoint_modified_ns
    return predict_training_windows(
        model=_model,
        checkpoint=_checkpoint,
        timelines=timelines,
        device_name=device_name,
    )


@st.cache_resource(show_spinner="Loading the FYP_A_new GRU checkpoint...")
def cached_forecaster(
    checkpoint_path: str,
    checkpoint_modified_ns: int,
    device_name: str,
) -> tuple[torch.nn.Module, dict]:
    del checkpoint_modified_ns
    return load_forecaster_checkpoint(checkpoint_path, device_name=device_name)


if not DATA_DIR.is_dir():
    st.error(
        f"Shanghai T2DM data folder was not found at `{DATA_DIR}`. "
        f"The model's default data path is `{DEFAULT_DATA_DIR}`."
    )
    st.stop()

try:
    patient_timelines = cached_patient_timelines(str(DATA_DIR))
except Exception as error:
    st.error(f"Could not read the Shanghai T2DM data folder: {error}")
    st.stop()

workbook_count = len(
    [
        path
        for path in DATA_DIR.glob("*")
        if path.is_file()
        and path.suffix.lower() in {".xlsx", ".xls", ".xlsm"}
        and not path.name.startswith(("~$", "."))
    ]
)
st.success(
    f"Found `{DATA_DIR}`: loaded {len(patient_timelines)} patient record timelines "
    f"from {workbook_count} Excel workbooks."
)

if not CHECKPOINT_PATH.is_file():
    st.warning(
        "The FYP_A_new checkpoint has not been created yet. Train the model from "
        "the project root, then refresh this page:"
    )
    st.code(
        r".\.venv\Scripts\python.exe -m FYP_A_new.train_t2dm",
        language="powershell",
    )
    st.stop()

if not TEST_PREDICTIONS_PATH.is_file():
    st.error(
        "The held-out test predictions are missing. Retrain the FYP_A_new model "
        "to create `FYP_A_new\\outputs\\test_predictions.csv`."
    )
    st.stop()

try:
    test_predictions = cached_test_predictions(
        str(TEST_PREDICTIONS_PATH),
        TEST_PREDICTIONS_PATH.stat().st_mtime_ns,
    )
except Exception as error:
    st.error(f"Could not load held-out test predictions: {error}")
    st.stop()

device_name = "cuda" if torch.cuda.is_available() else "cpu"
try:
    model, checkpoint = cached_forecaster(
        str(CHECKPOINT_PATH),
        CHECKPOINT_PATH.stat().st_mtime_ns,
        device_name,
    )
except Exception as error:
    st.error(f"Could not load the FYP_A_new GRU checkpoint: {error}")
    st.stop()

sequence_length = int(checkpoint["sequence_length"])

with st.sidebar:
    st.header("Forecast settings")
    patient_id = st.selectbox(
        "Patient record timeline",
        options=sorted(patient_timelines),
        format_func=lambda value: f"Patient record {value}",
    )
    horizon_label = st.selectbox("Forecast horizon", ["3 hours", "6 hours", "12 hours"])
    horizon_steps = {"3 hours": 12, "6 hours": 24, "12 hours": 48}[horizon_label]
    st.caption(
        f"Model lookback: {sequence_length} readings "
        f"({sequence_length * 15 // 60} hours)."
    )

timeline = patient_timelines[patient_id].sort_values("timestamp").reset_index(drop=True)
patient_test_predictions = (
    test_predictions.loc[test_predictions["patient_id"] == str(patient_id)]
    .sort_values("timestamp")
    .reset_index(drop=True)
)
try:
    training_predictions = cached_training_predictions(
        CHECKPOINT_PATH.stat().st_mtime_ns,
        device_name,
        patient_timelines,
        model,
        checkpoint,
    )
except Exception as error:
    st.error(f"Could not create training-period predictions: {error}")
    st.stop()
patient_training_predictions = (
    training_predictions.loc[training_predictions["patient_id"] == str(patient_id)]
    .sort_values("timestamp")
    .reset_index(drop=True)
)
if "split" in patient_training_predictions.columns:
    patient_validation_predictions = patient_training_predictions.loc[
        patient_training_predictions["split"] == "validation"
    ].reset_index(drop=True)
    patient_training_predictions = patient_training_predictions.loc[
        patient_training_predictions["split"] == "train"
    ].reset_index(drop=True)
else:
    patient_validation_predictions = pd.DataFrame(columns=patient_training_predictions.columns)
gap_locations = [
    index
    for index, gap in enumerate(timeline["timestamp"].diff())
    if pd.notna(gap) and gap > MAX_SEQUENCE_GAP
]
latest_run_start = gap_locations[-1] if gap_locations else 0
continuous_history = timeline.iloc[latest_run_start:].reset_index(drop=True)
if len(continuous_history) < sequence_length:
    st.error(
        f"Patient record {patient_id} has only {len(continuous_history)} consecutive readings "
        f"in the latest data segment. At least {sequence_length} are required for a forecast."
    )
    st.stop()

history = continuous_history.tail(sequence_length).copy()
if history[list(FEATURE_COLUMNS)].isna().any().any():
    st.error("The selected patient's latest model input window contains missing features.")
    st.stop()

start_time = pd.Timestamp(history["timestamp"].iloc[-1])
try:
    normal_forecast = forecast_from_history(
        model,
        checkpoint,
        history,
        horizon_steps=horizon_steps,
        device_name=device_name,
    )
except Exception as error:
    st.error(f"Forecast could not be generated: {error}")
    st.stop()

forecast_area, scenario_area = st.columns([2.35, 1], gap="large")
with scenario_area:
    with st.container(border=True):
        st.subheader("What-if simulator")
        st.caption(
            "Add hypothetical meal/insulin events and compare their modelled "
            "effect with the normal forecast."
        )
        include_meal = st.checkbox("Include a meal", value=False)
        meal_time = st.time_input(
            "Meal time",
            value=default_scenario_time(start_time, 60),
            step=timedelta(minutes=15),
            disabled=not include_meal,
            key="scenario_meal_time",
        )
        meal_amount = st.number_input(
            "Meal amount (recorded food mass, g)",
            min_value=0.0,
            value=60.0,
            step=5.0,
            disabled=not include_meal,
            help="The model feature is recorded food mass, not a carbohydrate count.",
        )
        include_insulin = st.checkbox("Include an insulin event", value=False)
        insulin_time = st.time_input(
            "Insulin time",
            value=default_scenario_time(start_time, 120),
            step=timedelta(minutes=15),
            disabled=not include_insulin,
            key="scenario_insulin_time",
        )
        insulin_amount = st.number_input(
            "Insulin amount (units)",
            min_value=0.0,
            value=2.0,
            step=0.5,
            disabled=not include_insulin,
            help="Scenario input only; this does not recommend an insulin dose.",
        )
        st.caption(
            "Simulation only. It assumes entered events occur exactly as scheduled "
            "and is not medical or dosing advice."
        )

meal_schedule: dict[pd.Timestamp, float] = {}
insulin_schedule: dict[pd.Timestamp, float] = {}
if include_meal and meal_amount > 0:
    meal_schedule[next_scheduled_timestamp(start_time, meal_time)] = float(meal_amount)
if include_insulin and insulin_amount > 0:
    insulin_schedule[next_scheduled_timestamp(start_time, insulin_time)] = float(insulin_amount)

scenario_enabled = bool(meal_schedule or insulin_schedule)
scenario_forecast = None
if scenario_enabled:
    try:
        scenario_forecast = forecast_from_history(
            model,
            checkpoint,
            history,
            horizon_steps=horizon_steps,
            device_name=device_name,
            meal_schedule=meal_schedule,
            insulin_schedule=insulin_schedule,
        )
    except Exception as error:
        st.error(f"What-if forecast could not be generated: {error}")
        st.stop()

forecast_end = start_time + horizon_steps * pd.Timedelta(minutes=15)
scenario_events = [
    ("Meal", event_time)
    for event_time in meal_schedule
] + [
    ("Insulin", event_time)
    for event_time in insulin_schedule
]
for event_name, event_time in scenario_events:
    if event_time >= forecast_end:
        timing_note = (
            "is at the final forecast step, so it cannot affect the displayed "
            "forecast."
            if event_time == forecast_end
            else f"is outside this {horizon_label} forecast, so it will not affect "
            "the displayed scenario."
        )
        with scenario_area:
            st.warning(
                f"The scheduled {event_name.lower()} at {event_time:%Y-%m-%d %H:%M} "
                f"{timing_note}"
            )

latest_glucose = float(history["glucose"].iloc[-1])
normal_end_glucose = float(normal_forecast["predicted_glucose_mg_dl"].iloc[-1])
displayed_forecast = scenario_forecast if scenario_forecast is not None else normal_forecast
simulation_end_glucose = float(displayed_forecast["predicted_glucose_mg_dl"].iloc[-1])
simulation_delta_end = simulation_end_glucose - normal_end_glucose
test_mae = (
    float(
        (
            patient_test_predictions["actual_glucose_mg_dl"]
            - patient_test_predictions["predicted_glucose_mg_dl"]
        )
        .abs()
        .mean()
    )
    if not patient_test_predictions.empty
    else None
)
with forecast_area:
    metric_columns = st.columns(5)
    metric_columns[0].metric("Patient record", patient_id)
    metric_columns[1].metric("Latest observed CGM", f"{latest_glucose:.1f} mg/dL")
    metric_columns[2].metric(
        "Held-out test MAE",
        f"{test_mae:.1f} mg/dL" if test_mae is not None else "Unavailable",
    )
    metric_columns[3].metric(
        "Simulation after " + horizon_label,
        f"{simulation_end_glucose:.1f} mg/dL",
    )
    metric_columns[4].metric(
        "What-if change",
        f"{simulation_delta_end:+.1f} mg/dL" if scenario_enabled else "No event",
    )

    chart = go.Figure()
    chart.add_trace(
        go.Scatter(
            x=patient_training_predictions["timestamp"],
            y=patient_training_predictions["predicted_glucose_mg_dl"],
            mode="lines",
            name="Training prediction",
            line={"color": "#53b5a8", "width": 2},
        )
    )
    if not patient_validation_predictions.empty:
        chart.add_trace(
            go.Scatter(
                x=patient_validation_predictions["timestamp"],
                y=patient_validation_predictions["predicted_glucose_mg_dl"],
                mode="lines",
                name="Validation prediction",
                line={"color": "#f59e0b", "width": 2},
            )
        )
    if not patient_test_predictions.empty:
        chart.add_trace(
            go.Scatter(
                x=patient_test_predictions["timestamp"],
                y=patient_test_predictions["predicted_glucose_mg_dl"],
                mode="lines",
                name="Testing prediction (held-out)",
                line={"color": "#596caa", "width": 2},
            )
        )
        chart.add_trace(
            go.Scatter(
                x=patient_test_predictions["timestamp"],
                y=patient_test_predictions["actual_glucose_mg_dl"],
                mode="lines",
                name="Real testing CGM",
                line={"color": "#8b5cf6", "width": 2},
            )
        )
    else:
        st.warning(
            f"Patient record {patient_id} has no held-out test windows, so a testing "
            "prediction or real testing CGM line is unavailable for this timeline."
        )

    if not patient_test_predictions.empty:
        chart.update_xaxes(
            range=[
                min(
                    patient_test_predictions["timestamp"].min(),
                    min(
                        [
                            series.min()
                            for series in (
                                patient_training_predictions["timestamp"],
                                patient_validation_predictions["timestamp"],
                            )
                            if not series.empty
                        ]
                        or [patient_test_predictions["timestamp"].min()]
                    ),
                ),
                patient_test_predictions["timestamp"].max(),
            ]
        )
    add_glucose_risk_lines(chart)
    chart.update_layout(
        title=f"Training and held-out testing CGM for patient record {patient_id}",
        xaxis_title="Timestamp",
        yaxis_title="CGM (mg/dL)",
        hovermode="x unified",
        margin={"l": 10, "r": 10, "t": 50, "b": 30},
        height=520,
    )
    normal_simulation_timestamps = pd.concat(
        [
            pd.Series([start_time]),
            normal_forecast["timestamp"].reset_index(drop=True),
        ],
        ignore_index=True,
    )
    normal_simulation_glucose = pd.concat(
        [
            pd.Series([latest_glucose]),
            normal_forecast["predicted_glucose_mg_dl"].reset_index(drop=True),
        ],
        ignore_index=True,
    )
    simulation_chart = go.Figure()
    simulation_chart.add_trace(
        go.Scatter(
            x=normal_simulation_timestamps,
            y=normal_simulation_glucose,
            mode="lines+markers",
            name="Without what-if simulation",
            line={"color": "#2563eb", "width": 2},
        )
    )
    if scenario_forecast is not None:
        scenario_simulation_timestamps = pd.concat(
            [
                pd.Series([start_time]),
                scenario_forecast["timestamp"].reset_index(drop=True),
            ],
            ignore_index=True,
        )
        scenario_simulation_glucose = pd.concat(
            [
                pd.Series([latest_glucose]),
                scenario_forecast["predicted_glucose_mg_dl"].reset_index(drop=True),
            ],
            ignore_index=True,
        )
        simulation_chart.add_trace(
            go.Scatter(
                x=scenario_simulation_timestamps,
                y=scenario_simulation_glucose,
                mode="lines+markers",
                name="With what-if simulation",
                line={"color": "#e07a36", "width": 2, "dash": "dash"},
            )
        )
    add_glucose_risk_lines(simulation_chart)
    simulation_chart.update_layout(
        title=f"{horizon_label} simulation comparison for patient record {patient_id}",
        xaxis_title="Timestamp",
        yaxis_title="CGM (mg/dL)",
        hovermode="x unified",
        margin={"l": 10, "r": 10, "t": 50, "b": 30},
        height=460,
    )
    st.plotly_chart(simulation_chart, width="stretch")
    st.caption(
        "The simulation chart compares the normal no-event forecast with the "
        "meal/insulin what-if forecast when a what-if event is enabled. Meal "
        "and insulin effects are learned from sparse historical event records, "
        "not from a physiological dosing model."
    )
    st.plotly_chart(chart, width="stretch")
    st.caption(
        "Training and validation predictions show the GRU before the held-out "
        "test period. Testing prediction shows its rolling one-step-ahead "
        "estimates over the held-out test period; real testing CGM shows the "
        "actual readings from that same period. The horizontal lines mark "
        "glucose risk thresholds. This is a research simulation, not medical "
        "or dosing advice."
    )

with st.expander("Model and data details"):
    training = checkpoint.get("summary", {})
    st.write(
        {
            "Model": training.get("model", "PyTorch GRU"),
            "Training split": training.get("split", {}).get("training", "first 10 elapsed days"),
            "Test split": training.get("split", {}).get("testing", "final available up-to-4 days"),
            "Training workbooks": training.get("split", {}).get("workbooks"),
            "Training patients": training.get("split", {}).get("patients"),
            "Test metrics": training.get("test_metrics"),
        }
    )
