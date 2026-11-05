"""Inference and a planned-event feature builder for chronological candidates."""
import argparse,json,math
from pathlib import Path
import numpy as np
import pandas as pd
import torch
from models.training.train_chronological import ChronologicalForecast
from models.training.train_shanghai_carb_iob import modeled_iob

def build_future_schedule(origin,historical_boluses,planned_meals=(),planned_boluses=(),
                          history_start=None,excluded_insulin_times=()):
    """Return 16 bins of engineered future covariates; never takes future glucose.

    Bolus: timestamp, units, formulation ('rapid' or 'regular'). Meal: timestamp,
    carbohydrate_g. Quantities are explicit scenario assumptions. No basal or
    unknown insulin is assigned a made-up curve. Existing IOB needs preceding
    doses; six hours of encoder history alone do not establish complete IOB.
    """
    origin=pd.Timestamp(origin);times=pd.date_range(origin+pd.Timedelta(minutes=15),periods=16,freq='15min')
    doses=[];annotation=np.zeros(16);carbs=np.zeros(16);meal=np.zeros(16)
    def bin_index(event):
        offset=(pd.Timestamp(event['timestamp'])-origin).total_seconds()/60
        if not 0<offset<=240:raise ValueError('Planned events must be within (origin, origin + 4h]')
        return int(math.ceil(offset/15))-1
    for historical,events in [(True,historical_boluses),(False,planned_boluses)]:
        for event in events:
            t=pd.Timestamp(event['timestamp']);units=float(event['units'])
            if not np.isfinite(units) or units<0:raise ValueError('Dose must be finite and nonnegative')
            if event['formulation'] not in ('rapid','regular'):raise ValueError('Only supported bolus formulations may be modeled')
            curve=(360.,75.,'rapid') if event['formulation']=='rapid' else (480.,180.,'regular')
            if historical:
                if t>origin:raise ValueError('Historical doses cannot occur after forecast origin')
            else:annotation[bin_index(event)]=1
            doses.append((t.value,units,curve))
    for event in planned_meals:
        value=float(event['carbohydrate_g'])
        if not np.isfinite(value) or value<0:raise ValueError('Carbohydrate must be finite and nonnegative')
        index=bin_index(event);carbs[index]+=value;meal[index]=1
    iob,_=modeled_iob(times,doses)
    excluded=[pd.Timestamp(t) for t in excluded_insulin_times]
    coverage=np.asarray([float(any(t-pd.Timedelta(hours=8)<u<=t for u in excluded)) for t in times])
    warmup=np.ones(16) if history_start is None else np.asarray([(t-pd.Timestamp(history_start)).total_seconds()<8*3600 for t in times],dtype=float)
    hour=times.hour+times.minute/60
    return np.column_stack([np.sin(2*np.pi*hour/24),np.cos(2*np.pi*hour/24),carbs,meal,
        np.zeros(16),np.zeros(16),iob,annotation,coverage,warmup]).astype(np.float32)

def forecast(checkpoint_path,payload):
    saved=torch.load(checkpoint_path,map_location='cpu',weights_only=True)
    if saved['architecture']!='chronological-history-and-event-gru-v1':raise ValueError('Unsupported architecture')
    x=np.asarray(payload['history'],dtype=np.float32)
    if x.shape!=(24,saved['input_dim']) or not np.isfinite(x).all() or np.any(x[:,0]<=0):raise ValueError('Invalid engineered 24-step history')
    scale={k:np.asarray(v) for k,v in saved['scalers'].items()}
    static_payload=payload.get('static_context')
    raw=np.asarray(static_payload[:2] if static_payload is not None else [None,None],dtype=float)
    missing=~np.isfinite(raw)
    if np.any(np.isfinite(raw)&(raw<=0)):raise ValueError('Age/BMI must be positive or unavailable')
    static=np.r_[(np.where(missing,scale['static_median'],raw)-scale['static_mean'])/scale['static_scale'],missing.astype(float)].astype(np.float32)
    future=np.zeros((16,10),dtype=np.float32)
    if saved['conditional']:
        future=np.asarray(payload['future_schedule'],dtype=np.float32)
        if future.shape!=(16,10) or not np.isfinite(future).all() or np.any(future[:,2:]<0):raise ValueError('Invalid 16-bin future schedule')
        if not np.isin(future[:,[3,4,5,7,8,9]],[0,1]).all():raise ValueError('Future annotation/coverage flags must be binary')
        future=((future-scale['future_mean'])/scale['future_scale']).astype(np.float32)
    history=((x-scale['history_mean'])/scale['history_scale']).astype(np.float32)
    model=ChronologicalForecast(saved['recurrent_kind'],saved['input_dim'],saved['static_context'],saved['conditional'],hidden_dim=saved.get('hidden_dim',32),num_layers=saved.get('num_layers',2),head_dim=saved.get('head_dim',16))
    model.load_state_dict(saved['state_dict']);model.eval()
    with torch.inference_mode():prediction=model(torch.from_numpy(history[None]),torch.from_numpy(static[None]),torch.from_numpy(future[None])).numpy()[0]*scale['target_scale']+scale['target_mean']+x[-1,0]
    return {'cohort':saved['cohort'],'variant':saved['variant'],'predictions_mg_dl':{str(h):float(v) for h,v in zip(saved['horizons_minutes'],prediction)},
        'scope':'experimental scenario-conditioned forecast; not a causal treatment effect' if saved['conditional'] else 'history-only research forecast'}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--checkpoint',required=True);p.add_argument('--input',required=True);a=p.parse_args()
    torch.set_num_threads(2)
    print(json.dumps(forecast(a.checkpoint,json.loads(Path(a.input).read_text())),indent=2))
