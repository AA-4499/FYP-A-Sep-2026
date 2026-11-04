import unittest
import numpy as np
import pandas as pd
import torch
from models.training.train_shanghai_supported_features import insulin_amount,route_columns,feature_windows,fit_scalers,normalize_batch,SupportedFeaturesModel,DYNAMIC

def session(patient,age,bmi):
    times=np.datetime64('2020-01-01T00:00')+np.arange(40)*np.timedelta64(15,'m')
    dynamic=np.zeros((40,len(DYNAMIC)),dtype=np.float32);dynamic[:,0]=np.arange(40)+100
    return {'patient':patient,'record':patient+'_0','times':times,'glucose':dynamic[:,0],'dynamic':dynamic,'static':np.array([age,bmi,0,0],dtype=np.float32)}

class SupportedFeatureTests(unittest.TestCase):
    def test_insulin_parser_keeps_units_and_rejects_multi_dose_regimens(self):
        self.assertEqual(insulin_amount('saline 100 ml + insulin 4 IU'),(4.,1.,0.))
        self.assertEqual(insulin_amount('4 IU breakfast / 6 IU dinner'),(0.,1.,1.))
        self.assertEqual(insulin_amount('unknown dose'),(0.,1.,1.))
        self.assertEqual(insulin_amount('/'),(0.,0.,0.))
        self.assertEqual(insulin_amount('0'),(0.,1.,0.))
        self.assertEqual(insulin_amount('0.5 IU / H'),(.5,1.,0.))

    def test_basal_and_bolus_aliases_remain_distinct(self):
        routes=route_columns(pd.DataFrame(columns=['Insulin dose - s.c.','Insulin dose - i.v.','CSII - bolus insulin (Novolin R, IU)','胰岛素泵基础量 (Novolin R, IU / H)']))
        self.assertEqual(len(routes['pump_basal_rate_units_per_hour']),1)
        self.assertEqual(len(routes['pump_bolus_units']),1)
        self.assertEqual(len(routes['sc_dose_units']),1)

    def test_future_insulin_is_excluded_and_scalers_are_training_only(self):
        a,b,c=session('a',40,20),session('b',999,999),session('c',800,800)
        a['dynamic'][24,3]=99
        split={'train':['a'],'validation':['b'],'test':['c']}
        batches=feature_windows([a,b,c],split,1)
        self.assertEqual(float(batches['train']['x'][0,:,3].sum()),0.)
        self.assertEqual(float(batches['train']['y'][0,-1]),139.)
        scalers=fit_scalers([a,b,c],split,batches)
        np.testing.assert_array_equal(scalers['static_median'],[40,20])
        np.testing.assert_array_equal(scalers['dynamic_mean'][7:],0)
        np.testing.assert_array_equal(scalers['dynamic_scale'][7:],1)
        x,context=normalize_batch(batches['train'],scalers,list(range(len(DYNAMIC))))
        self.assertTrue(np.isfinite(x).all() and np.isfinite(context).all())

    def test_both_architectures_produce_four_direct_outputs(self):
        for kind in ['GRU','LSTM']:
            model=SupportedFeaturesModel(kind,len(DYNAMIC));model.eval()
            with torch.inference_mode():output=model(torch.zeros(2,24,len(DYNAMIC)),torch.zeros(2,4))
            self.assertEqual(tuple(output.shape),(2,4));self.assertTrue(torch.isfinite(output).all())

if __name__=='__main__':unittest.main()
