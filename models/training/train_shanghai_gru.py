"""Reproducible, patient-disjoint Shanghai GRU candidates from the official ZIP.

Glucose-only direct multi-horizon regression. No future covariates, interpolation,
cross-visit windows, shared patients across splits, or automatic model activation.
"""
from __future__ import annotations
import argparse
import hashlib
import io
import json
from pathlib import Path
import random
import re
import time
import warnings
import zipfile
import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

HORIZONS = (15, 30, 60, 120)
LOOKBACK = 24
ARCHIVE_SHA256 = '59b5f5c4053a32bb6b7827844a0191597dc82228fe88ce332a189fdfc659c4cb'

class ShanghaiGRU(nn.Module):
    def __init__(self, hidden=32, horizons=HORIZONS):
        super().__init__()
        self.gru = nn.GRU(1, hidden, num_layers=2, dropout=0.15, batch_first=True)
        self.head = nn.Sequential(nn.Linear(hidden, 16), nn.GELU(), nn.Linear(16, len(horizons)))

    def forward(self, x):
        encoded, _ = self.gru(x)
        return self.head(encoded[:, -1])

def write_json(path, data):
    path.write_text(json.dumps(data, indent=2, allow_nan=False), encoding='utf-8')

def patient_split(ids, seed):
    ids = sorted(set(ids))
    shuffled = [str(value) for value in np.random.default_rng(seed).permutation(ids)]
    validation = max(2, round(len(ids) * 0.1))
    testing = max(2, round(len(ids) * 0.1))
    result = {'train': sorted(shuffled[validation+testing:]), 'validation': sorted(shuffled[:validation]), 'test': sorted(shuffled[validation:validation+testing])}
    assert all(result.values())
    assert not (set(result['train']) & set(result['test']) or set(result['train']) & set(result['validation']) or set(result['validation']) & set(result['test']))
    return result

def load_source(archive):
    raw = archive.read_bytes()
    if hashlib.sha256(raw).hexdigest() != ARCHIVE_SHA256:
        raise ValueError('Official archive checksum mismatch; no training performed.')
    sessions = {'ShanghaiT1DM': [], 'ShanghaiT2DM': []}
    audit = []
    canonical = lambda name: re.sub(r'[^a-z0-9]', '', str(name).lower())
    with zipfile.ZipFile(io.BytesIO(raw)) as source:
        for entry in sorted(source.namelist()):
            name = Path(entry).name
            if '__MACOSX' in entry or not re.fullmatch(r'\d+_\d+_\d+\.xlsx?', name):
                continue
            cohort = 'ShanghaiT1DM' if 'Shanghai_T1DM/' in entry else 'ShanghaiT2DM' if 'Shanghai_T2DM/' in entry else None
            if not cohort: continue
            content = source.read(entry)
            frame = pd.read_excel(io.BytesIO(content))
            date_col = next(c for c in frame if canonical(c) in ('date','datetime','timestamp'))
            glucose_col = next(c for c in frame if canonical(c).startswith('cgmmg') or canonical(c)=='cgm')
            parsed = pd.DataFrame({'time': pd.to_datetime(frame[date_col],errors='coerce'), 'glucose': pd.to_numeric(frame[glucose_col],errors='coerce')})
            invalid_time = int(parsed.time.isna().sum())
            duplicates = int(parsed.dropna(subset=['time']).time.duplicated().sum())
            parsed = parsed.dropna(subset=['time']).sort_values('time').drop_duplicates('time',keep='last')
            missing = ~np.isfinite(parsed.glucose.to_numpy()) | (parsed.glucose.to_numpy() <= 0)
            parsed.loc[missing,'glucose'] = np.nan
            sessions[cohort].append({'record':Path(name).stem,'patient':name.split('_')[0], 'times':parsed.time.to_numpy(), 'glucose':parsed.glucose.to_numpy(dtype=np.float32)})
            audit.append({'cohort':cohort,'file':name,'sha256':hashlib.sha256(content).hexdigest(),'source_rows':len(frame),'invalid_timestamps':invalid_time,'duplicate_timestamps':duplicates,'missing_or_nonpositive_glucose':int(missing.sum())})
    expected = {'ShanghaiT1DM':(12,16),'ShanghaiT2DM':(100,109)}
    for cohort,(people,visits) in expected.items():
        if len(sessions[cohort]) != visits or len({s['patient'] for s in sessions[cohort]}) != people:
            raise ValueError(f'Incomplete {cohort} source release')
    return sessions,audit

