"""Replay local held-out windows, compare sizes and measure unknown-plan forecasts."""
import argparse
import hashlib
import json
from pathlib import Path
import warnings

import numpy as np
import pandas as pd
import torch

from models.training.local_v3_inputs import engineer_record, FOOD_PATH
from models.training.train_chronological import ChronologicalForecast, make_batches, normalize_batch, predict
from models.training.train_shanghai_gru import evaluate, write_json
from models.training.train_shanghai_carb_iob import remaining_fraction

ROOT = Path(__file__).resolve().parents[2]


def unknown_plan_future(batch, sessions):
    """Keep known clock and past exposure; never read doses/food after each origin."""
    result = batch['future'].copy(); result[:,:,2:9] = 0
    by_record = {s['record']:s for s in sessions}
    for record, session in by_record.items():
        indices = np.asarray([i for i,m in enumerate(batch['meta']) if m[1] == record], dtype=int)
        if not len(indices): continue
        origins = pd.to_datetime([batch['meta'][i][2] for i in indices]).as_unit('ns').asi8
        times = origins[:,None]+np.arange(1,17)[None,:]*900e9
        for dose,units,curve in session['doses']:
            result[indices,:,6] += ((origins>=dose)[:,None]*units*remaining_fraction((times-dose)/60e9,curve[0],curve[1])).astype(np.float32)
        for annotation in session['excluded']:
            result[indices,:,8] = np.maximum(result[indices,:,8],((origins>=annotation)[:,None]&(times>=annotation)&(times-annotation<480*60e9)).astype(np.float32))
    return result


