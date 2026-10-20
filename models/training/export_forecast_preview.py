"""Export local model results for a temporary, backend-free frontend preview.

Only baseline forecasts and CGM chart series are exported. No credentials,
demographics or database writes are involved. Re-run after changing the data
or the legacy checkpoint. This does not export the experimental candidate.
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import torch

from models.training.t2dm.t2dm_pipeline import DEFAULT_DATA_DIR, PROJECT_ROOT
from web.backend.services.forecast_service import forecast_patient


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=PROJECT_ROOT / 'web/frontend/public/forecast-preview')
    args = parser.parse_args()
    torch.set_num_threads(1)
    args.output.mkdir(parents=True, exist_ok=True)
    generated = datetime.now(timezone.utc).isoformat()
    records, unavailable = [], []
    files = sorted(path for path in DEFAULT_DATA_DIR.glob('*.xls*') if not path.name.startswith('~$'))
    for workbook in files:
        patient_id = workbook.stem
        try:
            result = forecast_patient(patient_id, {'source': 'local', 'horizon_hours': 12, 'events': []})
        except (ValueError, LookupError) as error:
            unavailable.append({'patient_id': patient_id, 'reason': str(error)})
            print('Unavailable:', patient_id, str(error), flush=True)
            continue
        result.update(source='preview', delivery='precomputed', generated_at=generated)
        result.pop('scenario')  # The preview has no interactive scenario inference.
        result['scenario_enabled'] = False
        (args.output / f'{patient_id}.json').write_text(json.dumps(result, separators=(',', ':'), allow_nan=False), encoding='utf-8')
        records.append(patient_id)
        print('Exported:', patient_id, flush=True)
    manifest = {'version': 1, 'generated_at': generated, 'records': records, 'unavailable': unavailable,
                'semantics': 'Local workbook baseline predictions and diagnostics. Not live inference; no Supabase write.'}
    (args.output / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(f'Complete: {len(records)} exported, {len(unavailable)} unavailable.', flush=True)


if __name__ == '__main__':
    main()
