"""Train a medium conditional T2DM GRU using only explicitly selected data/raw files."""
import argparse
import hashlib
import json
from pathlib import Path
import warnings

import numpy as np
import pandas as pd
import torch

from models.training.local_v3_inputs import engineer_record, FOOD_PATH
from models.training.train_chronological import chronological_split, train_variant
from models.training.train_shanghai_gru import write_json


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data-dir', default='data/raw/Shanghai_T2DM')
    parser.add_argument('--summary', default='data/raw/Shanghai_T2DM_Summary.xlsx')
    parser.add_argument('--output', required=True)
    parser.add_argument('--epochs', type=int, default=40)
    parser.add_argument('--patience', type=int, default=8)
    parser.add_argument('--seed', type=int, default=20261106)
    parser.add_argument('--batch-size', type=int, default=256)
    parser.add_argument('--training-stride', type=int, default=4)
    parser.add_argument('--hidden-dim', type=int, default=64)
    parser.add_argument('--head-dim', type=int, default=32)
    args = parser.parse_args()
    torch.set_num_threads(2); torch.set_num_interop_threads(1); torch.use_deterministic_algorithms(True)
    warnings.filterwarnings('ignore', category=UserWarning, module='openpyxl')
    output = Path(args.output); output.mkdir(parents=True, exist_ok=True)
    if any(output.iterdir()):
        parser.error('Output must be empty; existing runs are preserved.')
    summary_path = Path(args.summary); summary = pd.read_excel(summary_path)
    ids = summary['Patient Number'].astype(str).str.strip()
    if ids.duplicated().any():
        raise ValueError('Duplicate exact-session summary IDs.')
    summaries = dict(zip(ids, summary.to_dict('records')))
    sessions = []; audit = []
    for path in sorted(Path(args.data_dir).glob('*.xls*')):
        if path.stem not in summaries:
            raise ValueError(f'Missing exact-session demographics: {path.stem}')
        frame = pd.read_excel(path, keep_default_na=False)
        session = engineer_record(frame, summaries[path.stem], path.stem)
        sessions.append(session)
        audit.append({'path':path.as_posix(), 'sha256':hashlib.sha256(path.read_bytes()).hexdigest(), 'rows':len(frame), 'retained_timestamps':len(session['times']), 'missing_cgm':int(np.isnan(session['glucose']).sum()), 'record':path.stem, **session['coverage']})
    assignments, manifest = chronological_split(sessions)
    write_json(output/'ShanghaiT2DM_split_manifest.json', manifest)
    write_json(output/'source_audit.json', audit)
    write_json(output/'run_provenance.json', {'arguments':vars(args), 'source':'local data/raw workbooks, not Sample or the downloaded teacher archive', 'source_files':len(audit), 'patients':len({s['patient'] for s in sessions}), 'summary_sha256':hashlib.sha256(summary_path.read_bytes()).hexdigest(), 'food_reference_sha256':hashlib.sha256(FOOD_PATH.read_bytes()).hexdigest(), 'torch':str(torch.__version__), 'numpy':np.__version__, 'pandas':pd.__version__})
    print(json.dumps({'files':len(audit), 'rows':sum(a['rows'] for a in audit), 'partitions':manifest['retained_rows'], 'features':{k:sum(a[k] for a in audit) for k in ['described_meals','complete_reference_meals','modeled_bolus_events']} }), flush=True)
    result = train_variant('ShanghaiT2DM', 'gru_future_event_decoder', assignments, manifest, output, args)
    # evaluate_local_v3 separately replays this checkpoint and compares both sizes.
    write_json(output/'completion.json', {'all_complete':True, 'models':1, 'source_files':len(audit), 'test_metrics':result['test_metrics']})


if __name__ == '__main__':
    main()
