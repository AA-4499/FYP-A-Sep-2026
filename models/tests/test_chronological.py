import unittest
import numpy as np
import pandas as pd
import torch
from models.training.train_chronological import chronological_split,make_batches,ChronologicalForecast
from models.training.predict_chronological import build_future_schedule

class ChronologicalTests(unittest.TestCase):
    def session(self,record,start,days=1):
        times=pd.date_range(start,periods=days*96,freq='15min').to_numpy()
        glucose=np.full(len(times),120,dtype=np.float32)
        features=np.column_stack([glucose,np.zeros((len(times),13))]).astype(np.float32)
        return {'record':record,'patient':record.split('_')[0],'times':times,'glucose':glucose,
                'static':np.asarray([50,25,0,0],dtype=np.float32),'exposure_dynamic':features}

    def test_whole_sessions_and_chronology(self):
        sessions=[self.session(str(i),'2021-01-%02d'%(i+1)) for i in range(20)]
        split,manifest=chronological_split(sessions)
        ids=[s['record'] for values in split.values() for s in values]
        self.assertEqual(len(ids),len(set(ids)))
        self.assertLess(max(s['times'][-1] for s in split['train']),min(s['times'][0] for s in split['validation']))
        self.assertLess(max(s['times'][-1] for s in split['validation']),min(s['times'][0] for s in split['test']))
        self.assertEqual(sum(s['rows'] for s in manifest['sessions']),sum(len(s['times']) for s in sessions))

    def test_session_spanning_all_partitions_is_purged(self):
        sessions=[self.session(str(i),'2021-01-%02d'%(i+1)) for i in range(20)]
        sessions.append(self.session('long','2021-01-01',40))
        _,manifest=chronological_split(sessions)
        self.assertEqual(next(s['partition'] for s in manifest['sessions'] if s['session']=='long'),'purged')

    def test_windows_remain_inside_session_and_future_excludes_glucose(self):
        s=self.session('1','2021-01-01');s['exposure_dynamic'][:,0]=np.arange(96)+100
        groups={k:[s] for k in ['train','validation','test']}
        batches=make_batches(groups,'exposure_dynamic',[15,30,60,240],4)
        self.assertEqual(batches['test']['x'].shape[1:],(24,14))
        self.assertEqual(batches['test']['future'].shape[1:],(16,10))
        self.assertTrue(np.all(batches['test']['future']==0))

    def test_later_schedule_does_not_change_earlier_outputs(self):
        torch.manual_seed(1);model=ChronologicalForecast('GRU',14,True,True).eval()
        x=torch.zeros(2,24,14);static=torch.zeros(2,4);future=torch.zeros(2,16,10)
        with torch.inference_mode():
            before=model(x,static,future);future[:,4:]+=1;after=model(x,static,future)
        torch.testing.assert_close(before[:,:3],after[:,:3],atol=0,rtol=0)
        self.assertFalse(torch.equal(before[:,3],after[:,3]))

    def test_schedule_recomputes_iob_and_places_meal(self):
        origin='2021-01-01 12:00'
        future=build_future_schedule(origin,[{'timestamp':origin,'units':4,'formulation':'rapid'}],
            [{'timestamp':'2021-01-01 12:30','carbohydrate_g':40}],
            [{'timestamp':'2021-01-01 12:45','units':2,'formulation':'regular'}],history_start='2021-01-01 00:00')
        self.assertEqual(future.shape,(16,10));self.assertEqual(future[1,2],40)
        self.assertEqual(future[:,2].sum(),40);self.assertEqual(future[2,7],1)
        self.assertGreater(future[2,6],future[1,6]);self.assertEqual(future[:,9].sum(),0)

    def test_future_plan_rejects_unknown_formulation_and_past_event(self):
        with self.assertRaises(ValueError):build_future_schedule('2021-01-01 12:00',[],planned_boluses=[{'timestamp':'2021-01-01 12:30','units':3,'formulation':'premixed'}])
        with self.assertRaises(ValueError):build_future_schedule('2021-01-01 12:00',[],planned_meals=[{'timestamp':'2021-01-01 11:30','carbohydrate_g':40}])

if __name__=='__main__':unittest.main()