def windows(sessions, split, stride, horizons=HORIZONS):
    if not horizons or any(h <= 0 or h % 15 for h in horizons) or sorted(set(horizons)) != list(horizons):
        raise ValueError('Horizons must be unique, increasing positive multiples of 15 minutes')
    max_steps = max(horizons) // 15
    result = {}
    for name, people in split.items():
        x,y,meta = [],[],[]
        for session in sessions:
            if session['patient'] not in people: continue
            values,times = session['glucose'],session['times']
            for end in range(LOOKBACK-1,len(values)-max_steps,stride if name=='train' else 1):
                start=end-LOOKBACK+1
                segment=values[start:end+max_steps+1]
                if not np.isfinite(segment).all(): continue
                differences=np.diff(times[start:end+max_steps+1]).astype('timedelta64[s]').astype(np.int64)
                if not np.all(np.abs(differences-900)<=1): continue
                x.append(values[start:end+1,None]);y.append(values[[end+h//15 for h in horizons]])
                meta.append((session['patient'],session['record'],str(times[end])))
        if not x: raise ValueError(f'No continuous windows for {name}')
        result[name]=(np.asarray(x,dtype=np.float32),np.asarray(y,dtype=np.float32),meta)
    return result

def predictions(model, x, mean, scale, delta_mean, delta_scale, batch_size=512):
    model.eval(); output=[]
    with torch.inference_mode():
        for start in range(0,len(x),batch_size):
            batch=torch.from_numpy(((x[start:start+batch_size]-mean)/scale).astype(np.float32))
            output.append(model(batch).numpy()*delta_scale+delta_mean+x[start:start+batch_size,-1,0,None])
    return np.concatenate(output)

def evaluate(actual, predicted, baseline, horizons=HORIZONS):
    report={}
    for j,h in enumerate(horizons):
        error=predicted[:,j].astype(np.float64)-actual[:,j]
        persistence=baseline.astype(np.float64)-actual[:,j]
        mae=float(np.abs(error).mean());baseline_mae=float(np.abs(persistence).mean())
        report[str(h)]={'mae_mg_dl':mae,'rmse_mg_dl':float(np.sqrt(np.mean(error**2))), 'persistence_mae_mg_dl':baseline_mae,'persistence_rmse_mg_dl':float(np.sqrt(np.mean(persistence**2))), 'mae_improvement_pct':100*(baseline_mae-mae)/baseline_mae if baseline_mae else 0.0}
    return report

def train_cohort(cohort,sessions,output,args):
    started=time.monotonic();output.mkdir(parents=True,exist_ok=False)
    random.seed(args.seed);np.random.seed(args.seed);torch.manual_seed(args.seed)
    split=patient_split([s['patient'] for s in sessions],args.seed)
    horizons=tuple(args.horizons)
    batches=windows(sessions,split,args.training_stride,horizons)
    train_x,train_y,_=batches['train'];val_x,val_y,_=batches['validation']
    # Fit every normalization parameter exclusively on training patients/windows.
    training_values=np.concatenate([s['glucose'][np.isfinite(s['glucose'])] for s in sessions if s['patient'] in split['train']])
    mean=float(training_values.mean());scale=max(float(training_values.std()),1.0)
    deltas=train_y-train_x[:,-1,0,None]
    delta_mean=deltas.mean(axis=0);delta_scale=np.maximum(deltas.std(axis=0),1.0)
    loader=DataLoader(TensorDataset(torch.from_numpy((train_x-mean)/scale),torch.from_numpy((deltas-delta_mean)/delta_scale)),batch_size=args.batch_size,shuffle=True,generator=torch.Generator().manual_seed(args.seed))
    model=ShanghaiGRU(args.hidden,horizons);optimizer=torch.optim.Adam(model.parameters(),lr=0.001)
    criterion=nn.HuberLoss();best=float('inf');state=None;stale=0;history=[]
    print(f'{cohort}: patients '+str({k:len(v) for k,v in split.items()})+', windows '+str({k:len(v[0]) for k,v in batches.items()}),flush=True)
    for epoch in range(1,args.epochs+1):
        model.train();losses=[]
        for x,y in loader:
            optimizer.zero_grad(set_to_none=True);loss=criterion(model(x),y);loss.backward();nn.utils.clip_grad_norm_(model.parameters(),1.0);optimizer.step();losses.append(float(loss.detach()))
        val_pred=predictions(model,val_x,mean,scale,delta_mean,delta_scale)
        # Validation-only selection. Equal weighting across the four horizons.
        score=float(np.mean(np.abs(val_pred-val_y)))
        history.append({'epoch':epoch,'training_huber_loss':float(np.mean(losses)),'validation_mae_mg_dl':score})
        print(f'{cohort} epoch {epoch}: validation MAE {score:.3f} mg/dL',flush=True)
        if score<best-0.001:
            best=score;state={k:v.detach().clone() for k,v in model.state_dict().items()};stale=0;best_epoch=epoch
        else: stale+=1
        write_json(output/'training_history.json',history)
        if stale>=args.patience: break
    model.load_state_dict(state)
    test_x,test_y,test_meta=batches['test'];test_pred=predictions(model,test_x,mean,scale,delta_mean,delta_scale)
    metrics=evaluate(test_y,test_pred,test_x[:,-1,0],horizons)
    per_patient={p:evaluate(test_y[[m[0]==p for m in test_meta]],test_pred[[m[0]==p for m in test_meta]],test_x[[m[0]==p for m in test_meta],-1,0],horizons) for p in split['test']}
    checkpoint={'state_dict':state,'architecture':'glucose-only-direct-multihorizon-gru-v1','input_features':['glucose_mg_dl'],'hidden_dim':args.hidden,'num_layers':2,'sequence_length':LOOKBACK,'horizons_minutes':list(horizons),'feature_mean':mean,'feature_scale':scale,'delta_mean':delta_mean.tolist(),'delta_scale':delta_scale.tolist(),'cohort':cohort,'seed':args.seed,'best_epoch':best_epoch,'patient_split':split,'source_archive_sha256':ARCHIVE_SHA256}
    path=output/'checkpoint.pt';torch.save(checkpoint,path)
    tensor_file={**{k:v for k,v in checkpoint.items() if k!='state_dict'},'weights':{k:{'shape':list(v.shape),'values':v.numpy().ravel().tolist()} for k,v in state.items()}}
    write_json(output/'model.json',tensor_file)
    report={'cohort':cohort,'status':'research_candidate_not_activated','patients':{k:len(v) for k,v in split.items()},'patient_split':split,'sessions':len(sessions),'windows':{k:len(v[0]) for k,v in batches.items()},'best_epoch':best_epoch,'completed_epochs':len(history),'selection':'validation MAE averaged across horizons; test used once after selection','test_metrics':metrics,'per_test_patient_metrics':per_patient,'checkpoint_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'source_archive_sha256':ARCHIVE_SHA256,'runtime_seconds':time.monotonic()-started,'torch_version':torch.__version__,'numpy_version':np.__version__,'pandas_version':pd.__version__,'arguments':vars(args),'limitations':['Glucose-only model does not estimate meal, insulin or exercise interventions.','Patient-disjoint testing estimates generalization within this dataset, not external or prospective clinical validity.','T1DM test cohort has only two patients.','Overlapping windows are correlated; window counts are not independent patient counts.','Not a reproduction of the researcher GARNN architecture.']}
    write_json(output/'metrics.json',report)
    exported=[]
    for i,meta in enumerate(test_meta):
        for j,h in enumerate(horizons):exported.append({'patient_id':meta[0],'record_id':meta[1],'forecast_origin':meta[2],'minutes_ahead':h,'actual_mg_dl':float(test_y[i,j]),'predicted_mg_dl':float(test_pred[i,j]),'persistence_mg_dl':float(test_x[i,-1,0])})
    pd.DataFrame(exported).to_csv(output/'test_predictions.csv',index=False)
    print(f'{cohort} completed: '+json.dumps(metrics),flush=True)
    return report

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--archive',required=True);parser.add_argument('--output',required=True);parser.add_argument('--epochs',type=int,default=30);parser.add_argument('--batch-size',type=int,default=256);parser.add_argument('--hidden',type=int,default=32);parser.add_argument('--patience',type=int,default=6);parser.add_argument('--training-stride',type=int,default=4);parser.add_argument('--seed',type=int,default=20261029);parser.add_argument('--threads',type=int,default=2)
    parser.add_argument('--horizons',type=int,nargs='+',default=list(HORIZONS),help='Increasing forecast horizons in minutes, e.g. 15 30 60 240')
    args=parser.parse_args()
    if not args.horizons or sorted(set(args.horizons))!=args.horizons or any(h<=0 or h%15 for h in args.horizons):parser.error('Horizons must be unique, increasing positive multiples of 15 minutes')
    if min(args.epochs,args.batch_size,args.hidden,args.patience,args.training_stride,args.threads)<1:parser.error('Training parameters must be positive')
    torch.set_num_threads(args.threads);torch.set_num_interop_threads(1);torch.use_deterministic_algorithms(True)
    warnings.filterwarnings('ignore',category=UserWarning,module='openpyxl')
    destination=Path(args.output);destination.mkdir(parents=True,exist_ok=True)
    if any(destination.iterdir()):parser.error('Output directory must be empty; existing model runs are never overwritten')
    sessions,audit=load_source(Path(args.archive));write_json(destination/'source_audit.json',audit)
    reports=[train_cohort(cohort,data,destination/cohort,args) for cohort,data in sessions.items()]
    write_json(destination/'training_summary.json',reports)

if __name__=='__main__': main()
