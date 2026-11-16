"""Verify the actual saved joint model, native target contract and fixed splits."""
import hashlib
import json
import unittest
from pathlib import Path
import numpy as np
import torch
from models.training.train_integrated_v3 import HISTORY, FUTURE, HORIZONS
from models.training.train_chronological import ChronologicalForecast

ROOT=Path(__file__).resolve().parents[2]
RUN=ROOT/'models/evaluation/integrated_v3_20261116'

class IntegratedV3Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        cls.checkpoint=torch.load(RUN/'checkpoint.pt',map_location='cpu',weights_only=True)
        cls.fixture=json.loads((RUN/'synthetic_parity.json').read_text(encoding='utf-8'))
        cls.model=ChronologicalForecast('GRU',15,True,True,future_dim=17,horizons_minutes=HORIZONS)
        cls.model.load_state_dict(cls.checkpoint['state_dict']);cls.model.eval()

    def predict(self,future):
        s=self.checkpoint['scalers'];f=self.fixture
        raw=np.array([f['static']],np.float32)
        static=np.c_[(raw-s['static_mean'])/s['static_scale'],np.zeros((1,2))]
        with torch.inference_mode():
            y=self.model(torch.tensor((np.array([f['history']])-s['history_mean'])/s['history_scale'],dtype=torch.float32),
              torch.tensor(static,dtype=torch.float32),torch.tensor((np.array([future])-s['future_mean'])/s['future_scale'],dtype=torch.float32)).numpy()[0]
        return y*s['target_scale']+s['target_mean']+f['history'][-1][0]

    def test_actual_checkpoint_public_artifact_and_synthetic_parity(self):
        sha=hashlib.sha256((RUN/'checkpoint.pt').read_bytes()).hexdigest()
        artifact=json.loads((ROOT/'web/frontend/public/conditional-models/ShanghaiT2DMIntegrated.json').read_text(encoding='utf-8'))
        self.assertEqual(sha,artifact['checkpoint_sha256']);self.assertEqual(sha,self.fixture['checkpoint_sha256'])
        self.assertEqual(self.checkpoint['dynamic_features'],HISTORY)
        self.assertEqual(self.checkpoint['future_features'],FUTURE)
        np.testing.assert_allclose(self.predict(self.fixture['future']),self.fixture['expected'],atol=.0001,rtol=0)

    def test_later_activity_cannot_change_earlier_outputs(self):
        baseline=self.predict(self.fixture['future']);future=np.array(self.fixture['future'])
        future[12:,14:16]=[5,1];changed=self.predict(future)
        np.testing.assert_array_equal(baseline[:12],changed[:12]);self.assertGreater(np.max(np.abs(baseline[12:]-changed[12:])),.001)

    def test_participant_split_and_missing_source_contract(self):
        parts=json.loads((RUN/'partitions.json').read_text(encoding='utf-8'))
        sets=[set(parts[p]['cgmacros_subjects']) for p in ['train','validation','test']]
        for i in range(3):
            for j in range(i):self.assertFalse(sets[i]&sets[j])
        support=json.loads((RUN/'activity_support.json').read_text(encoding='utf-8'))
        self.assertFalse(support['activity_type_labels_available']);self.assertGreater(support['max_met'],5)
        self.assertEqual(self.checkpoint['future_features'][-1],'insulin_source_available')
        self.assertFalse(self.checkpoint['joint_insulin_activity_validated'])

if __name__=='__main__':unittest.main()
