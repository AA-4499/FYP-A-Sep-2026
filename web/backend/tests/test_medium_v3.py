import copy
import json
import unittest
from unittest.mock import patch

import numpy as np
import pandas as pd

from test_forecast_api import ForecastApiTests, token, ROOT
from services import medium_v3_service as service
from models.training.local_v3_inputs import engineer_record

EMPTY = {'events':[]}


def synthetic_data():
    rows = [{'Patient Number':'2017_1_20201118','Date':t.isoformat(),'CGM (mg / dl)':120+8*np.sin(i/8), 'Dietary intake':'Rice 100 g' if i==52 else '', 'Insulin dose - s.c.':'Novolin R, 2 IU' if i==48 else ''} for i,t in enumerate(pd.date_range('2021-01-01',periods=64,freq='15min'))]
    return {'rows':rows,'summary':{'Age (years)':55,'BMI (kg/m2)':25,'Type of Diabetes':'T2DM'}}


class MediumV3Tests(unittest.TestCase):
    setUp = ForecastApiTests.setUp

    def test_new_route_requires_auth_and_admin_assignment_before_data_loading(self):
        url = '/api/patients/2017_1_20201118/conditional-forecast'
        with patch.object(service,'forecast_patient') as forecast:
            self.assertEqual(401,self.client.post(url,json={}).status_code)
            self.assertEqual(403,self.client.post(url,json={},headers=token('patient','other')).status_code)
            with patch('app.patient_is_assigned',return_value=False):
                self.assertEqual(403,self.client.post(url,json={},headers=token()).status_code)
            forecast.assert_not_called()

    def test_invalid_and_patient_bolus_plans_fail_before_reading_data(self):
        for plan in [{'events':None},{'events':[{'kind':'bolus','minutesAhead':30,'amount':2,'formulation':'basal'}]}, {'events':[{'kind':'meal','minutesAhead':30,'amount':float('nan')}]}, {'events':[{'kind':'meal','minutesAhead':30,'amount':100},{'kind':'meal','minutesAhead':30,'amount':60}]}]:
            with self.assertRaises(ValueError):
                service.validate_request({'baseline':EMPTY,'scenario':plan},'doctor')
        with self.assertRaises(PermissionError):
            service.validate_request({'baseline':EMPTY,'scenario':{'events':[{'kind':'bolus','minutesAhead':30,'amount':2,'formulation':'rapid'}]}},'patient')

    def test_real_medium_inference_and_later_events_cannot_change_earlier_outputs(self):
        data = synthetic_data(); payload = {'source':'local','baseline':EMPTY,'scenario':{'events':[{'kind':'meal','minutesAhead':90,'amount':30},{'kind':'bolus','minutesAhead':100,'amount':2,'formulation':'regular'}]}}
        with patch('services.conditional_input_service.local_conditional_input',return_value=data):
            result = service.forecast_patient('2017_1_20201118',payload,'doctor','test')
        forecast = result['forecast']
        self.assertEqual('server',forecast['delivery'])
        self.assertIn('local-v3-medium',forecast['model_version'])
        self.assertEqual([15,30,60,240],forecast['horizons_minutes'])
        np.testing.assert_allclose([p['value'] for p in forecast['baseline'][:4]],[p['value'] for p in forecast['scenario'][:4]],rtol=0,atol=1e-5)
        self.assertNotEqual(forecast['baseline_end'],forecast['scenario_end'])
        self.assertEqual(5,len(result['comparison']['explanations']))

    def test_missing_cgm_and_wrong_cohort_are_rejected(self):
        for bad in ['missing','cohort']:
            data = synthetic_data()
            if bad == 'missing': data['rows'][-1]['CGM (mg / dl)'] = ''
            else: data['summary']['Type of Diabetes'] = 'T1DM'
            with patch('services.conditional_input_service.local_conditional_input',return_value=data), self.assertRaises(ValueError):
                service.forecast_patient('2017_1_20201118',{'source':'local','baseline':EMPTY,'scenario':EMPTY},'doctor','test')

    def test_service_preprocessing_matches_saved_checkpoint_example(self):
        registry = json.loads(service.REGISTRY.read_text(encoding='utf-8'))
        path = ROOT/registry['checkpoint']; saved_example = json.loads((path.parent/'test_input_example.json').read_text())
        from models.training.predict_chronological import forecast
        output = forecast(path,saved_example)
        np.testing.assert_allclose(list(output['predictions_mg_dl'].values()),saved_example['expected_predictions_mg_dl'],rtol=0,atol=1e-4)


if __name__ == '__main__':
    unittest.main()
