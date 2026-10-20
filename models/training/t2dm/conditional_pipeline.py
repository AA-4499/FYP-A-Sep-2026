"""Experimental direct multi-horizon forecasting with recorded events and static context.

Conditional prediction, not an identified causal treatment-effect estimator.
Blank event fields represent unknown/unrecorded events, not verified fasting.
"""
from __future__ import annotations

import argparse
import copy
import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from .t2dm_pipeline import (
    DEFAULT_DATA_DIR, PROJECT_ROOT, MAX_SEQUENCE_GAP, SAMPLE_INTERVAL,
    _find_timestamp_column, _find_glucose_column, _find_event_columns,
    _parse_glucose, _parse_event_value, calculate_boundaries,
)

DEFAULT_SUMMARY = PROJECT_ROOT / 'data/raw/cleaned_Shanghai_T2DM_Summary.xlsx'
OUTPUT = PROJECT_ROOT / 'models/evaluation/t2dm/conditional_v2'
EVENT_VALUES = ('food_mass_g', 'sc_insulin_units', 'iv_insulin_units', 'bolus_units', 'basal_rate_iu_h')
EVENT_COLUMNS = EVENT_VALUES + tuple(name + '_recorded' for name in EVENT_VALUES)
TIME_COLUMNS = ('hour_sin', 'hour_cos')
PAST_COLUMNS = ('glucose',) + EVENT_COLUMNS + TIME_COLUMNS
FUTURE_COLUMNS = EVENT_COLUMNS + TIME_COLUMNS + ('lead_fraction',)
BASELINE_PREFIXES = ('gender', 'age_', 'height_', 'weight_', 'bmi_', 'smoking_', 'duration_')


def _recorded(series):
    text = series.astype('string').fillna('').str.strip().str.lower()
    return (~text.isin(('', 'nan', 'none', 'null', '--', '/', '0', '0.0'))).astype(float)


def prepare_record(raw: pd.DataFrame, record_id: str):
    """Keep events at valid timestamps, aligning to the next CGM within one interval.

    No glucose interpolation or event carry-forward through recording gaps.
    Basal rates keep their IU/h units and never enter a bolus-dose sum.
    """
    tc, gc = _find_timestamp_column(list(raw)), _find_glucose_column(list(raw))
    times = pd.to_datetime(raw[tc], errors='coerce')
    if times.dt.tz is not None:
        times = times.dt.tz_localize(None)
    glucose = _parse_glucose(raw[gc])
    valid = times.notna() & glucose.notna() & np.isfinite(glucose)
    frame = pd.DataFrame({'timestamp': times[valid], 'glucose': glucose[valid]})
    frame = frame.groupby('timestamp', as_index=False)['glucose'].mean().sort_values('timestamp').reset_index(drop=True)
    if frame.empty:
        raise ValueError(f'No CGM observations in {record_id}')
    events = pd.DataFrame({'timestamp': times})
    for column in EVENT_COLUMNS:
        events[column] = 0.
    meal_columns, insulin_columns = _find_event_columns(list(raw))
    for column in meal_columns:
        events['food_mass_g'] += raw[column].map(lambda value: _parse_event_value(value, meal=True))
        events['food_mass_g_recorded'] = np.maximum(events['food_mass_g_recorded'], _recorded(raw[column]))
    for column in insulin_columns:
        label = str(column).lower()
        key = ('basal_rate_iu_h' if 'basal' in label else 'bolus_units' if 'bolus' in label
               else 'iv_insulin_units' if 'i.v.' in label else 'sc_insulin_units')
        events[key] += raw[column].map(lambda value: _parse_event_value(value, meal=False))
        events[key + '_recorded'] = np.maximum(events[key + '_recorded'], _recorded(raw[column]))
    # A missing numeric amount can still have a recorded event indicator.
    for column in EVENT_VALUES:
        events[column] = events[column].clip(lower=0)
    events = events.loc[events['timestamp'].notna()].copy()
    targets = frame['timestamp'].to_numpy(dtype='datetime64[ns]')
    positions = np.searchsorted(targets, events['timestamp'].to_numpy(dtype='datetime64[ns]'), side='left')
    bounded = positions < len(frame)
    lag = np.full(len(events), np.inf)
    lag[bounded] = (targets[positions[bounded]] - events['timestamp'].to_numpy(dtype='datetime64[ns]')[bounded]) / np.timedelta64(1, 'm')
    keep = bounded & (lag >= 0) & (lag <= MAX_SEQUENCE_GAP.total_seconds() / 60)
    events = events.iloc[np.flatnonzero(keep)].copy()
    events['position'] = positions[keep]
    for column in EVENT_COLUMNS:
        aggregation = events.groupby('position')[column].max() if column.endswith('_recorded') or column == 'basal_rate_iu_h' else events.groupby('position')[column].sum()
        frame[column] = pd.Series(np.arange(len(frame))).map(aggregation).fillna(0.).to_numpy()
    hour = frame['timestamp'].dt.hour + frame['timestamp'].dt.minute / 60
    frame['hour_sin'] = np.sin(2 * np.pi * hour / 24)
    frame['hour_cos'] = np.cos(2 * np.pi * hour / 24)
    frame['patient_record_id'] = record_id
    frame['workbook_count'] = 1
    return frame


