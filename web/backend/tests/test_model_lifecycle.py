"""Data-policy, paired evaluation and durable activation acceptance regressions."""
from __future__ import annotations

import copy
import json
import os
import tempfile
import subprocess
import sys
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch, Mock

import pandas as pd

from test_forecast_api import ROOT, token
import app as dashboard
from services import model_store as store, retraining_service as service
from services.retraining_policy import inventory, policy, recommendation
from services.model_quality import acceptance, compare_models, ModelQualityError


def rows(count=80, record='2000_0_20200101'):
    return [{'Patient Number': record, 'Date': stamp.isoformat(), 'CGM (mg / dl)': 120 + i % 8}
            for i, stamp in enumerate(pd.date_range('2020-01-01', periods=count, freq='15min', tz='UTC'))]


class RetrainingPolicyTests(unittest.TestCase):
    def test_invalid_duplicates_conflicts_and_short_segments_do_not_inflate_counts(self):
        source = rows()
        sample = source + [dict(source[1]), {**source[2], 'CGM (mg / dl)': 999},
                           {**source[0], 'Date': 'bad'}, {**source[0], 'CGM (mg / dl)': None},
                           {**source[0], 'CGM (mg / dl)': True}] + rows(20, 'short_record')
        result = inventory(sample)
        self.assertEqual(1, result['quality']['duplicate_rows'])
        self.assertEqual(2, result['quality']['conflicting_duplicate_rows'])
        self.assertEqual(3, result['quality']['invalid_rows'])
        self.assertEqual(22, result['quality']['short_segment_rows'])
        self.assertEqual(77, result['snapshot']['valid_observations'])
        self.assertEqual(1, result['snapshot']['complete_timelines'])
        # Reordering rows cannot change the snapshot, nor sum duplicate event doses.
        self.assertEqual(result['snapshot'], inventory(list(reversed(sample)))['snapshot'])

    def test_forty_observations_are_needed_for_a_trainable_segment(self):
        self.assertEqual(0, inventory(rows(39))['snapshot']['valid_observations'])
        self.assertEqual(40, inventory(rows(40))['snapshot']['valid_observations'])
        gapped = rows(80)
        gapped[39]['CGM (mg / dl)'] = None
        self.assertEqual(40, inventory(gapped)['snapshot']['valid_observations'])

    def test_threshold_interval_and_five_new_data_timelines_all_apply(self):
        before = inventory(sum([rows(40, f'{2000+i}_0') for i in range(5)], []))
        current = inventory(sum([rows(2200, f'{2000+i}_0') for i in range(5)], []))
        now = datetime(2026, 11, 10, tzinfo=timezone.utc)
        active = {'baseline': before['snapshot'], 'activated_at': (now - timedelta(days=8)).isoformat()}
        result = recommendation(current, active, now=now)
        self.assertTrue(result['recommended'])
        self.assertEqual(10800, result['new_observations'])
        self.assertEqual(10000, result['threshold'])
        active['activated_at'] = (now - timedelta(days=6)).isoformat()
        self.assertFalse(recommendation(current, active, now=now)['recommended'])
        # A 10% threshold can exceed the fixed 10,000-observation floor.
        active['baseline']['valid_observations'] = 200000
        self.assertEqual(20000, recommendation(current, active, now=now)['threshold'])
        active['baseline']['valid_observations'] = 200
        concentrated = inventory(rows(11000, '2000_0') + sum([rows(40, f'{2000+i}_0') for i in range(1, 5)], []))
        active['activated_at'] = (now - timedelta(days=8)).isoformat()
        self.assertFalse(recommendation(concentrated, active, now=now)['recommended'])

    def test_corrections_and_deletions_are_not_new_observations_and_missing_baseline_is_explicit(self):
        original = inventory(rows())
        updated = rows()
        updated[-1]['CGM (mg / dl)'] = 130
        current = inventory(updated)
        active = {'baseline': original['snapshot'], 'activated_at': '2026-10-01T00:00:00+00:00'}
        result = recommendation(current, active)
        self.assertEqual(0, result['new_observations'])
        self.assertEqual(1, result['changed_observations'])
        no_baseline = recommendation(current, None)
        self.assertFalse(no_baseline['recommended'])
        self.assertFalse(no_baseline['baseline_available'])
        self.assertEqual(0, no_baseline['new_observations'])
        self.assertNotIn('observations', no_baseline['current'])

    def test_each_exact_visit_is_counted_separately(self):
        result = inventory(rows(40, '2000_0_20200101') + rows(40, '2000_0_20200201'))
        self.assertEqual(2, result['snapshot']['complete_timelines'])
        self.assertEqual(1, result['snapshot']['patients'])


class DurableModelTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.seed = self.directory / 'seed.pt'
        self.seed.write_bytes(b'old model')
        self.env = patch.dict(os.environ, {'T2DM_MODEL_DIR': '', 'T2DM_CHECKPOINT_PATH': str(self.seed), 'RENDER': ''})
        self.env.start()
        self.addCleanup(self.env.stop)

    def publish(self, value=b'new model', baseline=None):
        candidate = self.directory / 'candidate.pt'
        candidate.write_bytes(value)
        return store.activate(candidate, run_id=str(uuid.uuid4()), baseline=baseline,
                              comparison={'accepted': True}, activated_at='2026-11-10T00:00:00+00:00')

    def test_model_and_baseline_survive_module_reload_and_bundled_seed_changes(self):
        baseline = inventory(rows())['snapshot']
        self.publish(baseline=baseline)
        self.seed.write_bytes(b'older redeployed bundle')
        script = "import sys; sys.path.insert(0,'web/backend'); from services.model_store import active_checkpoint_path; print(active_checkpoint_path().read_bytes().decode())"
        output = subprocess.check_output([sys.executable, '-c', script], cwd=ROOT, env=os.environ.copy(), text=True)
        self.assertEqual('new model', output.strip())
        self.assertEqual(b'new model', store.active_checkpoint_path().read_bytes())
        self.assertEqual(baseline, store.read_active()['baseline'])

    def test_pointer_write_failure_keeps_model_and_baseline_together(self):
        self.publish(b'first', {'snapshot': 'first'})
        pointer = (self.directory / 'active.json').read_bytes()
        with patch.object(store, 'atomic_json', side_effect=OSError('disk full')), self.assertRaises(OSError):
            self.publish(b'candidate', {'snapshot': 'second'})
        self.assertEqual(pointer, (self.directory / 'active.json').read_bytes())
        self.assertEqual(b'first', store.active_checkpoint_path().read_bytes())

    def test_corrupt_or_missing_release_never_falls_back_to_seed(self):
        self.publish()
        store.active_checkpoint_path().unlink()
        with self.assertRaises(store.ModelStorageError):
            store.active_checkpoint_path()

    def test_unconfigured_unwritable_and_unmounted_storage_have_clear_errors(self):
        with patch.dict(os.environ, {'T2DM_CHECKPOINT_PATH': '', 'T2DM_MODEL_DIR': ''}):
            with self.assertRaisesRegex(store.ModelStorageError, 'persistent storage'):
                store.require_storage()
        with patch.object(store.tempfile, 'mkstemp', side_effect=PermissionError()), self.assertRaisesRegex(store.ModelStorageError, 'not writable'):
            store.require_storage()
        with patch.dict(os.environ, {'RENDER': 'true', 'T2DM_PERSISTENT_MOUNT': str(self.directory)}), patch.object(store.os.path, 'ismount', return_value=False):
            with self.assertRaisesRegex(store.ModelStorageError, 'not mounted'):
                store.active_checkpoint_path()

    def test_restart_after_activation_reconciles_a_stale_running_job(self):
        active = self.publish(baseline=inventory(rows())['snapshot'])
        store.atomic_json(self.directory / 'retraining.json', {'run_id': active['run_id'], 'status': 'running'})
        lock = self.directory / '.retraining-lock'
        lock.mkdir()
        service.recover_interrupted_training()
        self.assertEqual('completed', service.training_status()['status'])
        self.assertFalse(lock.exists())


