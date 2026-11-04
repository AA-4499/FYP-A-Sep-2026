"""Patient-disjoint GRU/LSTM experiments using observed Shanghai features.

Carbohydrates, exercise minutes and IOB are intentionally not fabricated.
Insulin channels represent source-aligned annotations, not verified exposure.
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
import unicodedata
import warnings
import zipfile
import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import DataLoader,TensorDataset
from models.training.train_shanghai_gru import load_source,patient_split,windows,evaluate,write_json,LOOKBACK

HORIZONS=(15,30,60,240)
ROUTES=('sc_dose_units','iv_dose_units','pump_bolus_units','pump_basal_rate_units_per_hour')
DYNAMIC=['glucose_mg_dl','hour_sin','hour_cos']+list(ROUTES)+[r+'_annotation_present' for r in ROUTES]+[r+'_amount_unresolved' for r in ROUTES]
STATIC=['age_years','bmi_kg_m2','age_missing','bmi_missing']
VARIANTS={'gru_context':('GRU',list(range(3))), 'gru_context_insulin':('GRU',list(range(len(DYNAMIC)))), 'lstm_context_insulin':('LSTM',list(range(len(DYNAMIC))))}

def normalize(value):
    return re.sub(r'[\W_]+','',unicodedata.normalize('NFKC',str(value)).casefold())

def present(value):
    return str(value).strip().casefold() not in ('','nan','none','null','/','--','data not available','na','n/a')

def insulin_amount(value):
    """Accept one explicit dose/rate; never sum an ambiguous multi-dose regimen."""
    if not present(value):return 0.,0.,0.
    text=str(value).strip()
    if re.fullmatch(r'\d+(?:\.\d+)?',text):return float(text),1.,0.
    amounts=re.findall(r'(?<![\d.])(\d+(?:\.\d+)?)\s*(?:iu|units?|u|单位)(?:\s*/\s*(?:h|hr|hour))?\b',text,flags=re.I)
    if len(amounts)==1:return float(amounts[0]),1.,0.
    return 0.,1.,1.

def route_columns(frame):
    output={r:[] for r in ROUTES}
    for col in frame:
        key=normalize(col)
        if key.startswith('insulindosesc'):output['sc_dose_units'].append(col)
        elif key.startswith('insulindoseiv'):output['iv_dose_units'].append(col)
        elif key.startswith('csiibolusinsulin'):output['pump_bolus_units'].append(col)
        elif key.startswith('csiibasalinsulin') or key.startswith(normalize('胰岛素泵基础量')):output['pump_basal_rate_units_per_hour'].append(col)
    return output

def enrich_source(archive,sessions):
    static={}; raw_records={}; audit=[]
    with zipfile.ZipFile(archive) as source:
        for name in sorted(source.namelist()):
            if name.startswith('__MACOSX/') or not name.endswith(('.xls','.xlsx')):continue
            cohort='ShanghaiT1DM' if 'T1DM' in name else 'ShanghaiT2DM' if 'T2DM' in name else None
            if cohort is None:continue
            if 'Summary' in name:
                frame=pd.read_excel(io.BytesIO(source.read(name)))
                cols={normalize(c):c for c in frame}
                age=next(c for c in frame if normalize(c).startswith('age'))
                bmi=next(c for c in frame if normalize(c).startswith('bmi'))
                for _,row in frame.iterrows():
                    values=pd.to_numeric(pd.Series([row[age],row[bmi]]),errors='coerce').to_numpy(dtype=float).copy()
                    values[(values<=0)|~np.isfinite(values)]=np.nan
                    key=(cohort,str(row[cols['patientnumber']]).strip())
                    if key in static:raise ValueError('Duplicate summary identifier')
                    static[key]=np.r_[values,np.isnan(values).astype(float)].astype(np.float32)
            elif re.fullmatch(r'\d+_\d+_\d+\.xlsx?',Path(name).name):
                raw_records[(cohort,Path(name).stem)]=pd.read_excel(io.BytesIO(source.read(name)),keep_default_na=False)
    for cohort,cohort_sessions in sessions.items():
        for session in cohort_sessions:
            key=(cohort,session['record'])
            if key not in static:raise ValueError('Missing exact-session demographics')
            frame=raw_records[key];date=next(c for c in frame if normalize(c)=='date')
            parsed_time=pd.to_datetime(frame[date],errors='coerce')
            columns=route_columns(frame);by_time={}
            route_audit={r:{'nonzero_numeric_rows':0,'annotation_rows':0,'unresolved_rows':0,'source_columns':[str(c) for c in columns[r]]} for r in ROUTES}
            for index,row in frame.iterrows():
                if pd.isna(parsed_time.iloc[index]):continue
                values=[];flags=[];unresolved=[]
                for route in ROUTES:
                    # Aliased English/Chinese columns are alternatives, not extra insulin.
                    supplied=[row[c] for c in columns[route] if present(row[c])]
                    value,flag,missing=insulin_amount(supplied[0]) if supplied else (0.,0.,0.)
                    if len(supplied)>1 and len({str(v).strip() for v in supplied})>1:value,flag,missing=0.,1.,1.
                    values.append(value);flags.append(flag);unresolved.append(missing)
                    route_audit[route]['nonzero_numeric_rows']+=int(value>0)
                    route_audit[route]['annotation_rows']+=int(flag)
                    route_audit[route]['unresolved_rows']+=int(missing)
                by_time[pd.Timestamp(parsed_time.iloc[index]).value]=values+flags+unresolved
            hour=pd.DatetimeIndex(session['times']).hour+pd.DatetimeIndex(session['times']).minute/60
            events=np.asarray([by_time[pd.Timestamp(t).value] for t in session['times']],dtype=np.float32)
            session['dynamic']=np.column_stack([session['glucose'],np.sin(2*np.pi*hour/24),np.cos(2*np.pi*hour/24),events]).astype(np.float32)
            session['static']=static[key]
            audit.append({'cohort':cohort,'session':session['record'],'age_available':bool(np.isfinite(static[key][0])),'bmi_available':bool(np.isfinite(static[key][1])),'routes':route_audit})
    return audit

def feature_windows(sessions,split,stride):
    base=windows(sessions,split,stride,HORIZONS)
    by_record={s['record']:s for s in sessions}
    index={s['record']:{str(t):i for i,t in enumerate(s['times'])} for s in sessions}
    result={}
    for name,(glucose,target,meta) in base.items():
        histories=[];context=[]
        for _,record,origin in meta:
            session=by_record[record];end=index[record][origin]
            histories.append(session['dynamic'][end-LOOKBACK+1:end+1]);context.append(session['static'])
        result[name]={'x':np.asarray(histories),'context':np.asarray(context),'y':target,'last':glucose[:,-1,0],'meta':meta}
    return result

def fit_scalers(sessions,split,batches):
    raw=np.concatenate([s['dynamic'] for s in sessions if s['patient'] in split['train']])
    mean=np.nanmean(raw,axis=0);scale=np.nanstd(raw,axis=0);scale[scale<1e-6]=1
    # Observation/parse flags remain unscaled binary flags.
    mean[7:]=0;scale[7:]=1
    raw_static=np.stack([s['static'] for s in sessions if s['patient'] in split['train']])
    median=np.nanmedian(raw_static[:,:2],axis=0)
    if not np.isfinite(median).all():raise ValueError('No train-only age/BMI imputation value available')
    complete=np.where(np.isfinite(raw_static[:,:2]),raw_static[:,:2],median)
    static_mean=complete.mean(axis=0);static_scale=complete.std(axis=0);static_scale[static_scale<1e-6]=1
    deltas=batches['train']['y']-batches['train']['last'][:,None]
    return {'dynamic_mean':mean,'dynamic_scale':scale,'static_median':median,'static_mean':static_mean,'static_scale':static_scale,'target_mean':deltas.mean(axis=0),'target_scale':np.maximum(deltas.std(axis=0),1)}

class SupportedFeaturesModel(nn.Module):
    def __init__(self,kind,input_dim,hidden=32):
        super().__init__()
        self.encoder=(nn.GRU if kind=='GRU' else nn.LSTM)(input_dim,hidden,num_layers=2,dropout=.15,batch_first=True)
        self.head=nn.Sequential(nn.Linear(hidden+4,16),nn.GELU(),nn.Linear(16,4))
    def forward(self,x,context):
        encoded,_=self.encoder(x)
        return self.head(torch.cat([encoded[:,-1],context],dim=1))

def normalize_batch(batch,scalers,columns):
    x=((batch['x']-scalers['dynamic_mean'])/scalers['dynamic_scale'])[:,:,columns].astype(np.float32)
    static=batch['context'].copy()
    static[:,:2]=(np.where(np.isfinite(static[:,:2]),static[:,:2],scalers['static_median'])-scalers['static_mean'])/scalers['static_scale']
    if not np.isfinite(x).all() or not np.isfinite(static).all():raise ValueError('Nonfinite normalized features')
    return x,static.astype(np.float32)

def predict(model,batch,normalized,scalers):
    x,static=normalized;output=[];model.eval()
    with torch.inference_mode():
        for start in range(0,len(x),512):
            output.append(model(torch.from_numpy(x[start:start+512]),torch.from_numpy(static[start:start+512])).numpy()*scalers['target_scale']+scalers['target_mean']+batch['last'][start:start+512,None])
    return np.concatenate(output)

def train_variant(cohort,variant,batches,scalers,split,destination,args):
    start=time.monotonic();folder=destination/cohort/variant;folder.mkdir(parents=True,exist_ok=False)
    random.seed(args.seed);np.random.seed(args.seed);torch.manual_seed(args.seed)
    kind,columns=VARIANTS[variant]
    prepared={name:normalize_batch(batch,scalers,columns) for name,batch in batches.items()}
    x,context=prepared['train'];batch=batches['train']
    target=((batch['y']-batch['last'][:,None]-scalers['target_mean'])/scalers['target_scale']).astype(np.float32)
    loader=DataLoader(TensorDataset(torch.from_numpy(x),torch.from_numpy(context),torch.from_numpy(target)),batch_size=args.batch_size,shuffle=True,generator=torch.Generator().manual_seed(args.seed))
    model=SupportedFeaturesModel(kind,len(columns));optimizer=torch.optim.Adam(model.parameters(),lr=.001);loss_fn=nn.HuberLoss()
    best=float('inf');best_state=None;stale=0;history=[]
    for epoch in range(1,args.epochs+1):
        model.train();losses=[]
        for inputs,static,y in loader:
            optimizer.zero_grad(set_to_none=True);loss=loss_fn(model(inputs,static),y);loss.backward();nn.utils.clip_grad_norm_(model.parameters(),1);optimizer.step();losses.append(float(loss.detach()))
        validation=predict(model,batches['validation'],prepared['validation'],scalers)
        score=float(np.abs(validation-batches['validation']['y']).mean());history.append({'epoch':epoch,'training_huber_loss':float(np.mean(losses)),'validation_mae_mg_dl':score})
        print(f'{cohort} {variant} epoch {epoch}: validation MAE {score:.3f}',flush=True)
        if score<best-.001:best=score;best_epoch=epoch;best_state={k:v.detach().clone() for k,v in model.state_dict().items()};stale=0
        else:stale+=1
        write_json(folder/'training_history.json',history)
        if stale>=args.patience:break
    model.load_state_dict(best_state)
    batch=batches['test'];prediction=predict(model,batch,prepared['test'],scalers)
    metrics=evaluate(batch['y'],prediction,batch['last'],HORIZONS)
    metadata={'architecture':'shanghai-supported-context-v1','recurrent_kind':kind,'input_dim':len(columns),'hidden_dim':32,'num_layers':2,'sequence_length':24,'horizons_minutes':list(HORIZONS),'dynamic_features':[DYNAMIC[i] for i in columns],'static_features':STATIC,'cohort':cohort,'variant':variant,'scalers':{k:v.tolist() for k,v in scalers.items()},'patient_split':split,'seed':args.seed,'best_epoch':best_epoch}
    checkpoint=folder/'checkpoint.pt';torch.save({'state_dict':best_state,**metadata},checkpoint)
    write_json(folder/'model.json',{**metadata,'weights':{k:{'shape':list(v.shape),'values':v.numpy().ravel().tolist()} for k,v in best_state.items()}})
    rows=[]
    for i,(patient,record,origin) in enumerate(batch['meta']):
        for j,h in enumerate(HORIZONS):rows.append({'patient_id':patient,'record_id':record,'forecast_origin':origin,'minutes_ahead':h,'actual_mg_dl':float(batch['y'][i,j]),'predicted_mg_dl':float(prediction[i,j]),'persistence_mg_dl':float(batch['last'][i])})
    pd.DataFrame(rows).to_csv(folder/'test_predictions.csv',index=False)
    result={**metadata,'status':'research_candidate_not_activated','patients':{k:len(v) for k,v in split.items()},'windows':{k:len(v['x']) for k,v in batches.items()},'completed_epochs':len(history),'test_metrics':metrics,'checkpoint_sha256':hashlib.sha256(checkpoint.read_bytes()).hexdigest(),'runtime_seconds':time.monotonic()-start,'arguments':vars(args),'limitations':['No carbohydrate, exercise-minute or IOB feature is fitted.','Dose and basal-rate units are separate; sparse basal annotations are not carried forward or treated as dose.','Source annotation times and summary demographics are assumed usable at aligned CGM timestamps; entry-time availability is not verified.','Blank insulin fields mean unrecorded, not proven no exposure; unresolved amounts use zero numeric contribution plus flags.','Single-seed, patient-disjoint retrospective benchmark; overlapping windows are correlated.','T1DM test set has only two people.','Predictive associations are not causal treatment effects.']}
    write_json(folder/'metrics.json',result)
    print(f'{cohort} {variant} completed: '+json.dumps(metrics),flush=True)
    return result

def main():
    p=argparse.ArgumentParser();p.add_argument('--archive',required=True);p.add_argument('--output',required=True);p.add_argument('--epochs',type=int,default=30);p.add_argument('--patience',type=int,default=6);p.add_argument('--batch-size',type=int,default=256);p.add_argument('--training-stride',type=int,default=4);p.add_argument('--seed',type=int,default=20261029);p.add_argument('--threads',type=int,default=2);args=p.parse_args()
    if min(args.epochs,args.patience,args.batch_size,args.training_stride,args.threads)<1:p.error('Training parameters must be positive')
    torch.set_num_threads(args.threads);torch.set_num_interop_threads(1);torch.use_deterministic_algorithms(True)
    warnings.filterwarnings('ignore',category=UserWarning,module='openpyxl')
    destination=Path(args.output);destination.mkdir(parents=True,exist_ok=True)
    if any(destination.iterdir()):p.error('Output folder must be empty')
    sessions,source_audit=load_source(Path(args.archive));feature_audit=enrich_source(args.archive,sessions)
    write_json(destination/'source_audit.json',source_audit);write_json(destination/'feature_audit.json',feature_audit)
    write_json(destination/'feature_readiness.json',{'included':['glucose','age','BMI','time of day','recorded insulin doses and basal-rate annotations'],'excluded':{'carbohydrate_grams':'No reviewed nutrient conversion table','exercise_minutes':'No exercise series in official release','insulin_on_board':'No measured IOB; insulin-action durations/regimen completeness unverified'},'assumptions':['Source-aligned retrospective annotations; no verified entry-time metadata','Summary demographics treated as baseline context']})
    results=[]
    for cohort,data in sessions.items():
        split=patient_split([s['patient'] for s in data],args.seed);batches=feature_windows(data,split,args.training_stride);scalers=fit_scalers(data,split,batches)
        print(cohort+' partitions '+str({k:len(v) for k,v in split.items()})+', windows '+str({k:len(v['x']) for k,v in batches.items()}),flush=True)
        for variant in VARIANTS:results.append(train_variant(cohort,variant,batches,scalers,split,destination,args))
    write_json(destination/'training_summary.json',results)

if __name__=='__main__':main()
