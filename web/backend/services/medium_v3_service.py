"""Local-data medium v3 inference. Raw records are loaded on the authorized server."""
from datetime import datetime, timezone
from functools import lru_cache
import hashlib
import json
import math
import os
from pathlib import Path

import numpy as np
import pandas as pd
import requests
import torch

from models.training.local_v3_inputs import engineer_record, FOOD_PATH
from models.training.predict_chronological import build_future_schedule
from models.training.train_chronological import ChronologicalForecast
from models.training.supabase_io import supabase_config, supabase_headers

ROOT = Path(__file__).resolve().parents[3]
REGISTRY = ROOT / 'models/registry/local_v3_medium.json'


def numeric(value):
    return not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(value)


def plan_events(plan):
    if not isinstance(plan, dict):
        raise ValueError('Provide a baseline and changed plan.')
    if 'events' in plan:
        events = plan['events']
    else:
        for key in ['carbs', 'bolus', 'mealAt', 'bolusAt']:
            if not numeric(plan.get(key)):
                raise ValueError('Plan amounts and times must be finite numbers.')
        if not 0 <= plan['carbs'] <= 150 or not 0 <= plan['bolus'] <= 50 or plan.get('formulation') not in ('rapid','regular'):
            raise ValueError('Unsupported plan amount or insulin formulation.')
        events = []
        if plan['carbs']:
            events.append({'kind':'meal','minutesAhead':plan['mealAt'],'amount':plan['carbs']})
        if plan['bolus']:
            events.append({'kind':'bolus','minutesAhead':plan['bolusAt'],'amount':plan['bolus'],'formulation':plan['formulation']})
    if not isinstance(events, list) or len(events) > 12:
        raise ValueError('Provide at most 12 events per plan.')
    carbs = [0.] * 16
    for event in events:
        if not isinstance(event, dict) or event.get('kind') not in ('meal','bolus') or not numeric(event.get('minutesAhead')) or not 0 < event['minutesAhead'] <= 240 or not numeric(event.get('amount')) or event['amount'] <= 0:
            raise ValueError('Events require a positive amount and a time within four hours.')
        if event['kind'] == 'meal':
            index = math.ceil(event['minutesAhead']/15)-1; carbs[index] += event['amount']
            if carbs[index] > 150:
                raise ValueError('Maximum carbohydrate per 15-minute bin is 150 g.')
        elif event['amount'] > 50 or event.get('formulation') not in ('rapid','regular'):
            raise ValueError('Specify a rapid/regular bolus of at most 50 units.')
    return events


def validate_request(payload, role):
    if not isinstance(payload, dict) or payload.get('source', 'supabase') not in ('supabase','local'):
        raise ValueError('Choose a supported data source.')
    baseline = plan_events(payload.get('baseline')); scenario = plan_events(payload.get('scenario'))
    if role == 'patient' and any(e['kind'] == 'bolus' for e in baseline+scenario):
        raise PermissionError('Patient scenarios support meals only.')
    return baseline, scenario


def read_rows(table, patient_id, token):
    url, key = supabase_config(); rows = []; offset = 0
    while True:
        try:
            response = requests.get(f'{url}/rest/v1/{table}', headers={**supabase_headers(key), 'Authorization':f'Bearer {token}', 'Range':f'{offset}-{offset+999}'}, params={'Patient Number':f'eq.{patient_id}', 'order':'Date.asc,id.asc' if table == 'patient_detail' else 'id.asc'}, timeout=30)
            response.raise_for_status(); batch = response.json()
        except (requests.RequestException, ValueError):
            raise RuntimeError('Authorized Supabase records could not be loaded.') from None
        if not isinstance(batch, list) or any(not isinstance(r, dict) or str(r.get('Patient Number')) != patient_id for r in batch):
            raise RuntimeError('Supabase returned inconsistent record identities.')
        rows.extend(batch)
        if len(batch) < 1000:
            return rows
        offset += 1000


