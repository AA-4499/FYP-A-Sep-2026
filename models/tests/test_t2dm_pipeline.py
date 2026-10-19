from __future__ import annotations

import tempfile
import unittest
from datetime import time
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch import nn

try:
    from models.training.t2dm.t2dm_pipeline import (
        FEATURE_COLUMNS,
        GRUGlucoseForecaster,
        build_window_sets,
        calculate_boundaries,
        forecast_from_history,
        load_forecaster_checkpoint,
        load_patient_timelines,
        next_scheduled_timestamp,
        predict_training_windows,
    )
except ImportError:
    from t2dm_pipeline import (
    FEATURE_COLUMNS,
    GRUGlucoseForecaster,
    build_window_sets,
    calculate_boundaries,
    forecast_from_history,
    load_forecaster_checkpoint,
    load_patient_timelines,
    next_scheduled_timestamp,
    predict_training_windows,
)


def make_timeline(start: str, periods: int) -> pd.DataFrame:
    timestamps = pd.date_range(start=start, periods=periods, freq="15min")
    values = np.arange(periods, dtype=np.float32)
    frame = pd.DataFrame(
        {
            "timestamp": timestamps,
            "glucose": values + 100.0,
            "meal": np.zeros(periods, dtype=np.float32),
            "insulin": np.zeros(periods, dtype=np.float32),
            "meal_recent_1h": np.zeros(periods, dtype=np.float32),
            "meal_recent_3h": np.zeros(periods, dtype=np.float32),
            "insulin_recent_1h": np.zeros(periods, dtype=np.float32),
            "insulin_recent_3h": np.zeros(periods, dtype=np.float32),
            "hour_sin": np.sin(2 * np.pi * (timestamps.hour / 24.0)),
            "hour_cos": np.cos(2 * np.pi * (timestamps.hour / 24.0)),
            "source_file": "synthetic.xlsx",
        }
    )
    assert list(frame[list(FEATURE_COLUMNS)].columns) == list(FEATURE_COLUMNS)
    return frame