def load_records(data_dir=DEFAULT_DATA_DIR):
    return {path.stem: prepare_record(pd.read_excel(path), path.stem)
            for path in sorted(Path(data_dir).glob('*'))
            if path.suffix.lower() in ('.xls', '.xlsx') and not path.name.startswith('~$')}


def summary_features(summary: pd.DataFrame, include_undated_labs=False):
    if summary['Patient Number'].astype(str).duplicated().any():
        raise ValueError('Duplicate patient summary IDs require explicit resolution')
    columns = []
    for column in summary.columns:
        name = str(column).lower()
        if column == 'Patient Number':
            continue
        core = any(name.startswith(prefix.replace('_', ' ')) for prefix in BASELINE_PREFIXES)
        laboratory = name.startswith(('fasting plasma', '2-hour postprandial plasma',
            'fasting c-peptide', '2-hour postprandial c-peptide', 'fasting insulin',
            '2-hour postprandial insulin', 'hba1c', 'glycated albumin', 'total cholesterol',
            'triglyceride', 'high-density lipoprotein', 'low-density lipoprotein',
            'creatinine', 'estimated glomerular', 'uric acid', 'blood urea'))
        if core or (include_undated_labs and laboratory):
            columns.append(column)
    matrix = summary.set_index(summary['Patient Number'].astype(str))[columns].apply(pd.to_numeric, errors='coerce')
    return matrix.replace([np.inf, -np.inf], np.nan)


@dataclass
class Batch:
    past: np.ndarray
    future: np.ndarray
    static: np.ndarray
    target: np.ndarray
    last: np.ndarray
    records: np.ndarray
    origins: np.ndarray

    def __len__(self):
        return len(self.target)

    def subset(self, indices):
        return Batch(*(getattr(self, name)[indices] for name in self.__dataclass_fields__))


def make_windows(records, summary, sequence_length=24, horizon=48, stride=12):
    boundaries = calculate_boundaries(records)
    collected = {split: {key: [] for key in Batch.__dataclass_fields__} for split in ('train', 'validation', 'test')}
    for record_id, frame in records.items():
        if record_id not in summary.index:
            raise ValueError(f'Missing exact patient summary for {record_id}')
        times = frame['timestamp'].to_numpy(dtype='datetime64[ns]')
        gaps = np.flatnonzero(np.diff(times) > MAX_SEQUENCE_GAP.to_timedelta64()) + 1
        edges = np.r_[0, gaps, len(frame)]
        for start, end in zip(edges[:-1], edges[1:]):
            for first in range(start + sequence_length, end - horizon + 1, stride):
                last = first + horizon - 1
                boundary = boundaries[record_id]
                if pd.Timestamp(times[last]) < boundary.validation_start:
                    split = 'train'
                elif pd.Timestamp(times[first]) >= boundary.validation_start and pd.Timestamp(times[last]) < boundary.train_end:
                    split = 'validation'
                elif pd.Timestamp(times[first]) >= boundary.test_start:
                    split = 'test'
                else:
                    continue  # Entire target trajectory must stay in the same split.
                past = frame.iloc[first-sequence_length:first]
                future = frame.iloc[first:first+horizon]
                f = future[list(EVENT_COLUMNS) + list(TIME_COLUMNS)].to_numpy(dtype=np.float32)
                f = np.c_[f, np.arange(1, horizon + 1, dtype=np.float32) / horizon]
                values = {'past': past[list(PAST_COLUMNS)].to_numpy(dtype=np.float32),
                          'future': f, 'static': summary.loc[record_id].to_numpy(dtype=np.float32),
                          'target': future['glucose'].to_numpy(dtype=np.float32),
                          'last': float(past['glucose'].iloc[-1]), 'records': record_id,
                          'origins': times[first-1]}
                for name, value in values.items():
                    collected[split][name].append(value)
    result = {}
    for split, values in collected.items():
        if not values['target']:
            raise ValueError(f'No complete {horizon}-step {split} trajectories')
        result[split] = Batch(*(np.asarray(values[key]) for key in Batch.__dataclass_fields__))
    return result