class ReadinessAndInitializationTests(unittest.TestCase):
    setUp = DurableModelTests.setUp

    def test_initialize_validates_the_seed_and_never_overwrites_an_active_release(self):
        import shutil
        shutil.copyfile(ROOT / 'models/weights/gru_t2dm_forecaster.pt', self.seed)
        with patch.dict(os.environ, {'T2DM_MODEL_DIR': str(self.directory / 'persistent')}):
            first = store.initialize_storage()
            self.assertIsNone(first['baseline'])
            self.assertEqual(first, store.initialize_storage())
            self.assertEqual(first['model_sha256'], store.read_active()['model_sha256'])

    def test_readiness_caches_hashed_counts_and_success_resets_growth_without_refetch(self):
        from models.training import train_from_supabase as trainer, supabase_io
        original = inventory(rows())
        current = inventory(rows(100))
        store.activate(self.seed, run_id=str(uuid.uuid4()), baseline=original['snapshot'], comparison={'accepted': True}, activated_at='2026-10-01T00:00:00+00:00')
        service._inventory_cache.clear()
        with patch.object(supabase_io, 'supabase_config', return_value=('url', 'key')), patch.object(trainer, 'fetch_all_supabase_rows', return_value=rows(100)) as fetch:
            result = service.data_readiness(refresh=True)
            self.assertEqual(20, result['new_observations'])
            self.assertEqual(20, service.data_readiness()['new_observations'])
            fetch.assert_called_once()
            self.assertNotIn('2000_0_20200101', json.dumps(result))
            cached = next(iter(service._inventory_cache.values()))[1]
            self.assertNotIn('rows', cached)
            store.activate(self.seed, run_id=str(uuid.uuid4()), baseline=current['snapshot'], comparison={'accepted': True}, activated_at='2026-11-01T00:00:00+00:00')
            self.assertEqual(0, service.data_readiness()['new_observations'])


class QualityGateTests(unittest.TestCase):
    def test_both_metrics_must_not_worsen_and_nonfinite_values_are_rejected(self):
        active = {'mae_mg_dl': 10.0, 'rmse_mg_dl': 12.0}
        self.assertTrue(acceptance(active, active, policy())[0])
        for candidate in [{'mae_mg_dl': 10.1, 'rmse_mg_dl': 11}, {'mae_mg_dl': 9, 'rmse_mg_dl': 12.1}]:
            self.assertFalse(acceptance(active, candidate, policy())[0])
        with self.assertRaises(ModelQualityError):
            acceptance(active, {'mae_mg_dl': float('nan'), 'rmse_mg_dl': 10}, policy())

    def test_real_identical_models_use_the_same_frozen_windows(self):
        from models.training.train_from_supabase import prepare_supabase_timelines
        timelines = prepare_supabase_timelines(rows(600))
        path = ROOT / 'models/weights/gru_t2dm_forecaster.pt'
        result = compare_models(path, path, timelines, policy())
        self.assertTrue(result['accepted'])
        self.assertEqual(result['active'], result['candidate'])
        self.assertGreaterEqual(result['evaluation_windows'], 100)
        self.assertEqual(64, len(result['evaluation_sha256']))

    def test_insufficient_holdout_never_activates(self):
        from models.training.train_from_supabase import prepare_supabase_timelines
        path = ROOT / 'models/weights/gru_t2dm_forecaster.pt'
        with self.assertRaisesRegex(ModelQualityError, 'Insufficient'):
            compare_models(path, path, prepare_supabase_timelines(rows()), policy())
