"""Approved policy and deterministic counts of trainable, newly added observations."""
from __future__ import annotations

import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[3]


def policy():
    value = json.loads((ROOT / 'config/retraining-policy.json').read_text(encoding='utf-8'))
    for key in ('minimum_new_observations', 'minimum_new_timelines', 'minimum_interval_days', 'sequence_length', 'minimum_segment_observations', 'minimum_evaluation_windows'):
        if type(value.get(key)) is not int or value[key] < 1:
            raise ValueError('Invalid retraining policy configuration.')
    for key in ('minimum_growth_fraction', 'maximum_mae_degradation', 'maximum_rmse_degradation'):
        if not isinstance(value.get(key), (int, float)) or not math.isfinite(value[key]) or not 0 <= value[key] <= 1:
            raise ValueError('Invalid retraining policy configuration.')
    if value['minimum_segment_observations'] < math.ceil((value['sequence_length'] + 1) / 0.64):
        raise ValueError('The minimum segment must support a training window before validation.')
    if value.get('approval_status') != 'approved' or value.get('automatic_training') is not False:
        raise ValueError('Retraining policy must be approved and keep automatic training disabled.')
    return value


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()


EVENTS = ('Dietary intake', 'Insulin dose - s.c.', 'Insulin dose - i.v.',
          'CSII - bolus insulin (Novolin R, IU)', 'CSII - basal insulin (Novolin R, IU / H)')


def inventory(raw_rows, *, sequence_length=24, minimum_segment_observations=None):
    """Exact-visit/time identity; conflicting duplicates are excluded, never averaged."""
    groups = {}
    invalid = 0
    for row in raw_rows:
        if not isinstance(row, dict):
            invalid += 1
            continue
        try:
            identity = str(row.get('Patient Number') or '').strip()
            raw_time = row.get('Date')
            if not identity or not isinstance(raw_time, str) or not raw_time.strip():
                raise ValueError()
            stamp = pd.to_datetime(raw_time, utc=True, errors='raise')
            glucose = row.get('CGM (mg / dl)')
            if isinstance(glucose, bool) or glucose is None or not str(glucose).strip():
                raise ValueError()
            glucose = float(str(glucose).replace(',', ''))
            if not math.isfinite(glucose) or glucose <= 0 or pd.isna(stamp):
                raise ValueError()
            normalized = {'Patient Number': identity, 'Date': stamp.isoformat(), 'CGM (mg / dl)': glucose,
                          **{key: '' if row.get(key) is None else str(row[key]).strip() for key in EVENTS}}
            key = (identity, stamp)
            groups.setdefault(key, []).append(normalized)
        except (ValueError, TypeError, OverflowError):
            invalid += 1
    records = {}
    duplicates = conflicts = 0
    for (identity, stamp), versions in groups.items():
        variants = {digest(row) for row in versions}
        if len(variants) != 1:
            conflicts += len(versions)
            continue
        duplicates += len(versions) - 1
        records.setdefault(identity, []).append((stamp, versions[0]))
    eligible = []
    short = 0
    for identity, readings in sorted(records.items()):
        readings.sort(key=lambda entry: entry[0])
        segments = [[]]
        for item in readings:
            if segments[-1] and abs(item[0] - segments[-1][-1][0] - pd.Timedelta(minutes=15)) > pd.Timedelta(seconds=1):
                segments.append([])
            segments[-1].append(item)
        for segment in segments:
            # 40 observations support a 24-step history before the train/validation cut.
            if len(segment) >= (minimum_segment_observations or math.ceil((sequence_length + 1) / 0.64)):
                eligible.extend(item[1] for item in segment)
            else:
                short += len(segment)
    record_hashes = {row['Patient Number']: digest(row['Patient Number']) for row in eligible}
    observations, observation_records = {}, {}
    for row in eligible:
        key = digest([row['Patient Number'], row['Date']])
        observations[key] = digest(row)
        observation_records[key] = record_hashes[row['Patient Number']]
    record_ids = set(record_hashes.values())
    patient_ids = {digest(row['Patient Number'].split('_')[0]) for row in eligible}
    snapshot = {'observations': observations, 'record_ids': sorted(record_ids), 'patient_ids': sorted(patient_ids),
                'valid_observations': len(observations), 'complete_timelines': len(record_ids),
                'patients': len(patient_ids), 'dataset_sha256': digest(observations)}
    return {'rows': eligible, 'snapshot': snapshot, 'observation_records': observation_records,
            'quality': {'raw_rows': len(raw_rows), 'invalid_rows': invalid, 'duplicate_rows': duplicates,
                        'conflicting_duplicate_rows': conflicts, 'short_segment_rows': short}}


def recommendation(current, active, rules=None, *, now=None):
    rules = rules or policy()
    now = now or datetime.now(timezone.utc)
    snapshot = current['snapshot']
    baseline = (active or {}).get('baseline')
    previous = baseline['observations'] if baseline else {}
    new_keys = set(snapshot['observations']) - set(previous)
    changed = sum(snapshot['observations'][key] != previous[key] for key in set(previous) & set(snapshot['observations']))
    minimum = max(rules['minimum_new_observations'], math.ceil((baseline or {}).get('valid_observations', 0) * rules['minimum_growth_fraction']))
    contributing = len({current['observation_records'][key] for key in new_keys})
    last_training = (active or {}).get('activated_at') if baseline else None
    elapsed = max(0.0, (now - datetime.fromisoformat(last_training)).total_seconds() / 86400) if last_training else None
    reasons = []
    if not baseline:
        reasons.append('No successful-training baseline exists; run the first quality-checked training manually.')
    if len(new_keys) < minimum:
        reasons.append('The minimum new-data threshold has not been reached.')
    if contributing < rules['minimum_new_timelines']:
        reasons.append(f"New data must cover at least {rules['minimum_new_timelines']} trainable exact-visit timelines.")
    if elapsed is not None and elapsed < rules['minimum_interval_days']:
        reasons.append('The minimum interval since the last successful activation has not elapsed.')
    return {'recommended': not reasons, 'reasons': reasons, 'baseline_available': baseline is not None,
            'new_observations': len(new_keys) if baseline else 0,
            'changed_observations': changed, 'removed_observations': len(set(previous) - set(snapshot['observations'])),
            'new_data_timelines': contributing if baseline else 0, 'threshold': minimum,
            'additional_timelines': len(set(snapshot['record_ids']) - set((baseline or {}).get('record_ids', []))) if baseline else 0,
            'additional_patients': len(set(snapshot['patient_ids']) - set((baseline or {}).get('patient_ids', []))) if baseline else 0,
            'progress_fraction': min(1.0, len(new_keys) / minimum) if baseline else 0.0,
            'days_since_success': elapsed, 'last_success_at': last_training,
            'current': {key: snapshot[key] for key in ('valid_observations', 'complete_timelines', 'patients', 'dataset_sha256')},
            'baseline': {key: baseline[key] for key in ('valid_observations', 'complete_timelines', 'patients', 'dataset_sha256')} if baseline else None,
            'quality': current['quality'], 'policy': rules,
            'checked_at': now.isoformat(), 'automatic_training': False}
