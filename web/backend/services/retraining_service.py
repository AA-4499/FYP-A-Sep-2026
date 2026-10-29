"""Run one background training job per shared model directory; publish atomically."""
from __future__ import annotations

import hashlib
import json
import logging
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def checkpoint_path():
    return Path(os.getenv('T2DM_CHECKPOINT_PATH', str(ROOT / 'models/weights/gru_t2dm_forecaster.pt'))).resolve()


def _now():
    return datetime.now(timezone.utc).isoformat()


def _write(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, allow_nan=False), encoding='utf-8')
    os.replace(temporary, path)


def training_status():
    path = checkpoint_path().parent / 'retraining.json'
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'status': 'idle'}


def recover_interrupted_training():
    """Called once when the configured single-worker server starts."""
    destination = checkpoint_path()
    lock = destination.parent / '.retraining-lock'
    if lock.exists():
        job = training_status()
        if job.get('status') == 'running':
            _write(destination.parent / 'retraining.json', {**job, 'status': 'failed',
                'finished_at': _now(), 'error': 'Training was interrupted by a server restart. Run retraining again.'})
        lock.rmdir()


def start_training(created_by):
    destination = checkpoint_path()
    destination.parent.mkdir(parents=True, exist_ok=True)
    lock = destination.parent / '.retraining-lock'
    try:
        lock.mkdir()
    except FileExistsError:
        raise ValueError('A retraining job is already running. Refresh its status.') from None
    job = {'run_id': str(uuid.uuid4()), 'status': 'running', 'started_at': _now(), 'created_by': created_by}
    try:
        _write(destination.parent / 'retraining.json', job)
        threading.Thread(target=_train, args=(destination, lock, job), daemon=True).start()
    except Exception:
        lock.rmdir()
        raise
    return job


def _train(destination, lock, job):
    status_file = destination.parent / 'retraining.json'
    try:
        from models.training.supabase_io import supabase_config
        from models.training.train_from_supabase import (
            fetch_all_supabase_rows, prepare_supabase_timelines, train_on_supabase_timelines,
        )
        from models.training.t2dm.t2dm_pipeline import load_forecaster_checkpoint
        url, key = supabase_config()
        rows = fetch_all_supabase_rows(url, key)
        timelines = prepare_supabase_timelines(rows)
        staging = destination.parent / 'training-runs' / job['run_id']
        result = train_on_supabase_timelines(timelines, staging, epochs=25, copy_to_weights=False)
        candidate = staging / 'gru_t2dm_forecaster.pt'
        load_forecaster_checkpoint(str(candidate), device_name='cpu')
        metrics = result['test_metrics']
        # Reject non-finite metrics before changing the active checkpoint.
        json.dumps(metrics, allow_nan=False)
        digest = hashlib.sha256(candidate.read_bytes()).hexdigest()
        os.replace(candidate, destination)
        job = {**job, 'status': 'completed', 'finished_at': _now(), 'rows': len(rows),
               'records': len(timelines), 'metrics': metrics, 'model_sha256': digest}
    except Exception:
        logging.exception('Admin model retraining failed')
        job = {**job, 'status': 'failed', 'finished_at': _now(),
               'error': 'Training failed. The previous model is still active. Check model service logs and CGM data coverage.'}
    finally:
        try:
            _write(status_file, job)
        finally:
            lock.rmdir()
