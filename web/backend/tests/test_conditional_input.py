"""Exact workbook identity and existing patient/care-team access boundaries."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import pandas as pd
from test_forecast_api import ForecastApiTests, token
from services import conditional_input_service as service


class ConditionalInputTests(unittest.TestCase):
    setUp = ForecastApiTests.setUp
    # Only exercise the new endpoint here; the parent regression suite runs separately.
    def test_conditional_input_permissions(self):
        url='/api/patients/2017_1_20201118/conditional-input'
        with patch.object(service,'local_conditional_input',return_value={'patient_id':'2017_1_20201118','rows':[]}) as load:
            self.assertEqual(401,self.client.get(url).status_code)
            self.assertEqual(403,self.client.get(url,headers=token('patient','other')).status_code)
            with patch('app.patient_is_assigned',return_value=False):
                self.assertEqual(403,self.client.get(url,headers=token()).status_code)
            load.assert_not_called()
            self.assertEqual(200,self.client.get(url,headers=token('patient','2017_1_20201118')).status_code)

    def test_exact_workbook_and_summary_are_required(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary);data=root/'records';data.mkdir()
            pd.DataFrame({'Date':['2021-01-01'],'CGM (mg / dl)':[120]}).to_excel(data/'record-a.xlsx',index=False)
            pd.DataFrame({'Patient Number':['record-a'],'Age (years)':[55]}).to_excel(root/'summary.xlsx',index=False)
            with patch.dict('os.environ',{'T2DM_DATA_DIR':str(data),'T2DM_SUMMARY_PATH':str(root/'summary.xlsx')}):
                result=service.local_conditional_input('record-a')
                self.assertEqual('record-a',result['rows'][0]['Patient Number'])
                self.assertEqual(55,result['summary']['Age (years)'])
                with self.assertRaises(LookupError):service.local_conditional_input('../summary')
                with self.assertRaises(LookupError):service.local_conditional_input('other')
