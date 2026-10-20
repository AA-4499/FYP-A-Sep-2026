"""Generate a candidate forecast without changing the production model or database."""
import argparse
from pathlib import Path
import pandas as pd
import torch
from .conditional_pipeline import (
    OUTPUT, DEFAULT_DATA_DIR, DEFAULT_SUMMARY, prepare_record, load_conditional_checkpoint,
    forecast_conditional_record,
)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkpoint',default=str(Path(__file__).resolve().parents[2]/'weights/conditional_gru_v2.pt'))
    parser.add_argument('--record-id',required=True)
    parser.add_argument('--data-dir',default=str(DEFAULT_DATA_DIR))
    parser.add_argument('--summary',default=str(DEFAULT_SUMMARY))
    parser.add_argument('--hours',type=int,choices=(3,6,12),default=3)
    parser.add_argument('--meal-g',type=float,default=0.)
    parser.add_argument('--bolus-iu',type=float,default=0.)
    parser.add_argument('--minutes-ahead',type=int,default=60)
    parser.add_argument('--output',default=None)
    args=parser.parse_args()
    if args.meal_g<0 or args.bolus_iu<0:
        parser.error('Event amounts must be nonnegative')
    torch.set_num_threads(2)
    files=[p for p in Path(args.data_dir).glob('*') if p.stem==args.record_id and p.suffix.lower() in ('.xls','.xlsx')]
    if len(files)!=1:
        parser.error('Choose an exact, unique workbook record ID')
    model,checkpoint=load_conditional_checkpoint(args.checkpoint)
    summary=pd.read_excel(args.summary).set_index('Patient Number')
    row=summary.loc[args.record_id]
    events=[]
    if args.meal_g: events.append({'kind':'food_mass_g','amount':args.meal_g,'minutes_ahead':args.minutes_ahead})
    if args.bolus_iu: events.append({'kind':'bolus_units','amount':args.bolus_iu,'minutes_ahead':args.minutes_ahead})
    frame=forecast_conditional_record(model,checkpoint,prepare_record(pd.read_excel(files[0]),args.record_id),row,args.hours,events)
    output=Path(args.output) if args.output else OUTPUT/f'{args.record_id}_{args.hours}h_scenario.csv'
    output.parent.mkdir(parents=True,exist_ok=True)
    frame.to_csv(output,index=False)
    print('Saved:',output)
    print('Maximum absolute scenario difference:',float((frame['scenario_glucose_mg_dl']-frame['baseline_glucose_mg_dl']).abs().max()))
    print('Conditional model sensitivity only; no validated causal treatment effect. Unknown future events do not mean confirmed no food or no insulin.')


if __name__=='__main__': main()
