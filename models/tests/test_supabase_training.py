import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pandas as pd
from models.training import train_from_supabase as trainer
from models.training.t2dm.t2dm_pipeline import _add_time_features, load_forecaster_checkpoint, forecast_from_history


class SupabaseTrainingTests(unittest.TestCase):
    def test_upload_creates_shared_run_and_keeps_exact_patient_foreign_key(self):
        timestamp = pd.Timestamp('2026-01-01')
        results = {
            'prediction_frame': pd.DataFrame([{
                'patient_id': '1234_0', 'timestamp': timestamp,
                'actual_glucose_mg_dl': 125.0, 'predicted_glucose_mg_dl': 124.0,
                'persistence_baseline_mg_dl': 123.0,
            }]),
            'split_frame': pd.DataFrame([{
                'patient_id': '1234_0', 'timeline_start': timestamp, 'timeline_end': timestamp,
                'train_target_end_exclusive': timestamp, 'test_target_start': timestamp,
                'observed_rows': 100, 'training_rows': 80, 'testing_rows': 20, 'test_windows': 1,
            }]),
            'test_metrics': {'mae_mg_dl': 1.0, 'rmse_mg_dl': 1.0,
                'persistence_baseline_mae_mg_dl': 2.0, 'persistence_baseline_rmse_mg_dl': 2.0, 'windows': 1},
            'patient_records': {'1234_0': '1234_0_20260101'},
            'epochs': 1, 'batch_size': 16, 'hidden_dim': 8,
        }
        with patch.object(trainer, 'post_to_supabase') as post:
            trainer.upload_results_to_supabase('https://example.supabase.co', 'sb_secret_test', results, 'test-training-run')
        calls = post.call_args_list
        self.assertEqual(['model_runs', 'training_predictions', 'training_metrics', 'training_timeline_splits'],
                         [call.args[2] for call in calls])
        for call in calls:
            self.assertTrue(all(row['run_id'] == 'test-training-run' for row in call.args[3]))
        self.assertEqual('1234_0_20260101', calls[1].args[3][0]['patient_record_id'])
        self.assertIsNone(calls[2].args[3][0]['patient_record_id'])
        self.assertEqual('1234_0_20260101', calls[2].args[3][1]['patient_record_id'])
        self.assertEqual('1234_0_20260101', calls[3].args[3][0]['patient_record_id'])

    def test_offline_cloud_training_exports_usable_model_and_reports(self):
        count = 160
        timeline = _add_time_features(pd.DataFrame({
            'timestamp': pd.date_range('2026-01-01', periods=count, freq='15min'),
            'glucose': 130 + 15 * np.sin(np.arange(count) / 8),
            'meal': np.zeros(count), 'insulin': np.zeros(count),
        }))
        timeline['patient_id'] = '1234'
        timeline['record_id'] = '1234_0'
        timeline['source_file'] = 'test'
        timeline['workbook_count'] = 1
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.object(trainer, 'PROJECT_DIR', root):
                result = trainer.train_on_supabase_timelines({'1234_0': timeline}, root / 'evaluation',
                    epochs=1, batch_size=16, hidden_dim=8, device_name='cpu')
            self.assertGreater(result['test_metrics']['windows'], 0)
            for filename in ('metrics.json', 'test_predictions.csv', 'timeline_splits.csv'):
                self.assertTrue((root / 'evaluation' / filename).is_file())
            model, checkpoint = load_forecaster_checkpoint(root / 'models/weights/gru_t2dm_forecaster.pt')
            forecast = forecast_from_history(model, checkpoint, timeline, horizon_steps=12)
            self.assertEqual(12, len(forecast))
            self.assertTrue(np.isfinite(forecast['predicted_glucose_mg_dl']).all())


if __name__ == '__main__':
    unittest.main()
