"""Compare the existing recursive GRU and conditional candidate on the same origins."""
import json
import argparse
from pathlib import Path
import numpy as np
import pandas as pd
import torch
from .conditional_pipeline import (load_records,summary_features,make_windows,load_conditional_checkpoint,
    predictions,unknown_plan,metrics,OUTPUT,DEFAULT_SUMMARY,DEFAULT_DATA_DIR)
from .t2dm_pipeline import load_forecaster_checkpoint,forecast_from_history,load_patient_timelines,PROJECT_ROOT


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkpoint',default=str(OUTPUT/'with_static.pt'))
    parser.add_argument('--output',default=str(OUTPUT/'legacy_comparison.json'))
    args=parser.parse_args()
    torch.set_num_threads(2)
    records=load_records()
    summary=summary_features(pd.read_excel(DEFAULT_SUMMARY))
    test=make_windows(records,summary)['test']
    indices=np.unique(test.records,return_index=True)[1]
    sample=test.subset(indices)
    conditional,checkpoint=load_conditional_checkpoint(args.checkpoint)
    candidate=predictions(conditional,unknown_plan(sample),checkpoint['scalers'])
    legacy,old=load_forecaster_checkpoint(PROJECT_ROOT/'models/weights/gru_t2dm_forecaster.pt')
    timelines=load_patient_timelines(DEFAULT_DATA_DIR)
    by_record={Path(str(frame['source_file'].iloc[0])).stem:frame for frame in timelines.values()}
    predicted=[]
    for index,(record_id,origin) in enumerate(zip(sample.records,sample.origins)):
        history=by_record[record_id].loc[lambda frame:frame['timestamp']<=pd.Timestamp(origin)].tail(old['sequence_length'])
        predicted.append(forecast_from_history(legacy,old,history,horizon_steps=48)['predicted_glucose_mg_dl'].to_numpy())
        if index%20==0:print('Compared origins:',index,flush=True)
    report={'comparison':'Same fixed origin per eligible record, after legacy recursion timestamp fix; no future event plan supplied.',
        'origins':len(sample),'legacy_recursive':metrics(sample.target,np.asarray(predicted)),
        'conditional_v2':metrics(sample.target,candidate),
        'persistence':metrics(sample.target,np.repeat(sample.last[:,None],48,axis=1))}
    Path(args.output).write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))


if __name__=='__main__':main()
