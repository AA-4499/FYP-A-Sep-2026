"""Clinical patient records from Supabase; no generated patient profiles."""
from __future__ import annotations
import math
import requests
from models.training.supabase_io import SupabaseStorageError, supabase_config, supabase_headers


def _number(value):
    if value is None or isinstance(value, bool) or str(value).strip() == '':
        return None
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (ValueError, TypeError):
        return None


def _summaries(patient_id=None):
    url, key = supabase_config()
    records = []
    while True:
        params = {'select': '*', 'order': 'Patient Number.asc'}
        if patient_id is not None:
            params['Patient Number'] = f'eq.{patient_id}'
        try:
            response = requests.get(f'{url}/rest/v1/patient_summary',
                headers={**supabase_headers(key), 'Range': f'{len(records)}-{len(records)+999}'}, params=params, timeout=30)
            response.raise_for_status()
            batch = response.json()
        except (requests.RequestException, ValueError):
            raise SupabaseStorageError('Clinical records could not be retrieved from Supabase.') from None
        if not isinstance(batch, list):
            raise SupabaseStorageError('Supabase returned an invalid patient summary response.')
        records.extend(batch)
        if len(batch) < 1000:
            return records


def _profile(row):
    record_id = str(row['Patient Number'])
    hba1c = _number(row.get('HbA1c (mmol/mol)'))
    fasting = _number(row.get('Fasting Plasma Glucose (mg/dl)'))
    return {
        'id': record_id, 'name': f'Patient {record_id}', 'source': 'supabase',
        'age': _number(row.get('Age (years)')), 'bmi': _number(row.get('BMI (kg/m\u00b2)')),
        'gender': {1: 'Female', 2: 'Male'}.get(row.get('Gender (Female=1, Male=2)')),
        'condition': row.get('Type of Diabetes'),
        'hba1c': round(hba1c * .09148 + 2.152, 1) if hba1c is not None else None,
        'fasting_glucose': round(fasting / 18.0182, 1) if fasting is not None else None,
        'diabetes_duration_years': _number(row.get('Duration of diabetes (years)')),
        'ldl_cholesterol': _number(row.get('Low-Density Lipoprotein Cholesterol (mmol/L)')),
        'hdl_cholesterol': _number(row.get('High-Density Lipoprotein Cholesterol (mmol/L)')),
        'triglycerides': _number(row.get('Triglyceride (mmol/L)')),
        'egfr': _number(row.get('Estimated Glomerular Filtration Rate  (ml/min/1.73m\u00b2)')),
        'risk_category': None, 'recorded_fields': row,
    }


def list_patients(query='', page=1, per_page=10):
    if page < 1 or not 1 <= per_page <= 250:
        raise ValueError('Use page >= 1 and per_page between 1 and 250.')
    profiles = [_profile(row) for row in _summaries()]
    search = query.casefold().strip()
    if search:
        profiles = [p for p in profiles if search in f"{p['id']} {p['name']} {p['condition'] or ''}".casefold()]
    start = (page - 1) * per_page
    return {'patients': profiles[start:start+per_page], 'total': len(profiles), 'page': page, 'per_page': per_page, 'source': 'supabase'}


def get_patient(patient_id):
    rows = _summaries(str(patient_id))
    exact = next((row for row in rows if str(row.get('Patient Number')) == str(patient_id)), None)
    return _profile(exact) if exact is not None else None


def get_default_patient_id():
    # Patient identifiers are selected after authenticated record retrieval.
    return None
