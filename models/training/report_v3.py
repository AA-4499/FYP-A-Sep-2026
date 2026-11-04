"""Summarize the retrained run without mixing conditional and history-only errors.

Cluster bootstrap intervals concern aggregate test MAE, never an individual's
prediction interval. Checkpoint selection is based on validation alone.
"""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
import pandas as pd


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run', default='models/evaluation/shanghai_v3_20261104')
    parser.add_argument('--version', default='shanghai-v3-20261104')
    args = parser.parse_args()
    run = Path(args.run)
    results = json.loads((run / 'training_summary.json').read_text())
    records, bootstrap = [], []
    rng = np.random.default_rng(20261104)
    lines = ['# Retrained v3 models', '',
             'History-only and oracle-conditional evaluations answer different questions. '
             'Rows must not be ranked across these two evaluation types. All errors are mg/dL.', '',
             '| Cohort | Model | Evaluation | 15m MAE | 30m MAE | 60m MAE | Last horizon MAE |',
             '| --- | --- | --- | ---: | ---: | ---: | ---: |']
    for result in results:
        directory = run / result['cohort'] / result['variant']
        digest = hashlib.sha256((directory / 'checkpoint.pt').read_bytes()).hexdigest()
        if digest != result['checkpoint_sha256']:
            raise ValueError('Checkpoint digest mismatch')
        conditional = result['conditional']
        kind = 'oracle conditional' if conditional else 'history only'
        horizons = result['horizons_minutes']
        metrics = result['test_metrics']
        errors = [f"{metrics[str(h)]['mae_mg_dl']:.2f}" for h in horizons]
        lines.append('| ' + ' | '.join([result['cohort'], result['variant'], kind, *errors[:3], errors[3]+f' ({horizons[3]}m)'])+' |')
        history = json.loads((directory / 'training_history.json').read_text())
        validation = next(h['validation_mae_mg_dl'] for h in history if h['epoch'] == result['best_epoch'])
        records.append({'cohort':result['cohort'], 'variant':result['variant'], 'conditional':conditional,
                        'evaluation':kind, 'checkpoint':(directory/'checkpoint.pt').as_posix(),
                        'checkpoint_sha256':digest, 'horizons_minutes':horizons,
                        'validation_mae_mg_dl':validation, 'test_metrics':metrics})
        frame = pd.read_csv(directory / 'test_predictions.csv', dtype={'patient_id':str})
        frame['absolute_error'] = (frame.predicted_mg_dl-frame.actual_mg_dl).abs()
        for h, part in frame.groupby('minutes_ahead'):
            groups = part.groupby('patient_id').absolute_error.agg(['sum','count'])
            indices = rng.integers(0, len(groups), size=(1000, len(groups)))
            means = groups['sum'].to_numpy()[indices].sum(axis=1) / groups['count'].to_numpy()[indices].sum(axis=1)
            lower, upper = np.quantile(means, [.025,.975])
            bootstrap.append({'cohort':result['cohort'],'variant':result['variant'], 'evaluation':kind,
                              'horizon_minutes':int(h),'patients':len(groups),'mae_mg_dl':float(part.absolute_error.mean()),
                              'cluster_bootstrap_95pct_mae_interval':[float(lower),float(upper)]})
    selection = {}
    for cohort in sorted({r['cohort'] for r in records}):
        candidates = [r for r in records if r['cohort']==cohort and not r['conditional'] and r['horizons_minutes']==[15,30,60,240]]
        chosen = min(candidates, key=lambda r:r['validation_mae_mg_dl'])
        selection[cohort] = {'variant':chosen['variant'],'criterion':'Mean validation MAE across identical 15/30/60/240-minute horizons; test errors not used.'}
    lines += ['', '## Interpretation', '',
              '- Each cohort has eight new checkpoints. The website uses the future-event decoder for explicit plan comparisons, not because it wins an unconditional test ranking.',
              '- The original legacy checkpoint remains available in the comparison tab. Its older evaluation population differs; this report does not claim a head-to-head improvement over it.',
              '- Additional features do not guarantee better errors at every horizon. Compare glucose/context/carb-IOB ablations within the same cohort and protocol.',
              '- Conditional test metrics assume actual future annotations are known. Unknown-plan prospective accuracy has not been established by this run.',
              '- Only 96 source meal descriptions map completely; basal/premixed/long-acting/IV exposure is outside estimated bolus IOB.',
              '- cluster_bootstrap.json uses 1,000 patient-cluster resamples for aggregate MAE. Small T1DM test cohorts limit precision. These are not per-prediction uncertainty bands.',
              '- See models/README.md for the model directory layout, training workflow and limitations.']
    (run/'integration_report.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    (run/'cluster_bootstrap.json').write_text(json.dumps(bootstrap,indent=2),encoding='utf-8')
    registry = Path('models/registry'); registry.mkdir(parents=True,exist_ok=True)
    (registry/'conditional_v3.json').write_text(json.dumps({'version':args.version,
        'run':run.as_posix(),'history_model_validation_selection':selection,'models':records,
        'website_decoder_selection':'Architecture chosen for experimental future-plan interface, not test-error selection.',
        'causal_treatment_effect_validated':False},indent=2),encoding='utf-8')
    print(json.dumps({'cataloged_models':len(records),'aggregate_mae_bootstrap_intervals':len(bootstrap)}))


if __name__ == '__main__':
    main()