class ChronologicalSplitTests(unittest.TestCase):
    def test_scheduled_time_aligns_to_patient_grid_across_midnight(self) -> None:
        self.assertEqual(
            next_scheduled_timestamp(
                pd.Timestamp("2024-01-01 12:24"),
                time(13, 24),
            ),
            pd.Timestamp("2024-01-01 13:24"),
        )
        self.assertEqual(
            next_scheduled_timestamp(
                pd.Timestamp("2024-01-01 23:50"),
                time(0, 6),
            ),
            pd.Timestamp("2024-01-02 00:20"),
        )

    def test_fourteen_day_timeline_uses_first_eighty_percent_of_rows_for_training(self) -> None:
        timeline = make_timeline("2024-01-01", 14 * 24 * 4)
        timelines = {"2000": timeline}
        boundaries = calculate_boundaries(timelines)
        windows = build_window_sets(timelines, boundaries, sequence_length=24)
        boundary = boundaries["2000"]
        expected_train_rows = int(len(timeline) * 0.8)

        self.assertGreater(len(windows["train"]), 0)
        self.assertGreater(len(windows["validation"]), 0)
        self.assertGreater(len(windows["test"]), 0)
        self.assertEqual(boundary.observed_rows, len(timeline))
        self.assertEqual(boundary.training_rows, expected_train_rows)
        self.assertEqual(boundary.testing_rows, len(timeline) - expected_train_rows)
        self.assertEqual(boundary.train_end, timeline["timestamp"].iloc[expected_train_rows])
        self.assertTrue(
            np.all(pd.to_datetime(windows["train"].timestamps) < boundary.train_end)
        )
        self.assertTrue(
            np.all(pd.to_datetime(windows["validation"].timestamps) < boundary.train_end)
        )
        self.assertTrue(
            np.all(pd.to_datetime(windows["test"].timestamps) >= boundary.test_start)
        )
        self.assertTrue(
            set(windows["train"].timestamps).isdisjoint(windows["test"].timestamps)
        )

    def test_training_predictions_only_cover_training_targets(self) -> None:
        timelines = {"2000": make_timeline("2024-01-01", 14 * 24 * 4 + 1)}
        model = GRUGlucoseForecaster(input_dim=len(FEATURE_COLUMNS), hidden_dim=4)
        checkpoint = {
            "sequence_length": 24,
            "feature_mean": [0.0] * len(FEATURE_COLUMNS),
            "feature_scale": [1.0] * len(FEATURE_COLUMNS),
            "target_delta_mean": 0.0,
            "target_delta_scale": 1.0,
            "summary": {
                "parameters": {
                    "training_window_stride": 4,
                    "batch_size": 32,
                }
            },
        }

        predictions = predict_training_windows(
            model,
            checkpoint,
            timelines,
            device_name="cpu",
        )
        boundary = calculate_boundaries(timelines)["2000"]

        self.assertGreater(len(predictions), 0)
        self.assertTrue((predictions["timestamp"] < boundary.train_end).all())
        self.assertEqual(predictions["patient_id"].unique().tolist(), ["2000"])
        self.assertEqual(set(predictions["split"].unique()), {"train", "validation"})
        self.assertTrue(
            (
                predictions.loc[predictions["split"] == "validation", "timestamp"]
                >= boundary.validation_start
            ).all()
        )
        self.assertTrue(np.isfinite(predictions["predicted_glucose_mg_dl"]).all())

    def test_short_timeline_uses_final_twenty_percent_for_testing(self) -> None:
        timeline = make_timeline("2024-01-01", 8 * 24 * 4)
        timelines = {"2000": timeline}
        boundaries = calculate_boundaries(timelines)
        windows = build_window_sets(timelines, boundaries, sequence_length=24)
        boundary = boundaries["2000"]
        expected_train_rows = int(len(timeline) * 0.8)

        self.assertGreater(len(windows["train"]) + len(windows["validation"]), 0)
        self.assertGreater(len(windows["test"]), 0)
        self.assertEqual(boundary.observed_rows, len(timeline))
        self.assertEqual(boundary.training_rows, expected_train_rows)
        self.assertEqual(boundary.testing_rows, len(timeline) - expected_train_rows)
        self.assertEqual(boundary.train_end, timeline["timestamp"].iloc[expected_train_rows])
        self.assertTrue(
            np.all(pd.to_datetime(windows["test"].timestamps) >= boundary.test_start)
        )

    def test_split_uses_next_available_record_after_sparse_gap(self) -> None:
        timeline = make_timeline("2024-01-01", 20)
        timeline.loc[16:, "timestamp"] += pd.Timedelta(days=3)
        boundaries = calculate_boundaries({"2000": timeline})
        boundary = boundaries["2000"]

        self.assertEqual(boundary.training_rows, 16)
        self.assertEqual(boundary.testing_rows, 4)
        self.assertEqual(boundary.train_end, timeline["timestamp"].iloc[16])
        self.assertEqual(boundary.test_start, timeline["timestamp"].iloc[16])

    def test_windows_do_not_cross_large_recording_gaps(self) -> None:
        timeline = make_timeline("2024-01-01", 16)
        timeline.loc[8:, "timestamp"] += pd.Timedelta(days=1)
        boundaries = calculate_boundaries({"2000": timeline})
        windows = build_window_sets(
            {"2000": timeline},
            boundaries,
            sequence_length=3,
        )
        target_times = np.concatenate(
            [
                windows["train"].timestamps,
                windows["validation"].timestamps,
                windows["test"].timestamps,
            ]
        )

        self.assertNotIn(timeline["timestamp"].iloc[8], target_times)
        self.assertNotIn(timeline["timestamp"].iloc[9], target_times)
        self.assertIn(timeline["timestamp"].iloc[11].to_datetime64(), target_times)

    def test_app_forecast_uses_checkpoint_scaling_and_returns_persistence(self) -> None:
        model = GRUGlucoseForecaster(input_dim=len(FEATURE_COLUMNS), hidden_dim=4)
        for parameter in model.parameters():
            parameter.data.zero_()
        checkpoint = {
            "sequence_length": 4,
            "feature_columns": list(FEATURE_COLUMNS),
            "feature_mean": [0.0] * len(FEATURE_COLUMNS),
            "feature_scale": [1.0] * len(FEATURE_COLUMNS),
            "target_delta_mean": 0.0,
            "target_delta_scale": 1.0,
        }
        history = make_timeline("2024-01-01", 4)
        forecast = forecast_from_history(
            model,
            checkpoint,
            history,
            horizon_steps=3,
            device_name="cpu",
        )

        self.assertEqual(len(forecast), 3)
        self.assertEqual(
            forecast["timestamp"].tolist(),
            list(pd.date_range("2024-01-01 01:00", periods=3, freq="15min")),
        )
        self.assertTrue(
            np.allclose(forecast["predicted_glucose_mg_dl"], history["glucose"].iloc[-1])
        )
        self.assertEqual(
            forecast["persistence_baseline_mg_dl"].tolist(),
            [103.0, 103.0, 103.0],
        )

    def test_scheduled_meal_and_insulin_are_added_to_future_model_inputs(self) -> None:
        class EchoMealInput(nn.Module):
            def forward(self, history: torch.Tensor) -> torch.Tensor:
                return history[:, -1, FEATURE_COLUMNS.index("meal")]

        history = make_timeline("2024-01-01", 4)
        checkpoint = {
            "sequence_length": 4,
            "feature_columns": list(FEATURE_COLUMNS),
            "feature_mean": [0.0] * len(FEATURE_COLUMNS),
            "feature_scale": [1.0] * len(FEATURE_COLUMNS),
            "target_delta_mean": 0.0,
            "target_delta_scale": 1.0,
        }
        meal_time = pd.Timestamp("2024-01-01 01:00")
        insulin_time = pd.Timestamp("2024-01-01 01:15")
        forecast = forecast_from_history(
            EchoMealInput(),
            checkpoint,
            history,
            horizon_steps=3,
            device_name="cpu",
            meal_schedule={meal_time: 45.0},
            insulin_schedule={insulin_time: 2.0},
        )

        self.assertEqual(forecast.loc[0, "meal_input"], 45.0)
        self.assertEqual(forecast.loc[1, "insulin_input"], 2.0)
        self.assertGreater(
            forecast.loc[1, "predicted_glucose_mg_dl"],
            forecast.loc[0, "predicted_glucose_mg_dl"],
        )

    def test_scenario_amounts_must_be_nonnegative(self) -> None:
        model = GRUGlucoseForecaster(input_dim=len(FEATURE_COLUMNS), hidden_dim=4)
        history = make_timeline("2024-01-01", 4)
        checkpoint = {
            "sequence_length": 4,
            "feature_columns": list(FEATURE_COLUMNS),
            "feature_mean": [0.0] * len(FEATURE_COLUMNS),
            "feature_scale": [1.0] * len(FEATURE_COLUMNS),
            "target_delta_mean": 0.0,
            "target_delta_scale": 1.0,
        }

        with self.assertRaisesRegex(ValueError, "cannot be negative"):
            forecast_from_history(
                model,
                checkpoint,
                history,
                horizon_steps=1,
                meal_schedule={pd.Timestamp("2024-01-01 01:00"): -1.0},
            )

    def test_checkpoint_loader_reconstructs_new_model(self) -> None:
        model = GRUGlucoseForecaster(input_dim=len(FEATURE_COLUMNS), hidden_dim=4)
        checkpoint = {
            "model_state_dict": model.state_dict(),
            "model_config": {
                "input_dim": len(FEATURE_COLUMNS),
                "hidden_dim": 4,
                "num_layers": 2,
                "dropout": 0.15,
            },
            "feature_columns": list(FEATURE_COLUMNS),
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            checkpoint_path = Path(temp_dir) / "gru.pt"
            torch.save(checkpoint, checkpoint_path)
            loaded_model, loaded_checkpoint = load_forecaster_checkpoint(checkpoint_path)

        self.assertIsInstance(loaded_model, GRUGlucoseForecaster)
        self.assertEqual(loaded_checkpoint["feature_columns"], list(FEATURE_COLUMNS))

    def test_excel_workbooks_are_loaded_as_separate_patient_records(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            times = pd.date_range("2024-01-01", periods=8, freq="15min")
            columns = {
                "Date": times,
                "CGM (mg / dl)": np.arange(8, dtype=float) + 100.0,
                "Dietary intake": [None, None, "rice 30g", None, None, None, None, None],
                "Insulin dose - s.c.": [None, None, None, "2 units", None, None, None, None],
            }
            first = pd.DataFrame(columns)
            first.to_excel(root / "2000_0.xlsx", index=False)
            second = first.copy()
            second["Date"] = second["Date"] + pd.Timedelta(days=20)
            second.to_excel(root / "2000_1.xlsx", index=False)

            timelines = load_patient_timelines(root)

        self.assertEqual(list(timelines), ["2000_0", "2000_1"])
        self.assertEqual(len(timelines["2000_0"]), 8)
        self.assertEqual(len(timelines["2000_1"]), 8)
        self.assertEqual(int(timelines["2000_0"]["meal"].sum()), 30)
        self.assertEqual(int(timelines["2000_0"]["insulin"].sum()), 2)
        self.assertEqual(timelines["2000_0"]["patient_id"].unique().tolist(), ["2000"])
        self.assertEqual(timelines["2000_1"]["record_id"].unique().tolist(), ["2000_1"])
        self.assertEqual(int(timelines["2000_0"]["workbook_count"].iloc[0]), 1)
        self.assertEqual(float(timelines["2000_0"].loc[2, "meal_recent_1h"]), 30.0)
        self.assertEqual(float(timelines["2000_0"].loc[3, "insulin_recent_1h"]), 2.0)

    def test_repeated_patient_records_get_independent_test_windows(self) -> None:
        first_record = make_timeline("2024-01-01", 14 * 24 * 4)
        second_record = make_timeline("2024-02-01", 14 * 24 * 4)
        timelines = {"2000_0": first_record, "2000_1": second_record}
        boundaries = calculate_boundaries(timelines)
        windows = build_window_sets(timelines, boundaries, sequence_length=24)

        self.assertGreater(np.sum(windows["test"].patient_ids == "2000_0"), 0)
        self.assertGreater(np.sum(windows["test"].patient_ids == "2000_1"), 0)
        self.assertEqual(
            boundaries["2000_0"].train_end,
            first_record["timestamp"].iloc[int(len(first_record) * 0.8)],
        )
        self.assertEqual(
            boundaries["2000_1"].train_end,
            second_record["timestamp"].iloc[int(len(second_record) * 0.8)],
        )


if __name__ == "__main__":
    unittest.main()
