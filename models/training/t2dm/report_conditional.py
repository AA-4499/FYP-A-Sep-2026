"""Render the recorded comparison and scenario diagnostics as standalone figures."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import torch
from .conditional_pipeline import OUTPUT, DEFAULT_DATA_DIR, DEFAULT_SUMMARY, prepare_record, load_conditional_checkpoint, forecast_conditional_record


def main():
    torch.set_num_threads(2)
    comparison=json.loads((OUTPUT/'legacy_comparison.json').read_text())
    report=json.loads((OUTPUT/'metrics.json').read_text())
    labs=json.loads((OUTPUT/'retrospective_labs/metrics.json').read_text())
    fig,axes=plt.subplots(1,2,figsize=(12,4.5),layout='constrained')
    x=np.arange(3);width=.24
    for offset,(key,label,color) in enumerate([
        ('persistence','Keep latest CGM','#94a3b8'),('legacy_recursive','Legacy GRU, recursion fixed','#596caa'),('conditional_v2','Conditional GRU v2','#0f766e')]):
        values=[comparison[key][hours]['trajectory_mae_mg_dl'] for hours in ('3h','6h','12h')]
        bars=axes[0].bar(x+(offset-1)*width,values,width,label=label,color=color)
        axes[0].bar_label(bars,fmt='%.1f',fontsize=8,padding=2)
    axes[0].set(title='Matched comparison: 108 fixed forecast origins',ylabel='Trajectory MAE (mg/dL)',xticks=x,xticklabels=['3 h','6 h','12 h'],ylim=(0,42))
    axes[0].legend(fontsize=8)
    for offset,(values,label,color) in enumerate([
        (report['without_static']['unknown_future_plan'],'Without summary','#94a3b8'),
        (report['with_static']['unknown_future_plan'],'7 baseline summary fields','#0f766e'),
        (labs['with_static']['unknown_future_plan'],'23 fields, undated labs*','#d97706')]):
        bars=axes[1].bar(x+(offset-1)*width,[values[h]['trajectory_mae_mg_dl'] for h in ('3h','6h','12h')],width,label=label,color=color)
        axes[1].bar_label(bars,fmt='%.1f',fontsize=8,padding=2)
    axes[1].set(title='Static-context comparison: 1,422 test windows',ylabel='Trajectory MAE (mg/dL)',xticks=x,xticklabels=['3 h','6 h','12 h'],ylim=(0,34))
    axes[1].legend(fontsize=8)
    fig.supxlabel('* Undated laboratory results: retrospective experiment, not prospective validation.',fontsize=9)
    fig.savefig(OUTPUT/'comparison.png',dpi=180)
    plt.close(fig)
    record_id='2000_0_20201230'
    workbook=next(p for p in DEFAULT_DATA_DIR.glob('*') if p.stem==record_id)
    record=prepare_record(pd.read_excel(workbook),record_id)
    summary=pd.read_excel(DEFAULT_SUMMARY).set_index('Patient Number').loc[record_id]
    model,checkpoint=load_conditional_checkpoint(OUTPUT/'with_static.pt')
    meal=forecast_conditional_record(model,checkpoint,record,summary,12,[{'kind':'food_mass_g','amount':60.,'minutes_ahead':60}])
    bolus=forecast_conditional_record(model,checkpoint,record,summary,12,[{'kind':'bolus_units','amount':2.,'minutes_ahead':60}])
    hours=np.arange(1,len(meal)+1)/4
    fig,axes=plt.subplots(2,1,figsize=(10,6),sharex=True,layout='constrained')
    axes[0].plot(hours,meal['baseline_glucose_mg_dl'],label='No future plan supplied',color='#2563eb')
    axes[0].plot(hours,meal['scenario_glucose_mg_dl'],label='60 g food mass supplied at +1 h',color='#d97706')
    axes[0].set(ylabel='Predicted CGM (mg/dL)',title='Conditional input sensitivity; not a causal intervention estimate')
    axes[0].legend(fontsize=9)
    axes[1].plot(hours,meal['scenario_glucose_mg_dl']-meal['baseline_glucose_mg_dl'],label='Meal input sensitivity',color='#d97706')
    axes[1].plot(hours,bolus['scenario_glucose_mg_dl']-bolus['baseline_glucose_mg_dl'],label='Bolus input sensitivity (direction not validated)',color='#b91c1c')
    axes[1].axhline(0,color='#94a3b8',linewidth=1)
    axes[1].set(xlabel='Hours after last observed CGM',ylabel='Scenario minus baseline (mg/dL)')
    axes[1].legend(fontsize=9)
    for ax in axes:
        ax.axvline(1,color='#94a3b8',linestyle='--');ax.grid(alpha=.2)
    fig.supxlabel('Unknown future events do not mean confirmed fasting or no insulin. Food mass is not carbohydrate mass.',fontsize=9)
    fig.savefig(OUTPUT/'scenario_sensitivity.png',dpi=180)
    plt.close(fig)
    lines = ['# Conditional GRU experiment results', '',
        'All errors below are in mg/dL. One fixed seed (2026); checkpoints selected by validation trajectory MAE.', '',
        '## Matched legacy comparison', '',
        f"Same {comparison['origins']} origins, one per eligible record. Future event plan unknown. Legacy recursion alignment is fixed.", '',
        '| Model | 3h trajectory MAE | 6h trajectory MAE | 12h trajectory MAE |',
        '| --- | ---: | ---: | ---: |']
    for key,label in [('persistence','Latest-CGM persistence'),('legacy_recursive','Legacy GRU (fixed recursion)'),('conditional_v2','Conditional GRU v2, 7 summary fields')]:
        lines.append('| '+label+' | '+' | '.join(f"{comparison[key][hours]['trajectory_mae_mg_dl']:.2f}" for hours in ('3h','6h','12h'))+' |')
    lines += ['', '## Static-context experiment', '',
        f"{report['windows']['test']} test trajectories, overlapping windows within known records; not unseen-patient evaluation.", '',
        '| Inputs | 3h trajectory MAE | 6h trajectory MAE | 12h trajectory MAE |',
        '| --- | ---: | ---: | ---: |']
    for values,label in [(report['without_static']['unknown_future_plan'],'Without summary'),
            (report['with_static']['unknown_future_plan'],'7 baseline summary fields'),
            (labs['with_static']['unknown_future_plan'],'23 fields incl. undated labs (retrospective only)')]:
        lines.append('| '+label+' | '+' | '.join(f"{values[hours]['trajectory_mae_mg_dl']:.2f}" for hours in ('3h','6h','12h'))+' |')
    lines += ['', '## Scenario sensitivity', '',
        'These are predictive input sensitivities on the same fixed origins, not causal treatment effects.', '',
        '| Supplied input | Median maximum absolute curve change | Median signed peak change | Fraction with negative peak | Median 12h endpoint change |',
        '| --- | ---: | ---: | ---: | ---: |']
    for name,values in report['with_static']['sensitivity_on_fixed_origins'].items():
        if name == 'clock_phase_shift_12h': continue
        lines.append(f"| {name} | {values['median_max_abs_difference_mg_dl']:.3f} | {values['median_signed_peak_difference_mg_dl']:.3f} | {values['fraction_negative_peak']:.1%} | {values['median_endpoint_difference_mg_dl']:.5f} |")
    lines += ['', 'Important: a near-zero endpoint can coexist with a meaningful transient response. No sign or magnitude was artificially enforced.', '',
        'Signed peak is scenario minus baseline at the point with the largest absolute change. Both meal and insulin directions remain unvalidated: the example plot includes an immediate meal-associated fall and bolus-associated rise. These failures prevent promotion as a physiological what-if simulator; nonzero sensitivity alone is insufficient. Treatment-selection confounding and coarse event labels remain unresolved. Undated laboratory measurements may not have been available at forecast time.', '',
        'The legacy production checkpoint was not replaced. Both new checkpoints are experimental. See docs/conditional-model-audit.md for assumptions, remaining omissions and reproduction commands.', '']
    (OUTPUT/'EXPERIMENT_RESULTS.md').write_text('\n'.join(lines),encoding='utf-8')
    print('Saved figures and EXPERIMENT_RESULTS.md')


if __name__=='__main__':main()
