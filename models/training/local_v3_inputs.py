"""Shared raw-record feature engineering for local training and server inference."""
import json
from pathlib import Path

import numpy as np
import pandas as pd

from models.training import train_shanghai_supported_features as base
from models.training import train_shanghai_carb_iob as exposure

ROOT = Path(__file__).resolve().parents[2]
FOOD_PATH = ROOT / 'web/frontend/public/conditional-models/foods.json'


def food_lookup():
    return {k: (float(v), None) for k, v in json.loads(FOOD_PATH.read_text(encoding='utf-8'))['foods'].items()}


def engineer_record(frame, summary, record_id, lookup=None):
    """No interpolation; duplicate timestamps use the last source row, as in the UI."""
    lookup = food_lookup() if lookup is None else lookup
    frame = frame.copy().fillna('')
    date = next((c for c in frame if base.normalize(c) == 'date'), None)
    glucose = next((c for c in frame if base.normalize(c).startswith('cgmmg') or base.normalize(c) == 'cgm'), None)
    if date is None or glucose is None:
        raise ValueError('Date and CGM (mg / dl) columns are required.')
    frame['_time'] = pd.to_datetime(frame[date], errors='coerce', utc=True, format='mixed').dt.tz_localize(None)
    frame = frame.dropna(subset=['_time']).sort_values('_time', kind='stable').drop_duplicates('_time', keep='last')
    if frame.empty:
        raise ValueError('No valid source timestamps.')
    times = pd.DatetimeIndex(frame['_time']); ns = times.as_unit('ns').asi8
    values = pd.to_numeric(frame[glucose], errors='coerce').to_numpy(dtype=np.float32)
    values[(~np.isfinite(values)) | (values <= 0)] = np.nan
    meals = []; doses = []; excluded = []
    routes = base.route_columns(frame)
    unavailable = {'/', '-', '--', 'na', 'n/a', 'null', 'none', 'nan', 'data not available', 'not available', '未记录', '未記錄', '无记录'}
    def status(text):
        text = exposure.normalize(text)
        return 'blank' if not text else 'unavailable' if text in unavailable else 'description'
    for (_, row), t in zip(frame.iterrows(), ns):
        text = str(row.get('Dietary intake', '')).strip()
        chinese = [str(row[c]).strip() for c in frame if '饮食' in str(c) or '进食' in str(c)]
        if status(text) != 'description':
            text = next((s for s in chinese if status(s) == 'description'), text)
        if status(text) == 'blank':
            text = next((s for s in chinese if status(s) == 'unavailable'), text)
        state = status(text)
        carb = exposure.convert_meal(exposure.parse_items(text), lookup)[0] if state == 'description' else np.nan
        meals.append([float(carb) if np.isfinite(carb) else 0., float(state == 'description'), float(state == 'description' and not np.isfinite(carb)), float(state == 'unavailable')])
        for route, columns in routes.items():
            supplied = [row[c] for c in columns if base.present(row[c])]
            if not supplied:
                continue
            amount, _, missing = base.insulin_amount(supplied[0])
            curve = exposure.bolus_curve(supplied[0]) if route == 'sc_dose_units' else exposure.bolus_curve('Novolin R') if route == 'pump_bolus_units' else None
            if curve is not None and not missing and len({str(v).strip() for v in supplied}) == 1:
                doses.append((int(t), amount, curve))
            else:
                excluded.append(int(t))
    meals = np.asarray(meals)
    iob, annotation = exposure.modeled_iob(times, doses)
    excluded = np.asarray(excluded, dtype=np.int64)
    coverage = np.asarray([np.any((excluded <= t) & (excluded > t - 480 * 60e9)) for t in ns], dtype=float)
    recent = [np.asarray([meals[(ns <= t-lower*60e9) & (ns > t-upper*60e9), 0].sum() for t in ns]) for lower, upper in [(0,60),(60,180),(180,360)]]
    hour = times.hour + times.minute / 60
    dynamic = np.column_stack([values, np.sin(2*np.pi*hour/24), np.cos(2*np.pi*hour/24), meals[:,0], *recent, meals[:,1:], iob, annotation, coverage, (ns-ns[0] < 480*60e9).astype(float)]).astype(np.float32)
    def demographic(prefix):
        value = next((v for k, v in summary.items() if base.normalize(k).startswith(prefix)), None)
        number = pd.to_numeric(value, errors='coerce')
        return float(number) if pd.notna(number) and np.isfinite(number) and number > 0 else np.nan
    age, bmi = demographic('age'), demographic('bmi')
    return {'record': record_id, 'patient': record_id.split('_')[0], 'times': times.to_numpy(), 'glucose': values,
            'dynamic': dynamic, 'exposure_dynamic': dynamic,
            'static': np.asarray([age,bmi,float(not np.isfinite(age)),float(not np.isfinite(bmi))], dtype=np.float32),
            'doses': doses, 'excluded': excluded,
            'coverage': {'described_meals':int(meals[:,1].sum()), 'complete_reference_meals':int(((meals[:,1]==1)&(meals[:,2]==0)).sum()), 'modeled_bolus_events':len(doses), 'excluded_insulin_annotations':len(excluded)}}
