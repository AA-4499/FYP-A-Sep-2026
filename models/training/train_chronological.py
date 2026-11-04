"""Session-purged calendar-time retraining and retrospective event-conditioned GRU.

Future-event evaluation is conditional on recorded future annotations, not an
unconditional forecast and not causal validation of a treatment intervention.
"""
from __future__ import annotations
import argparse,hashlib,json,random,time,warnings
from pathlib import Path
import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import DataLoader,TensorDataset
from models.training.train_shanghai_gru import load_source,write_json,evaluate
from models.training import train_shanghai_supported_features as supported
from models.training import train_shanghai_carb_iob as exposure

HORIZONS=[15,30,60,240]
FUTURE_INDICES=[1,2,3,7,8,9,10,11,12,13]
VARIANTS={
 'gru_glucose_2h':('glucose_only','GRU',[0],False,[15,30,60,120],False),
 'gru_glucose_4h':('glucose_only','GRU',[0],False,HORIZONS,False),
 'gru_context':('supported_features','GRU',[0,1,2],True,HORIZONS,False),
 'gru_context_insulin':('supported_features','GRU',list(range(15)),True,HORIZONS,False),
 'lstm_context_insulin':('supported_features','LSTM',list(range(15)),True,HORIZONS,False),
 'gru_carb_iob':('carbohydrate_estimated_bolus_iob','GRU',list(range(14)),True,HORIZONS,False),
 'lstm_carb_iob':('carbohydrate_estimated_bolus_iob','LSTM',list(range(14)),True,HORIZONS,False),
 'gru_future_event_decoder':('future_event_conditional','GRU',list(range(14)),True,HORIZONS,True),
}

class ChronologicalForecast(nn.Module):
    def __init__(self,kind,input_dim,static_context=False,conditional=False,future_dim=10):
        super().__init__();self.conditional=conditional;self.static_context=static_context
        self.encoder=(nn.GRU if kind=='GRU' else nn.LSTM)(input_dim,32,num_layers=2,dropout=.15,batch_first=True)
        if conditional:
            self.static_initial=nn.Linear(4,64)
            self.decoder=nn.GRU(future_dim,32,num_layers=2,dropout=.15,batch_first=True)
            self.head=nn.Sequential(nn.Linear(32,16),nn.GELU(),nn.Linear(16,1))
        else:self.head=nn.Sequential(nn.Linear(32+(4 if static_context else 0),16),nn.GELU(),nn.Linear(16,4))

    def forward(self,x,static,future):
        encoded,state=self.encoder(x)
        if self.conditional:
            initial=state+self.static_initial(static).reshape(-1,2,32).transpose(0,1)
            decoded,_=self.decoder(future,initial)
            return self.head(decoded)[:,[0,1,3,15],0]
        last=encoded[:,-1]
        return self.head(torch.cat([last,static],dim=1) if self.static_context else last)

