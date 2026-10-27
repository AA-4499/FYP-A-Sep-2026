"""Tests for the read-only Neo4j Aura clinical concept graph endpoint."""
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
from services import clinical_knowledge_graph_service as clinical_kg

SECRET = "clinical-kg-test-secret-at-least-32-characters"


class FakeResult:
    def __init__(self, rows):
        self.rows = rows

    def __iter__(self):
        return iter(self.rows)


class FakeTransaction:
    def __init__(self):
        self.queries = []

    def run(self, query):
        self.queries.append(query)
        if "MATCH (n:MedicalConcept)" in query:
            return FakeResult([
                {"name": "Type 2 Diabetes", "category": "Disease",
                 "description": "Type 2 diabetes mellitus.", "sourceRefs": ["[17]", "[23]"],
                 "scope": "Type 2 Diabetes", "schemaVersion": "t2dm-medical-kg-v1"},
                {"name": "Diabetes", "category": "Disease",
                 "description": "Parent disease concept.", "sourceRefs": ["[17]"],
                 "scope": "Type 2 Diabetes", "schemaVersion": "t2dm-medical-kg-v1"},
            ])
        return FakeResult([
            {"sourceName": "Type 2 Diabetes", "predicate": "IS_A", "targetName": "Diabetes",
             "sourceRefs": ["[17]", "[23]"], "evidenceNote": "Subtype hierarchy.",
             "evidenceStatus": "candidate_for_review", "evidenceType": "literature",
             "scope": "Type 2 Diabetes", "schemaVersion": "t2dm-medical-kg-v1"}
        ])


class FakeSession:
    def __init__(self, transaction):
        self.transaction = transaction

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute_read(self, callback):
        return callback(self.transaction)


class FakeDriver:
    def __init__(self, transaction):
        self.transaction = transaction
        self.database = None

    def verify_connectivity(self):
        return None

    def session(self, database=None):
        self.database = database
        return FakeSession(self.transaction)

    def close(self):
        return None


def auth_headers():
    token = jwt.encode(
        {
            "sub": "doctor-test",
            "exp": time.time() + 600,
            "aud": "authenticated",
            "role": "authenticated",
            "app_metadata": {"role": "doctor"},
        },
        SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


class ClinicalKnowledgeGraphServiceTests(unittest.TestCase):
    def setUp(self):
        clinical_kg._DRIVER = None
        self.env = patch.dict(os.environ, {
            "CLINICAL_KG_NEO4J_URI": "neo4j+s://example.databases.neo4j.io",
            "CLINICAL_KG_NEO4J_USER": "neo4j",
            "CLINICAL_KG_NEO4J_PASSWORD": "test-password",
            "CLINICAL_KG_NEO4J_DATABASE": "neo4j",
        })
        self.env.start()
        self.addCleanup(self.env.stop)
        self.transaction = FakeTransaction()
        self.driver = FakeDriver(self.transaction)
        self.driver_patch = patch.object(clinical_kg.GraphDatabase, "driver", return_value=self.driver)
        self.driver_patch.start()
        self.addCleanup(self.driver_patch.stop)
        self.addCleanup(lambda: setattr(clinical_kg, "_DRIVER", None))

    def test_returns_concepts_and_candidate_edges_without_writes(self):
        graph = clinical_kg.get_clinical_knowledge_graph()
        self.assertEqual("neo4j-aura", graph["source"])
        self.assertTrue(graph["readOnly"])
        self.assertEqual(2, graph["stats"]["totalNodes"])
        self.assertEqual(1, graph["stats"]["totalEdges"])
        self.assertEqual(1, graph["stats"]["candidateEdges"])
        self.assertEqual("candidate_for_review", graph["edges"][0]["evidenceStatus"])
        self.assertEqual(["[17]", "[23]"], graph["edges"][0]["sourceRefs"])
        self.assertTrue(all("MERGE" not in query and "DELETE" not in query and "CREATE" not in query
                            for query in self.transaction.queries))
        self.assertEqual("neo4j", self.driver.database)

    def test_missing_password_fails_closed(self):
        clinical_kg._DRIVER = None
        with patch.dict(os.environ, {
            "CLINICAL_KG_NEO4J_URI": "neo4j+s://example.databases.neo4j.io",
            "CLINICAL_KG_NEO4J_USER": "neo4j",
        }, clear=False):
            os.environ.pop("CLINICAL_KG_NEO4J_PASSWORD", None)
            with self.assertRaises(clinical_kg.ClinicalKnowledgeGraphUnavailableError):
                clinical_kg.get_clinical_knowledge_graph()


class ClinicalKnowledgeGraphApiTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"SUPABASE_JWT_SECRET": SECRET})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.client = dashboard.app.test_client()

    def test_endpoint_requires_doctor_authentication(self):
        with patch.object(dashboard, "get_clinical_knowledge_graph") as service:
            self.assertEqual(401, self.client.get("/api/doctor/knowledge-graph").status_code)
            service.assert_not_called()

        with patch.object(auth_module, "_decode_token", return_value={
            "sub": "patient-user", "app_metadata": {"role": "patient"}
        }), patch.object(dashboard, "get_clinical_knowledge_graph") as service:
            response = self.client.get("/api/doctor/knowledge-graph", headers=auth_headers())
            self.assertEqual(403, response.status_code)
            service.assert_not_called()

    def test_doctor_receives_graph_payload(self):
        payload = {"source": "neo4j-aura", "readOnly": True, "stats": {}, "nodes": [], "edges": []}
        with patch.object(auth_module, "_decode_token", return_value={
            "sub": "doctor-user", "app_metadata": {"role": "doctor"}
        }), patch.object(dashboard, "get_clinical_knowledge_graph", return_value=payload):
            response = self.client.get("/api/doctor/knowledge-graph", headers=auth_headers())
        self.assertEqual(200, response.status_code)
        self.assertEqual(payload, response.json)

    def test_unavailable_aura_returns_503(self):
        with patch.object(auth_module, "_decode_token", return_value={
            "sub": "doctor-user", "app_metadata": {"role": "doctor"}
        }), patch.object(dashboard, "get_clinical_knowledge_graph",
                         side_effect=clinical_kg.ClinicalKnowledgeGraphUnavailableError("Aura unavailable")):
            response = self.client.get("/api/doctor/knowledge-graph", headers=auth_headers())
        self.assertEqual(503, response.status_code)
        self.assertIn("error", response.json)


if __name__ == "__main__":
    unittest.main()
