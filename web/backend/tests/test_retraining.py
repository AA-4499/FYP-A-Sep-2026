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

    def test_success_publishes_model_and_failure_keeps_current_model(self):
        from models.training import train_from_supabase as trainer
        from models.training.t2dm import t2dm_pipeline as pipeline
        from models.training import supabase_io
        def train(timelines, staging, **options):
            self.assertFalse(options['copy_to_weights'])
            staging.mkdir(parents=True)
            (staging / 'gru_t2dm_forecaster.pt').write_bytes(b'new-model')
            self.assertEqual(b'previous-model', self.path.read_bytes())
            return {'test_metrics': {'mae_mg_dl': 12.0, 'rmse_mg_dl': 15.0}}
        with patch.object(supabase_io, 'supabase_config', return_value=('url','key')), patch.object(trainer, 'fetch_all_supabase_rows', return_value=[{}]), patch.object(trainer, 'prepare_supabase_timelines', return_value={'record': []}), patch.object(trainer, 'train_on_supabase_timelines', side_effect=train), patch.object(pipeline, 'load_forecaster_checkpoint'):
            with patch.object(service.threading, 'Thread'):
                job = service.start_training('admin-id')
            service._train(self.path, self.path.parent / '.retraining-lock', job)
        self.assertEqual(b'new-model', self.path.read_bytes())
        self.assertEqual('completed', service.training_status()['status'])
        with patch.object(trainer, 'fetch_all_supabase_rows', side_effect=RuntimeError('offline')), patch.object(supabase_io, 'supabase_config', return_value=('url','key')):
            with patch.object(service.threading, 'Thread'):
                job = service.start_training('admin-id')
            with self.assertLogs(level='ERROR'):
                service._train(self.path, self.path.parent / '.retraining-lock', job)
        self.assertEqual('failed', service.training_status()['status'])
        self.assertEqual(b'new-model', self.path.read_bytes())
