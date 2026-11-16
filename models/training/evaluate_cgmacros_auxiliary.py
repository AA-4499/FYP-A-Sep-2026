"""Replay saved checkpoints; report source-cohort strata and transfer limits."""
import argparse
import json
import platform
from pathlib import Path

import numpy as np
import pandas as pd
import torch

from models.training.cgmacros_auxiliary import load_windows, metrics, write_json
from models.training.train_chronological import ChronologicalForecast


def main():
    p=argparse.ArgumentParser();p.add_argument('--run',default='models/evaluation/cgmacros_6h_20261116');a=p.parse_args()
    root=Path(a.run);experiment=json.loads((root/'experiment.json').read_text());args=experiment['arguments']
    torch.set_num_threads(2);torch.set_num_interop_threads(1)
    write_json(root/'runtime_provenance.json',{'python':platform.python_version(),'torch':str(torch.__version__),'numpy':np.__version__,'pandas':pd.__version__,'training_threads':2,'seed':args['seed'],'source_archive_sha256':'05c8b0e6f1a2757050aced55ce4bf6ab2ac9b30f2fd8ca193056812d9c621d4d','source_doi':'10.13026/3z8q-x658','source_csv_fingerprints':'source_audit.json','raw_files_uploaded':False})
    batches,_=load_windows(args['data_dir'],args['seed']);b=batches['test']
    bio=pd.read_csv(Path(args['data_dir'])/'bio.csv');groups={int(r.subject):'T2D' if r['A1c PDL (Lab)']>=6.5 else 'Prediabetes' if r['A1c PDL (Lab)']>=5.7 else 'No diabetes' for _,r in bio.iterrows()}
    replay=json.loads((root/'checkpoint_replay.json').read_text()) if (root/'checkpoint_replay.json').exists() else {}
    for mode in ['carbs_only','macros','macros_activity']:
        if not (root/f'{mode}.pt').exists(): continue
        saved=torch.load(root/f'{mode}.pt',map_location='cpu',weights_only=True)
        model=ChronologicalForecast('GRU',3,True,True,future_dim=10,hidden_dim=32,head_dim=16,horizons_minutes=list(range(15,361,15)));model.load_state_dict(saved['state_dict']);model.eval()
        s={k:np.array(v,dtype=np.float32) for k,v in saved['scalers'].items()}
        x=(b['x']-s['history_mean'])/s['history_scale'];static=b['s'].copy();static[:,:2]=(static[:,:2]-s['static_mean'])/s['static_scale']
        f=b['f'].copy()
        if mode=='carbs_only':f[:,:,[3,4,5,7,8,9]]=0
        elif mode=='macros':f[:,:,[8,9]]=0
        f=(f-s['future_mean'])/s['future_scale'];pred=[]
        with torch.inference_mode():
            for i in range(0,len(x),512):pred.append(model(*[torch.from_numpy(v[i:i+512]) for v in [x,static,f]]).numpy()*s['target_scale']+s['target_mean']+b['x'][i:i+512,-1,0,None])
        pred=np.concatenate(pred);overall=metrics(b['y'],pred,b['participant'])
        reference=json.loads((root/f'{mode}_metrics.json').read_text())['test']
        deviation=max(abs(overall['mae_mg_dl'][h]-reference['mae_mg_dl'][h]) for h in reference['mae_mg_dl'])
        if deviation>1e-5:raise ValueError('Saved-checkpoint replay differs from reported test metrics.')
        strata={}
        for label in ['No diabetes','Prediabetes','T2D']:
            mask=np.array([groups[int(pid)]==label for pid in b['participant']])
            strata[label]={'participants':int(len(np.unique(b['participant'][mask]))),'windows':int(mask.sum()),**metrics(b['y'][mask],pred[mask],b['participant'][mask])}
        replay[mode]={'test_metric_replay_max_difference':deviation,'strata':strata}
    write_json(root/'checkpoint_replay.json',replay)
    lines=['# CGMacros auxiliary GRU results','','Single-seed participant-held-out, recorded-future-input conditional prediction. This is not causal validation or Shanghai accuracy.','', '| Inputs | Validation subject MAE | Test 15 min | Test 30 min | Test 60 min | Test 240 min | Test 360 min |','| --- | ---: | ---: | ---: | ---: | ---: | ---: |']
    for r in experiment['results']:
        lines.append('| '+r['mode']+' | '+f"{r['best_validation_participant_mae']:.3f}"+' | '+' | '.join(f"{r['test']['mae_mg_dl'][str(h)]:.3f}" for h in [15,30,60,240,360])+' |')
    lines+=['','Lowest validation ablation: **'+experiment['selected_by_validation']+'**. Deployed research feature set: **macros_activity**, to retain nutrition and activity inputs; not claimed to be the lowest-error ablation. Units: mg/dL.','',
            'Source filtering retained 41 of 45 participants (28 train / 5 validation / 8 test). Test windows overlap; they are not independent people. See source audit for excluded files and reasons.','',
            'The nutrition-only gain over carbohydrate-only is small and not established as statistically significant. The full activity model is retained to preserve the requested exercise controls, even though the macros-only ablation has a lower validation error. It uses actual recorded future activity; it does not establish that editing exercise causes this glucose difference.','',
            '## T2D subgroup (source dataset, not Shanghai)','', '| Inputs | Participants | 15 min | 30 min | 60 min | 240 min | 360 min |','| --- | ---: | ---: | ---: | ---: | ---: | ---: |']
    for mode,r in replay.items():
        t=r['strata']['T2D'];lines.append('| '+mode+' | '+str(t['participants'])+' | '+' | '.join(f"{t['mae_mg_dl'][str(h)]:.3f}" for h in [15,30,60,240,360])+' |')
    lines+=['','No Shanghai macro/activity ground truth was provided, so additive corrections and replacement of Shanghai conditional v3 remain unvalidated. The UI offers a clearly separated, opt-in research comparison. Shanghai conditional v3 is independently retrained to the same six-hour horizon.','',
            'Reproduce: `python -m models.training.cgmacros_auxiliary --archive <ZIP> --output <empty-run-dir>`; then use matching `--run` with `models.training.evaluate_cgmacros_auxiliary` and `models.training.export_cgmacros_auxiliary`. All public parity examples are synthetic, not participant traces.']
    (root/'RESULTS.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
    print('Retained checkpoints reproduce test metrics; prior ablation audit results remain recorded.')


if __name__=='__main__':main()
