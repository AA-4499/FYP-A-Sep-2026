"""Persist a complete forecast and its evaluation in one database transaction."""
from __future__ import annotations

import hashlib
import json
import uuid

import requests
from models.training.supabase_io import (
    SupabaseStorageError, supabase_config, supabase_headers, storage_failure,
)


def validate_run_id(value):
    try:
        return str(uuid.UUID(value))
    except (ValueError, TypeError, AttributeError):
        raise ValueError('run_id must be a valid UUID.') from None


def save_forecast(result: dict, events: list, run_id: str, created_by: str | None = None):
    url, key = supabase_config()
    # The inference service attaches the digest of the exact checkpoint used.
    model_digest = result['model_sha256']
    actual = {point['timestamp']: point['value'] for point in result['testing_actual']}
    testing_rows = [
        {'timestamp': point['timestamp'], 'predicted_glucose_mg_dl': point['value'],
         'actual_glucose_mg_dl': actual[point['timestamp']]}
        for point in result['testing']
    ]
    fingerprint = json.dumps({'output': result, 'events': events}, sort_keys=True, allow_nan=False, separators=(',', ':'))
    record = {
        'run_id': validate_run_id(run_id), 'patient_id': result['patient_id'],
        'record_id': result['record_id'], 'source': result['source'],
        'horizon_hours': result['horizon_hours'], 'forecast_start': result['forecast_start'],
        'model_sha256': model_digest,
        'payload_sha256': hashlib.sha256(fingerprint.encode()).hexdigest(),
        'scenario_events': events, 'output': result, 'created_by': created_by,
        'testing_rows': testing_rows,
    }
    try:
        response = requests.post(f'{url}/rest/v1/rpc/save_glucose_forecast',
            headers=supabase_headers(key), json={'p_run': record}, timeout=45)
    except requests.RequestException:
        raise SupabaseStorageError('Supabase save was not confirmed because the connection failed. Retry with the same run ID to avoid duplicate results.') from None
    if not response.ok:
        raise storage_failure(response)
    saved = response.json()
    if (not isinstance(saved, dict) or saved.get('saved') is not True
            or saved.get('run_id') != record['run_id'] or saved.get('patient_id') != result['patient_id']
            or saved.get('test_predictions_saved') != len(testing_rows)
            or saved.get('metrics_saved') != (1 if result['metrics'] else 0)
            or saved.get('timeline_splits_saved') != 1):
        raise SupabaseStorageError('Supabase returned an incomplete save confirmation. Retry with the same run ID.')
    return saved
