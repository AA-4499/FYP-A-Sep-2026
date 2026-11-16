import unittest
import numpy as np
import pandas as pd

from models.training.cgmacros_auxiliary import native_grid, engineer


def source():
    rng = np.random.default_rng(3)
    knots = rng.integers(80, 180, 110)
    g = np.interp(np.arange(1636), np.arange(110)*15, knots)
    frame = pd.DataFrame({'Timestamp':pd.date_range('2020-01-01 00:07',periods=len(g),freq='min'),
                          'Libre GL':g, 'METs':30., 'Meal Type':None,
                          'Carbs':np.nan,'Protein':np.nan,'Fat':np.nan,'Fiber':np.nan})
    return frame


class CGMacrosPreprocessingTests(unittest.TestCase):
    def test_interpolated_minutes_are_excluded_and_sensor_phase_is_not_wall_clock_zero(self):
        f=source();_,grid,audit=native_grid(f)
        self.assertEqual(audit['phase_minute_mod15'],7)
        self.assertTrue((grid.Timestamp.dt.minute%15==7).all())
        self.assertLess(len(grid),len(f)/10)

    def test_shifted_phase_is_excluded_rather_than_guessed(self):
        f=source();f.loc[800:,'Timestamp']+=pd.Timedelta(minutes=2)
        with self.assertRaisesRegex(ValueError,'Multiple Libre phases'): native_grid(f)

    def test_meal_bins_and_fitbit_unit_conversion_preserve_real_zeros(self):
        f=source();index=53;at=f.Timestamp.iloc[index]
        f.loc[index,['Meal Type','Carbs','Protein','Fat','Fiber']]=['Lunch',0.,20.,15.,5.]
        x,future,t,_=engineer(f);i=t.searchsorted(at)
        np.testing.assert_array_equal(future[i,2:8],[0,20,15,5,1,1])
        self.assertEqual(future[i-1,6],0)
        self.assertEqual(future[i,8],3)
        self.assertEqual(future[i,9],1)

    def test_missing_activity_is_unknown_not_sedentary(self):
        f=source();f.loc[48,'METs']=np.nan
        _,future,t,_=engineer(f);i=t.searchsorted(f.Timestamp.iloc[48])
        self.assertEqual(future[i,9],0)
        self.assertEqual(future[i,8],0)

    def test_missing_macro_does_not_become_zero(self):
        f=source();f.loc[53,'Meal Type']='Lunch'
        with self.assertRaisesRegex(ValueError,'incomplete macronutrients'):engineer(f)


if __name__=='__main__':unittest.main()
