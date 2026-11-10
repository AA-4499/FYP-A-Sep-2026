"""Manual retraining with immutable releases, a quality gate, and data accounting."""
from __future__ import annotations

import json
import logging
import threading
import time
import uuid
from datetime import datetime, timezone

from . import model_store
from .retraining_policy import inventory, policy, recommendation

_inventory_cache = {}
_inventory_lock = threading.Lock()


def checkpoint_path():
    return model_store.active_checkpoint_path()


def _now():
    return datetime.now(timezone.utc).isoformat()


def _write(path, value):
    model_store.atomic_json(path, value)


def training_status():
    path = model_store.storage_directory() / 'retraining.json'
    storage = model_store.storage_status()
    try:
        job = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'status': 'idle'}
        active = model_store.read_active()
    except (OSError, ValueError):
        raise model_store.ModelStorageError('Retraining state could not be read. Check the persistent model storage.') from None
    # Activation is the transaction boundary; reconcile a crash after pointer commit.
    if active and job.get('run_id') == active['run_id']:
        job = {**job, 'status': 'completed', 'finished_at': active['activated_at'],
               'model_sha256': active['model_sha256'], 'comparison': active['comparison']}
        job.pop('error', None)
    elif job.get('status') == 'running' and not (model_store.storage_directory() / '.retraining-lock').exists():
        job = {**job, 'status': 'failed', 'error': 'The training worker stopped without a completed activation. The previous model and baseline remain active.'}
    return {**job, 'storage': storage}


def data_readiness(*, refresh=False):
    from models.training.supabase_io import supabase_config
    from models.training.train_from_supabase import fetch_all_supabase_rows
    rules = policy()
    cache_key = str(model_store.storage_directory())
    # Never expose raw timelines/identifiers through the Admin progress endpoint.
    with _inventory_lock:
        cached = _inventory_cache.get(cache_key)
        if refresh or not cached or time.monotonic() - cached[0] > 300:
            url, key = supabase_config()
            current = inventory(fetch_all_supabase_rows(url, key), sequence_length=rules['sequence_length'], minimum_segment_observations=rules['minimum_segment_observations'])
            current.pop('rows', None)  # Do not retain raw CGM/event records in the five-minute cache.
            _inventory_cache[cache_key] = (time.monotonic(), current)
        else:
            current = cached[1]
    result = recommendation(current, model_store.read_active(), rules)
    result['storage'] = model_store.storage_status()
    if not result['storage']['writable']:
        result['recommended'] = False
        result['reasons'].append('Persistent model storage must be configured before retraining.')
    return result


def recover_interrupted_training():
    """For the documented single-worker server; never discard committed activation."""
    directory = model_store.storage_directory()
    lock = directory / '.retraining-lock'
    if lock.exists():
        job = training_status()
        job.pop('storage', None)
        if job.get('status') == 'running':
            job = {**job, 'status': 'failed', 'finished_at': _now(),
                   'error': 'Training was interrupted by a server restart. The previously activated model and data baseline remain active.'}
        _write(directory / 'retraining.json', job)
        lock.rmdir()


def start_training(created_by):
    directory = model_store.require_storage()
    destination = checkpoint_path()
    if not destination.is_file():
        raise model_store.ModelStorageError('The active checkpoint is missing. Initialize the persistent model store before retraining.')
    active = model_store.read_active()
    if active and active.get('baseline'):
        elapsed = datetime.fromisoformat(_now()) - datetime.fromisoformat(active['activated_at'])
        minimum_days = policy()['minimum_interval_days']
        if elapsed.total_seconds() < minimum_days * 86400:
            raise ValueError(f'The minimum {minimum_days}-day interval since the last successful activation has not elapsed.')
    lock = directory / '.retraining-lock'
    try:
        lock.mkdir()
    except FileExistsError:
        raise ValueError('A retraining job is already running. Refresh its status.') from None
    job = {'run_id': str(uuid.uuid4()), 'status': 'running', 'started_at': _now(), 'created_by': created_by}
    try:
        _write(directory / 'retraining.json', job)
        threading.Thread(target=_train, args=(destination, lock, job), daemon=True).start()
    except Exception:
        _write(directory / 'retraining.json', {**job, 'status': 'failed', 'finished_at': _now(), 'error': 'The training worker could not start; the active model was not changed.'})
        lock.rmdir()
        raise
    return job


def _train(destination, lock, job):
    status_file = lock.parent / 'retraining.json'
    try:
        from models.training.supabase_io import supabase_config
        from models.training.train_from_supabase import (
            fetch_all_supabase_rows, prepare_supabase_timelines, train_on_supabase_timelines,
        )
        from .model_quality import compare_models
        rules = policy()
        url, key = supabase_config()
        raw_rows = fetch_all_supabase_rows(url, key)
        current = inventory(raw_rows, sequence_length=rules['sequence_length'], minimum_segment_observations=rules['minimum_segment_observations'])
        del raw_rows
        if not current['rows']:
            raise ValueError('No valid complete CGM timeline is available for training.')
        # Keep full exact-visit identity even when the legacy parser shortens record IDs.
        groups = {}
        for row in current['rows']:
            groups.setdefault(row['Patient Number'], []).append(row)
        timelines = {identity: next(iter(prepare_supabase_timelines(rows).values())) for identity, rows in groups.items()}
        del groups
        current.pop('rows', None)
        current.pop('observation_records', None)
        staging = lock.parent / 'training-runs' / job['run_id']
        train_on_supabase_timelines(timelines, staging, epochs=25, sequence_length=rules['sequence_length'], copy_to_weights=False)
        candidate = staging / 'gru_t2dm_forecaster.pt'
        comparison = compare_models(destination, candidate, timelines, rules)
        finished = _now()
        job = {**job, 'finished_at': finished, 'rows': current['snapshot']['valid_observations'],
               'records': current['snapshot']['complete_timelines'], 'comparison': comparison,
               'metrics': comparison['candidate'], 'data_quality': current['quality']}
        if not comparison['accepted']:
            job = {**job, 'status': 'rejected', 'error': 'Candidate quality did not meet the activation rules. The previous model and data baseline remain active.'}
        else:
            active = model_store.activate(candidate, run_id=job['run_id'], baseline=current['snapshot'],
                                          comparison=comparison, activated_at=finished)
            job = {**job, 'status': 'completed', 'model_sha256': active['model_sha256']}
        with _inventory_lock:
            _inventory_cache.pop(str(lock.parent), None)
    except Exception as exc:
        logging.exception('Admin model retraining failed')
        from .model_quality import ModelQualityError
        safe_message = str(exc) if isinstance(exc, (ModelQualityError, model_store.ModelStorageError)) else 'Training failed. Check model service logs and valid CGM coverage. The previous model and data baseline remain active.'
        job = {**job, 'status': 'failed', 'finished_at': _now(), 'error': safe_message}
    finally:
        try:
            _write(status_file, job)
        except OSError:
            logging.exception('Could not persist training job status; the active release pointer remains authoritative')
        finally:
            lock.rmdir()