@lru_cache(maxsize=2)
def load_predictor(registry_text):
    registry = json.loads(registry_text)
    if hashlib.sha256(FOOD_PATH.read_bytes()).hexdigest() != registry['food_reference_sha256']:
        raise RuntimeError('The carbohydrate reference does not match this model version.')
    path = (ROOT / registry['checkpoint']).resolve()
    if not path.is_relative_to(ROOT / 'models') or hashlib.sha256(path.read_bytes()).hexdigest() != registry['checkpoint_sha256']:
        raise RuntimeError('The medium v3 checkpoint does not match its registered version.')
    saved = torch.load(path, map_location='cpu', weights_only=True)
    if saved['architecture'] != 'chronological-history-and-event-gru-v1' or saved['cohort'] != 'ShanghaiT2DM' or saved['hidden_dim'] != 64 or not saved['conditional']:
        raise RuntimeError('Unsupported medium v3 checkpoint contract.')
    torch.set_num_threads(max(1, min(2, int(os.getenv('OMP_NUM_THREADS', '1')))))
    model = ChronologicalForecast('GRU', saved['input_dim'], True, True, hidden_dim=64, head_dim=saved['head_dim'])
    model.load_state_dict(saved['state_dict']); model.eval()
    return registry, saved, model


def predict_comparison(record, baseline, scenario, saved, model):
    x = record['dynamic'][-24:]; static = record['static']; scalers = {k:np.asarray(v) for k,v in saved['scalers'].items()}
    origin = pd.Timestamp(record['times'][-1]); start = pd.Timestamp(record['times'][0])
    doses = [{'timestamp':pd.Timestamp(t), 'units':amount, 'formulation':'rapid' if curve[0] == 360 else 'regular'} for t,amount,curve in record['doses'] if pd.Timestamp(t) <= origin]
    def future(events):
        meals = [{'timestamp':origin+pd.Timedelta(minutes=e['minutesAhead']), 'carbohydrate_g':e['amount']} for e in events if e['kind']=='meal']
        boluses = [{'timestamp':origin+pd.Timedelta(minutes=e['minutesAhead']), 'units':e['amount'], 'formulation':e['formulation']} for e in events if e['kind']=='bolus']
        return build_future_schedule(origin, doses, meals, boluses, start, [pd.Timestamp(t) for t in record['excluded']])
    base_future = future(baseline); changed_future = future(scenario)
    def predict(history, schedule):
        context = static.copy()
        context[:2] = (np.where(np.isfinite(context[:2]),context[:2],scalers['static_median'])-scalers['static_mean'])/scalers['static_scale']
        h = ((history-scalers['history_mean'])/scalers['history_scale']).astype(np.float32)
        f = ((schedule-scalers['future_mean'])/scalers['future_scale']).astype(np.float32)
        with torch.inference_mode():
            values = model(torch.from_numpy(h[None]), torch.from_numpy(context[None]), torch.from_numpy(f[None])).numpy()[0]*scalers['target_scale']+scalers['target_mean']+x[-1,0]
        if not np.isfinite(values).all() or np.any(values <= 0):
            raise RuntimeError('The model returned unusable glucose estimates.')
        return values
    base = predict(x,base_future); changed = predict(x,changed_future); explanations = []
    for name, indices, future_indices in [('Recent glucose',[0],[]),('Recorded meal history',[3,4,5,6,7,8,9],[]),('Modeled bolus IOB and coverage',[10,11,12,13],[6,7,8,9])]:
        h = x.copy(); f = changed_future.copy(); h[:,indices] = scalers['history_mean'][indices]
        if future_indices:
            f[:,future_indices] = scalers['future_mean'][future_indices]
        explanations.append({'name':name,'change':float(changed[-1]-predict(h,f)[-1])})
    for kind, name in [('meal','Planned carbohydrate (removed and rerun)'),('bolus','Planned bolus (removed; IOB recalculated)')]:
        explanations.append({'name':name,'change':float(changed[-1]-predict(x,future([e for e in scenario if e['kind'] != kind]))[-1])})
    return base, changed, explanations