def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--run', required=True); args = parser.parse_args()
    torch.set_num_threads(2); warnings.filterwarnings('ignore',category=UserWarning,module='openpyxl')
    run = Path(args.run); provenance = json.loads((run/'run_provenance.json').read_text()); options = provenance['arguments']
    summary = pd.read_excel(options['summary']); summaries = {str(r['Patient Number']):r for r in summary.to_dict('records')}
    sessions = [engineer_record(pd.read_excel(p,keep_default_na=False),summaries[p.stem],p.stem) for p in sorted(Path(options['data_dir']).glob('*.xls*'))]
    manifest = json.loads((run/'ShanghaiT2DM_split_manifest.json').read_text()); partitions = {k:[] for k in ['train','validation','test']}
    assigned = {s['session']:s['partition'] for s in manifest['sessions']}
    for s in sessions:
        if assigned[s['record']] in partitions: partitions[assigned[s['record']]].append(s)
    batches = make_batches(partitions,'exposure_dynamic',[15,30,60,240],options['training_stride']); test = batches['test']; unknown = {**test,'future':unknown_plan_future(test,sessions)}
    new_path = run/'ShanghaiT2DM/gru_future_event_decoder/checkpoint.pt'
    teacher_path = ROOT/'models/evaluation/shanghai_v3_20261104/ShanghaiT2DM/gru_future_event_decoder/checkpoint.pt'
    teacher_manifest = json.loads((teacher_path.parents[2]/'ShanghaiT2DM_split_manifest.json').read_text())
    development = {s['session'] for s in teacher_manifest['sessions'] if s['partition'] in ('train','validation')}
    if development & {s['record'] for s in partitions['test']}:
        raise ValueError('Teacher development overlaps these test records; cannot report a held-out comparison.')
    results = {}; predictions = {}
    for name,path in [('local_medium',new_path),('original_small',teacher_path)]:
        saved = torch.load(path,map_location='cpu',weights_only=True); scale = {k:np.asarray(v) for k,v in saved['scalers'].items()}
        model = ChronologicalForecast('GRU',saved['input_dim'],True,True,hidden_dim=saved['hidden_dim'],head_dim=saved.get('head_dim',16)); model.load_state_dict(saved['state_dict'])
        output = {}
        for mode,batch in [('recorded_future_events',test),('unknown_future_events',unknown)]:
            prediction = predict(model,batch,normalize_batch(batch,scale,list(range(14))),scale)
            output[mode] = evaluate(test['y'],prediction,test['x'][:,-1,0],[15,30,60,240]); predictions[(name,mode)] = prediction
        results[name] = {'parameters':sum(p.numel() for p in model.parameters()),'checkpoint_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),**output}
    # Recompute every saved test error and verify checkpoint serialization independently.
    frame = pd.read_csv(new_path.parent/'test_predictions.csv')
    expected = frame.predicted_mg_dl.to_numpy().reshape(-1,4)
    deviation = float(np.max(np.abs(predictions[('local_medium','recorded_future_events')]-expected)))
    if deviation > 1e-4: raise ValueError(f'Saved test prediction replay failed: {deviation}')
    report = {'test_windows':len(test['x']),'test_sessions':len(partitions['test']),'test_patients':len(manifest['patients']['test']),'same_test_windows_for_both_sizes':True,'teacher_development_test_record_overlap':0,'all_saved_predictions_replayed_max_difference':deviation,'results':results,'limitations':['Both sources are Shanghai T2DM; this is not external validation.','Recorded-future evaluation assumes future annotations known. Unknown-plan results use only past exposure, not confirmed fasting.','Overlapping windows are correlated; subjects can repeat across calendar partitions.','No calibrated individual interval, causal effect or insulin dosing validation.','Only 77 completely mapped meals among 3060 meal descriptions; IOB excludes unsupported insulin.']}
    write_json(run/'medium_comparison.json', report)
    metrics = json.loads((new_path.parent/'metrics.json').read_text()); history = json.loads((new_path.parent/'training_history.json').read_text())
    metrics['limitations'] = report['limitations']
    metrics['data_source'] = 'local data/raw/Shanghai_T2DM'
    write_json(new_path.parent/'metrics.json',metrics)
    best = min(history,key=lambda r:r['validation_mae_mg_dl'])
    if best['epoch'] != metrics['best_epoch']: raise ValueError('Checkpoint not selected by validation minimum.')
    write_json(run/'verification.json', {'all_saved_test_predictions_replayed':True,'test_windows':len(test['x']),'max_abs_difference_mg_dl':deviation,'validation_selected_epoch':best['epoch'],'teacher_development_test_record_overlap':0,'later_events_cannot_change_earlier_outputs':metrics['verification']['decoder_later_event_early_output_max_difference'] < 1e-6,'no_live_deployment_performed':True})
    registry = {'version':'local-v3-medium-20261106','cohort':'ShanghaiT2DM','checkpoint':new_path.relative_to(ROOT).as_posix() if new_path.is_absolute() else new_path.as_posix(),'checkpoint_sha256':results['local_medium']['checkpoint_sha256'],'hidden_dim':64,'head_dim':32,'parameters':results['local_medium']['parameters'],'source':'data/raw/Shanghai_T2DM + data/raw/Shanghai_T2DM_Summary.xlsx','food_reference_sha256':hashlib.sha256(FOOD_PATH.read_bytes()).hexdigest(),'evaluation':{'scope':'retrospective calendar-held-out conditional on recorded future events; separate unknown-plan evaluation in medium_comparison.json','mae_mg_dl':{h:v['mae_mg_dl'] for h,v in results['local_medium']['recorded_future_events'].items()}},'unknown_plan_mae_mg_dl':{h:v['mae_mg_dl'] for h,v in results['local_medium']['unknown_future_events'].items()},'activation':'Explicit server engine selection; original browser model retained.'}
    write_json(ROOT/'models/registry/local_v3_medium.json',registry)
    lines = ['# Local-data medium v3 evaluation','','Local training: 109 source workbooks / 100 patients; 64 hidden units, two GRU layers, 32-unit output head. The original browser model is preserved.','','| Model | Plan information | 15 min MAE | 30 min MAE | 60 min MAE | 240 min MAE |','| --- | --- | ---: | ---: | ---: | ---: |']
    for name,r in results.items():
        for mode in ['recorded_future_events','unknown_future_events']:
            lines.append('| '+name+' | '+mode+' | '+' | '.join(f"{r[mode][str(h)]['mae_mg_dl']:.2f}" for h in [15,30,60,240])+' |')
    lines += ['','Units: mg/dL. Persistence baseline errors and RMSE are included in medium_comparison.json. Same held-out records and windows for both model sizes. Selection used validation only.','','Source coverage: 77 fully mapped meals / 3060 descriptions; 725 supported bolus annotations. Missing/unresolved intake remains unknown.','','All saved test predictions were independently replayed; maximum deviation: '+str(deviation)+'.','',*report['limitations']]
    (run/'evaluation_report.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print(json.dumps({'test_windows':len(test['x']),'results':results},indent=2),flush=True)


if __name__ == '__main__': main()
