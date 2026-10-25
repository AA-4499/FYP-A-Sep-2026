"""Role naming, trusted claims, and patient record access regression tests."""
import os
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import patch, Mock

import jwt

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app as dashboard
from auth import current_user

SECRET = 'role-test-secret-at-least-32-characters'


def headers(**claims):
    payload = {'sub': 'test-user', 'exp': time.time() + 600,
               'aud': 'authenticated', 'role': 'authenticated', **claims}
    encoded = jwt.encode(payload, SECRET, algorithm='HS256')
    return {'Authorization': f'Bearer {encoded}'}


class PlatformRoleTests(unittest.TestCase):
    def setUp(self):
        env = patch.dict(os.environ, {'SUPABASE_JWT_SECRET': SECRET})
        env.start()
        self.addCleanup(env.stop)
        patient = patch.object(dashboard, 'get_patient', side_effect=lambda patient_id: {
            'id': patient_id, 'authorized_role': current_user()['role'],
        })
        self.patient = patient.start()
        self.addCleanup(patient.stop)
        self.client = dashboard.app.test_client()
        self.url = '/api/patients/record-a'

    def test_profile_link_supports_new_patients_without_embedded_record_claims(self):
        with patch('auth._patient_record_link', return_value='record-a') as resolve:
            response = self.client.get(self.url, headers=headers(app_metadata={'role': 'patient'}))
            self.assertEqual(200, response.status_code)
            resolve.assert_called_once()

    def test_failed_profile_link_verification_does_not_grant_record_access(self):
        with patch('auth._patient_record_link', side_effect=RuntimeError('Unavailable')):
            response = self.client.get(self.url, headers=headers(app_metadata={'role': 'patient'}))
            self.assertEqual(403, response.status_code)

    def test_three_platform_roles_can_access_permitted_record(self):
        for role in ('admin', 'patient', 'doctor'):
            with self.subTest(role=role):
                response = self.client.get(self.url, headers=headers(
                    app_metadata={'role': role, 'patient_id': 'record-a'}))
                self.assertEqual(200, response.status_code)
                self.assertEqual(role, response.json['authorized_role'])

    def test_legacy_clinician_is_exposed_as_doctor(self):
        response = self.client.get(self.url, headers=headers(app_metadata={'role': 'clinician'}))
        self.assertEqual(200, response.status_code)
        self.assertEqual('doctor', response.json['authorized_role'])

    def test_doctor_and_legacy_signed_top_level_claims(self):
        for claim in ('role', 'user_role'):
            for role in ('doctor', 'clinician'):
                with self.subTest(claim=claim, role=role):
                    response = self.client.get(self.url, headers=headers(**{claim: role}))
                    self.assertEqual(200, response.status_code)
                    self.assertEqual('doctor', response.json['authorized_role'])

    def test_patient_cannot_access_another_or_unlinked_record(self):
        for patient_id in ('record-b', None):
            with self.subTest(patient_id=patient_id):
                response = self.client.get(self.url, headers=headers(
                    app_metadata={'role': 'patient', 'patient_id': patient_id}))
                self.assertEqual(403, response.status_code)
        self.patient.assert_not_called()

    def test_editable_metadata_cannot_grant_privileged_roles(self):
        for role in ('admin', 'doctor', 'clinician'):
            with self.subTest(role=role):
                response = self.client.get(self.url, headers=headers(user_metadata={'role': role}))
                self.assertEqual(403, response.status_code)
        self.patient.assert_not_called()

    def test_trusted_patient_role_takes_priority_over_other_claims(self):
        response = self.client.get(self.url, headers=headers(
            app_metadata={'role': 'patient', 'patient_id': 'record-b'},
            user_role='doctor', user_metadata={'role': 'admin'}))
        self.assertEqual(403, response.status_code)
        self.patient.assert_not_called()

    def test_unknown_role_is_denied(self):
        response = self.client.get(self.url, headers=headers(app_metadata={'role': 'nurse'}))
        self.assertEqual(403, response.status_code)
        self.patient.assert_not_called()

    def test_patient_cannot_browse_directory_even_with_a_linked_record(self):
        with patch.object(dashboard, 'list_patients') as directory:
            for patient_id in (None, 'record-a'):
                response = self.client.get('/api/patients', headers=headers(
                    app_metadata={'role': 'patient', 'patient_id': patient_id}))
                self.assertEqual(403, response.status_code)
            directory.assert_not_called()

    def test_unauthenticated_request_is_denied(self):
        self.assertEqual(401, self.client.get(self.url).status_code)
        self.patient.assert_not_called()

    def test_prediction_rejects_non_doctors_before_entering_forecast_route(self):
        route = Mock(return_value=({'accepted': True}, 200))
        with patch.dict(dashboard.app.view_functions, {'forecast_api.glucose_forecast': route}):
            for role in ('patient', 'admin'):
                with self.subTest(role=role):
                    response = self.client.post('/api/patients/record-a/glucose-forecast',
                        json={}, headers=headers(app_metadata={'role': role, 'patient_id': 'record-a'}))
                    self.assertEqual(403, response.status_code)
                    self.assertIn('Doctor accounts only', response.json['error'])
            route.assert_not_called()

    def test_doctor_and_legacy_clinician_can_enter_prediction_route(self):
        route = Mock(return_value=({'accepted': True}, 200))
        with patch.dict(dashboard.app.view_functions, {'forecast_api.glucose_forecast': route}):
            for role in ('doctor', 'clinician'):
                with self.subTest(role=role):
                    response = self.client.post('/api/patients/record-a/glucose-forecast',
                        json={}, headers=headers(app_metadata={'role': role}))
                    self.assertEqual(200, response.status_code, response.json)
            self.assertEqual(2, route.call_count)


if __name__ == '__main__':
    unittest.main()
