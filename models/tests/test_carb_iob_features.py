import unittest
import numpy as np
import pandas as pd
from models.training.train_shanghai_carb_iob import (
    remaining_fraction,bolus_curve,modeled_iob,parse_items,convert_meal)

class CarbIobFeatures(unittest.TestCase):
    def test_action_boundaries_and_monotonicity(self):
        y=remaining_fraction(np.arange(0,500),480,180)
        self.assertEqual(y[0],1);self.assertEqual(y[480],0)
        self.assertTrue(np.all(np.diff(y)<=0));self.assertTrue(np.all((y>=0)&(y<=1)))

    def test_future_dose_and_datetime_resolution(self):
        times=pd.date_range('2021-01-01',periods=40,freq='15min')
        doses=[(times[4].value,4.,(480.,180.,'regular'))]
        ns,_=modeled_iob(times.as_unit('ns'),doses)
        us,_=modeled_iob(times.as_unit('us'),doses)
        np.testing.assert_array_equal(ns,us)
        self.assertEqual(ns[3],0);self.assertEqual(ns[4],4);self.assertEqual(ns[36],0)

    def test_superposition(self):
        t=pd.Timestamp('2021-01-01');curve=(360.,75.,'rapid')
        value,_=modeled_iob([t],[(t.value,2.,curve),(t.value,3.,curve)])
        self.assertEqual(value[0],5)

    def test_mixed_and_basal_not_rapid(self):
        for text in ['insulin aspart 70/30, 14 IU','insulin degludec 8 IU','unknown insulin']:
            self.assertIsNone(bolus_curve(text))
        self.assertEqual(bolus_curve('Novolin R, 5 IU')[0],480)
        self.assertEqual(bolus_curve('insulin aspart, 5 IU')[0],360)

    def test_complete_meal_and_chinese_units(self):
        total,_,missing=convert_meal(parse_items('米饭 150 克'),{'米饭':(28.,None)})
        self.assertAlmostEqual(total,42);self.assertFalse(missing)

    def test_partial_and_volume_never_complete(self):
        for text in ['rice 100 g; unknown dish 50 g','rice 100 ml','a bowl of rice']:
            total,_,missing=convert_meal(parse_items(text),{'rice':(28.,None)})
            self.assertTrue(np.isnan(total));self.assertTrue(missing)

if __name__=='__main__':unittest.main()
