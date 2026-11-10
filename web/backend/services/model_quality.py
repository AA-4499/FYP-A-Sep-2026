"""Paired evaluation on an identical, frozen chronological holdout."""
from __future__ import annotations

import hashlib
import json
import math

import numpy as np
import torch

from models.training.t2dm.t2dm_pipeline import (
    build_window_sets, calculate_boundaries, load_forecaster_checkpoint,
    _predict_scaled, _scaled_features,
)


class ModelQualityError(ValueError):
    pass


def acceptance(active, candidate, rules):
    reasons = []
    for metric, limit in (('mae_mg_dl', 'maximum_mae_degradation'), ('rmse_mg_dl', 'maximum_rmse_degradation')):
        old, new = active.get(metric), candidate.get(metric)
        if any(isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0 for value in (old, new)):
            raise ModelQualityError('Both models require finite nonnegative MAE and RMSE.')
        if new > old * (1 + rules[limit]):
            reasons.append(f'Candidate {metric} exceeds the permitted degradation.')
    return not reasons, reasons


def compare_models(active_path, candidate_path, timelines, rules):
    active_model, active = load_forecaster_checkpoint(str(active_path), device_name='cpu')
    candidate_model, candidate = load_forecaster_checkpoint(str(candidate_path), device_name='cpu')
    length = rules['sequence_length']
    if active['sequence_length'] != length or candidate['sequence_length'] != length or active['feature_columns'] != candidate['feature_columns']:
        raise ModelQualityError('The active and candidate model contracts do not match the common evaluation set.')
    boundaries = calculate_boundaries(timelines)
    windows = build_window_sets(timelines, boundaries, sequence_length=length)['test']
    if len(windows) < rules['minimum_evaluation_windows']:
        raise ModelQualityError('Insufficient complete held-out windows for model quality comparison.')
    if not np.isfinite(windows.features).all() or not np.isfinite(windows.targets).all():
        raise ModelQualityError('Evaluation data contains missing or non-finite values.')
    frozen_identity = json.dumps([(str(record), str(stamp)) for record, stamp in zip(windows.patient_ids, windows.timestamps)], separators=(',', ':')).encode()
    evaluation_digest = hashlib.sha256(frozen_identity + windows.features.tobytes() + windows.targets.tobytes()).hexdigest()
    def evaluate(model, checkpoint):
        features = _scaled_features(windows, np.asarray(checkpoint['feature_mean']), np.asarray(checkpoint['feature_scale']))
        with torch.inference_mode():
            predictions = _predict_scaled(model, features, batch_size=128, device=torch.device('cpu'))
        predictions = predictions * float(checkpoint['target_delta_scale']) + float(checkpoint['target_delta_mean']) + windows.last_glucose
        errors = np.asarray(predictions, dtype=np.float64) - windows.targets
        return {'mae_mg_dl': float(np.abs(errors).mean()), 'rmse_mg_dl': float(np.sqrt(np.square(errors).mean()))}
    old_metrics, new_metrics = evaluate(active_model, active), evaluate(candidate_model, candidate)
    accepted, reasons = acceptance(old_metrics, new_metrics, rules)
    return {'accepted': accepted, 'reasons': reasons, 'active': old_metrics, 'candidate': new_metrics,
            'evaluation_windows': len(windows), 'evaluation_records': len(set(windows.patient_ids)),
            'evaluation_sha256': evaluation_digest,
            'scope': 'Same frozen per-record chronological 20% holdout; candidate training excludes holdout targets. This is not a prospective or unseen-patient clinical validation.',
            'maximum_mae_degradation': rules['maximum_mae_degradation'],
            'maximum_rmse_degradation': rules['maximum_rmse_degradation']}
