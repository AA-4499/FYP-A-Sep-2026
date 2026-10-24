"""Export the existing checkpoint and exact repository histories for browser inference.

No training, cloud calls, credentials, demographics, or database writes.
Run: python -m models.training.export_browser_gru
"""
import base64
import hashlib
import json
from pathlib import Path
import numpy as np
import pandas as pd
import torch
from models.training.t2dm.t2dm_pipeline import (
    PROJECT_ROOT, DEFAULT_DATA_DIR, FEATURE_COLUMNS, MAX_SEQUENCE_GAP,
    load_forecaster_checkpoint, load_patient_timelines, forecast_from_history,
)


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, separators=(',', ':'), allow_nan=False), encoding='utf-8')


def main():
    torch.set_num_threads(1)
    checkpoint_path = PROJECT_ROOT / 'models/weights/gru_t2dm_forecaster.pt'
    model, checkpoint = load_forecaster_checkpoint(checkpoint_path)
    digest = hashlib.sha256(checkpoint_path.read_bytes()).hexdigest()
    destination = PROJECT_ROOT / 'web/frontend/public/browser-model'
    weights = {name: {'shape': list(tensor.shape), 'base64': base64.b64encode(tensor.detach().cpu().numpy().astype('<f4').tobytes()).decode('ascii')}
               for name, tensor in model.state_dict().items()}
    exported = {'version': 1, 'architecture': 'pytorch-gru-gelu-v1', 'model_sha256': digest,
                'sequence_length': int(checkpoint['sequence_length']),
                'hidden_dim': model.gru.hidden_size, 'num_layers': model.gru.num_layers,
                'feature_columns': list(FEATURE_COLUMNS),
                'feature_mean': np.asarray(checkpoint['feature_mean']).tolist(),
                'feature_scale': np.asarray(checkpoint['feature_scale']).tolist(),
                'target_delta_mean': float(checkpoint['target_delta_mean']),
                'target_delta_scale': float(checkpoint['target_delta_scale']), 'weights': weights}
    write_json(destination / 'gru.json', exported)
    timelines = load_patient_timelines(DEFAULT_DATA_DIR)
    records, unavailable, references = [], [], []
    for record_id, timeline in timelines.items():
        patient_id = Path(str(timeline['source_file'].iloc[0])).stem
        starts = timeline.index[timeline['timestamp'].diff().gt(MAX_SEQUENCE_GAP)].tolist()
        history = timeline.iloc[starts[-1] if starts else 0:].tail(exported['sequence_length']).copy()
        if len(history) != exported['sequence_length'] or not np.isfinite(history[list(FEATURE_COLUMNS)].to_numpy()).all():
            unavailable.append(patient_id)
            continue
        seed = {'version': 1, 'patient_id': patient_id, 'record_id': record_id, 'model_sha256': digest,
                'data_origin': 'repository-workbook', 'timestamps': [time.isoformat() for time in history['timestamp']],
                'features': history[list(FEATURE_COLUMNS)].to_numpy().tolist()}
        write_json(destination / 'history' / f'{patient_id}.json', seed)
        records.append(patient_id)
        # Independent PyTorch reference outputs for the actual exported inputs.
        if len(references) < 12:
            origin = history['timestamp'].iloc[-1]
            for hours in (3, 6, 12):
                for events in ([], [{'kind': 'meal', 'amount': 60, 'minutes_ahead': 60}, {'kind': 'insulin', 'amount': 2, 'minutes_ahead': 120}]):
                    schedules = {'meal': {}, 'insulin': {}}
                    for event in events:
                        schedules[event['kind']][origin + pd.Timedelta(minutes=event['minutes_ahead'])] = event['amount']
                    result = forecast_from_history(model, checkpoint, history, horizon_steps=hours*4,
                        meal_schedule=schedules['meal'], insulin_schedule=schedules['insulin'])
                    references.append({'patient_id': patient_id, 'horizon_hours': hours, 'events': events,
                        'expected': result['predicted_glucose_mg_dl'].tolist()})
    write_json(destination / 'manifest.json', {'version': 1, 'model_sha256': digest, 'records': records, 'unavailable': unavailable})
    write_json(PROJECT_ROOT / 'web/frontend/tests/fixtures/browser-gru-reference.json', {'model_sha256': digest, 'cases': references})
    print(f'Exported existing checkpoint and {len(records)} exact record histories; {len(unavailable)} unavailable. No cloud requests or writes.')


if __name__ == '__main__':
    main()
