"""Audit source coverage of the legacy nine-feature forecasting pipeline."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import numpy as np
import pandas as pd

from .t2dm_pipeline import (
    DEFAULT_DATA_DIR, PROJECT_ROOT, FEATURE_COLUMNS, _find_event_columns,
    _find_glucose_column, _parse_event_value, _parse_glucose,
)


def audit(data_dir, summary_path):
    result = {name: 0 for name in ('workbooks', 'raw_rows', 'valid_cgm_rows', 'meal_rows',
        'insulin_rows', 'meal_rows_without_cgm', 'insulin_rows_without_cgm')}
    result.update(parsed_meal_mass=0., retained_meal_mass=0., insulin_columns={},
                  meal_text_examples=[], insulin_text_examples=[])
    for path in sorted(Path(data_dir).glob('*')):
        if path.suffix.lower() not in ('.xls', '.xlsx') or path.name.startswith('~$'):
            continue
        raw = pd.read_excel(path)
        meal_columns, insulin_columns = _find_event_columns(list(raw))
        valid = _parse_glucose(raw[_find_glucose_column(list(raw))]).notna()
        meal = pd.Series(0., index=raw.index)
        insulin = meal.copy()
        for column in meal_columns:
            values = raw[column].map(lambda value: _parse_event_value(value, meal=True))
            meal += values
            if len(result['meal_text_examples']) < 5:
                result['meal_text_examples'].extend(raw.loc[values.gt(0), column].astype(str).head(2).tolist())
        for column in insulin_columns:
            values = raw[column].map(lambda value: _parse_event_value(value, meal=False))
            insulin += values
            entry = result['insulin_columns'].setdefault(str(column), {'rows': 0, 'rows_without_cgm': 0})
            entry['rows'] += int(values.gt(0).sum())
            entry['rows_without_cgm'] += int((values.gt(0) & ~valid).sum())
            if len(result['insulin_text_examples']) < 5:
                result['insulin_text_examples'].extend(raw.loc[values.gt(0), column].astype(str).head(2).tolist())
        result['workbooks'] += 1
        result['raw_rows'] += len(raw)
        result['valid_cgm_rows'] += int(valid.sum())
        result['meal_rows'] += int(meal.gt(0).sum())
        result['insulin_rows'] += int(insulin.gt(0).sum())
        result['meal_rows_without_cgm'] += int((meal.gt(0) & ~valid).sum())
        result['insulin_rows_without_cgm'] += int((insulin.gt(0) & ~valid).sum())
        result['parsed_meal_mass'] += float(meal.sum())
        result['retained_meal_mass'] += float(meal[valid].sum())
    summary = pd.read_excel(summary_path)
    result['summary_rows'] = len(summary)
    result['summary_missing_fraction'] = {str(column): float(summary[column].isna().mean()) for column in summary}
    result['summary_has_measurement_dates'] = any('date' in str(column).lower() for column in summary)
    result['legacy_feature_columns'] = list(FEATURE_COLUMNS)
    result['legacy_uses_summary'] = False
    result['interpretation'] = 'Parsed numeric event counts; blank values do not establish verified absence of food or medication.'
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir', default=str(DEFAULT_DATA_DIR))
    parser.add_argument('--summary', default=str(PROJECT_ROOT/'data/raw/cleaned_Shanghai_T2DM_Summary.xlsx'))
    parser.add_argument('--output', default=str(PROJECT_ROOT/'models/evaluation/t2dm/audit/data_audit.json'))
    args = parser.parse_args()
    result = audit(args.data_dir, args.summary)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps({key: value for key, value in result.items() if not key.endswith('_examples') and key != 'summary_missing_fraction'}))


if __name__ == '__main__':
    main()