def forecast_patient(patient_id, payload, role, token):
    baseline, scenario = validate_request(payload, role)
    source = payload.get('source','supabase')
    if source == 'local':
        from services.conditional_input_service import local_conditional_input
        data = local_conditional_input(patient_id); rows = data['rows']; summary = data['summary']
    else:
        summaries = read_rows('patient_summary',patient_id,token)
        if len(summaries) != 1:
            raise LookupError('A unique authorized exact-visit summary is required.')
        summary = summaries[0]; rows = read_rows('patient_detail',patient_id,token)
    dataset = summary.get('source_dataset')
    diagnosis = str(summary.get('Type of Diabetes','')).strip().lower()
    if (dataset and dataset != 'ShanghaiT2DM') or (not dataset and diagnosis not in ('t2dm','t2d','type 2','type 2 diabetes','type 2 diabetes mellitus')):
        raise ValueError('This local-data model supports Shanghai T2DM records only.')
    if not rows:
        raise LookupError('No authorized CGM records found.')
    record = engineer_record(pd.DataFrame(rows),summary,patient_id)
    times = pd.DatetimeIndex(record['times']); history = record['dynamic'][-24:]
    if len(history) != 24 or not np.isfinite(history).all() or not np.all(np.abs(np.diff(times[-24:].asi8)-900e9) <= 1e9):
        raise ValueError('24 consecutive valid CGM readings at 15-minute intervals are required. Missing readings are not interpolated.')
    registry,saved,model = load_predictor(REGISTRY.read_text(encoding='utf-8'))
    base,changed,explanations = predict_comparison(record,baseline,scenario,saved,model)
    origin = times[-1]; anchor = {'timestamp':origin.isoformat()+'Z','value':float(history[-1,0])}
    def points(values):
        return [anchor]+[{'timestamp':(origin+pd.Timedelta(minutes=h)).isoformat()+'Z','value':float(v)} for h,v in zip(saved['horizons_minutes'],values)]
    recent = record['dynamic'][times > origin-pd.Timedelta(hours=6)]
    forecast = {'patient_id':patient_id,'record_id':patient_id,'source':source,'horizon_hours':4,'model_family':'conditional-v3', 'model_version':registry['version'],'model_sha256':registry['checkpoint_sha256'],'model_evaluation':registry['evaluation'], 'delivery':'server','generated_at':datetime.now(timezone.utc).isoformat(),'horizons_minutes':saved['horizons_minutes'], 'sequence_length':24,'forecast_start':anchor['timestamp'],'latest_glucose':anchor['value'], 'baseline_end':float(base[-1]),'scenario_end':float(changed[-1]),'scenario_enabled':baseline != scenario, 'baseline':points(base),'scenario':points(changed),'observed':[{'timestamp':t.isoformat()+'Z','value':float(v)} for t,v in zip(times[-24:],history[:,0])], 'metrics':None,'training':[],'validation':[],'testing':[],'testing_actual':[], 'exposure':{'iob_units':float(history[-1,10]),'described_meals':int(recent[:,7].sum()),'converted_meals':int(((recent[:,7]==1)&(recent[:,8]==0)).sum()),'excluded_insulin':sum(t > (origin-pd.Timedelta(hours=8)).value for t in record['excluded']),'warmup_incomplete':bool(history[-1,13])}, 'uncertainty':'No calibrated prediction interval is available. Four sampled horizons do not describe every intervening glucose value. Experimental conditional prediction does not identify treatment effects or recommend insulin doses.', 'plans':{'cohort':'ShanghaiT2DM','baseline':payload['baseline'],'scenario':payload['scenario'],'assumptions':'Local raw-data medium GRU. Supported bolus IOB only; unrecorded intake and insulin remain unknown.'}}
    return {'forecast':forecast,'comparison':{'baseline':base.tolist(),'scenario':changed.tolist(),'explanations':explanations,'baselineFuture':[],'scenarioFuture':[]}}