def fit_scalers(batch):
    unique = np.unique(batch.records, return_index=True)[1]
    raw_static = batch.static[unique]
    median = np.array([np.median(col[np.isfinite(col)]) if np.isfinite(col).any() else 0. for col in raw_static.T])
    static_values = np.where(np.isfinite(raw_static), raw_static, median)
    def moments(values):
        mean, scale = values.mean(axis=0), values.std(axis=0)
        return mean, np.maximum(scale, 1.)
    past_mean, past_scale = moments(batch.past.reshape(-1, len(PAST_COLUMNS)))
    future_mean, future_scale = moments(batch.future.reshape(-1, len(FUTURE_COLUMNS)))
    # Static quantities such as height in metres need true standardization;
    # a 1-unit scale floor would suppress their variation.
    static_mean = static_values.mean(axis=0)
    static_scale = static_values.std(axis=0)
    static_scale[static_scale < 1e-6] = 1.
    target_scale = max(1., float(np.std(batch.target - batch.last[:, None])))
    return {name: np.asarray(value).tolist() for name, value in locals().copy().items()
            if name in ('median', 'past_mean', 'past_scale', 'future_mean', 'future_scale', 'static_mean', 'static_scale', 'target_scale')}


def transform(batch, scalers, use_static=True):
    missing = ~np.isfinite(batch.static)
    static = np.where(missing, np.asarray(scalers['median']), batch.static)
    static = (static - scalers['static_mean']) / scalers['static_scale']
    static = np.c_[static, missing.astype(np.float32)]
    if not use_static:
        static[:] = 0
    return [torch.tensor(value, dtype=torch.float32) for value in (
        (batch.past-scalers['past_mean'])/scalers['past_scale'],
        (batch.future-scalers['future_mean'])/scalers['future_scale'], static,
        (batch.target-batch.last[:, None])/scalers['target_scale'])]


class ConditionalGRU(nn.Module):
    def __init__(self, static_dim, hidden=32):
        super().__init__()
        self.encoder = nn.GRU(len(PAST_COLUMNS), hidden, batch_first=True)
        self.static_encoder = nn.Sequential(nn.Linear(static_dim, hidden), nn.Tanh())
        self.fusion = nn.Sequential(nn.Linear(hidden*2, hidden), nn.Tanh())
        self.decoder = nn.GRU(len(FUTURE_COLUMNS) + hidden, hidden, batch_first=True)
        self.output = nn.Linear(hidden, 1)

    def forward(self, past, future, static):
        _, hidden = self.encoder(past)
        context = self.fusion(torch.cat((hidden[-1], self.static_encoder(static)), dim=-1))
        decoder_input = torch.cat((future, context[:, None].expand(-1, future.shape[1], -1)), dim=-1)
        decoded, _ = self.decoder(decoder_input, context[None])
        return self.output(decoded).squeeze(-1)


def unknown_plan(batch):
    result = copy.deepcopy(batch)
    result.future[:, :, :len(EVENT_COLUMNS)] = 0
    return result


