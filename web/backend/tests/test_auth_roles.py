"""Role naming, trusted claims, and patient record access regression tests."""
import os
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import patch, Mock

import jwt
import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app as dashboard
from auth import current_user, patient_is_assigned

SECRET = 'role-test-secret-at-least-32-characters'
ASSIGNMENT_ENV = {'SUPABASE_URL': 'https://example.supabase.co', 'SUPABASE_KEY': 'test-key'}


def headers(**claims):
    payload = {'sub': 'test-user', 'exp': time.time() + 600,
               'aud': 'authenticated', 'role': 'authenticated', **claims}
    encoded = jwt.encode(payload, SECRET, algorithm='HS256')
    return {'Authorization': f'Bearer {encoded}'}


def assignment_response(rows):
    """Build a fake Supabase REST response for an assignment lookup."""
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = rows
    return response


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
        assignment = assignment_response([{'patient_id': 'record-a'}])
        with patch.dict(os.environ, ASSIGNMENT_ENV), \
             patch('auth.requests.get', return_value=assignment), \
             patch.dict(dashboard.app.view_functions, {'forecast_api.glucose_forecast': route}):
            for role in ('doctor', 'clinician'):
                with self.subTest(role=role):
                    response = self.client.post('/api/patients/record-a/glucose-forecast',
                        json={}, headers=headers(app_metadata={'role': role}))
                    self.assertEqual(200, response.status_code, response.json)
            self.assertEqual(2, route.call_count)

    def test_assigned_doctor_reaches_prediction_route(self):
        route = Mock(return_value=({'accepted': True}, 200))
        presented = headers(app_metadata={'role': 'doctor'})
        with patch.dict(os.environ, ASSIGNMENT_ENV), \
             patch('auth.requests.get', return_value=assignment_response([{'patient_id': 'record-a'}])) as get, \
             patch.dict(dashboard.app.view_functions, {'forecast_api.glucose_forecast': route}):
            response = self.client.post('/api/patients/record-a/glucose-forecast', json={}, headers=presented)
        self.assertEqual(200, response.status_code, response.json)
        route.assert_called_once()
        self.assertEqual('https://example.supabase.co/rest/v1/clinician_patient_assignments',
                         get.call_args.args[0])
        self.assertEqual({'select': 'patient_id', 'clinician_id': 'eq.test-user',
                          'patient_id': 'eq.record-a', 'limit': '1'}, get.call_args.kwargs['params'])
        self.assertEqual(presented['Authorization'],
                         get.call_args.kwargs['headers']['Authorization'])

    def test_unassigned_doctor_gets_403_without_entering_route(self):
        route = Mock(return_value=({'accepted': True}, 200))
        with patch.dict(os.environ, ASSIGNMENT_ENV), \
             patch('auth.requests.get', return_value=assignment_response([])) as get, \
             patch.dict(dashboard.app.view_functions, {'forecast_api.glucose_forecast': route}):
            response = self.client.post('/api/patients/record-a/glucose-forecast',
                json={}, headers=headers(app_metadata={'role': 'doctor'}))
        self.assertEqual(403, response.status_code)
        self.assertIn('not assigned', response.json['error'])
        route.assert_not_called()
        get.assert_called_once()

    def test_admin_is_denied_before_any_assignment_lookup(self):
        route = Mock(return_value=({'accepted': True}, 200))
        with patch('auth.requests.get') as get, \
             patch.dict(dashboard.app.view_functions, {'forecast_api.glucose_forecast': route}):
            response = self.client.post('/api/patients/record-a/glucose-forecast',
                json={}, headers=headers(app_metadata={'role': 'admin', 'patient_id': 'record-a'}))
        self.assertEqual(403, response.status_code)
        self.assertIn('Doctor accounts only', response.json['error'])
        get.assert_not_called()
        route.assert_not_called()

    def test_patient_is_denied_before_any_assignment_lookup(self):
        route = Mock(return_value=({'accepted': True}, 200))
        with patch('auth.requests.get') as get, \
             patch.dict(dashboard.app.view_functions, {'forecast_api.glucose_forecast': route}):
            response = self.client.post('/api/patients/record-a/glucose-forecast',
                json={}, headers=headers(app_metadata={'role': 'patient', 'patient_id': 'record-a'}))
        self.assertEqual(403, response.status_code)
        self.assertIn('Doctor accounts only', response.json['error'])
        get.assert_not_called()
        route.assert_not_called()

    def test_assignment_lookup_transport_failure_returns_503_without_entering_route(self):
        route = Mock(return_value=({'accepted': True}, 200))
        with patch.dict(os.environ, ASSIGNMENT_ENV), \
             patch('auth.requests.get', side_effect=requests.RequestException('Supabase down')), \
             patch.dict(dashboard.app.view_functions, {'forecast_api.glucose_forecast': route}):
            response = self.client.post('/api/patients/record-a/glucose-forecast',
                json={}, headers=headers(app_metadata={'role': 'doctor'}))
        self.assertEqual(503, response.status_code)
        self.assertIn('could not be verified', response.json['error'])
        route.assert_not_called()

    def test_assignment_lookup_unparseable_response_returns_503(self):
        broken = Mock()
        broken.raise_for_status.return_value = None
        broken.json.side_effect = ValueError('not JSON')
        route = Mock(return_value=({'accepted': True}, 200))
        with patch.dict(os.environ, ASSIGNMENT_ENV), \
             patch('auth.requests.get', return_value=broken), \
             patch.dict(dashboard.app.view_functions, {'forecast_api.glucose_forecast': route}):
            response = self.client.post('/api/patients/record-a/glucose-forecast',
                json={}, headers=headers(app_metadata={'role': 'doctor'}))
        self.assertEqual(503, response.status_code)
        self.assertIn('could not be verified', response.json['error'])
        route.assert_not_called()

    def test_unconfigured_supabase_fails_closed_with_503(self):
        route = Mock(return_value=({'accepted': True}, 200))
        with patch.dict(os.environ, {'SUPABASE_URL': '', 'SUPABASE_KEY': ''}), \
             patch.dict(dashboard.app.view_functions, {'forecast_api.glucose_forecast': route}):
            response = self.client.post('/api/patients/record-a/glucose-forecast',
                json={}, headers=headers(app_metadata={'role': 'doctor'}))
        self.assertEqual(503, response.status_code)
        self.assertIn('could not be verified', response.json['error'])
        route.assert_not_called()


