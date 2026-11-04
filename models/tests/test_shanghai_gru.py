import unittest
import numpy as np
from models.training.train_shanghai_gru import patient_split,windows,evaluate,LOOKBACK

def session(patient,record='visit0',n=40):
    return {'patient':patient,'record':record,'times':np.datetime64('2020-01-01T00:00')+np.arange(n)*np.timedelta64(15,'m'),'glucose':100+np.arange(n,dtype=np.float32)}

class ShanghaiTrainingTests(unittest.TestCase):
    def test_patient_split_is_complete_disjoint_and_repeatable(self):
        ids=[str(i) for i in range(100)]
        a=patient_split(ids+ids[:9],20261029)
        self.assertEqual(a,patient_split(list(reversed(ids)),20261029))
        self.assertEqual([len(a[k]) for k in ['train','validation','test']],[80,10,10])
        self.assertEqual(len(set(a['train']+a['validation']+a['test'])),100)

    def test_targets_are_future_only_and_repeat_visits_stay_in_one_split(self):
        split={'train':['a'],'validation':['b'],'test':['c']}
        parts=windows([session('a'),session('a','visit1'),session('b'),session('c')],split,1)
        x,y,meta=parts['train']
        self.assertEqual(x.shape[1:],(LOOKBACK,1))
        self.assertEqual(set(m[0] for m in meta),{'a'})
        np.testing.assert_array_equal(y[0],[124,125,127,131])
        self.assertEqual(float(x[0,-1,0]),123)
        self.assertEqual(set(m[1] for m in meta),{'visit0','visit1'})

    def test_missing_glucose_and_time_gaps_are_not_imputed(self):
        broken=session('a','missing',n=32);broken['glucose'][20]=np.nan
        gap=session('a','gap',n=32);gap['times'][20:]+=np.timedelta64(15,'m')
        parts=windows([broken,gap,session('a','good'),session('b'),session('c')],{'train':['a'],'validation':['b'],'test':['c']},1)
        self.assertEqual(set(m[1] for m in parts['train'][2]),{'good'})

    def test_metrics_report_persistence_without_claiming_an_improvement(self):
        actual=np.ones((5,4))*100
        report=evaluate(actual,np.ones((5,4))*110,np.ones(5)*100)
        self.assertEqual(report['60']['mae_mg_dl'],10)
        self.assertEqual(report['60']['persistence_mae_mg_dl'],0)

    def test_four_hour_target_requires_sixteen_future_steps(self):
        split={'train':['a'],'validation':['b'],'test':['c']}
        parts=windows([session('a'),session('b'),session('c')],split,1,(15,30,60,240))
        x,y,meta=parts['test']
        self.assertEqual(len(x),1)
        np.testing.assert_array_equal(y[0],[124,125,127,139])
        self.assertEqual(float(x[0,-1,0]),123)
        gap=session('a','gap',40);gap['times'][38:]+=np.timedelta64(15,'m')
        with self.assertRaisesRegex(ValueError,'train'):
            windows([gap,session('b'),session('c')],split,1,(15,30,60,240))

    def test_invalid_horizons_are_rejected(self):
        for horizons in [(0,15),(30,15),(15,15),(15,31)]:
            with self.assertRaisesRegex(ValueError,'Horizons'):
                windows([],{},1,horizons)

if __name__=='__main__':unittest.main()
