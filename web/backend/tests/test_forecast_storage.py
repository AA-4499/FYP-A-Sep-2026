"""Supabase persistence and authentication boundaries without network calls."""
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'web/backend'))
from services.forecast_storage_service import save_forecast
from models.training.supabase_io import supabase_headers, SupabaseStorageError
from auth import _decode_token

RUN = '409bf197-b3ad-43bc-b5e4-bf8a8d9a0001'


def output():
    return {'patient_id': '2000_0_20201230', 'record_id': '2000_0', 'source': 'supabase',
        'horizon_hours': 3, 'forecast_start': '2020-12-30T12:00:00', 'model_sha256': 'a'*64,
        'testing': [{'timestamp': '2020-12-30T11:00:00', 'value': 123}],
        'testing_actual': [{'timestamp': '2020-12-30T11:00:00', 'value': 125}],
        'metrics': {'mae_mg_dl': 2, 'rmse_mg_dl': 2, 'test_windows': 1},
        'baseline': [{'timestamp': '2020-12-30T12:15:00', 'value': 124}],
        'scenario': [{'timestamp': '2020-12-30T12:15:00', 'value': 124}],
        'timeline_split': {'observed_rows': 50}}


class SupabaseForecastStorageTests(unittest.TestCase):
    def setUp(self):
        self.config = patch('services.forecast_storage_service.supabase_config', return_value=('https://example.supabase.co', 'sb_secret_test'))
        self.config.start()
        self.addCleanup(self.config.stop)

    def test_secret_key_is_not_sent_as_a_jwt(self):
        self.assertEqual({'apikey': 'sb_secret_test'}, supabase_headers('sb_secret_test'))
        self.assertEqual('Bearer legacy.jwt.key', supabase_headers('legacy.jwt.key')['Authorization'])

    def test_atomic_rpc_contains_all_curves_metrics_and_matched_test_rows(self):
        saved = {'saved': True, 'run_id': RUN, 'patient_id': '2000_0_20201230',
                 'test_predictions_saved': 1, 'metrics_saved': 1, 'timeline_splits_saved': 1}
        response = Mock(ok=True)
        response.json.return_value = saved
        with patch('services.forecast_storage_service.requests.post', return_value=response) as post:
            self.assertEqual(saved, save_forecast(output(), [], RUN))
            self.assertEqual(saved, save_forecast(output(), [], RUN))
        payload = post.call_args.kwargs['json']['p_run']
        self.assertEqual(RUN, payload['run_id'])
        self.assertEqual(output(), payload['output'])
        self.assertEqual(125, payload['testing_rows'][0]['actual_glucose_mg_dl'])
        self.assertEqual(123, payload['testing_rows'][0]['predicted_glucose_mg_dl'])
        self.assertEqual({'apikey': 'sb_secret_test'}, post.call_args.kwargs['headers'])
        self.assertTrue(post.call_args.args[0].endswith('/rpc/save_glucose_forecast'))
        self.assertEqual(post.call_args_list[0].kwargs['json'], post.call_args_list[1].kwargs['json'])

    def test_missing_database_function_is_actionable(self):
        response = Mock(ok=False, status_code=404)
        response.json.return_value = {'code': 'PGRST202'}
        with patch('services.forecast_storage_service.requests.post', return_value=response):
            with self.assertRaisesRegex(SupabaseStorageError, 'supabase_forecast_outputs.sql'):
                save_forecast(output(), [], RUN)

    def test_incomplete_save_receipt_fails(self):
        response = Mock(ok=True)
        response.json.return_value = {'saved': True, 'run_id': RUN, 'patient_id': '2000_0_20201230',
                                      'test_predictions_saved': 0}
        with patch('services.forecast_storage_service.requests.post', return_value=response):
            with self.assertRaisesRegex(SupabaseStorageError, 'incomplete'):
                save_forecast(output(), [], RUN)

    def test_auth_uses_verified_supabase_user_for_asymmetric_tokens(self):
        response = Mock(status_code=200)
        response.json.return_value = {'id': 'verified-user', 'app_metadata': {'role': 'doctor'}}
        with patch.dict(os.environ, {'SUPABASE_JWT_SECRET': ''}), \
             patch('models.training.supabase_io.supabase_config', return_value=('https://example.supabase.co', 'sb_secret_test')), \
             patch('requests.get', return_value=response) as get:
            claims = _decode_token('signed-access-token')
        self.assertEqual('verified-user', claims['sub'])
        self.assertEqual('doctor', claims['app_metadata']['role'])
        self.assertEqual('Bearer signed-access-token', get.call_args.kwargs['headers']['Authorization'])


if __name__ == '__main__':
    unittest.main()
