"""Clinical API contracts: database facts, explicit absence, and no prototype results."""
import os
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import patch
import jwt
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app as dashboard
from services import patient_service
from models.training.supabase_io import SupabaseStorageError

SECRET = 'clinical-api-test-secret-at-least-32-characters'
ROWS = [
    {'Patient Number': 'record-a', 'Age (years)': 40, 'HbA1c (mmol/mol)': 66, 'Fasting Plasma Glucose (mg/dl)': 180, 'Type of Diabetes': 'T2D'},
    {'Patient Number': 'record-b', 'Age (years)': None, 'HbA1c (mmol/mol)': None},
]

def headers():
    token = jwt.encode({'sub': 'doctor-test', 'exp': time.time()+600, 'aud': 'authenticated',
        'app_metadata': {'role': 'doctor'}}, SECRET, algorithm='HS256')
    return {'Authorization': f'Bearer {token}'}

class ClinicalApiTests(unittest.TestCase):
    def setUp(self):
        env = patch.dict(os.environ, {'SUPABASE_JWT_SECRET': SECRET})
        env.start(); self.addCleanup(env.stop)
        summaries = patch.object(patient_service, '_summaries', return_value=ROWS)
        self.summaries = summaries.start(); self.addCleanup(summaries.stop)
        self.client = dashboard.app.test_client()

    def test_health_and_metadata_do_not_expose_a_generated_patient_id(self):
        self.assertEqual(200, self.client.get('/api/health').status_code)
        response = self.client.get('/api/meta')
        self.assertEqual(200, response.status_code)
        self.assertIsNone(response.json['default_patient_id'])

    def test_patient_data_requires_authentication(self):
        self.assertEqual(401, self.client.get('/api/patients').status_code)

    def test_directory_uses_database_rows_and_pagination(self):
        response = self.client.get('/api/patients?per_page=1', headers=headers())
        self.assertEqual(200, response.status_code)
        self.assertEqual(2, response.json['total'])
        self.assertEqual('supabase', response.json['source'])
        self.assertEqual(['record-a'], [p['id'] for p in response.json['patients']])

    def test_profile_units_and_missing_measurements_are_preserved(self):
        response = self.client.get('/api/patients/record-a', headers=headers())
        self.assertEqual(200, response.status_code)
        self.assertEqual(10, response.json['fasting_glucose'])
        self.assertEqual(8.2, response.json['hba1c'])
        absent = self.client.get('/api/patients/record-b', headers=headers()).json
        for key in ['age', 'hba1c', 'bmi', 'fasting_glucose', 'risk_category']:
            self.assertIsNone(absent[key])

    def test_unknown_records_never_fall_back_to_another_patient(self):
        self.assertEqual(404, self.client.get('/api/patients/missing', headers=headers()).status_code)

    def test_database_failure_returns_unavailable_instead_of_mock_data(self):
        self.summaries.side_effect = SupabaseStorageError('Clinical database unavailable')
        response = self.client.get('/api/patients', headers=headers())
        self.assertEqual(503, response.status_code)
        self.assertEqual('supabase', response.json['source'])

    def test_unvalidated_prototype_endpoints_do_not_generate_clinical_results(self):
        for suffix in ['timeline', 'risk-assessment', 'xai-explanation', 'insights', 'digital-twin', 'report']:
            with self.subTest(suffix=suffix):
                response = self.client.get('/api/patients/record-a/'+suffix, headers=headers())
                self.assertEqual(501, response.status_code)
                self.assertFalse(response.json['available'])
        self.assertEqual(501, self.client.post('/api/patients/record-a/simulate', json={}, headers=headers()).status_code)

if __name__ == '__main__':
    unittest.main()
