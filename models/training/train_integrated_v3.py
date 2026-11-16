"""One v3 GRU with meal/bolus and nutrition/activity inputs; no summed forecasts.

Warm-start the retained Shanghai T2DM checkpoint. Fit on real Shanghai and
CGMacros T2D-group targets, keeping their original splits and missingness.
Activity names are NOT training labels. See the separately sourced MET catalog.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import random
from pathlib import Path
import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset, WeightedRandomSampler
from models.training import train_chronological as chrono
from models.training import train_shanghai_supported_features as supported
from models.training import train_shanghai_carb_iob as exposure
from models.training import cgmacros_auxiliary as cg
from models.training.train_shanghai_gru import load_source

HORIZONS = list(range(15, 361, 15))
EXTRA = ['protein_g','fat_g','fiber_g','macros_known','met','activity_known','insulin_source_available']
HISTORY = exposure.FEATURES + ['insulin_source_available']
FUTURE = [exposure.FEATURES[i] for i in chrono.FUTURE_INDICES] + EXTRA

def write(path, value):
    Path(path).write_bytes((json.dumps(value, indent=2, allow_nan=False)+'\n').encode('utf-8'))

def provenance(args, output):
    sources={name:hashlib.sha256(Path(path).read_bytes()).hexdigest() for name,path in {
      'shanghai_archive':args.archive,'nutrient_archive':args.nutrients,
      'cgmacros_bio':Path(args.cgmacros)/'bio.csv'}.items()}
    write(Path(output)/'run_provenance.json',{'arguments':vars(args),'source_sha256':sources,
      'torch':str(torch.__version__),'numpy':np.__version__,'pandas':pd.__version__,
      'training_targets':'real Shanghai T2DM and CGMacros HbA1c-defined T2D-group glucose; no synthetic intervention labels'})

def prepare(args, output):
    sessions, audit = load_source(Path(args.archive))
    supported.enrich_source(args.archive, sessions)
    lookup = exposure.nutrient_lookup(args.nutrients, output)
    exposure.add_features(args.archive, sessions, lookup, output)
    for data in sessions.values():
        for s in data:
            s['exposure_dynamic'] = s['dynamic']
    assigned, split = chrono.chronological_split(sessions['ShanghaiT2DM'])
    sh = chrono.make_batches(assigned, 'exposure_dynamic', HORIZONS, 4)
    write(output/'shanghai_split.json', split)
    write(output/'source_audit.json', audit)
    # Original participant split is fixed before outcomes, including exclusions.
    cgb, cga = cg.load_windows(args.cgmacros, 20261116)
    bio = pd.read_csv(Path(args.cgmacros)/'bio.csv')
    ids = set(bio.loc[bio['A1c PDL (Lab)'] >= 6.5, 'subject'].astype(int))
    write(output/'cgmacros_source_audit.json', cga)
    out = {}; splits = {}
    for part in ['train','validation','test']:
        b = cgb[part]; mask = np.isin(b['participant'], list(ids))
        x, f = b['x'][mask], b['f'][mask]
        if not len(x):
            raise ValueError('Empty CGMacros T2D partition')
        # Shared contract: no fabricated insulin observations in CGMacros.
        cx = np.zeros((len(x),24,15), np.float32); cx[:,:,:3] = x
        cx[:,:,12] = 1  # insulin annotations unavailable, not verified zero
        cf = np.zeros((len(x),24,17), np.float32)
        cf[:,:,:3] = f[:,:,:3]; cf[:,:,3] = f[:,:,6]; cf[:,:,8] = 1
        cf[:,:,10:16] = f[:,:,[3,4,5,7,8,9]]
        sx = np.concatenate([sh[part]['x'], np.ones((*sh[part]['x'].shape[:2],1),np.float32)],axis=2)
        sf = np.concatenate([sh[part]['future'],np.zeros((*sh[part]['future'].shape[:2],7),np.float32)],axis=2)
        sf[:,:,-1] = 1
        out[part] = {'x':np.concatenate([sx,cx]),'f':np.concatenate([sf,cf]),
          's':np.concatenate([sh[part]['static'],b['s'][mask]]),
          'y':np.concatenate([sh[part]['y'],b['y'][mask]]),
          'domain':np.r_[np.zeros(len(sx),int),np.ones(len(cx),int)]}
        splits[part] = {'shanghai_windows':len(sx),'cgmacros_windows':len(cx),
          'cgmacros_subjects':sorted(set(map(int,b['participant'][mask])))}
    assert not(set(splits['train']['cgmacros_subjects']) & set(splits['test']['cgmacros_subjects']))
    assert not(set(splits['validation']['cgmacros_subjects']) & set(splits['test']['cgmacros_subjects']))
    write(output/'partitions.json',splits)
    # Report observed TRAINING intensity support, not named-activity coverage.
    train = out['train']; known=train['f'][:,:,15]>0
    values=train['f'][:,:,14][known]
    coverage={'source':'CGMacros training participants, observed 15-minute mean Fitbit METs / 10',
      'activity_type_labels_available':False,'min_met':float(values.min()),'max_met':float(values.max()),
      'known_activity_bins_in_overlapping_train_windows':int(known.sum()),
      'histogram':np.histogram(values,bins=[1,2,3,4,5,6,7,8,18.01])[0].tolist(),
      'histogram_edges':[1,2,3,4,5,6,7,8,18.01]}
    write(output/'activity_support.json',coverage)
    return out, splits, coverage

def train(args):
    output=Path(args.output); output.mkdir(parents=True,exist_ok=True)
    if any(output.iterdir()): raise ValueError('Preserve runs: output must be empty')
    provenance(args,output)
    torch.set_num_threads(2);torch.set_num_interop_threads(1)
    torch.use_deterministic_algorithms(True)
    torch.manual_seed(args.seed);np.random.seed(args.seed);random.seed(args.seed)
    batches, splits, coverage=prepare(args,output)
    old=torch.load(args.checkpoint,map_location='cpu',weights_only=True)
    scales={k:list(v) for k,v in old['scalers'].items()}
    scales['history_mean'] += [0.]; scales['history_scale'] += [1.]
    raw=batches['train']['f'][:,:,10:]
    mean=raw.mean((0,1));std=np.maximum(raw.std((0,1)),1.)
    mean[[3,5,6]]=0;std[[3,5,6]]=1
    scales['future_mean']+=mean.tolist();scales['future_scale']+=std.tolist()
    prepared={}
    for part,b in batches.items():
        s=b['s'].copy(); missing=~np.isfinite(s[:,:2])
        s[:,:2]=(np.where(missing,scales['static_median'],s[:,:2])-scales['static_mean'])/scales['static_scale']
        s[:,2:]=missing
        prepared[part]=[np.asarray(v,np.float32) for v in [
          (b['x']-scales['history_mean'])/scales['history_scale'],s,
          (b['f']-scales['future_mean'])/scales['future_scale'],
          (b['y']-b['x'][:,-1,0,None]-scales['target_mean'])/scales['target_scale']]]
        if not all(np.isfinite(v).all() for v in prepared[part]): raise ValueError('Invalid input')
    model=chrono.ChronologicalForecast('GRU',15,True,True,future_dim=17,horizons_minutes=HORIZONS)
    state=model.state_dict()
    for key,value in old['state_dict'].items():
        if key in ['encoder.weight_ih_l0','decoder.weight_ih_l0']:
            state[key].zero_();state[key][:,:value.shape[1]]=value
        else: state[key]=value.clone()
    model.load_state_dict(state)
    def predict(part):
        model.eval(); rows=[]
        with torch.inference_mode():
            for first in range(0,len(batches[part]['x']),512):
                x,s,f=[torch.from_numpy(v[first:first+512]) for v in prepared[part][:3]]
                rows.append(model(x,s,f).numpy()*scales['target_scale']+scales['target_mean']+batches[part]['x'][first:first+512,-1,0,None])
        return np.concatenate(rows)
    def metrics(part,p):
        b=batches[part];result={}
        for domain,name in [(0,'ShanghaiT2DM'),(1,'CGMacros_T2D')]:
            m=b['domain']==domain
            result[name]={str(h):{'mae_mg_dl':float(np.abs(p[m,j]-b['y'][m,j]).mean()),
              'persistence_mae_mg_dl':float(np.abs(b['x'][m,-1,0]-b['y'][m,j]).mean())} for j,h in enumerate(HORIZONS)}
        return result
    initial=metrics('test',predict('test'))  # reported only; never used for selection
    domain=batches['train']['domain'];counts=np.bincount(domain)
    sampler=WeightedRandomSampler(torch.tensor(1/counts[domain],dtype=torch.double),len(domain),replacement=True,generator=torch.Generator().manual_seed(args.seed))
    loader=DataLoader(TensorDataset(*[torch.from_numpy(v) for v in prepared['train']]),batch_size=256,sampler=sampler)
    optimizer=torch.optim.Adam(model.parameters(),lr=.0005)
    criterion=nn.HuberLoss();best=float('inf');stale=0;history=[];best_state=None
    for epoch in range(1,args.epochs+1):
        model.train();losses=[]
        for x,s,f,y in loader:
            optimizer.zero_grad(set_to_none=True);loss=criterion(model(x,s,f),y);loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(),1);optimizer.step();losses.append(float(loss.detach()))
        p=predict('validation');b=batches['validation'];d=b['domain']
        errors=[float(np.abs(p[d==i]-b['y'][d==i]).mean()) for i in [0,1]]
        score=float(np.mean(errors));history.append({'epoch':epoch,'loss':float(np.mean(losses)),'validation_domain_mae_mg_dl':errors,'selection_score':score})
        write(output/'training_history.json',history)
        print(f'epoch {epoch}: validation Shanghai {errors[0]:.3f}, CGMacros T2D {errors[1]:.3f}',flush=True)
        if score<best-.001:
            best=score;best_epoch=epoch;best_state={k:v.detach().clone() for k,v in model.state_dict().items()};stale=0
        else:stale+=1
        if stale>=args.patience:break
    model.load_state_dict(best_state);pred=predict('test')
    contract={'version':2,'architecture':'integrated-conditional-v3-gru','cohort':'ShanghaiT2DM','conditional':True,
      'input_dim':15,'hidden_dim':32,'num_layers':2,'sequence_length':24,'future_steps':24,
      'dynamic_features':HISTORY,'future_features':FUTURE,'horizons_minutes':HORIZONS,'scalers':scales,
      'causal_treatment_effect_validated':False,'joint_insulin_activity_validated':False,
      'activity_type_labels_available':False,'best_epoch':best_epoch,'seed':args.seed}
    path=output/'checkpoint.pt';torch.save({**contract,'state_dict':best_state},path)
    sha=hashlib.sha256(path.read_bytes()).hexdigest()
    artifact={**contract,'checkpoint_sha256':sha,'weights':{k:{'shape':list(v.shape),'values':v.numpy().ravel().tolist()} for k,v in best_state.items()}}
    write(output/'model.json',artifact)
    result={'selection':'mean of validation domain MAE, balanced domain sampling; no test-based selection',
      'partitions':splits,'test_metrics_by_domain':metrics('test',pred),'warm_start_test_metrics_by_domain':initial,
      'checkpoint_sha256':sha,'arguments':vars(args),'best_epoch':best_epoch,
      'warm_start_checkpoint_sha256':hashlib.sha256(Path(args.checkpoint).read_bytes()).hexdigest(),
      'limitations':['CGMacros activity names unavailable: model learns MET intensity, not named sport effects.',
        'Shanghai lacks activity/macros and CGMacros lacks administered insulin; no observed joint insulin/activity labels.',
        'Retrospective recorded-future-event evaluation, not causal or clinical validation.',
        'Shanghai split may repeat patients across whole calendar-separated sessions; see split manifest.',
        'CGMacros T2D-group participant-disjoint; native-grid phase exclusions retained.']}
    write(output/'metrics.json',result)
    # Synthetic parity fixture, no participant CGM in public test artifacts.
    x=np.zeros((1,24,15),np.float32);x[:,:,0]=120;x[:,:,2]=1;x[:,:,-1]=1
    f=np.zeros((1,24,17),np.float32);f[:,:,1]=1;f[:,:,-1]=1
    f[:,1,2]=40;f[:,1,3]=1;f[:,1,10:14]=[20,15,6,1];f[:,4:6,14:16]=[3.8,1]
    static=np.array([[55,25,0,0]],np.float32)
    def run(rawf):
        with torch.inference_mode():
            return (model(torch.tensor((x-scales['history_mean'])/scales['history_scale'],dtype=torch.float32),
              torch.tensor(np.c_[(static[:,:2]-scales['static_mean'])/scales['static_scale'],static[:,2:]],dtype=torch.float32),
              torch.tensor((rawf-scales['future_mean'])/scales['future_scale'],dtype=torch.float32)).numpy()*scales['target_scale']+scales['target_mean']+120)[0]
    expected=run(f);later=f.copy();later[:,12:,14:16]=[5,1]
    assert np.max(np.abs(run(later)[:12]-expected[:12]))<1e-6
    restored=torch.load(path,map_location='cpu',weights_only=True);model.load_state_dict(restored['state_dict'])
    assert np.max(np.abs(run(f)-expected))<1e-6
    write(output/'synthetic_parity.json',{'history':x[0].tolist(),'future':f[0].tolist(),'static':[55,25],
      'expected':expected.tolist(),'checkpoint_sha256':sha})
    print('Completed integrated v3 '+sha,flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--archive',default='.model-data/diabetes_datasets.zip')
    p.add_argument('--nutrients',default='.model-data/usda-sr-legacy.zip');p.add_argument('--cgmacros',default='data/raw/CGMacros/research')
    p.add_argument('--checkpoint',default='models/evaluation/conditional_6h_20261116/ShanghaiT2DM/gru_future_event_decoder/checkpoint.pt')
    p.add_argument('--output',default='models/evaluation/integrated_v3_20261116');p.add_argument('--epochs',type=int,default=35)
    p.add_argument('--patience',type=int,default=7);p.add_argument('--seed',type=int,default=20261116)
    train(p.parse_args())
