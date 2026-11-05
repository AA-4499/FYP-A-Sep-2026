import json
from pathlib import Path
import unittest

import numpy as np
import pandas as pd

from models.training.local_v3_inputs import engineer_record

ROOT = Path(__file__).resolve().parents[2]


class LocalV3InputsTests(unittest.TestCase):
    def test_preprocessing_matches_existing_v3_reference_cases(self):
        fixtures = json.loads((ROOT/'web/frontend/tests/fixtures/conditional-feature-reference.json').read_text(encoding='utf-8'))['cases']
        for fixture in fixtures:
            with self.subTest(record=fixture['record_id']):
                age,bmi = fixture['static_context'][:2]
                record = engineer_record(pd.DataFrame(fixture['rows']),{'Age (years)':age,'BMI (kg/m2)':bmi},fixture['record_id'])
                np.testing.assert_allclose(record['dynamic'],fixture['expected_history'],rtol=0,atol=2e-5)
                np.testing.assert_allclose(record['static'],fixture['static_context'],rtol=0,atol=2e-5)

    def test_alias_missing_values_and_duplicate_times_do_not_invent_glucose(self):
        frame = pd.DataFrame({'Date':['2021-01-01','2021-01-01','2021-01-01T00:15:00'], 'CGM ':[100,120,'']})
        record = engineer_record(frame,{},'sample')
        self.assertEqual(2,len(record['times']))
        self.assertEqual(120,record['glucose'][0])
        self.assertTrue(np.isnan(record['glucose'][1]))


if __name__ == '__main__':
    unittest.main()
