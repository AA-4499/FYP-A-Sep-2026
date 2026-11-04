"""Export only inference weights/metadata, public nutrient references and parity fixtures."""
import argparse,hashlib,json,io,zipfile
from pathlib import Path
import numpy as np
import pandas as pd
import torch
from models.training.predict_chronological import forecast,build_future_schedule

ROOT=Path(__file__).resolve().parents[2]


def write_json(path, value):
    # Hash the same UTF-8/LF bytes Git and Linux deployment will serve. Windows
    # text-mode write_text translates LF to CRLF and used to invalidate releases.
    path.write_bytes((json.dumps(value, indent=2, allow_nan=False)+'\n').encode('utf-8'))

def main():
    p=argparse.ArgumentParser();p.add_argument('--archive');p.add_argument('--run',default='models/evaluation/shanghai_v3_20261104');p.add_argument('--version',default='shanghai-v3-20261104');args=p.parse_args()
    torch.set_num_threads(2)
    run=Path(args.run).resolve();public=ROOT/'web/frontend/public/conditional-models'
    public.mkdir(parents=True,exist_ok=True);manifest={'version':1,'models':{}}
    cases=[];feature_cases=[]
    archive_path=args.archive or json.loads((run/'run_provenance.json').read_text())['arguments']['archive']
    for cohort in ['ShanghaiT1DM','ShanghaiT2DM']:
        folder=run/cohort/'gru_future_event_decoder';source=json.loads((folder/'model.json').read_text())
        keep=['architecture','recurrent_kind','input_dim','hidden_dim','num_layers','sequence_length','static_context','conditional',
              'dynamic_features','static_features','future_features','horizons_minutes','future_steps','cohort','variant','scalers','weights']
        model={k:source[k] for k in keep};model['version']=1
        model['checkpoint_sha256']=hashlib.sha256((folder/'checkpoint.pt').read_bytes()).hexdigest()
        path=public/(cohort+'.json');write_json(path,model)
        metrics=json.loads((folder/'metrics.json').read_text())
        manifest['models'][cohort]={'path':'/conditional-models/'+path.name,'artifact_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
            'checkpoint_sha256':model['checkpoint_sha256'],'name':cohort+' conditional GRU','version':args.version,
            'horizons_minutes':[15,30,60,240],'evaluation_scope':'Retrospective conditional on recorded future events; research only.',
            'test_metrics':metrics['test_metrics']}
        original=json.loads((folder/'test_input_example.json').read_text())
        prediction=pd.read_csv(folder/'test_predictions.csv',nrows=1).iloc[0]
        with zipfile.ZipFile(archive_path) as archive:
            name=next(n for n in archive.namelist() if '__MACOSX' not in n and Path(n).stem==prediction['record_id'])
            frame=pd.read_excel(io.BytesIO(archive.read(name)),keep_default_na=False)
        date=next(c for c in frame if str(c).casefold()=='date')
        frame=frame[pd.to_datetime(frame[date])<=pd.Timestamp(prediction['forecast_origin'])].copy()
        frame['Patient Number']=str(prediction['record_id'])
        feature_cases.append({'cohort':cohort,'record_id':str(prediction['record_id']),
            'rows':json.loads(frame.to_json(orient='records',date_format='iso')),
            'static_context':original['static_context'],'expected_history':original['history']})
        # Test fixture is kept in repository tests only, never the deployed assets.
        for name,history,static,origin in [
            ('held-out',original['history'],original['static_context'],'2021-01-01T12:00:00Z'),
            ('synthetic',[[120,0,1,0,0,0,0,0,0,0,0,0,0,0] for _ in range(24)],[55,25,0,0],'2021-01-01T12:00:00Z')]:
            for plan in ['baseline','meal','bolus','later','combined','multiple','off_grid','mixed_formulations']:
                meals=[{'timestamp':'2021-01-01T12:30:00Z','carbohydrate_g':40}] if plan in ['meal','combined'] else []
                boluses=[{'timestamp':'2021-01-01T12:45:00Z','units':2,'formulation':'regular'}] if plan in ['bolus','combined'] else []
                if plan=='later':meals=[{'timestamp':'2021-01-01T14:00:00Z','carbohydrate_g':60}]
                if plan=='multiple':
                    meals=[{'timestamp':'2021-01-01T12:30:00Z','carbohydrate_g':40},{'timestamp':'2021-01-01T13:30:00Z','carbohydrate_g':20}]
                    boluses=[{'timestamp':'2021-01-01T12:45:00Z','units':2,'formulation':'regular'},{'timestamp':'2021-01-01T13:45:00Z','units':1,'formulation':'rapid'}]
                if plan=='off_grid':
                    meals=[{'timestamp':'2021-01-01T12:20:00Z','carbohydrate_g':35}]
                    boluses=[{'timestamp':'2021-01-01T12:05:00Z','units':1,'formulation':'rapid'}]
                if plan=='mixed_formulations':
                    meals=[{'timestamp':'2021-01-01T12:30:00Z','carbohydrate_g':40}]
                    boluses=[{'timestamp':'2021-01-01T12:45:00Z','units':2,'formulation':'regular'},{'timestamp':'2021-01-01T13:10:00Z','units':1,'formulation':'rapid'}]
                future=build_future_schedule(origin,[{'timestamp':'2021-01-01T11:00:00Z','units':3,'formulation':'rapid'}],meals,boluses,history_start='2021-01-01T00:00:00Z')
                payload={'history':history,'static_context':static,'future_schedule':future.tolist()}
                result=forecast(folder/'checkpoint.pt',payload)
                planned_events=[{'kind':'meal','minutesAhead':(pd.Timestamp(e['timestamp'])-pd.Timestamp(origin)).total_seconds()/60,'amount':e['carbohydrate_g']} for e in meals]
                planned_events += [{'kind':'bolus','minutesAhead':(pd.Timestamp(e['timestamp'])-pd.Timestamp(origin)).total_seconds()/60,'amount':e['units'],'formulation':e['formulation']} for e in boluses]
                cases.append({'cohort':cohort,'name':name+'-'+plan,**payload,'planned_events':planned_events,'expected':list(result['predictions_mg_dl'].values()),'checkpoint_sha256':model['checkpoint_sha256']})
    mapping=pd.read_csv(run/'reference_food_mapping.csv')
    write_json(public/'foods.json',{'version':1,'source':'USDA SR Legacy 2018, carbohydrate by difference; analyst-selected reference preparations, not dietitian verified.',
        'foods':{str(r['food_key']):float(r['carb_g_per_100g']) for r in mapping.to_dict('records')}})
    manifest['food_reference']={'path':'/conditional-models/foods.json','artifact_sha256':hashlib.sha256((public/'foods.json').read_bytes()).hexdigest()}
    write_json(ROOT/'web/frontend/src/lib/conditionalManifest.json',manifest)
    fixture=ROOT/'web/frontend/tests/fixtures/conditional-decoder-reference.json';write_json(fixture,{'cases':cases})
    write_json(ROOT/'web/frontend/tests/fixtures/conditional-feature-reference.json',{'cases':feature_cases})
    print(json.dumps({'exported_models':2,'parity_cases':len(cases),'patient_data_in_public_assets':False}))

if __name__=='__main__':main()
