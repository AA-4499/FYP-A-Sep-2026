"""Private Supabase artifact storage plus a transactional database activation/lease."""
from __future__ import annotations
import gzip
import hashlib
import json
import logging
import os
from pathlib import Path
import tempfile
import threading
import uuid
from urllib.parse import quote

import requests
from models.training.supabase_io import supabase_config, supabase_headers


def enabled():
    return os.getenv('T2DM_STORAGE_BACKEND', 'disk').strip().lower() == 'supabase'


def fail(message):
    from .model_store import ModelStorageError
    raise ModelStorageError(message)


def cache_directory():
    url, _ = supabase_config()
    return Path(os.getenv('T2DM_CACHE_DIR', str(Path(tempfile.gettempdir()) / ('t2dm-cache-' + hashlib.sha256(url.encode()).hexdigest()[:12])))).resolve()


def bucket():
    name = os.getenv('T2DM_STORAGE_BUCKET', 'model-artifacts')
    if not name or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in name):
        fail('T2DM_STORAGE_BUCKET must be a lowercase bucket name.')
    return name


def control(action='read', run_id=None, payload=None):
    url, key = supabase_config()
    try:
        response = requests.post(url + '/rest/v1/rpc/model_storage_control', headers=supabase_headers(key),
            json={'p_action': action, 'p_model_id': 'legacy-gru', 'p_run_id': run_id, 'p_payload': payload or {}}, timeout=30)
        if not response.ok:
            error = response.json()
            if error.get('code') in ('PGRST202', '42883', '42P01'):
                fail('Supabase model storage is not installed. Run docs/supabase_model_storage.sql in the SQL Editor.')
            if error.get('code') == 'P0001':
                # Only known operator-safe lease errors are surfaced.
                message = error.get('message', '')
                if message in ('A training job is already running','The minimum 7-day training interval has not elapsed'):
                    raise ValueError(message)
                fail('The model storage transaction rejected the run or its training lease. The previous release remains active.')
            fail('Supabase rejected model storage access. Check the server secret and service-role function grants.')
        state = response.json()
        if not isinstance(state, dict) or 'active' not in state or 'job' not in state:
            fail('Supabase returned invalid model storage state.')
        return state
    except (requests.RequestException, json.JSONDecodeError):
        fail('Supabase model storage is unavailable. No replacement checkpoint has been selected.')


def require_storage():
    control()
    url, key = supabase_config()
    try:
        response = requests.get(url + '/storage/v1/bucket/' + bucket(), headers=supabase_headers(key), timeout=20)
        if not response.ok or response.json().get('public') is not False:
            fail('Create the private model-artifacts Storage bucket and grant only server access; a public model bucket is not accepted.')
        directory = cache_directory()
        directory.mkdir(parents=True, exist_ok=True)
        fd, temporary = tempfile.mkstemp(dir=directory)
        os.close(fd)
        os.unlink(temporary)
        return directory
    except (requests.RequestException, ValueError, OSError):
        fail('The private model bucket or local download cache is unavailable or not writable.')


def object_url(path):
    parts = path.split('/')
    if len(parts) != 4 or parts[0:2] != ['legacy-gru','versions'] or parts[3] not in ('model.pt','baseline.json.gz'):
        fail('The model release contains an invalid artifact path.')
    try:
        uuid.UUID(parts[2])
    except (ValueError, TypeError):
        fail('The model release has an invalid version identifier.')
    url, _ = supabase_config()
    return url + '/storage/v1/object/' + quote(bucket(), safe='') + '/' + quote(path, safe='/')


def upload(path, content, content_type):
    _, key = supabase_config()
    try:
        response = requests.post(object_url(path), headers={**supabase_headers(key), 'Content-Type': content_type}, data=content, timeout=90)
        if not response.ok:
            fail('A model artifact could not be uploaded. The active release and baseline were not changed.')
    except requests.RequestException:
        fail('Model artifact upload was not confirmed. The active release and baseline were not changed.')


def download(path, digest, suffix):
    if not isinstance(digest, str) or len(digest) != 64 or any(c not in '0123456789abcdef' for c in digest):
        fail('The active model artifact has no valid integrity digest.')
    directory = cache_directory()
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / (digest + suffix)
    if target.is_file() and hashlib.sha256(target.read_bytes()).hexdigest() == digest:
        return target
    _, key = supabase_config()
    try:
        response = requests.get(object_url(path).replace('/object/', '/object/authenticated/', 1), headers=supabase_headers(key), timeout=90)
        if not response.ok or hashlib.sha256(response.content).hexdigest() != digest:
            fail('The active model artifact is missing or failed its SHA-256 check. Bundled weights will not be substituted.')
        fd, temporary = tempfile.mkstemp(dir=directory)
        try:
            with os.fdopen(fd, 'wb') as stream:
                stream.write(response.content); stream.flush(); os.fsync(stream.fileno())
            os.replace(temporary, target)
        finally:
            if os.path.exists(temporary): os.unlink(temporary)
        return target
    except (requests.RequestException, OSError):
        fail('The active model could not be downloaded or cached. Retry when Supabase storage is available.')


def read_active():
    active = control()['active']
    if active is None:
        return None
    try:
        result = dict(active)
        download(active['checkpoint'], active['model_sha256'], '.pt')
        result['baseline'] = None
        if active.get('baseline_object'):
            baseline = download(active['baseline_object'], active['baseline_sha256'], '.json.gz')
            result['baseline'] = json.loads(gzip.decompress(baseline.read_bytes()))
        return result
    except (KeyError, TypeError, ValueError, OSError):
        fail('The active cloud model release or baseline is invalid; restore its complete registered version.')


class Lease:
    def __init__(self, run_id, directory):
        self.run_id, self.parent = run_id, directory
        self.stop = threading.Event()
        self.thread = threading.Thread(target=self.heartbeat, daemon=True)
        self.thread.start()

    def heartbeat(self):
        while not self.stop.wait(60):
            try:
                control('renew', self.run_id)
            except Exception:
                # Activation itself rechecks ownership and expiry in the database.
                logging.exception('Model training lease renewal failed')

    def rmdir(self):
        self.stop.set()
        try:
            control('release', self.run_id)
        except Exception:
            logging.exception('Model lease release was not confirmed; it will expire in Supabase')


def acquire(job):
    control('acquire', job['run_id'], job)
    return Lease(job['run_id'], cache_directory())


def save_job(job):
    control('job', job['run_id'], job)


def activate(candidate, *, run_id, baseline, comparison, activated_at):
    if comparison.get('accepted') is not True and comparison.get('initialization') is not True:
        fail('A candidate must pass its quality gate before cloud activation.')
    run_id = str(uuid.UUID(run_id))
    data = Path(candidate).read_bytes()
    prefix = f'legacy-gru/versions/{run_id}/'
    checkpoint = prefix + 'model.pt'
    upload(checkpoint, data, 'application/octet-stream')
    active = {'schema': 1, 'run_id': run_id, 'checkpoint': checkpoint,
              'model_sha256': hashlib.sha256(data).hexdigest(), 'activated_at': activated_at,
              'comparison': {**comparison, 'accepted': True}, 'baseline_object': None}
    if baseline is not None:
        compressed = gzip.compress(json.dumps(baseline, allow_nan=False, separators=(',', ':')).encode(), mtime=0)
        active.update(baseline_object=prefix+'baseline.json.gz', baseline_sha256=hashlib.sha256(compressed).hexdigest())
        upload(active['baseline_object'], compressed, 'application/gzip')
    # This one database transaction publishes checkpoint + baseline and verifies the lease.
    control('activate', run_id, active)
    return {**active, 'baseline': baseline}
