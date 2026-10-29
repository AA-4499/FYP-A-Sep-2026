"""Forecast integration, validation, and patient access regression tests."""
import math
import os
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import patch, Mock

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'web/backend'))
import jwt
import app as dashboard
from services import forecast_service as service
from services import forecast_storage_service as storage
from models.training.supabase_io import SupabaseStorageError

SECRET = 'forecast-test-secret-at-least-32-characters'


def token(role='doctor', patient_id=None):
    metadata = {'role': role}
    if patient_id:
        metadata['patient_id'] = patient_id
    encoded = jwt.encode({'sub': 'test-user', 'exp': time.time() + 600, 'aud': 'authenticated',
                          'role': 'authenticated', 'app_metadata': metadata}, SECRET, algorithm='HS256')
    return {'Authorization': f'Bearer {encoded}'}


class ForecastApiTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'SUPABASE_JWT_SECRET': SECRET})
        self.env.start()
        self.addCleanup(self.env.stop)
        # Care-team assignment authorization is covered in test_auth_roles; this
        # suite exercises the forecast route itself, so callers are pre-assigned.
        assignment = patch.object(dashboard, 'patient_is_assigned', return_value=True)
        assignment.start()
        self.addCleanup(assignment.stop)
        saver = patch.object(storage, 'save_forecast', return_value={'saved': True, 'run_id': 'test-run'})
        self.saver = saver.start()
        self.addCleanup(saver.stop)
        self.client = dashboard.app.test_client()
        self.url = '/api/patients/2017_1_20201118/glucose-forecast'

    def test_unassigned_doctor_cannot_forecast(self):
        with patch.object(dashboard, 'patient_is_assigned', return_value=False):
            response = self.client.post(self.url, json={}, headers=token())
        self.assertEqual(403, response.status_code)
        self.assertIn('not assigned', response.get_json()['error'])

    def test_requires_authentication(self):
        self.assertEqual(401, self.client.post(self.url, json={}).status_code)

    def test_patient_cannot_read_other_record(self):
        with patch.object(service, 'forecast_patient') as forecast:
            response = self.client.post(self.url, json={}, headers=token('patient', '2018_0_20210420'))
            self.assertEqual(403, response.status_code)
            forecast.assert_not_called()

    def test_only_doctor_and_legacy_clinician_can_forecast(self):
        for headers in (token(), token('clinician')):
            with patch.object(service, 'forecast_patient', return_value={'patient_id': '2017_1_20201118'}) as forecast:
                response = self.client.post(self.url, json={'horizon_hours': 6}, headers=headers)
                self.assertEqual(200, response.status_code)
                forecast.assert_called_once_with('2017_1_20201118', {'horizon_hours': 6})

    def test_editable_user_metadata_cannot_grant_doctor_access(self):
        encoded = jwt.encode({'sub': 'test-user', 'exp': time.time() + 600, 'aud': 'authenticated',
                              'role': 'authenticated', 'user_metadata': {'role': 'doctor'}}, SECRET, algorithm='HS256')
        response = self.client.post(self.url, json={}, headers={'Authorization': f'Bearer {encoded}'})
        self.assertEqual(403, response.status_code)

    def test_invalid_payload_returns_400(self):
        payloads = [None, [], {'source': 'unknown'}, {'horizon_hours': True}, {'horizon_hours': 5},
                    {'events': [{'kind': 'meal', 'amount': -1, 'minutes_ahead': 15}]},
                    {'events': [{'kind': 'meal', 'amount': math.inf, 'minutes_ahead': 15}]},
                    {'events': [{'kind': 'meal', 'amount': 60, 'minutes_ahead': 180}]},
                    {'events': [{'kind': 'meal', 'amount': 60, 'minutes_ahead': 16}]}]
        for payload in payloads:
            with self.subTest(payload=payload):
                response = self.client.post(self.url, json=payload, headers=token())
                self.assertEqual(400, response.status_code, response.get_json())

    def test_unknown_record_returns_404(self):
        response = self.client.post('/api/patients/no-such-patient/glucose-forecast', json={'source': 'local'}, headers=token())
        self.assertEqual(404, response.status_code)

    def test_missing_checkpoint_returns_actionable_503(self):
        with patch.dict(os.environ, {'T2DM_CHECKPOINT_PATH': str(ROOT / 'missing-model.pt')}):
            response = self.client.post(self.url, json={}, headers=token())
            self.assertEqual(503, response.status_code)
            self.assertIn('checkpoint', response.get_json()['error'])

    def test_real_checkpoint_forecasts_all_horizons_and_scenario(self):
        for horizon in (3, 6, 12):
            with self.subTest(horizon=horizon):
                response = self.client.post(self.url, json={'source': 'local', 'horizon_hours': horizon,
                    'events': [{'kind': 'meal', 'amount': 60, 'minutes_ahead': 60}]}, headers=token())
                self.assertEqual(200, response.status_code, response.get_json())
                result = response.get_json()
                self.assertEqual('2017_1_20201118', result['patient_id'])
                self.assertEqual('2017_1', result['record_id'])
                self.assertEqual(horizon * 4 + 1, len(result['baseline']))
                self.assertEqual(horizon * 4 + 1, len(result['scenario']))
                self.assertNotEqual(result['baseline_end'], result['scenario_end'])
                self.assertGreater(result['metrics']['test_windows'], 0)
                self.assertTrue(all(math.isfinite(point['value']) for point in result['scenario']))
                self.assertGreater(len(result['training']), 0)
                self.assertGreater(len(result['testing']), 0)

    def test_save_failure_is_not_reported_as_success(self):
        self.saver.side_effect = SupabaseStorageError('Save was not confirmed')
        with patch.object(service, 'forecast_patient', return_value={'patient_id': '2017_1_20201118'}):
            response = self.client.post(self.url, json={}, headers=token())
        self.assertEqual(503, response.status_code)
        self.assertFalse(response.get_json()['saved'])
        self.assertIn('run_id', response.get_json())

    def test_invalid_run_id_rejected_before_inference_or_write(self):
        with patch.object(service, 'forecast_patient') as forecast:
            response = self.client.post(self.url, json={'run_id': 'bad'}, headers=token())
        self.assertEqual(400, response.status_code)
        forecast.assert_not_called()
        self.saver.assert_not_called()

    def test_cloud_queries_only_exact_record_and_paginates(self):
        first = Mock()
        first.json.return_value = [{'row': i} for i in range(1000)]
        last = Mock()
        last.json.return_value = [{'row': 1000}]
        with patch.dict(os.environ, {'SUPABASE_URL': 'https://example.supabase.co', 'SUPABASE_KEY': 'test-key'}), \
             patch.object(service.requests, 'get', side_effect=[first, last]) as get, \
             patch.object(service, 'prepare_supabase_timelines', return_value={'2017_1': 'frame'}) as prepare:
            self.assertEqual(('2017_1', 'frame'), service._cloud_timeline('2017_1_20201118'))
            self.assertEqual(1001, len(prepare.call_args.args[0]))
            self.assertEqual('eq.2017_1_20201118', get.call_args.kwargs['params']['Patient Number'])
            self.assertEqual('1000-1999', get.call_args.kwargs['headers']['Range'])


if __name__ == '__main__':
    unittest.main()