def planned_event(batch, kind, amount, minutes):
    if kind not in EVENT_VALUES or not np.isfinite(amount) or amount <= 0:
        raise ValueError('Use an observed event channel and positive finite amount')
    step = int(minutes / 15) - 1
    if minutes % 15 or not 0 <= step < batch.future.shape[1]:
        raise ValueError('Event must lie on a 15-minute step in the forecast horizon')
    result = copy.deepcopy(batch)
    result.future[:, step, EVENT_COLUMNS.index(kind)] += amount
    result.future[:, step, EVENT_COLUMNS.index(kind + '_recorded')] = 1
    return result


def predictions(model, batch, scalers, use_static=True):
    inputs = transform(batch, scalers, use_static)
    result = []
    model.eval()
    with torch.no_grad():
        for start in range(0, len(batch), 512):
            result.append(model(*(value[start:start+512] for value in inputs[:3])).numpy())
    return np.concatenate(result) * scalers['target_scale'] + batch.last[:, None]


def metrics(actual, predicted):
    report = {}
    for hours in (3,6,12):
        step = hours*4
        error = actual[:, :step]-predicted[:, :step]
        end_error = actual[:, step-1]-predicted[:, step-1]
        report[f'{hours}h'] = {'trajectory_mae_mg_dl': float(np.abs(error).mean()),
            'endpoint_mae_mg_dl': float(np.abs(end_error).mean()),
            'endpoint_rmse_mg_dl': float(np.sqrt((end_error**2).mean()))}
    return report


def train_candidate(windows, summary_columns, epochs=12, batch_size=256, hidden=32, use_static=True, seed=2026):
    torch.manual_seed(seed)
    rng = np.random.default_rng(seed)
    scalers = fit_scalers(windows['train'])
    tensors = transform(windows['train'], scalers, use_static)
    model = ConditionalGRU(tensors[2].shape[-1], hidden)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-3)
    loader = DataLoader(TensorDataset(*tensors), batch_size=batch_size, shuffle=True,
                        generator=torch.Generator().manual_seed(seed))
    best_state, best_mae = None, float('inf')
    losses = []
    validation = unknown_plan(windows['validation'])
    for epoch in range(epochs):
        model.train()
        total = []
        for past, future, static, target in loader:
            future = future.clone()
            # Hide an entire future event plan for half the origins, rather than
            # pretending an unrecorded event plan is a verified no-treatment plan.
            hide = torch.from_numpy(rng.random(len(future)) < .5)
            zeros = torch.tensor((np.zeros(len(EVENT_COLUMNS))-np.asarray(scalers['future_mean'])[:len(EVENT_COLUMNS)])/np.asarray(scalers['future_scale'])[:len(EVENT_COLUMNS)], dtype=torch.float32)
            future[hide, :, :len(EVENT_COLUMNS)] = zeros
            optimizer.zero_grad()
            loss = nn.functional.smooth_l1_loss(model(past, future, static), target)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 5.)
            optimizer.step()
            total.append(float(loss.detach()))
        validation_prediction = predictions(model, validation, scalers, use_static)
        val_mae = float(np.abs(validation.target-validation_prediction).mean())
        losses.append({'epoch':epoch+1,'training_loss':float(np.mean(total)),'validation_unknown_plan_trajectory_mae':val_mae})
        if val_mae < best_mae:
            best_mae, best_state = val_mae, copy.deepcopy(model.state_dict())
        print(json.dumps({'static':use_static,**losses[-1]}),flush=True)
    model.load_state_dict(best_state)
    return model, {'version':'conditional-gru-v2','context_at_each_step':True,'state_dict':best_state,'scalers':scalers,
        'static_columns':list(summary_columns),'past_columns':list(PAST_COLUMNS),
        'future_columns':list(FUTURE_COLUMNS),'sequence_length':windows['train'].past.shape[1],
        'horizon_steps':windows['train'].future.shape[1],'hidden':hidden,'use_static':use_static,
        'training_history':losses,'prediction_semantics':'conditional association; no identified causal treatment effect',
        'summary_availability':'undated snapshot; baseline availability assumed, requires clinical verification'}


