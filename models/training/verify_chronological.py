"""Independent saved-artifact, chronology and evaluation-contract checks."""
import argparse,hashlib,json
from pathlib import Path
import numpy as np
import pandas as pd
import torch
from models.training.train_chronological import ChronologicalForecast
from models.training.predict_chronological import forecast
from models.training.train_shanghai_gru import write_json

def main():
    p=argparse.ArgumentParser();p.add_argument('--run',required=True);a=p.parse_args();root=Path(a.run)
    torch.set_num_threads(2)
    completed=json.loads((root/'completion.json').read_text());assert completed['all_complete'] and completed['completed_models']==16
    summary=json.loads((root/'training_summary.json').read_text());assert len(summary)==16
    manifests={c:json.loads((root/(c+'_split_manifest.json')).read_text()) for c in ['ShanghaiT1DM','ShanghaiT2DM']}
    common_origins={};verified=[]
    for result in summary:
        folder=root/result['cohort']/result['variant'];path=folder/'checkpoint.pt'
        assert hashlib.sha256(path.read_bytes()).hexdigest()==result['checkpoint_sha256']
        saved=torch.load(path,map_location='cpu',weights_only=True)
        assert 'glucose' not in ' '.join(saved['future_features'])
        portable=json.loads((folder/'model.json').read_text())
        model=ChronologicalForecast(saved['recurrent_kind'],saved['input_dim'],saved['static_context'],saved['conditional'])
        model.load_state_dict(saved['state_dict']);model.eval()
        restored=ChronologicalForecast(saved['recurrent_kind'],saved['input_dim'],saved['static_context'],saved['conditional'])
        restored.load_state_dict({k:torch.tensor(v['values'],dtype=torch.float32).reshape(v['shape']) for k,v in portable['weights'].items()});restored.eval()
        x=torch.zeros(2,24,saved['input_dim']);static=torch.zeros(2,4);future=torch.zeros(2,16,10)
        with torch.inference_mode():deviation=float((model(x,static,future)-restored(x,static,future)).abs().max())
        assert deviation<1e-6
        example=json.loads((folder/'test_input_example.json').read_text());output=forecast(path,example)
        np.testing.assert_allclose(list(output['predictions_mg_dl'].values()),example['expected_predictions_mg_dl'],rtol=0,atol=1e-4)
        frame=pd.read_csv(folder/'test_predictions.csv',dtype={'patient_id':str,'record_id':str})
        manifest=manifests[result['cohort']];sessions={s['session']:s for s in manifest['sessions']}
        assert set(frame.record_id)==set(s for s in sessions if sessions[s]['partition']=='test')
        for record,part in frame.groupby('record_id'):
            session=sessions[record];origins=pd.to_datetime(part.forecast_origin)
            assert origins.min()-pd.Timedelta(minutes=23*15)>=pd.Timestamp(session['start'])
            assert origins.max()+pd.Timedelta(minutes=max(saved['horizons_minutes']))<=pd.Timestamp(session['end'])
        partitions={k:[s for s in sessions.values() if s['partition']==k] for k in ['train','validation','test']}
        for left,right in [('train','validation'),('validation','test')]:
            assert max(pd.Timestamp(s['end']) for s in partitions[left])<min(pd.Timestamp(s['start']) for s in partitions[right])
        for horizon in saved['horizons_minutes']:
            part=frame[frame.minutes_ahead==horizon];error=part.predicted_mg_dl-part.actual_mg_dl
            mae=float(error.abs().mean());rmse=float(np.sqrt((error**2).mean()))
            assert abs(mae-result['test_metrics'][str(horizon)]['mae_mg_dl'])<1e-5
            assert abs(rmse-result['test_metrics'][str(horizon)]['rmse_mg_dl'])<1e-5
        if saved['horizons_minutes']==[15,30,60,240]:
            keys=frame[['patient_id','record_id','forecast_origin','minutes_ahead','actual_mg_dl']]
            if result['cohort'] in common_origins:pd.testing.assert_frame_equal(keys,common_origins[result['cohort']])
            else:common_origins[result['cohort']]=keys
        assert result['verification']['safe_checkpoint_full_test_max_abs_difference']<1e-6
        if saved['conditional']:assert result['verification']['decoder_later_event_early_output_max_difference']<1e-6
        history=json.loads((folder/'training_history.json').read_text());best_epoch=result['best_epoch']
        result['best_validation_mae_mg_dl']=next(r['validation_mae_mg_dl'] for r in history if r['epoch']==best_epoch)
        result['evaluation_protocol']='calendar_whole_session_20261102'
        write_json(folder/'metrics.json',result)
        verified.append({'cohort':result['cohort'],'variant':result['variant'],'chronology_verified':True,
            'metrics_recomputed':True,'portable_prediction_max_abs_difference':deviation,'inference_example_replayed':True})
    write_json(root/'training_summary.json',summary)
    write_json(root/'verification.json',{'verified_models':len(verified),'models':verified,'no_live_models_activated':True})
    print(json.dumps({'verified_models':len(verified),'protocol':'calendar_whole_session_20261102'}))

if __name__=='__main__':main()
