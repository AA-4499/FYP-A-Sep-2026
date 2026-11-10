import os
import unittest
from unittest.mock import Mock, patch

import requests
from flask import Flask
from doctor_invitation_routes import doctor_invitation_api


def response(status, payload):
    result = Mock(status_code=status, ok=200 <= status < 300)
    result.json.return_value = payload
    return result


class DoctorInvitationTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.register_blueprint(doctor_invitation_api)
        self.client = app.test_client()
        self.url = '/api/admin/doctors/invite'
        self.fields = dict(full_name=' Dr Test ', email=' DOC@EXAMPLE.COM ',
                           organisation='Clinic', department='Diabetes', registration_id='MMC-123')
        self.headers = {'Authorization': 'Bearer admin-session'}
        self.claims = {'sub': 'admin-id', 'app_metadata': {'role': 'admin'}}
        for patcher in [
            patch.dict(os.environ, {'DOCTOR_INVITE_REDIRECT_URL': 'https://app.example/?auth=invite'}),
            patch('auth._decode_token', side_effect=lambda _: self.claims),
            patch('doctor_invitation_routes.supabase_config', return_value=('https://project.example', 'sb_secret_server')),
        ]:
            patcher.start()
            self.addCleanup(patcher.stop)
        self.post = patch('doctor_invitation_routes.requests.post').start()
        self.addCleanup(patch.stopall)

    def send(self, fields=None):
        return self.client.post(self.url, json=self.fields if fields is None else fields, headers=self.headers)

    def test_anonymous_patient_and_doctor_cannot_invite(self):
        self.assertEqual(401, self.client.post(self.url, json=self.fields).status_code)
        for role in ('patient', 'doctor'):
            self.claims = {'sub': 'other-id', 'app_metadata': {'role': role, 'patient_id': 'own-record'}}
            self.assertEqual(403, self.send().status_code)
        self.post.assert_not_called()

    def test_stale_admin_token_cannot_bypass_live_profile(self):
        self.post.return_value = response(403, {'code': '42501'})
        self.assertEqual(403, self.send().status_code)
        self.assertEqual(1, self.post.call_count)
        self.assertIn('/rpc/admin_prepare_doctor_invitation', self.post.call_args.args[0])
        self.assertEqual('Bearer admin-session', self.post.call_args.kwargs['headers']['Authorization'])

    def test_valid_invite_uses_server_secret_and_fixed_redirect(self):
        self.post.side_effect = [response(200, {'token': 'reserved-token'}), response(200, {
            'id': 'doctor-id', 'app_metadata': {'role': 'doctor', 'doctor_invitation': 'reserved-token'}})]
        result = self.send({**self.fields, 'redirect_to': 'https://evil.example'})
        self.assertEqual(201, result.status_code)
        self.assertEqual('doc@example.com', result.json['email'])
        prepare, invite = self.post.call_args_list
        self.assertEqual('Dr Test', prepare.kwargs['json']['p_full_name'])
        self.assertEqual({'email': 'doc@example.com', 'data': {'doctor_invitation_token': 'reserved-token'}}, invite.kwargs['json'])
        self.assertEqual({'redirect_to': 'https://app.example/?auth=invite'}, invite.kwargs['params'])
        self.assertEqual({'apikey': 'sb_secret_server'}, invite.kwargs['headers'])
        self.assertNotIn('reserved-token', result.get_data(as_text=True))

    def test_missing_invalid_or_overlong_fields_do_not_contact_auth(self):
        for field in self.fields:
            self.assertEqual(400, self.send({**self.fields, field: ' '}).status_code)
        for invalid in ({'email': 'bad-email'}, {'full_name': 'A' * 121}, {'organisation': 'A\nB'}):
            self.assertEqual(400, self.send({**self.fields, **invalid}).status_code)
        self.assertEqual(400, self.send([]).status_code)
        self.post.assert_not_called()

    def test_duplicates_and_missing_migration_never_send_email(self):
        for code, status in [('23505', 409), ('PGRST202', 503)]:
            self.post.reset_mock()
            self.post.return_value = response(400, {'code': code})
            self.assertEqual(status, self.send().status_code)
            self.assertEqual(1, self.post.call_count)

    def test_email_failure_and_uncertain_delivery_never_report_success(self):
        for send_result, expected in [(response(429, {}), 429), (response(500, {}), 502),
                                      (requests.Timeout(), 503), (response(200, {}), 502),
                                      (response(200, {'id': 'existing-patient'}), 502)]:
            self.post.side_effect = [response(200, {'token': 'token'}), send_result]
            result = self.send()
            self.assertEqual(expected, result.status_code)
            self.assertNotIn('message', result.json)

    def test_redirect_must_be_configured_and_safe(self):
        for url in ('', 'https://app.example', 'http://app.example/?auth=invite', 'https://user:pass@app.example/?auth=invite'):
            with patch.dict(os.environ, {'DOCTOR_INVITE_REDIRECT_URL': url}):
                self.assertEqual(503, self.send().status_code)
        self.post.assert_not_called()


if __name__ == '__main__':
    unittest.main()