def sensitivity(model, batch, checkpoint):
    base = unknown_plan(batch)
    y = predictions(model, base, checkpoint['scalers'], checkpoint['use_static'])
    result = {}
    for name, kind, amount, minutes in [('meal_60g_at_60min','food_mass_g',60.,60),
            ('meal_60g_at_120min','food_mass_g',60.,120),('bolus_2iu_at_60min','bolus_units',2.,60)]:
        scenario = predictions(model, planned_event(base,kind,amount,minutes), checkpoint['scalers'], checkpoint['use_static'])
        delta = scenario-y
        signed_peak = delta[np.arange(len(delta)), np.argmax(np.abs(delta), axis=1)]
        result[name] = {'median_max_abs_difference_mg_dl':float(np.median(np.max(np.abs(delta),axis=1))),
                       'median_signed_peak_difference_mg_dl':float(np.median(signed_peak)),
                       'fraction_negative_peak':float(np.mean(signed_peak<0)),
                       'median_endpoint_difference_mg_dl':float(np.median(delta[:,-1])),
                       'fraction_endpoint_increased':float(np.mean(delta[:,-1]>0))}
    shifted = copy.deepcopy(base)
    shifted.past[:, :, [PAST_COLUMNS.index(name) for name in TIME_COLUMNS]] *= -1
    shifted.future[:, :, [FUTURE_COLUMNS.index(name) for name in TIME_COLUMNS]] *= -1
    changed = predictions(model, shifted, checkpoint['scalers'], checkpoint['use_static']) - y
    result['clock_phase_shift_12h'] = {'median_max_abs_difference_mg_dl': float(np.median(np.max(np.abs(changed), axis=1))),
        'note': 'Input sensitivity with CGM held fixed; not a causal estimate of changing time.'}
    return result



def load_conditional_checkpoint(path):
    checkpoint = torch.load(Path(path), map_location='cpu', weights_only=False)
    if checkpoint.get('version') != 'conditional-gru-v2' or not checkpoint.get('context_at_each_step'):
        raise ValueError('Unsupported conditional checkpoint version')
    if checkpoint['past_columns'] != list(PAST_COLUMNS) or checkpoint['future_columns'] != list(FUTURE_COLUMNS):
        raise ValueError('Conditional checkpoint feature schema mismatch')
    model = ConditionalGRU(len(checkpoint['static_columns'])*2, checkpoint['hidden'])
    model.load_state_dict(checkpoint['state_dict'])
    model.eval()
    return model, checkpoint


