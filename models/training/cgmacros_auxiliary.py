"""Auditable CGMacros auxiliary experiment for conditional GRU v3.

No Shanghai labels, insulin effects, synthetic intervention labels or future CGM
are used as covariates. Subject-disjoint splits and carb-only ablations are fixed
before training. A trained association model is not a causal response model.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import random
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from models.training.train_chronological import ChronologicalForecast

HORIZONS = list(range(15, 361, 15))
HISTORY = ['glucose_mg_dl', 'hour_sin', 'hour_cos']
FUTURE = ['hour_sin', 'hour_cos', 'carbs_g', 'protein_g', 'fat_g',
          'fiber_g', 'meal_recorded', 'macros_known', 'met', 'activity_known']
SOURCE_SHA256 = '05c8b0e6f1a2757050aced55ce4bf6ab2ac9b30f2fd8ca193056812d9c621d4d'


def write_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2, allow_nan=False) + '\n', encoding='utf-8', newline='\n')


def extract_csvs(archive, destination):
    """Read only named CSV files; never execute notebooks or extract archive paths."""
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as outer:
        nested = [n for n in outer.namelist() if n.endswith('CGMacros_dateshifted365.zip')]
        if len(nested) != 1:
            raise ValueError('Expected the PhysioNet 1.0.0 outer archive.')
        content = outer.read(nested[0])
        if hashlib.sha256(content).hexdigest() != SOURCE_SHA256:
            raise ValueError('CGMacros source checksum mismatch.')
        with zipfile.ZipFile(io.BytesIO(content)) as inner:
            for name in inner.namelist():
                basename = Path(name).name
                if basename == 'bio.csv' or (basename.startswith('CGMacros-') and basename.endswith('.csv')):
                    (destination / basename).write_bytes(inner.read(name))


def native_grid(frame):
    """Recover a stable Libre 15-min phase, excluding ambiguous/shifted phases.

    Publisher minute-level glucose is linearly interpolated. Never train on it
    at minute resolution. Changes of slope identify the native sensor phase.
    Multi-phase files are excluded instead of guessing across clock changes.
    """
    f = frame.rename(columns=lambda c: str(c).strip()).copy()
    f['Timestamp'] = pd.to_datetime(f['Timestamp'], errors='raise')
    if f['Timestamp'].duplicated().any() or not f['Timestamp'].is_monotonic_increasing:
        raise ValueError('Duplicate or unordered timestamps.')
    g = pd.to_numeric(f['Libre GL'], errors='coerce').to_numpy(float)
    t = pd.DatetimeIndex(f['Timestamp']).as_unit('ns').asi8
    regular = np.abs(np.diff(t) - 60e9) < 1
    knots = np.where((np.abs(np.diff(np.diff(g))) > 1e-5) & regular[:-1] & regular[1:])[0] + 1
    if len(knots) < 50:
        raise ValueError('Insufficient evidence of native Libre sampling phase.')
    phases = (t[knots] // int(60e9)) % 15
    counts = np.bincount(phases.astype(int), minlength=15)
    phase = int(counts.argmax())
    if counts[phase] != len(knots):
        raise ValueError('Multiple Libre phases; exclude rather than sample interpolated glucose.')
    mask = (t // int(60e9)) % 15 == phase
    native = f.loc[mask].copy()
    native = native[(native['Timestamp'] >= f['Timestamp'].iloc[knots[0]]) &
                    (native['Timestamp'] <= f['Timestamp'].iloc[knots[-1]])]
    return f, native, {'phase_minute_mod15': phase, 'slope_knots': len(knots), 'source_rows': len(f), 'native_rows': len(native)}


def engineer(frame):
    f, native, audit = native_grid(frame)
    t = pd.DatetimeIndex(native['Timestamp'])
    minute = pd.DatetimeIndex(f['Timestamp'])
    glucose = pd.to_numeric(native['Libre GL'], errors='coerce').to_numpy(float)
    hour = t.hour + t.minute / 60
    x = np.column_stack([glucose, np.sin(2*np.pi*hour/24), np.cos(2*np.pi*hour/24)])
    future = np.zeros((len(t), 10), dtype=np.float32)
    future[:, :2] = x[:, 1:]
    # Events go into (previous sample, current sample]. No forward carrying.
    meal_rows = f['Meal Type'].notna() & f['Meal Type'].astype(str).str.strip().ne('')
    for _, row in f.loc[meal_rows].iterrows():
        index = t.searchsorted(row['Timestamp'])
        if index >= len(t) or (t[index] - row['Timestamp']).total_seconds() >= 900:
            continue
        values = pd.to_numeric(row[['Carbs','Protein','Fat','Fiber']], errors='coerce').to_numpy(float)
        # Publisher describes these as amounts in the consumed meal. Do not
        # multiply by Amount Consumed again without verified provenance.
        if not np.isfinite(values).all() or np.any(values < 0):
            raise ValueError('Meal has incomplete macronutrients.')
        future[index, 2:6] += values
        future[index, 6:8] = 1
    met_column = next((c for c in f if c.lower() == 'mets'), None)
    mets = (pd.to_numeric(f[met_column], errors='coerce').to_numpy(float) / 10
            if met_column else np.full(len(f), np.nan))
    # Fitbit METs is x10. A bin with incomplete coverage stays unknown.
    for i, end in enumerate(t):
        mask = (minute > end - pd.Timedelta(minutes=15)) & (minute <= end)
        values = mets[mask]
        if len(values) == 15 and np.isfinite(values).all() and np.all((values >= 1) & (values <= 18)):
            future[i, 8] = values.mean()
            future[i, 9] = 1
    audit.update(meals=int(meal_rows.sum()), known_activity_bins=int(future[:,9].sum()))
    return x.astype(np.float32), future, t, audit


def load_windows(root, seed):
    root = Path(root)
    bio = pd.read_csv(root/'bio.csv').rename(columns=lambda c: str(c).strip())
    if 'subject' not in bio or bio.subject.duplicated().any():
        raise ValueError('Explicit, unique subject IDs are required; never zip sorted rows to missing IDs.')
    profiles = {int(row.subject): row for _, row in bio.iterrows()}
    # Stratify using publisher HbA1c groups; the unit typo is documented in
    # docs/cgmacros-supabase-dataset.md. Labs are NOT used as model inputs.
    rng = np.random.default_rng(seed)
    split = {}
    for lower, upper in [(0,5.7),(5.7,6.5),(6.5,100)]:
        ids = sorted(i for i,r in profiles.items() if lower <= r['A1c PDL (Lab)'] < upper)
        rng.shuffle(ids)
        for j,i in enumerate(ids):
            split[i] = 'test' if j < 3 else 'validation' if j < 5 else 'train'
    batches = {k: {'x':[], 's':[], 'f':[], 'y':[], 'participant':[]} for k in ['train','validation','test']}
    audit = []
    for path in sorted(root.glob('CGMacros-*.csv')):
        pid = int(path.stem.split('-')[-1])
        if pid not in profiles:
            raise ValueError(f'No explicit bio subject: {pid}')
        try:
            x, future, times, info = engineer(pd.read_csv(path))
        except ValueError as failure:
            audit.append({'subject':pid, 'excluded':str(failure)})
            continue
        group = split[pid]; p = profiles[pid]
        static = [float(p.Age), float(p.BMI), 0., 0.]
        b = batches[group]; count = 0
        for end in range(23, len(x)-24, 4 if group=='train' else 1):
            start, stop = end-23, end+25
            g = x[start:stop,0]
            if not np.isfinite(g).all() or np.any((g<40)|(g>400)) or not np.all(np.diff(times[start:stop].as_unit('ns').asi8)==900_000_000_000):
                continue
            b['x'].append(x[start:end+1]); b['s'].append(static)
            b['f'].append(future[end+1:end+25]); b['y'].append(x[end+np.arange(1,25),0])
            b['participant'].append(pid); count += 1
        audit.append({'subject':pid,'partition':group,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'windows':count, **info})
    for b in batches.values():
        for k in b:
            b[k] = np.asarray(b[k],dtype=np.int64 if k=='participant' else np.float32)
        if len(b['x']) == 0:
            raise ValueError('Empty split after quality filtering.')
    return batches, audit


def metrics(y, prediction, subjects):
    return {'mae_mg_dl':{str(h):float(np.abs(y[:,j]-prediction[:,j]).mean()) for j,h in enumerate(HORIZONS)},
            'participant_macro_mae_mg_dl':{str(h):float(np.mean([np.abs(y[subjects==p,j]-prediction[subjects==p,j]).mean() for p in np.unique(subjects)])) for j,h in enumerate(HORIZONS)}}


def train(batches, mode, args, output):
    torch.manual_seed(args.seed); np.random.seed(args.seed); random.seed(args.seed)
    # Identical inputs, architecture and seed; feature groups are masked for
    # ablation. Missing is encoded separately from a recorded zero.
    copied = {k:{n:v.copy() for n,v in b.items()} for k,b in batches.items()}
    if mode == 'carbs_only':
        for b in copied.values(): b['f'][:,:,[3,4,5,7,8,9]]=0
    if mode == 'macros':
        for b in copied.values(): b['f'][:,:,[8,9]]=0
    tr = copied['train']
    hm = tr['x'].mean((0,1)); hs = np.maximum(tr['x'].std((0,1)),1e-3)
    fm = tr['f'].mean((0,1)); fs = np.maximum(tr['f'].std((0,1)),1.)
    fm[[6,7,9]]=0; fs[[6,7,9]]=1
    sm = tr['s'][:,:2].mean(0); ss = np.maximum(tr['s'][:,:2].std(0),1.)
    delta = tr['y'] - tr['x'][:,-1,0,None]; ym = delta.mean(0); ys = np.maximum(delta.std(0),1.)
    scalers = dict(history_mean=hm.tolist(),history_scale=hs.tolist(),future_mean=fm.tolist(),future_scale=fs.tolist(),static_mean=sm.tolist(),static_scale=ss.tolist(),static_median=sm.tolist(),target_mean=ym.tolist(),target_scale=ys.tolist())
    prepared = {}
    for k,b in copied.items():
        s=b['s'].copy();s[:,:2]=(s[:,:2]-sm)/ss
        prepared[k]=[(b['x']-hm)/hs,s,(b['f']-fm)/fs,(b['y']-b['x'][:,-1,0,None]-ym)/ys]
    loader=DataLoader(TensorDataset(*[torch.from_numpy(v.astype(np.float32)) for v in prepared['train']]),batch_size=256,shuffle=True,generator=torch.Generator().manual_seed(args.seed))
    model=ChronologicalForecast('GRU',3,True,True,future_dim=10,hidden_dim=32,head_dim=16,horizons_minutes=HORIZONS)
    optimizer=torch.optim.Adam(model.parameters(),lr=.001)
    def predict(partition):
        model.eval(); results=[]
        with torch.inference_mode():
            for start in range(0,len(copied[partition]['x']),512):
                tensors=[torch.from_numpy(v[start:start+512].astype(np.float32)) for v in prepared[partition][:3]]
                results.append(model(*tensors).numpy()*ys+ym+copied[partition]['x'][start:start+512,-1,0,None])
        return np.concatenate(results)
    best=float('inf');stale=0;history=[];state=None
    for epoch in range(1,args.epochs+1):
        model.train(); losses=[]
        for x,s,f,y in loader:
            optimizer.zero_grad();loss=nn.functional.huber_loss(model(x,s,f),y);loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(),1);optimizer.step();losses.append(float(loss.detach()))
        pred=predict('validation'); val=metrics(copied['validation']['y'],pred,copied['validation']['participant'])
        score=float(np.mean(list(val['participant_macro_mae_mg_dl'].values())))
        history.append({'epoch':epoch,'loss':float(np.mean(losses)),'validation_participant_mae':score})
        print(f'{mode} epoch {epoch}: validation participant MAE {score:.3f}',flush=True)
        if score<best-.001:
            best=score;best_epoch=epoch;state={k:v.detach().clone() for k,v in model.state_dict().items()};stale=0
        else: stale+=1
        if stale>=args.patience: break
    model.load_state_dict(state); prediction=predict('test')
    contract={'version':1,'architecture':'cgmacros-auxiliary-gru-v1','mode':mode,'input_dim':3,'hidden_dim':32,'num_layers':2,'sequence_length':24,'future_steps':24,'dynamic_features':HISTORY,'future_features':FUTURE,'horizons_minutes':HORIZONS,'scalers':scalers,'source_sha256':SOURCE_SHA256,'seed':args.seed,'best_epoch':best_epoch,'causal_treatment_effect_validated':False,'shanghai_transfer_validated':False}
    checkpoint=output/f'{mode}.pt';torch.save({**contract,'state_dict':state},checkpoint)
    contract['checkpoint_sha256']=hashlib.sha256(checkpoint.read_bytes()).hexdigest()
    artifact={**contract,'weights':{k:{'shape':list(v.shape),'values':v.numpy().flatten().tolist()} for k,v in state.items()}}
    write_json(output/f'{mode}.json',artifact)
    write_json(output/f'{mode}_history.json',history)
    # Public software parity fixture uses synthetic history, never a participant trace.
    sx=np.column_stack([np.linspace(130,140,24),np.sin(np.arange(24)/24*2*np.pi),np.cos(np.arange(24)/24*2*np.pi)]).astype(np.float32)
    sf=np.zeros((24,10),np.float32);sf[:,:2]=[0,-1];sf[3,2:8]=[40,20,15,6,1,1];sf[5:7,8:10]=[3,1]
    static=np.array([50,28,0,0],np.float32);ns=static.copy();ns[:2]=(ns[:2]-sm)/ss
    with torch.inference_mode(): expected=model(torch.from_numpy(((sx-hm)/hs)[None]),torch.from_numpy(ns[None]),torch.from_numpy(((sf-fm)/fs)[None])).numpy()[0]*ys+ym+sx[-1,0]
    write_json(output/f'{mode}_parity.json',{'history':sx.tolist(),'static':static.tolist(),'future':sf.tolist(),'expected':expected.tolist()})
    test=copied['test']; result={'mode':mode,'best_validation_participant_mae':best,'test':metrics(test['y'],prediction,test['participant']),'persistence':metrics(test['y'],np.repeat(test['x'][:,-1,0,None],len(HORIZONS),axis=1),test['participant']),'checkpoint_sha256':contract['checkpoint_sha256']}
    write_json(output/f'{mode}_metrics.json',result)
    return result


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--archive');parser.add_argument('--data-dir',default='data/raw/CGMacros/research');parser.add_argument('--output',default='models/evaluation/cgmacros_6h_20261116');parser.add_argument('--epochs',type=int,default=35);parser.add_argument('--patience',type=int,default=7);parser.add_argument('--seed',type=int,default=20261116)
    args=parser.parse_args(); output=Path(args.output)
    if output.exists() and any(output.iterdir()): parser.error('Preserve previous runs: output must be empty.')
    output.mkdir(parents=True,exist_ok=True)
    if args.archive: extract_csvs(args.archive,args.data_dir)
    torch.set_num_threads(2);torch.set_num_interop_threads(1);torch.use_deterministic_algorithms(True)
    batches,audit=load_windows(args.data_dir,args.seed)
    write_json(output/'source_audit.json',audit)
    summary={k:{'windows':len(b['x']),'subjects':np.unique(b['participant']).tolist()} for k,b in batches.items()}
    write_json(output/'split_manifest.json',{'policy':'participant-disjoint, HbA1c-group stratified; seed fixed before outcomes','partitions':summary})
    print(json.dumps(summary),flush=True)
    results=[train(batches,mode,args,output) for mode in ['carbs_only','macros','macros_activity']]
    # Selection uses validation only, never test improvements.
    selected=min(results,key=lambda r:r['best_validation_participant_mae'])['mode']
    write_json(output/'experiment.json',{'arguments':vars(args),'selected_by_validation':selected,'deployed_mode':'macros_activity','deployment_reason':'Retain user-requested nutrition and activity capabilities; this feature set is not claimed to have the lowest validation error. Each checkpoint epoch is selected on validation only.','results':results,'activation':'research_only','source_doi':'10.13026/3z8q-x658','license':'CC-BY-NC-SA-4.0','shanghai_transfer_validated':False,'causal_treatment_effect_validated':False})
    print('SELECTED '+selected,flush=True)


if __name__=='__main__':main()
