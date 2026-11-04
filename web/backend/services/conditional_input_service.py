"""Read an exact local source workbook for the authenticated research workspace."""
import os
from pathlib import Path
import pandas as pd
from models.training.t2dm.t2dm_pipeline import DEFAULT_DATA_DIR

ROOT = Path(__file__).resolve().parents[3]


def local_conditional_input(patient_id):
    directory = Path(os.getenv('T2DM_DATA_DIR', str(DEFAULT_DATA_DIR))).resolve()
    # Match enumerated filenames: never resolve a user-controlled path.
    matches = [p for p in directory.glob('*.xls*') if p.stem == patient_id]
    if len(matches) != 1:
        raise LookupError('No unique local source workbook matches this record.')
    frame = pd.read_excel(matches[0], keep_default_na=False)
    frame['Patient Number'] = patient_id
    summary_path = Path(os.getenv('T2DM_SUMMARY_PATH', str(ROOT / 'data/raw/cleaned_Shanghai_T2DM_Summary.xlsx')))
    summary = pd.read_excel(summary_path)
    selected = summary[summary['Patient Number'].astype(str) == patient_id]
    if len(selected) != 1:
        raise LookupError('No unique exact-visit summary matches this record.')
    import json
    return {'patient_id': patient_id, 'source_dataset': 'ShanghaiT2DM',
            'rows': json.loads(frame.to_json(orient='records', date_format='iso')),
            'summary': json.loads(selected.to_json(orient='records', date_format='iso'))[0]}