def forecast_conditional_record(model, checkpoint, record, summary_row, horizon_hours=3, events=None):
    if horizon_hours not in (3,6,12):
        raise ValueError('Horizon must be 3, 6 or 12 hours')
    record = record.sort_values('timestamp').reset_index(drop=True)
    gaps = record['timestamp'].diff().gt(MAX_SEQUENCE_GAP)
    positions = record.index[gaps].tolist()
    continuous = record.iloc[positions[-1] if positions else 0:]
    sequence = checkpoint['sequence_length']
    if len(continuous) < sequence:
        raise ValueError(f'At least {sequence} continuous readings are required')
    history = continuous.tail(sequence)
    if not np.isfinite(history[list(PAST_COLUMNS)].to_numpy()).all():
        raise ValueError('History contains missing or non-finite model inputs')
    start = pd.Timestamp(history['timestamp'].iloc[-1])
    horizon = checkpoint['horizon_steps']
    future_times = pd.date_range(start+SAMPLE_INTERVAL, periods=horizon, freq=SAMPLE_INTERVAL)
    hour = future_times.hour.to_numpy() + future_times.minute.to_numpy()/60
    future = np.zeros((horizon,len(FUTURE_COLUMNS)),dtype=np.float32)
    future[:,FUTURE_COLUMNS.index('hour_sin')] = np.sin(2*np.pi*hour/24)
    future[:,FUTURE_COLUMNS.index('hour_cos')] = np.cos(2*np.pi*hour/24)
    future[:,-1] = np.arange(1,horizon+1)/horizon
    static = pd.to_numeric(summary_row.reindex(checkpoint['static_columns']),errors='coerce').to_numpy(dtype=np.float32)
    static[~np.isfinite(static)] = np.nan
    batch = Batch(history[list(PAST_COLUMNS)].to_numpy(dtype=np.float32)[None],future[None],static[None],
        np.zeros((1,horizon),dtype=np.float32),np.array([history['glucose'].iloc[-1]]),
        np.array([str(summary_row.name)]),np.array([start.to_datetime64()]))
    baseline = predictions(model,batch,checkpoint['scalers'],checkpoint['use_static'])[0]
    scenario_batch = batch
    for event in events or []:
        if event['minutes_ahead'] >= horizon_hours*60:
            raise ValueError('Place scenario events before the end of the displayed horizon')
        scenario_batch = planned_event(scenario_batch,event['kind'],event['amount'],event['minutes_ahead'])
    scenario = predictions(model,scenario_batch,checkpoint['scalers'],checkpoint['use_static'])[0]
    return pd.DataFrame({'timestamp':future_times[:horizon_hours*4],
        'baseline_glucose_mg_dl':baseline[:horizon_hours*4],
        'scenario_glucose_mg_dl':scenario[:horizon_hours*4]})


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir',default=str(DEFAULT_DATA_DIR))
    parser.add_argument('--summary',default=str(DEFAULT_SUMMARY))
    parser.add_argument('--output-dir',default=str(OUTPUT))
    parser.add_argument('--epochs',type=int,default=12)
    parser.add_argument('--batch-size',type=int,default=256)
    parser.add_argument('--hidden',type=int,default=32)
    parser.add_argument('--stride',type=int,default=12)
    parser.add_argument('--include-undated-labs',action='store_true',help='Retrospective experiment only; these laboratory measurement dates are unavailable')
    parser.add_argument('--ablate-static',action='store_true')
    args=parser.parse_args()
    if min(args.epochs,args.batch_size,args.hidden,args.stride)<1:
        parser.error('Training parameters must be positive')
    torch.set_num_threads(4)
    records=load_records(args.data_dir)
    summary=summary_features(pd.read_excel(args.summary),args.include_undated_labs)
    windows=make_windows(records,summary,stride=args.stride)
    output=Path(args.output_dir);output.mkdir(parents=True,exist_ok=True)
    report={'windows':{name:len(batch) for name,batch in windows.items()},
            'records':len(records),'static_columns':list(summary.columns),
            'undated_labs_included':args.include_undated_labs,
            'promotion_status':'Experimental only. Event-response direction requires separate validation; not validated as a causal what-if simulator.',
            'summary_assumption':'Undated record-level snapshot. Baseline demographics assumed available; laboratory availability at prediction time is unverified.',
            'evaluation':'Within-record chronological split; all 48 target steps inside one split. Not unseen-patient validation.'}
    test=windows['test']
    # One fixed origin per record for reporting sensitivity and legacy comparison.
    indices=np.unique(test.records,return_index=True)[1]
    sample=test.subset(indices)
    for use_static in ([True,False] if args.ablate_static else [True]):
        model,checkpoint=train_candidate(windows,summary.columns,args.epochs,args.batch_size,args.hidden,use_static)
        checkpoint['undated_labs_included']=args.include_undated_labs
        label='with_static' if use_static else 'without_static'
        torch.save(checkpoint,output/f'{label}.pt')
        if use_static:
            weights = PROJECT_ROOT/'models/weights'
            weights.mkdir(parents=True,exist_ok=True)
            name = 'conditional_gru_v2_retrospective.pt' if args.include_undated_labs else 'conditional_gru_v2.pt'
            torch.save(checkpoint,weights/name)
        unknown=predictions(model,unknown_plan(test),checkpoint['scalers'],use_static)
        known=predictions(model,test,checkpoint['scalers'],use_static)
        report[label]={'unknown_future_plan':metrics(test.target,unknown),
                       'recorded_future_events_assumed_known':metrics(test.target,known),
                       'sensitivity_on_fixed_origins':sensitivity(model,sample,checkpoint)}
        np.savez_compressed(output/f'{label}_test.npz',actual=test.target,predicted=unknown,records=test.records,origins=test.origins)
    persistence=np.repeat(test.last[:,None],48,axis=1)
    report['persistence']=metrics(test.target,persistence)
    (output/'metrics.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2),flush=True)


if __name__=='__main__':
    main()
