"""Immutable model releases; one atomic pointer commits model and data baseline."""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import tempfile
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BUNDLED = ROOT / 'models/weights/gru_t2dm_forecaster.pt'


class ModelStorageError(RuntimeError):
    """An operator-actionable error without credentials or patient data."""


def storage_directory():
    configured = os.getenv('T2DM_MODEL_DIR')
    if configured:
        return Path(configured).resolve()
    checkpoint = os.getenv('T2DM_CHECKPOINT_PATH')
    return Path(checkpoint).resolve().parent if checkpoint else BUNDLED.parent


def storage_configured():
    return bool(os.getenv('T2DM_MODEL_DIR') or os.getenv('T2DM_CHECKPOINT_PATH'))


def atomic_json(path, value):
    """Write and fsync a temporary file before committing it on the same volume."""
    path = Path(path)
    fd, temporary = tempfile.mkstemp(prefix=path.name + '.', suffix='.tmp', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            json.dump(value, stream, allow_nan=False, separators=(',', ':'))
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def require_storage():
    if not storage_configured():
        raise ModelStorageError('Retraining requires persistent storage. Configure T2DM_MODEL_DIR on a persistent disk; bundled weights are read-only deployment assets.')
    directory = storage_directory()
    if os.getenv('RENDER'):
        mount = os.getenv('T2DM_PERSISTENT_MOUNT', '')
        if not mount or not Path(mount).is_dir() or not os.path.ismount(mount):
            raise ModelStorageError('The persistent model disk is missing or not mounted. Set T2DM_PERSISTENT_MOUNT to the actual disk mount; a directory alone is not persistent storage.')
        if not directory.is_relative_to(Path(mount).resolve()):
            raise ModelStorageError('T2DM_MODEL_DIR must be inside T2DM_PERSISTENT_MOUNT.')
    try:
        directory.mkdir(parents=True, exist_ok=True)
        fd, probe = tempfile.mkstemp(prefix='.write-check-', dir=directory)
        os.close(fd)
        os.unlink(probe)
    except OSError:
        raise ModelStorageError('Model storage is missing or not writable. Check the persistent disk mount and service permissions.') from None
    return directory


def read_active():
    pointer = storage_directory() / 'active.json'
    if not pointer.exists():
        return None
    try:
        active = json.loads(pointer.read_text(encoding='utf-8'))
        path = (storage_directory() / active['checkpoint']).resolve()
        versions = storage_directory() / 'versions'
        if active.get('schema') != 1 or not path.is_relative_to(versions) or not path.is_file():
            raise ValueError('Invalid release')
        if hashlib.sha256(path.read_bytes()).hexdigest() != active['model_sha256']:
            raise ValueError('Digest mismatch')
        return active
    except (OSError, ValueError, KeyError, TypeError):
        raise ModelStorageError('The active model release is missing or corrupt. Restore the persistent release; the bundled model will not be substituted.') from None


def active_checkpoint_path():
    if storage_configured():
        # On hosted services, never infer from a replacement directory after a lost mount.
        if os.getenv('RENDER'):
            require_storage()
        active = read_active()
        if active:
            return (storage_directory() / active['checkpoint']).resolve()
        if os.getenv('T2DM_MODEL_DIR'):
            raise ModelStorageError('Persistent model storage has no active release. Initialize it once with python -m web.backend.services.model_store --initialize from the repository root.')
    return Path(os.getenv('T2DM_CHECKPOINT_PATH', str(BUNDLED))).resolve()


def activate(candidate, *, run_id, baseline, comparison, activated_at):
    directory = require_storage()
    # Use only UUID run identifiers in filesystem paths.
    release_id = str(uuid.UUID(str(run_id)))
    version = directory / 'versions' / release_id
    version.mkdir(parents=True, exist_ok=False)
    checkpoint = version / 'model.pt'
    try:
        with open(candidate, 'rb') as source, checkpoint.open('xb') as target:
            shutil.copyfileobj(source, target)
            target.flush()
            os.fsync(target.fileno())
        active = {'schema': 1, 'run_id': release_id, 'checkpoint': checkpoint.relative_to(directory).as_posix(),
                  'model_sha256': hashlib.sha256(checkpoint.read_bytes()).hexdigest(),
                  'activated_at': activated_at, 'baseline': baseline, 'comparison': comparison}
        # A failed pointer write leaves the previous model AND baseline untouched.
        atomic_json(directory / 'active.json', active)
        return active
    except Exception:
        # Leave failed release files for audit; they cannot be selected without the pointer.
        raise


def storage_status():
    try:
        require_storage()
        active = read_active()
        return {'configured': True, 'writable': True, 'initialized': active is not None,
                'active_model_sha256': active['model_sha256'] if active else None,
                'last_activation': active['activated_at'] if active else None}
    except ModelStorageError as exc:
        return {'configured': storage_configured(), 'writable': False, 'initialized': False, 'error': str(exc)}


def initialize_storage():
    require_storage()
    existing = read_active()
    if existing:
        return existing
    source = Path(os.getenv('T2DM_CHECKPOINT_PATH', str(BUNDLED))).resolve()
    if not source.is_file():
        raise ModelStorageError('The initial checkpoint is missing. Supply a validated bundled checkpoint before initializing storage.')
    from models.training.t2dm.t2dm_pipeline import load_forecaster_checkpoint
    try:
        load_forecaster_checkpoint(str(source), device_name='cpu')
    except Exception:
        raise ModelStorageError('The initial checkpoint failed validation. No active release was initialized; supply a compatible validated GRU checkpoint.') from None
    from datetime import datetime, timezone
    return activate(source, run_id=str(uuid.uuid4()), baseline=None, comparison={'initialization': True},
                    activated_at=datetime.now(timezone.utc).isoformat())


if __name__ == '__main__':
    import argparse
    import sys
    sys.path.insert(0, str(ROOT))
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--initialize', action='store_true', required=True)
    parser.parse_args()
    try:
        release = initialize_storage()
        print(json.dumps({'initialized': True, 'model_sha256': release['model_sha256']}))
    except (ModelStorageError, OSError, ValueError) as exc:
        print(json.dumps({'initialized': False, 'error': str(exc)}))
        raise SystemExit(1)
