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


def retrieve_forecast(patient_id: str, run_id: str):
    run_id = validate_run_id(run_id)
    url, key = supabase_config()
    try:
        response = requests.get(f'{url}/rest/v1/glucose_forecasts', headers=supabase_headers(key),
            params={'run_id': f'eq.{run_id}', 'patient_id': f'eq.{patient_id}',
                    'select': 'run_id,patient_id,model_sha256,created_at,output', 'limit': '2'}, timeout=30)
        if not response.ok:
            raise SupabaseStorageError('Saved prediction history could not be read. Check the output migration and server database permissions.')
        rows = response.json()
    except (requests.RequestException, ValueError):
        raise SupabaseStorageError('Saved prediction history could not be reached. Retry when the model service and Supabase are available.') from None
    if not isinstance(rows, list):
        raise SupabaseStorageError('Saved prediction history returned an invalid response.')
    if not rows:
        raise LookupError('No saved forecast matches this patient and run ID.')
    if len(rows) != 1 or not isinstance(rows[0], dict):
        raise SupabaseStorageError('Saved prediction history returned inconsistent records.')
    row = rows[0]
    output = row.get('output')
    if (row.get('run_id') != run_id or row.get('patient_id') != patient_id or not isinstance(output, dict)
            or output.get('patient_id') != patient_id or output.get('model_sha256') != row.get('model_sha256')):
        raise SupabaseStorageError('Saved prediction patient or model identity is inconsistent.')
    return row
