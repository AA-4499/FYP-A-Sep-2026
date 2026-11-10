import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import app as dashboard
from services import retraining_service as service
from test_auth_roles import headers, SECRET


class RetrainingTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.path = Path(self.temporary.name) / 'active.pt'
        self.path.write_bytes(b'previous-model')
        env = patch.dict(os.environ, {'T2DM_CHECKPOINT_PATH': str(self.path), 'SUPABASE_JWT_SECRET': SECRET})
        env.start()
        self.addCleanup(env.stop)

    def test_api_requires_live_active_admin(self):
        client = dashboard.app.test_client()
        url = '/api/admin/model/retrain'
        self.assertEqual(401, client.post(url).status_code)
        for role in ['patient', 'doctor']:
            self.assertEqual(403, client.post(url, headers=headers(app_metadata={'role':role, 'patient_id':'record-a'})).status_code)
        response = Mock()
        response.json.return_value = False
        with patch('retraining_routes.supabase_config', return_value=('https://example.test', 'key')), patch('retraining_routes.requests.post', return_value=response), patch('retraining_routes.start_training') as start:
            self.assertEqual(403, client.post(url, headers=headers(app_metadata={'role':'admin'})).status_code)
            start.assert_not_called()
            response.json.return_value = True
            start.return_value = {'status':'running'}
            self.assertEqual(202, client.post(url, headers=headers(app_metadata={'role':'admin'})).status_code)
            start.side_effect = ValueError('Already running')
            self.assertEqual(409, client.post(url, headers=headers(app_metadata={'role':'admin'})).status_code)

    def test_only_one_job_and_restart_recovers_interrupted_job(self):
        with patch.object(service.threading, 'Thread'):
            service.start_training('admin-id')
            with self.assertRaises(ValueError):
                service.start_training('another-admin')
        service.recover_interrupted_training()
        self.assertEqual('failed', service.training_status()['status'])
        self.assertEqual(b'previous-model', self.path.read_bytes())
        self.assertFalse((self.path.parent / '.retraining-lock').exists())

    def test_success_rejection_and_failure_preserve_the_correct_baseline(self):
        from models.training import train_from_supabase as trainer, supabase_io
        from services import model_quality, model_store
        from test_model_lifecycle import rows
        def train(timelines, staging, **options):
            self.assertFalse(options['copy_to_weights'])
            staging.mkdir(parents=True)
            (staging / 'gru_t2dm_forecaster.pt').write_bytes(b'new-model')
            return {'test_metrics': {'mae_mg_dl': 12.0, 'rmse_mg_dl': 15.0}}
        comparison = {'accepted': True, 'active': {'mae_mg_dl': 13.0, 'rmse_mg_dl': 16.0},
                      'candidate': {'mae_mg_dl': 12.0, 'rmse_mg_dl': 15.0}, 'reasons': []}
        with patch.object(supabase_io, 'supabase_config', return_value=('url','key')), patch.object(trainer, 'fetch_all_supabase_rows', return_value=rows()), patch.object(trainer, 'train_on_supabase_timelines', side_effect=train), patch.object(model_quality, 'compare_models', return_value=comparison):
            with patch.object(service.threading, 'Thread'):
                job = service.start_training('admin-id')
            service._train(self.path, self.path.parent / '.retraining-lock', job)
            active = model_store.read_active()
            self.assertEqual(b'new-model', model_store.active_checkpoint_path().read_bytes())
            self.assertEqual(b'previous-model', self.path.read_bytes())
            self.assertEqual('completed', service.training_status()['status'])
            self.assertEqual(80, active['baseline']['valid_observations'])
            with self.assertRaisesRegex(ValueError, 'interval'):
                service.start_training('admin-id')
            from datetime import datetime, timedelta, timezone
            active['activated_at'] = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
            model_store.atomic_json(self.path.parent / 'active.json', active)
            comparison['accepted'] = False
            with patch.object(service.threading, 'Thread'):
                job = service.start_training('admin-id')
            service._train(model_store.active_checkpoint_path(), self.path.parent / '.retraining-lock', job)
            self.assertEqual('rejected', service.training_status()['status'])
            self.assertEqual(active, model_store.read_active())
        with patch.object(trainer, 'fetch_all_supabase_rows', side_effect=RuntimeError('offline')), patch.object(supabase_io, 'supabase_config', return_value=('url','key')):
            with patch.object(service.threading, 'Thread'):
                job = service.start_training('admin-id')
            with self.assertLogs(level='ERROR'):
                service._train(model_store.active_checkpoint_path(), self.path.parent / '.retraining-lock', job)
        self.assertEqual('failed', service.training_status()['status'])
        self.assertEqual(active, model_store.read_active())

    def test_readiness_is_admin_only_and_reports_data_failures(self):
        client = dashboard.app.test_client()
        url = '/api/admin/model/readiness'
        self.assertEqual(401, client.get(url).status_code)
        self.assertEqual(403, client.get(url, headers=headers(app_metadata={'role':'doctor'})).status_code)
        response = Mock()
        response.json.return_value = True
        with patch('retraining_routes.supabase_config', return_value=('https://example.test', 'key')), patch('retraining_routes.requests.post', return_value=response), patch('retraining_routes.data_readiness', side_effect=RuntimeError('offline')):
            result = client.get(url, headers=headers(app_metadata={'role':'admin'}))
            self.assertEqual(503, result.status_code)
            self.assertIn('New-data statistics', result.json['error'])

    def test_admin_browser_preflight_does_not_bypass_actual_authorization(self):
        from flask import Flask
        from flask_cors import CORS
        from retraining_routes import retraining_api
        application = Flask('admin-retraining-cors-test')
        application.register_blueprint(retraining_api)
        origin = 'https://frontend.example.test'
        CORS(application, resources={r'/api/*': {'origins': [origin]}})
        client = application.test_client()
        with patch('retraining_routes.requests.post') as verify_admin:
            for path, method in [('/api/admin/model/retrain', 'GET'), ('/api/admin/model/retrain', 'POST'), ('/api/admin/model/readiness', 'GET')]:
                response = client.options(path, headers={'Origin': origin, 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': 'authorization'})
                self.assertEqual(200, response.status_code)
                self.assertEqual(origin, response.headers['Access-Control-Allow-Origin'])
                self.assertIn('authorization', response.headers['Access-Control-Allow-Headers'].lower())
            self.assertEqual(401, client.post('/api/admin/model/retrain', headers={'Origin': origin}).status_code)
            self.assertEqual(401, client.get('/api/admin/model/readiness', headers={'Origin': origin}).status_code)
            blocked = client.options('/api/admin/model/readiness', headers={'Origin': 'https://untrusted.example', 'Access-Control-Request-Method': 'GET'})
            self.assertNotIn('Access-Control-Allow-Origin', blocked.headers)
            verify_admin.assert_not_called()