def chronological_split(sessions):
    """Global calendar cutoffs within cohort; purge any crossing session."""
    times=np.sort(np.concatenate([pd.DatetimeIndex(s['times']).as_unit('ns').asi8 for s in sessions]))
    requested=[int(times[min(len(times)-1,round(len(times)*q))]) for q in [.56,.70]]
    starts=np.asarray([pd.DatetimeIndex(s['times']).as_unit('ns').asi8.min() for s in sessions])
    ends=np.asarray([pd.DatetimeIndex(s['times']).as_unit('ns').asi8.max() for s in sessions])
    weights=np.asarray([len(s['times']) for s in sessions]);total=weights.sum()
    # Whole recording sessions are indivisible. The raw quantiles can put every
    # validation session across a boundary, especially in the small T1 cohort.
    # Choose the closest feasible pair of calendar cuts without looking at CGM
    # values, model errors or meal/insulin outcomes.
    candidates=sorted(set(starts.tolist()+[int(t)+1 for t in ends]+requested))
    best=None
    for left in candidates:
        train=ends<left
        if not train.any():continue
        for right in candidates:
            if right<=left:continue
            validation=(starts>=left)&(ends<right);test=starts>=right
            if not validation.any() or not test.any():continue
            counts=np.asarray([weights[train].sum(),weights[validation].sum(),weights[test].sum()])
            fractions=counts/total;purged=1-fractions.sum()
            score=float(np.square(fractions-np.asarray([.56,.14,.30])).sum()+.1*purged)
            candidate=(score,abs(left-requested[0])+abs(right-requested[1]),left,right)
            if best is None or candidate<best:best=candidate
    if best is None:raise ValueError('No feasible nonempty whole-session chronological split')
    boundaries=list(best[2:])
    assignments={k:[] for k in ['train','validation','test']};audit=[]
    for s in sessions:
        ts=pd.DatetimeIndex(s['times']).as_unit('ns').asi8;start,end=int(ts.min()),int(ts.max())
        group='train' if end<boundaries[0] else 'validation' if start>=boundaries[0] and end<boundaries[1] else 'test' if start>=boundaries[1] else 'purged'
        if group!='purged':assignments[group].append(s)
        audit.append({'session':s['record'],'patient':s['patient'],'start':str(pd.Timestamp(start)),
                      'end':str(pd.Timestamp(end)),'rows':len(ts),'partition':group})
    if not all(assignments.values()):raise ValueError('Calendar split has an empty partition; do not silently change policy')
    for left,right in [('train','validation'),('validation','test')]:
        assert max(pd.Timestamp(s['times'][-1]) for s in assignments[left])<min(pd.Timestamp(s['times'][0]) for s in assignments[right])
    counts={k:sum(len(s['times']) for s in v) for k,v in assignments.items()}
    patients={k:sorted({s['patient'] for s in v}) for k,v in assignments.items()}
    manifest={'policy':'cohort-global calendar chronology; whole sessions crossing cutoffs purged',
        'requested_row_fractions':{'train':.56,'validation':.14,'test':.30},
        'requested_row_quantile_cutoffs':[str(pd.Timestamp(t)) for t in requested],
        'cutoff_selection':'Nearest feasible whole-session calendar split minimizing sum((retained original-row fractions - requested fractions)^2) + 0.1 * purged original-row fraction; uses timestamps and row counts only.',
        'cutoffs':[str(pd.Timestamp(t)) for t in boundaries],'sessions':audit,'retained_rows':counts,
        'retained_row_fractions':{k:v/sum(counts.values()) for k,v in counts.items()},'patients':patients,
        'test_patients_seen_in_train':sorted(set(patients['test'])&set(patients['train'])),
        'test_patients_seen_in_development':sorted(set(patients['test'])&(set(patients['train'])|set(patients['validation']))),
        'test_patients_unseen_in_development':sorted(set(patients['test'])-set(patients['train'])-set(patients['validation']))}
    return assignments,manifest

