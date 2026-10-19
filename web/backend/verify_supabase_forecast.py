"""Read live CGM, infer, save atomically, then verify stored output and FK joins."""
from __future__ import annotations

import argparse
import json
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'web/backend'))

from models.training.supabase_io import supabase_config, supabase_headers
from services.forecast_service import forecast_patient
from services.forecast_storage_service import save_forecast
import requests


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--patient-id', required=True)
    parser.add_argument('--horizon-hours', type=int, choices=(3, 6, 12), default=3)
    parser.add_argument('--run-id', default=str(uuid.uuid4()))
    args = parser.parse_args()
    print(json.dumps({'run_id': args.run_id, 'stage': 'reading_supabase_and_predicting'}), flush=True)
    result = forecast_patient(args.patient_id, {'source': 'supabase', 'horizon_hours': args.horizon_hours, 'events': []})
    receipt = save_forecast(result, [], args.run_id)
    # Repeating the same operation must not create a second set of child rows.
    repeat = save_forecast(result, [], args.run_id)
    assert repeat == receipt, 'Idempotent save receipt changed'
    url, key = supabase_config()
    response = requests.get(f'{url}/rest/v1/glucose_forecasts', headers=supabase_headers(key),
        params={'run_id': f'eq.{args.run_id}', 'select': 'output'}, timeout=30)
    response.raise_for_status()
    stored = response.json()
    assert len(stored) == 1 and stored[0]['output'] == result, 'Stored curves differ from model output'
    response = requests.get(f'{url}/rest/v1/model_runs', headers=supabase_headers(key), params={
        'run_id': f'eq.{args.run_id}',
        'select': 'run_id,glucose_forecasts(run_id,patient_summary("Patient Number")),training_predictions(id,patient_record_id),training_metrics(id,patient_record_id),training_timeline_splits(id,patient_record_id)',
    }, timeout=30)
    response.raise_for_status()
    joined = response.json()
    assert len(joined) == 1, 'Missing shared run record'
    assert joined[0]['glucose_forecasts'][0]['patient_summary']['Patient Number'] == args.patient_id, 'Missing patient-summary relationship'
    for table in ('training_predictions', 'training_metrics', 'training_timeline_splits'):
        assert all(row['patient_record_id'] == args.patient_id for row in joined[0][table]), 'Incorrect child patient foreign key'
    counts = {table: len(joined[0][table]) for table in ('glucose_forecasts', 'training_predictions', 'training_metrics', 'training_timeline_splits')}
    assert counts == {'glucose_forecasts': 1, 'training_predictions': len(result['testing']),
                      'training_metrics': 1 if result['metrics'] else 0, 'training_timeline_splits': 1}, 'Related output counts do not match'
    print(json.dumps({'verified': True, 'run_id': args.run_id, 'source': 'supabase',
        'forecast_points': len(result['baseline']) - 1, 'related_rows': counts,
        'full_output_readback_matches': True, 'duplicate_retry_verified': True, 'patient_foreign_keys_verified': True}), flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        # Avoid traceback/HTTP bodies containing credentials or patient rows.
        print(json.dumps({'verified': False, 'error_type': type(exc).__name__,
            'action': 'Check the SQL migration, Supabase credentials, and patient record ID.'}), flush=True)
        raise SystemExit(1)
