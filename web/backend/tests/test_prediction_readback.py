"""Historical online outputs remain bound to the authorised patient and run."""
import os
import unittest
import uuid
from unittest.mock import patch, Mock

import app as dashboard
from services import forecast_storage_service as storage, forecast_service
from models.training.supabase_io import SupabaseStorageError
from test_forecast_api import token, SECRET


class PredictionReadbackTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'SUPABASE_JWT_SECRET': SECRET})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.run_id = str(uuid.uuid4())
        self.url = f'/api/patients/record-a/glucose-forecasts/{self.run_id}'
        self.client = dashboard.app.test_client()

    def test_history_requires_authentication_and_doctor_assignment(self):
        with patch.object(storage, 'retrieve_forecast') as retrieve:
            self.assertEqual(401, self.client.get(self.url).status_code)
            self.assertEqual(403, self.client.get(self.url, headers=token('patient', 'record-b')).status_code)
            with patch.object(dashboard, 'patient_is_assigned', return_value=False):
                self.assertEqual(403, self.client.get(self.url, headers=token()).status_code)
            retrieve.assert_not_called()

    def test_authorised_history_and_service_failures_are_explicit(self):
        with patch.object(storage, 'retrieve_forecast', return_value={'run_id': self.run_id, 'patient_id': 'record-a'}), patch.object(dashboard, 'patient_is_assigned', return_value=True):
            self.assertEqual(200, self.client.get(self.url, headers=token()).status_code)
            self.assertEqual(200, self.client.get(self.url, headers=token('patient', 'record-a')).status_code)
        for failure, expected in [(LookupError('Not found'), 404), (ValueError('Invalid run ID'), 400), (SupabaseStorageError('History unavailable'), 503)]:
            with patch.object(storage, 'retrieve_forecast', side_effect=failure), patch.object(dashboard, 'patient_is_assigned', return_value=True):
                self.assertEqual(expected, self.client.get(self.url, headers=token()).status_code)

    def test_exact_patient_and_run_filters_are_used_and_storage_identity_is_verified(self):
        row = {'run_id': self.run_id, 'patient_id': 'record-a', 'model_sha256': 'model-a', 'output': {'patient_id': 'record-a', 'model_sha256': 'model-a'}}
        response = Mock(ok=True)
        response.json.return_value = [row]
        with patch.object(storage, 'supabase_config', return_value=('https://example.test', 'key')), patch.object(storage.requests, 'get', return_value=response) as request:
            self.assertEqual(row, storage.retrieve_forecast('record-a', self.run_id))
            self.assertEqual('eq.record-a', request.call_args.kwargs['params']['patient_id'])
            self.assertEqual(f'eq.{self.run_id}', request.call_args.kwargs['params']['run_id'])
            response.json.return_value = [{**row, 'patient_id': 'record-b'}]
            with self.assertRaises(SupabaseStorageError):
                storage.retrieve_forecast('record-a', self.run_id)

    def test_wrong_patient_cgm_response_never_becomes_a_forecast(self):
        response = Mock()
        response.json.return_value = [{'Patient Number': 'other-record'}]
        with patch.object(forecast_service, 'supabase_config', return_value=('https://example.test', 'key')), patch.object(forecast_service.requests, 'get', return_value=response):
            with self.assertRaisesRegex(RuntimeError, 'patient identity'):
                forecast_service._cloud_timeline('record-a')
