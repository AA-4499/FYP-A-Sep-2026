import tempfile
import unittest
from pathlib import Path
import numpy as np
import pandas as pd
import torch
from models.training.t2dm.conditional_pipeline import (
    prepare_record, summary_features, make_windows, fit_scalers, ConditionalGRU,
    predictions, unknown_plan, planned_event, PAST_COLUMNS, FUTURE_COLUMNS,
    forecast_conditional_record, load_conditional_checkpoint,
)


def raw_record(periods=400):
    return pd.DataFrame({'Date':pd.date_range('2024-01-01',periods=periods,freq='15min'),
        'CGM (mg / dl)':120+np.sin(np.arange(periods)/5)*10,'Dietary intake':['']*periods,
        'Insulin dose - s.c.':np.zeros(periods),'CSII - basal insulin (Novolin R, IU / H)':np.zeros(periods)})


def windows():
    record=prepare_record(raw_record(),'1234_0_20240101')
    summary=pd.DataFrame({'Age (years)':[60.],'BMI (kg/m2)':[25.]},index=['1234_0_20240101'])
    return record,summary,make_windows({'1234_0_20240101':record},summary)


class ConditionalModelTests(unittest.TestCase):
    def test_event_without_cgm_is_retained_and_basal_rate_is_separate(self):
        raw=raw_record(6)
        event=pd.DataFrame({'Date':[pd.Timestamp('2024-01-01 00:10')],
            'CGM (mg / dl)':[np.nan],'Dietary intake':['Rice 60 g'],
            'Insulin dose - s.c.':['2 IU'],'CSII - basal insulin (Novolin R, IU / H)':[0.8]})
        frame=prepare_record(pd.concat([raw,event],ignore_index=True),'record')
        self.assertEqual(60.,frame.loc[1,'food_mass_g'])
        self.assertEqual(2.,frame.loc[1,'sc_insulin_units'])
        self.assertEqual(.8,frame.loc[1,'basal_rate_iu_h'])
        self.assertEqual(0.,frame.loc[0,'food_mass_g_recorded'])
        self.assertEqual(1.,frame.loc[1,'food_mass_g_recorded'])

    def test_events_are_not_carried_across_large_gaps(self):
        raw=raw_record(3)
        raw.loc[1,'Date']=pd.Timestamp('2024-01-01 00:30')
        raw.loc[1,'CGM (mg / dl)']=np.nan
        raw.loc[1,'Dietary intake']='Rice 60 g'
        raw.loc[2,'Date']=pd.Timestamp('2024-01-01 02:00')
        self.assertEqual(0.,prepare_record(raw,'record')['food_mass_g'].sum())

    def test_summary_identity_and_undated_labs_do_not_enter_default_features(self):
        summary=pd.DataFrame({'Patient Number':['1234_0_20240101'],'Age (years)':[60],
            'BMI (kg/m2)':[25.],'HbA1c (mmol/mol)':['70'],'Fasting Plasma Glucose (mg/dl)':[180.]})
        core=summary_features(summary)
        self.assertNotIn('Patient Number',core.columns)
        self.assertNotIn('HbA1c (mmol/mol)',core.columns)
        self.assertIn('HbA1c (mmol/mol)',summary_features(summary,True).columns)

    def test_target_trajectories_do_not_cross_validation_or_test_boundaries(self):
        record,_,batches=windows()
        times=record['timestamp']
        validation=times.iloc[int(int(len(times)*.8)*.8)]
        test=times.iloc[int(len(times)*.8)]
        for split,batch in batches.items():
            first=pd.to_datetime(batch.origins)+pd.Timedelta(minutes=15)
            last=pd.to_datetime(batch.origins)+pd.Timedelta(hours=12)
            if split=='train': self.assertTrue((last<validation).all())
            elif split=='validation': self.assertTrue(((first>=validation)&(last<test)).all())
            else: self.assertTrue((first>=test).all())
        self.assertNotIn('glucose',FUTURE_COLUMNS)

    def test_subunit_static_features_are_standardized_and_unit_invariant(self):
        import copy
        from models.training.t2dm.conditional_pipeline import transform
        _, _, batches = windows()
        batch = copy.deepcopy(batches['train'])
        half = len(batch)//2
        batch.records[:half] = 'record_a'
        batch.records[half:] = 'record_b'
        batch.static[:half, 1] = 1.6
        batch.static[half:, 1] = 1.8
        scaled_metres = transform(batch, fit_scalers(batch))[2][:, 1].numpy()
        batch.static[:, 1] *= 100
        scaled_centimetres = transform(batch, fit_scalers(batch))[2][:, 1].numpy()
        np.testing.assert_allclose(scaled_metres, scaled_centimetres, atol=1e-5)
        self.assertGreater(np.std(scaled_metres), .9)

    def test_future_event_cannot_change_predictions_before_the_event(self):
        _,summary,batches=windows()
        scalers=fit_scalers(batches['train'])
        model=ConditionalGRU(len(summary.columns)*2,8)
        base=unknown_plan(batches['test'])
        scenario=planned_event(base,'food_mass_g',60.,60)
        y=predictions(model,base,scalers)
        altered=predictions(model,scenario,scalers)
        np.testing.assert_allclose(y[:,:3],altered[:,:3],atol=1e-6)
        self.assertTrue(np.any(np.abs(y[:,3:]-altered[:,3:])>1e-6))

    def test_checkpoint_roundtrip_and_latest_history_forecast(self):
        record,summary,batches=windows()
        scalers=fit_scalers(batches['train'])
        model=ConditionalGRU(len(summary.columns)*2,8)
        checkpoint={'version':'conditional-gru-v2','context_at_each_step':True,
            'state_dict':model.state_dict(),'static_columns':list(summary.columns),
            'past_columns':list(PAST_COLUMNS),'future_columns':list(FUTURE_COLUMNS),
            'sequence_length':24,'horizon_steps':48,'hidden':8,'scalers':scalers,'use_static':True}
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'candidate.pt';torch.save(checkpoint,path)
            loaded,cp=load_conditional_checkpoint(path)
            forecast=forecast_conditional_record(loaded,cp,record,summary.iloc[0],6,
                [{'kind':'food_mass_g','amount':60.,'minutes_ahead':60}])
        self.assertEqual(24,len(forecast))
        self.assertTrue(np.isfinite(forecast['scenario_glucose_mg_dl']).all())
        np.testing.assert_allclose(forecast['baseline_glucose_mg_dl'].iloc[:3],forecast['scenario_glucose_mg_dl'].iloc[:3])


if __name__=='__main__':unittest.main()