class PatientAssignmentHelperTests(unittest.TestCase):
    def test_returns_true_for_a_non_empty_assignment_list(self):
        with patch.dict(os.environ, ASSIGNMENT_ENV), \
             patch('auth.requests.get', return_value=assignment_response([{'patient_id': 'record-a'}])) as get:
            self.assertTrue(patient_is_assigned('clinician-1', 'record-a', 'caller-token'))
        self.assertEqual('eq.clinician-1', get.call_args.kwargs['params']['clinician_id'])
        self.assertEqual('Bearer caller-token', get.call_args.kwargs['headers']['Authorization'])

    def test_returns_false_for_an_empty_assignment_list(self):
        with patch.dict(os.environ, ASSIGNMENT_ENV), \
             patch('auth.requests.get', return_value=assignment_response([])):
            self.assertFalse(patient_is_assigned('clinician-1', 'record-b', 'caller-token'))

    def test_non_list_payload_is_not_treated_as_assigned(self):
        with patch.dict(os.environ, ASSIGNMENT_ENV), \
             patch('auth.requests.get', return_value=assignment_response({'patient_id': 'record-a'})):
            self.assertFalse(patient_is_assigned('clinician-1', 'record-a', 'caller-token'))

    def test_http_failure_raises_runtime_error(self):
        failing = Mock()
        failing.raise_for_status.side_effect = requests.HTTPError('403 from RLS')
        with patch.dict(os.environ, ASSIGNMENT_ENV), \
             patch('auth.requests.get', return_value=failing):
            with self.assertRaises(RuntimeError):
                patient_is_assigned('clinician-1', 'record-a', 'caller-token')

    def test_missing_server_credentials_raise_runtime_error(self):
        with patch.dict(os.environ, {'SUPABASE_URL': '', 'SUPABASE_KEY': ''}):
            with self.assertRaises(RuntimeError):
                patient_is_assigned('clinician-1', 'record-a', 'caller-token')


if __name__ == '__main__':
    unittest.main()