def make_batches(assignments,source_kind,horizons,stride):
    result={};max_step=max(horizons)//15
    for partition,sessions in assignments.items():
        xs=[];ys=[];statics=[];futures=[];meta=[]
        for s in sessions:
            times=pd.DatetimeIndex(s['times']).as_unit('ns').asi8
            features=s[source_kind]
            for end in range(23,len(times)-max_step,stride if partition=='train' else 1):
                start=end-23;stop=end+max_step+1
                if not np.isfinite(s['glucose'][start:stop]).all() or not np.all(np.abs(np.diff(times[start:stop])-900e9)<=1e9):continue
                xs.append(features[start:end+1]);ys.append(s['glucose'][[end+h//15 for h in horizons]])
                statics.append(s['static']);futures.append(s['exposure_dynamic'][end+1:end+max_step+1,FUTURE_INDICES])
                meta.append((s['patient'],s['record'],str(pd.Timestamp(times[end]))))
        if not xs:raise ValueError(f'No eligible {partition} windows')
        result[partition]={'x':np.asarray(xs,dtype=np.float32),'y':np.asarray(ys,dtype=np.float32),
            'static':np.asarray(statics,dtype=np.float32),'future':np.asarray(futures,dtype=np.float32),'meta':meta}
    return result

def fit_scalers(train_sessions,batches,source_kind,indices,flags):
    raw=np.concatenate([s[source_kind][:,indices] for s in train_sessions])
    mean=np.nanmean(raw,axis=0);scale=np.nanstd(raw,axis=0);scale[scale<1e-6]=1
    for j,index in enumerate(indices):
        if index in flags:mean[j]=0;scale[j]=1
    raw_static=np.stack([s['static'][:2] for s in train_sessions]);median=np.nanmedian(raw_static,axis=0)
    if not np.isfinite(median).all():raise ValueError('No training demographics for imputation')
    filled=np.where(np.isfinite(raw_static),raw_static,median);sm=filled.mean(axis=0);ss=np.maximum(filled.std(axis=0),1e-6)
    future_raw=np.concatenate([s['exposure_dynamic'][:,FUTURE_INDICES] for s in train_sessions])
    fm=np.nanmean(future_raw,axis=0);fs=np.maximum(np.nanstd(future_raw,axis=0),1e-6)
    for j,index in enumerate(FUTURE_INDICES):
        if index in exposure.FLAGS:fm[j]=0;fs[j]=1
    delta=batches['train']['y']-batches['train']['x'][:,-1,0,None]
    return {'history_mean':mean,'history_scale':scale,'static_median':median,'static_mean':sm,'static_scale':ss,
        'future_mean':fm,'future_scale':fs,'target_mean':delta.mean(axis=0),'target_scale':np.maximum(delta.std(axis=0),1)}

def normalize_batch(batch,scalers,indices):
    x=((batch['x'][:,:,indices]-scalers['history_mean'])/scalers['history_scale']).astype(np.float32)
    static=batch['static'].copy();static[:,:2]=(np.where(np.isfinite(static[:,:2]),static[:,:2],scalers['static_median'])-scalers['static_mean'])/scalers['static_scale']
    future=((batch['future']-scalers['future_mean'])/scalers['future_scale']).astype(np.float32)
    if not all(np.isfinite(v).all() for v in [x,static,future]):raise ValueError('Nonfinite model input')
    return x,static.astype(np.float32),future

def predict(model,batch,prepared,scalers):
    result=[];model.eval()
    with torch.inference_mode():
        for start in range(0,len(batch['x']),512):
            x,static,future=[torch.from_numpy(v[start:start+512]) for v in prepared]
            result.append(model(x,static,future).numpy()*scalers['target_scale']+scalers['target_mean']+batch['x'][start:start+512,-1,0,None])
    return np.concatenate(result)

def train_variant(cohort,variant,assignments,manifest,output,args):
    family,kind,indices,static_context,horizons,conditional=VARIANTS[variant]
    source_kind='exposure_dynamic' if family in ['carbohydrate_estimated_bolus_iob','future_event_conditional'] else 'observed_dynamic'
    names=exposure.FEATURES if source_kind=='exposure_dynamic' else supported.DYNAMIC
    flags=exposure.FLAGS if source_kind=='exposure_dynamic' else list(range(7,15))
    batches=make_batches(assignments,source_kind,horizons,args.training_stride)
    scalers=fit_scalers(assignments['train'],batches,source_kind,indices,flags)
    prepared={k:normalize_batch(v,scalers,indices) for k,v in batches.items()}
    folder=output/cohort/variant;folder.mkdir(parents=True,exist_ok=False)
    random.seed(args.seed);np.random.seed(args.seed);torch.manual_seed(args.seed)
    train=batches['train'];target=((train['y']-train['x'][:,-1,0,None]-scalers['target_mean'])/scalers['target_scale']).astype(np.float32)
    loader=DataLoader(TensorDataset(*[torch.from_numpy(v) for v in prepared['train']],torch.from_numpy(target)),
        batch_size=args.batch_size,shuffle=True,generator=torch.Generator().manual_seed(args.seed))
    model=ChronologicalForecast(kind,len(indices),static_context,conditional);optimizer=torch.optim.Adam(model.parameters(),lr=.001)
    criterion=nn.HuberLoss();best=float('inf');state=None;stale=0;history=[];started=time.monotonic()
    for epoch in range(1,args.epochs+1):
        model.train();losses=[]
        for x,static,future,y in loader:
            optimizer.zero_grad(set_to_none=True);loss=criterion(model(x,static,future),y);loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(),1);optimizer.step();losses.append(float(loss.detach()))
        prediction=predict(model,batches['validation'],prepared['validation'],scalers)
        score=float(np.abs(prediction-batches['validation']['y']).mean())
        history.append({'epoch':epoch,'training_huber_loss':float(np.mean(losses)),'validation_mae_mg_dl':score})
        write_json(folder/'training_history.json',history)
        print(f'{cohort} {variant} epoch {epoch}: validation MAE {score:.3f}',flush=True)
        if score<best-.001:best=score;best_epoch=epoch;state={k:v.detach().clone() for k,v in model.state_dict().items()};stale=0
        else:stale+=1
        if stale>=args.patience:break
    model.load_state_dict(state);test=batches['test'];prediction=predict(model,test,prepared['test'],scalers)
    metrics=evaluate(test['y'],prediction,test['x'][:,-1,0],horizons)
    contract={'architecture':'chronological-history-and-event-gru-v1','family':family,'recurrent_kind':kind,'input_dim':len(indices),
        'hidden_dim':32,'num_layers':2,'sequence_length':24,'static_context':static_context,'conditional':conditional,
        'dynamic_features':[names[i] for i in indices],'static_features':supported.STATIC if static_context else [],
        'future_features':[exposure.FEATURES[i] for i in FUTURE_INDICES] if conditional else [],
        'horizons_minutes':horizons,'future_steps':16 if conditional else 0,'cohort':cohort,'variant':variant,
        'scalers':{k:v.tolist() for k,v in scalers.items()},'patient_split':manifest['patients'],'seed':args.seed,'best_epoch':best_epoch,
        'split_policy':manifest['policy'],'split_manifest':'../../'+cohort+'_split_manifest.json',
        'future_action_inputs_supported':conditional,'causal_treatment_effect_validated':False}
    checkpoint=folder/'checkpoint.pt';torch.save({'state_dict':state,**contract},checkpoint)
    write_json(folder/'model.json',{**contract,'weights':{k:{'shape':list(v.shape),'values':v.numpy().ravel().tolist()} for k,v in state.items()}})
    write_json(folder/'preprocessing_contract.json',{'history_features':contract['dynamic_features'],'future_features':contract['future_features'],
        'normalization':'Apply saved per-feature training means/scales. Static imputation and scaling use training sessions only. Predict glucose delta, undo horizon-specific target scaling, add last observed glucose.',
        'future_schedule':'16 consecutive 15-minute future bins. Event-conditioned test uses actual recorded future meal/insulin annotations: oracle scenario evaluation, not ordinary prospective forecasting.' if conditional else 'No future schedule input.',
        'exposure_assumptions':'USDA reference complete meals only; modeled rapid/regular bolus IOB only; source-row timing; excluded exposure and missing meal flags retained.',
        'scenario_consistency':'Recompute future IOB from past doses plus supplied scenario doses; never read future measured glucose. Future clocks are known at forecast origin.'})
    rows=[]
    for i,(patient,record,origin) in enumerate(test['meta']):
        for j,h in enumerate(horizons):rows.append({'patient_id':patient,'record_id':record,'forecast_origin':origin,'minutes_ahead':h,
            'actual_mg_dl':float(test['y'][i,j]),'predicted_mg_dl':float(prediction[i,j]),'persistence_mg_dl':float(test['x'][i,-1,0]),
            'patient_seen_in_development':patient in manifest['test_patients_seen_in_development']})
    frame=pd.DataFrame(rows);frame.to_csv(folder/'test_predictions.csv',index=False)
    groups={}
    for seen in [True,False]:
        mask=np.asarray([m[0] in manifest['test_patients_seen_in_development'] for m in test['meta']])==seen
        if mask.any():groups['seen_in_development' if seen else 'unseen_in_development']=evaluate(test['y'][mask],prediction[mask],test['x'][mask,-1,0],horizons)
    # Load the exact saved checkpoint and verify its full held-out predictions.
    saved=torch.load(checkpoint,map_location='cpu',weights_only=True)
    restored=ChronologicalForecast(kind,len(indices),static_context,conditional);restored.load_state_dict(saved['state_dict'])
    check=predict(restored,test,prepared['test'],scalers);deviation=float(np.max(np.abs(check-prediction)))
    assert deviation<1e-6
    early_difference=None
    if conditional:
        x,static,future=[torch.from_numpy(v[:2].copy()) for v in prepared['test']]
        model.eval()
        with torch.inference_mode():
            first=model(x,static,future);future[:,4:,:]+=10;changed=model(x,static,future)
        early_difference=float((first[:,:3]-changed[:,:3]).abs().max());assert early_difference<1e-6
    result={**contract,'status':'research_candidate_not_activated','patients':{k:len(v) for k,v in manifest['patients'].items()},
        'sessions':{k:len(v) for k,v in assignments.items()},'windows':{k:len(v['x']) for k,v in batches.items()},
        'test_metrics':metrics,'test_metrics_by_patient_overlap':groups,'completed_epochs':len(history),
        'checkpoint_sha256':hashlib.sha256(checkpoint.read_bytes()).hexdigest(),'runtime_seconds':time.monotonic()-started,
        'verification':{'safe_checkpoint_full_test_max_abs_difference':deviation,'decoder_later_event_early_output_max_difference':early_difference},
        'limitations':['Retrospective chronological evaluation; some subjects may repeat across partitions; report overlap groups.',
        'Whole sessions crossing date boundaries are excluded, so effective proportions differ from requested 56/14/30.',
        'No randomized/causal or clinical treatment-effect validation; no exercise.',
        'Only 96 completely mapped meals in source cohort; reference preparation and insulin-action assumptions remain.',
        'Future-event decoder test is oracle-conditional on recorded future event annotations, not a forecast with unknown future intake.']}
    write_json(folder/'metrics.json',result)
    write_json(folder/'test_input_example.json',{'history':test['x'][0][:,indices].tolist(),
        'static_context':[float(v) if np.isfinite(v) else None for v in test['static'][0]],
        'future_schedule':test['future'][0].tolist() if conditional else None,'expected_predictions_mg_dl':prediction[0].tolist(),
        'note':'Raw engineered features in contract order; retrospective held-out software verification example.'})
    print(f'COMPLETED {cohort} {variant}: '+json.dumps({h:round(v['mae_mg_dl'],3) for h,v in metrics.items()}),flush=True)
    return result

def report(output,results):
    write_json(output/'training_summary.json',results)
    rows=[]
    for r in results:
        for h,m in r['test_metrics'].items():rows.append({'cohort':r['cohort'],'model':r['variant'],'evaluation_kind':'oracle_future_event_conditional' if r['conditional'] else 'history_only','horizon_minutes':int(h),**m})
    pd.DataFrame(rows).to_csv(output/'evaluation_comparison.csv',index=False)
    lines=['# Chronological retraining evaluation','','Target: oldest 56% / next 14% / latest 30%, separately per cohort. Closest feasible calendar cutoffs are chosen from session dates and row counts only; entire boundary-crossing sessions are purged. Exact row proportions are impossible with indivisible sessions. Earlier models are preserved.','',
        'History-only forecasts and oracle future-event conditional forecasts answer different questions. Their errors must not be interpreted as a fair unconditional model ranking. Event-conditioned errors assume future recorded annotations are known. No causal treatment-effect claim is supported.','',
        '| Cohort | Model | Evaluation | 15 min MAE | 30 min MAE | 60 min MAE | Last horizon MAE |','| --- | --- | --- | ---: | ---: | ---: | ---: |']
    for r in results:
        ms=r['test_metrics'];last=str(r['horizons_minutes'][-1])
        lines.append(f"| {r['cohort']} | {r['variant']} | {'oracle conditional' if r['conditional'] else 'history only'} | {ms['15']['mae_mg_dl']:.2f} | {ms['30']['mae_mg_dl']:.2f} | {ms['60']['mae_mg_dl']:.2f} | {ms[last]['mae_mg_dl']:.2f} ({last} min) |")
    lines+=['','## Achieved split','','| Cohort | Train rows (%) | Validation rows (%) | Test rows (%) | Purged sessions | Test patients seen / unseen in development |','| --- | ---: | ---: | ---: | ---: | --- |']
    for cohort in sorted({r['cohort'] for r in results}):
        m=json.loads((output/(cohort+'_split_manifest.json')).read_text())
        counts=[f"{m['retained_rows'][k]} ({100*m['retained_row_fractions'][k]:.1f}%)" for k in ['train','validation','test']]
        purged=sum(s['partition']=='purged' for s in m['sessions'])
        lines.append('| '+cohort+' | '+' | '.join(counts)+f" | {purged} | {len(m['test_patients_seen_in_development'])} / {len(m['test_patients_unseen_in_development'])} |")
    coverage=json.loads((output/'coverage.json').read_text());partition_coverage=[]
    lines+=['','## Retained feature coverage','','| Cohort | Partition | Described meals | Completely mapped reference meals | Modeled boluses |','| --- | --- | ---: | ---: | ---: |']
    for cohort in sorted({r['cohort'] for r in results}):
        m=json.loads((output/(cohort+'_split_manifest.json')).read_text())
        for partition in ['train','validation','test','purged']:
            ids={s['session'] for s in m['sessions'] if s['partition']==partition}
            selected=[r for r in coverage if r['cohort']==cohort and r['session'] in ids]
            row={'cohort':cohort,'partition':partition,**{k:sum(r[k] for r in selected) for k in ['described_meals','complete_reference_meals','modeled_bolus_events','excluded_insulin_annotations']}}
            partition_coverage.append(row)
            lines.append(f"| {cohort} | {partition} | {row['described_meals']} | {row['complete_reference_meals']} | {row['modeled_bolus_events']} |")
    write_json(output/'partition_feature_coverage.json',partition_coverage)
    lines+=['','MAE and RMSE are in mg/dL. See metrics.json for RMSE, persistence comparison, selected epochs, sample counts and seen/unseen-patient subgroup results. No test-based model selection or live activation.','',
        'Carbohydrate conversion remains limited to 96 fully mapped source meals; unmapped intake is not known zero. IOB models only identifiable rapid/regular boluses with explicit triangular action assumptions and coverage flags. Sparse basal, premixed, long-acting and IV exposure are excluded. True meal/entry availability times are not verified.',
        '', 'All preprocessing is fitted on retained training sessions only; all history and target windows remain inside a recording session and assigned partition. Conditional decoder future inputs contain clock and meal/insulin exposure/status features, never measured future glucose. Its recurrent structure prevents a later event from changing an earlier output.',
        '', 'Each checkpoint is safely reloaded and all held-out predictions recomputed. Previous patient-disjoint test errors are not directly comparable to these chronological test errors because test patients and dates differ.']
    (output/'evaluation_report.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')

def main():
    p=argparse.ArgumentParser();p.add_argument('--archive',required=True);p.add_argument('--nutrients',required=True);p.add_argument('--output',required=True)
    p.add_argument('--epochs',type=int,default=30);p.add_argument('--patience',type=int,default=6);p.add_argument('--batch-size',type=int,default=256)
    p.add_argument('--training-stride',type=int,default=4);p.add_argument('--seed',type=int,default=20261029);p.add_argument('--threads',type=int,default=2)
    p.add_argument('--variants',nargs='+',choices=list(VARIANTS),default=list(VARIANTS));args=p.parse_args()
    torch.set_num_threads(args.threads);torch.set_num_interop_threads(1);torch.use_deterministic_algorithms(True)
    warnings.filterwarnings('ignore',category=UserWarning,module='openpyxl')
    output=Path(args.output);output.mkdir(parents=True,exist_ok=True)
    if any(output.iterdir()):p.error('Output must be empty; historical runs are preserved')
    sessions,audit=load_source(Path(args.archive));write_json(output/'source_audit.json',audit)
    for cohort,data in sessions.items():
        _,manifest=chronological_split(data);write_json(output/(cohort+'_split_manifest.json'),manifest)
        print(cohort+' feasible calendar split: '+json.dumps(manifest['retained_row_fractions']),flush=True)
    supported.enrich_source(args.archive,sessions)
    for data in sessions.values():
        for s in data:s['observed_dynamic']=s['dynamic'].copy()
    lookup=exposure.nutrient_lookup(args.nutrients,output);exposure.add_features(args.archive,sessions,lookup,output)
    for data in sessions.values():
        for s in data:s['exposure_dynamic']=s['dynamic']
    write_json(output/'run_provenance.json',{'arguments':vars(args),'torch':str(torch.__version__),'numpy':np.__version__,'pandas':pd.__version__,
        'nutrient_archive_sha256':hashlib.sha256(Path(args.nutrients).read_bytes()).hexdigest(),'exercise_included':False})
    results=[]
    for cohort,data in sessions.items():
        assignments,manifest=chronological_split(data);write_json(output/(cohort+'_split_manifest.json'),manifest)
        print(cohort+' partitions: '+json.dumps({k:len(v) for k,v in assignments.items()})+' rows: '+json.dumps(manifest['retained_rows']),flush=True)
        for variant in args.variants:
            results.append(train_variant(cohort,variant,assignments,manifest,output,args));report(output,results)
    write_json(output/'completion.json',{'completed_models':len(results),'expected_models':len(args.variants)*2,'all_complete':True})

if __name__=='__main__':main()
