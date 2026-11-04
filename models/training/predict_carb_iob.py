"""Run a saved history-conditioned model on its documented feature contract.

Input JSON: history (24 timestamped rows with named engineered features),
age_years and bmi_kg_m2. Missing age/BMI may be null. Meal/IOB features must
already be constructed using preprocessing_contract.json, not arbitrary sliders.
"""
import argparse,json
from pathlib import Path
import numpy as np
import pandas as pd
import torch
from models.training.train_shanghai_supported_features import SupportedFeaturesModel
from models.training.train_shanghai_carb_iob import FLAGS

def forecast(checkpoint_path,payload):
    saved=torch.load(checkpoint_path,map_location='cpu',weights_only=True)
    if saved['architecture']!='shanghai-history-carb-iob-context-v1':raise ValueError('Unsupported checkpoint contract')
    rows=payload['history'];times=pd.DatetimeIndex([row['timestamp'] for row in rows])
    if len(rows)!=24 or not np.all(np.diff(times.as_unit('ns').asi8)==900_000_000_000):
        raise ValueError('Provide exactly 24 consecutive 15-minute history rows')
    names=saved['dynamic_features'];x=np.asarray([[row[name] for name in names] for row in rows],dtype=np.float32)
    if not np.isfinite(x).all() or np.any(x[:,0]<=0):raise ValueError('History must be finite, with positive glucose')
    if np.any(x[:,3:]<0):raise ValueError('Carbohydrate, IOB, counts and flags must be nonnegative')
    if not np.isin(x[:,FLAGS],[0,1]).all():raise ValueError('Status features must be binary')
    hours=times.hour+times.minute/60
    if not np.allclose(x[:,1:3],np.column_stack([np.sin(2*np.pi*hours/24),np.cos(2*np.pi*hours/24)]),atol=1e-5):
        raise ValueError('Clock features must match timestamps')
    scalers={k:np.asarray(v) for k,v in saved['scalers'].items()}
    raw=np.asarray([payload.get('age_years'),payload.get('bmi_kg_m2')],dtype=float)
    if np.any(np.isfinite(raw)&(raw<=0)):raise ValueError('Age and BMI must be positive or null')
    missing=~np.isfinite(raw)
    static=np.r_[(np.where(missing,scalers['static_median'],raw)-scalers['static_mean'])/scalers['static_scale'],missing.astype(float)].astype(np.float32)
    normalized=((x-scalers['dynamic_mean'])/scalers['dynamic_scale']).astype(np.float32)
    model=SupportedFeaturesModel(saved['recurrent_kind'],saved['input_dim']);model.load_state_dict(saved['state_dict']);model.eval()
    with torch.inference_mode():prediction=model(torch.from_numpy(normalized[None]),torch.from_numpy(static[None])).numpy()[0]*scalers['target_scale']+scalers['target_mean']+x[-1,0]
    return {'cohort':saved['cohort'],'variant':saved['variant'],'forecast_origin':str(times[-1]),
        'predictions_mg_dl':{str(h):float(v) for h,v in zip(saved['horizons_minutes'],prediction)},
        'scope':'retrospective history-conditioned research forecast; no future-plan or causal effect validation'}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--checkpoint',required=True);p.add_argument('--input',required=True);a=p.parse_args()
    print(json.dumps(forecast(a.checkpoint,json.loads(Path(a.input).read_text())),indent=2))
