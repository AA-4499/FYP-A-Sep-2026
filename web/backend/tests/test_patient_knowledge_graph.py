"""Patient-condition KG normalization, database isolation and API access checks."""
import os
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import jwt

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'web/backend'))
import app as dashboard
from services import knowledge_graph_service as kg

SECRET = 'patient-kg-test-secret-at-least-32-characters'


def headers(patient_id=None):
    metadata = {'role': 'patient', 'patient_id': patient_id} if patient_id else {'role': 'doctor'}
    token = jwt.encode({'sub': 'kg-test-user', 'exp': time.time() + 600, 'aud': 'authenticated',
                        'role': 'authenticated', 'app_metadata': metadata}, SECRET, algorithm='HS256')
    return {'Authorization': f'Bearer {token}'}


class PatientConditionServiceTests(unittest.TestCase):
    def test_normalizes_conditions_and_excludes_unrecorded_biomarkers(self):
        conditions = kg.extract_patient_conditions({'Type of Diabetes': 'T2DM',
            'Comorbidities': 'hypertension; Hypertension', 'Diabetic Microvascular Complications': 'nephropathy',
            'Hypoglycemia (yes/no)': 'yes', 'age': 57, 'hba1c': 8.1, 'medications': ['Drug A']})
        self.assertEqual({'Type 2 Diabetes', 'Hypertension', 'Diabetic Nephropathy', 'Hypoglycemia'},
                         {condition['name'] for condition in conditions})
        self.assertEqual(4, len(conditions))

    def test_empty_and_negative_fields_do_not_invent_conditions(self):
        self.assertEqual([], kg.extract_patient_conditions({'Comorbidities': '/',
            'Type of Diabetes': None, 'Hypoglycemia (yes/no)': 'no', 'hypertension': False}))

    def test_missing_patient_and_mismatched_fallback_never_touch_database(self):
        with patch.object(kg, 'get_patient', return_value=None), patch.object(kg, '_driver') as driver:
            with self.assertRaises(kg.PatientNotFoundError):
                kg.get_patient_knowledge_graph('record-a')
            with self.assertRaises(kg.PatientNotFoundError):
                kg.get_patient_knowledge_graph('record-a', {'id': 'record-b', 'condition': 'T2DM'})
            driver.assert_not_called()

    def test_authoritative_patient_takes_priority_over_browser_fallback(self):
        driver = Mock()
        session = driver.session.return_value.__enter__ = Mock(return_value=Mock())
        driver.session.return_value.__exit__ = Mock(return_value=False)
        session.return_value.execute_write.side_effect = lambda callback, record, conditions: {'patientId': record, 'conditions': conditions}
        with patch.object(kg, 'get_patient', return_value={'condition': 'T2DM'}), patch.object(kg, '_driver', return_value=driver):
            graph = kg.get_patient_knowledge_graph('record-a', {'id': 'record-a', 'condition': 'T1DM'})
        self.assertEqual('Type 2 Diabetes', graph['elements']['nodes'][1]['data']['label'])
        self.assertEqual(1, graph['stats']['condition_count'])

    def test_database_updates_are_parameterized_and_scoped_to_one_patient(self):
        tx = Mock()
        tx.run.return_value.single.return_value = {'patientId': "record'a", 'conditions': []}
        kg._write_and_read(tx, "record'a", [{'id': 'comorbidity::hypertension', 'name': 'Hypertension',
                                           'category': 'comorbidity', 'edgeLabel': 'has comorbidity'}])
        for call in tx.run.call_args_list:
            self.assertNotIn("record'a", call.args[0])
            self.assertEqual("record'a", call.kwargs['patientId'])
        deletion = tx.run.call_args_list[1].args[0]
        self.assertIn('Patient {patientId: $patientId}', deletion)
        self.assertIn('HAS_CONDITION', deletion)


class PatientConditionApiTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'SUPABASE_JWT_SECRET': SECRET})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.client = dashboard.app.test_client()
        self.url = '/api/patients/record-a/knowledge-graph'

    def test_requires_authentication_and_patient_access(self):
        with patch.object(dashboard, 'get_patient_knowledge_graph') as service:
            self.assertEqual(401, self.client.get(self.url).status_code)
            self.assertEqual(403, self.client.get(self.url, headers=headers('record-b')).status_code)
            service.assert_not_called()

    def test_invalid_patient_payload_returns_400(self):
        for body in ([], {'patient': []}, {'patient': 'invalid'}):
            with patch.object(dashboard, 'get_patient_knowledge_graph') as service:
                self.assertEqual(400, self.client.post(self.url, json=body, headers=headers()).status_code)
                service.assert_not_called()

    def test_missing_record_and_unavailable_neo4j_are_explicit_errors(self):
        for error, status in ((kg.PatientNotFoundError('Unknown record'), 404),
                              (kg.KnowledgeGraphUnavailableError('Patient Neo4j unavailable'), 503)):
            with patch.object(dashboard, 'get_patient_knowledge_graph', side_effect=error):
                response = self.client.get(self.url, headers=headers())
                self.assertEqual(status, response.status_code)
                self.assertIn('error', response.json)

    def test_patient_can_request_own_graph(self):
        graph = {'patient_id': 'record-a', 'elements': {'nodes': [], 'edges': []}}
        with patch.object(dashboard, 'get_patient_knowledge_graph', return_value=graph) as service:
            response = self.client.post(self.url, json={'patient': {'id': 'record-a'}}, headers=headers('record-a'))
            self.assertEqual(200, response.status_code)
            self.assertEqual(graph, response.json)
            service.assert_called_once_with('record-a', patient_payload={'id': 'record-a'})


if __name__ == '__main__':
    unittest.main()
