"""Tests for doctor patient assignment and graph-grounded KG analysis."""
from __future__ import annotations

import os
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import jwt

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "web/backend"))

import app as dashboard
import auth as auth_module
from services import knowledge_graph_analysis_service as analysis_service
from services import patient_assignment_service as assignment_service

SECRET = "knowledge-graph-test-secret-at-least-32-characters"


class AssignmentServiceTests(unittest.TestCase):
    def test_reads_assignments_using_callers_token_and_deduplicates(self):
        response = Mock()
        response.json.return_value = [{"patient_id": "P-02"}, {"patient_id": "P-01"}, {"patient_id": "P-01"}]
        response.raise_for_status.return_value = None
        with patch.object(assignment_service, "supabase_config", return_value=("https://example.supabase.co", "public-key")), \
             patch.object(assignment_service, "supabase_headers", return_value={"apikey": "public-key"}), \
             patch.object(assignment_service.requests, "get", return_value=response) as get:
            result = assignment_service.get_doctor_assigned_patient_ids("doctor-1", "caller-token")
        self.assertEqual(["P-01", "P-02"], result)
        self.assertEqual("Bearer caller-token", get.call_args.kwargs["headers"]["Authorization"])
        self.assertEqual("eq.doctor-1", get.call_args.kwargs["params"]["clinician_id"])

    def test_missing_supabase_config_fails_closed(self):
        from models.training.supabase_io import SupabaseStorageError
        with patch.object(assignment_service, "supabase_config", side_effect=SupabaseStorageError("config missing")):
            with self.assertRaises(assignment_service.PatientAssignmentUnavailableError):
                assignment_service.get_doctor_assigned_patient_ids("doctor-1", "caller-token")


class KnowledgeGraphAnalysisTests(unittest.TestCase):
    def test_candidate_relationships_are_excluded_from_analysis(self):
        patient_graph = {"elements": {"nodes": [
            {"data": {"id": "patient", "label": "Patient", "kind": "Patient"}},
            {"data": {"id": "disease", "label": "Type 2 Diabetes", "kind": "Condition"}},
        ], "edges": []}}
        clinical_graph = {
            "nodes": [
                {"id": "concept-t2dm", "name": "Type 2 Diabetes", "category": "Disease",
                 "description": "T2D", "sourceRefs": ["[17]"]},
                {"id": "concept-diabetes", "name": "Diabetes", "category": "Disease",
                 "description": "Parent", "sourceRefs": ["[17]"]},
            ],
            "edges": [{
                "source": "concept-t2dm", "target": "concept-diabetes",
                "sourceName": "Type 2 Diabetes", "targetName": "Diabetes", "predicate": "IS_A",
                "sourceRefs": ["[17]"], "evidenceNote": "Candidate edge",
                "evidenceStatus": "candidate_for_review",
            }],
        }
        with patch.object(analysis_service, "get_clinical_knowledge_graph", return_value=clinical_graph), \
             patch.dict(os.environ, {"KG_AI_PROVIDER": "rules"}, clear=False):
            result = analysis_service.analyze_patient_knowledge_graph(patient_graph)
        self.assertEqual("rules", result["provider"])
        self.assertEqual(1, result["contextStats"]["matchedConcepts"])
        self.assertEqual(0, result["contextStats"]["reviewedRelationships"])
        self.assertEqual(1, result["contextStats"]["candidateRelationshipsExcluded"])
        self.assertFalse(any("Candidate edge" in item for item in result["observations"]))


class DoctorKnowledgeGraphApiTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"SUPABASE_JWT_SECRET": SECRET})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.client = dashboard.app.test_client()

    def headers(self):
        token = jwt.encode(
            {"sub": "doctor-1", "exp": time.time() + 600, "aud": "authenticated",
             "role": "authenticated", "app_metadata": {"role": "doctor"}},
            SECRET, algorithm="HS256",
        )
        return {"Authorization": "Bearer " + token}

    def test_patient_graph_rejects_unassigned_patient_before_graph_access(self):
        with patch.object(auth_module, "_decode_token", return_value={
            "sub": "doctor-1", "app_metadata": {"role": "doctor"}
        }), patch.object(dashboard, "get_doctor_assigned_patient_ids", return_value=["P-01"]), \
             patch.object(dashboard, "get_patient_knowledge_graph") as graph:
            response = self.client.get("/api/doctor/patients/P-02/knowledge-graph", headers=self.headers())
        self.assertEqual(403, response.status_code)
        graph.assert_not_called()

    def test_assigned_patient_graph_is_returned(self):
        payload = {"patient_id": "P-01", "elements": {"nodes": [], "edges": []}, "stats": {}}
        with patch.object(auth_module, "_decode_token", return_value={
            "sub": "doctor-1", "app_metadata": {"role": "doctor"}
        }), patch.object(dashboard, "get_doctor_assigned_patient_ids", return_value=["P-01"]), \
             patch.object(dashboard, "get_patient_knowledge_graph", return_value=payload):
            response = self.client.get("/api/doctor/patients/P-01/knowledge-graph", headers=self.headers())
        self.assertEqual(200, response.status_code)
        self.assertEqual(payload, response.json)

    def test_assigned_patient_list_requires_doctor_role(self):
        with patch.object(auth_module, "_decode_token", return_value={"sub": "patient-1", "app_metadata": {"role": "patient"}}), \
             patch.object(dashboard, "get_doctor_assigned_patient_ids") as assignments:
            response = self.client.get("/api/doctor/assigned-patients", headers=self.headers())
        self.assertEqual(403, response.status_code)
        assignments.assert_not_called()


if __name__ == "__main__":
    unittest.main()
