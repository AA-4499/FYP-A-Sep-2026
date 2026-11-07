"""Tests for the read-only clinical KG bibliography service and Doctor endpoint."""
from __future__ import annotations

import os
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import jwt

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "web/backend"))

import app as dashboard
import auth as auth_module
from services import clinical_knowledge_sources_service as source_service

SECRET = "clinical-sources-test-secret-at-least-32-characters"


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


class ClinicalKnowledgeSourcesServiceTests(unittest.TestCase):
    def test_reads_checked_in_bibliography_and_calculates_digest(self):
        result = source_service.get_clinical_knowledge_sources()
        self.assertEqual("repository-bibliography", result["source"])
        self.assertEqual(29, result["totalReferences"])
        self.assertEqual(29, len(result["references"]))
        self.assertRegex(result["sha256"], r"^[a-f0-9]{64}$")
        self.assertEqual("[1]", result["references"][0]["ref"])
        self.assertTrue(result["references"][0]["title"])
        self.assertTrue(result["references"][0]["url"].startswith("https://"))

    def test_duplicate_reference_ids_are_rejected(self):
        payload = {
            "version": "test",
            "references": [
                {"ref": "[1]", "authors": "Author", "title": "Title", "publication": "Journal"},
                {"ref": "[1]", "authors": "Author", "title": "Title 2", "publication": "Journal"},
            ],
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "references.json"
            path.write_text(__import__("json").dumps(payload), encoding="utf-8")
            with patch.object(source_service, "REFERENCES_PATH", path):
                with self.assertRaises(source_service.ClinicalKnowledgeSourcesUnavailableError):
                    source_service.get_clinical_knowledge_sources()

    def test_non_http_publisher_url_is_rejected(self):
        payload = {
            "version": "test",
            "references": [
                {"ref": "[1]", "authors": "Author", "title": "Title", "publication": "Journal",
                 "url": "javascript:alert(1)"},
            ],
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "references.json"
            path.write_text(__import__("json").dumps(payload), encoding="utf-8")
            with patch.object(source_service, "REFERENCES_PATH", path):
                with self.assertRaises(source_service.ClinicalKnowledgeSourcesUnavailableError):
                    source_service.get_clinical_knowledge_sources()


class ClinicalKnowledgeSourcesApiTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"SUPABASE_JWT_SECRET": SECRET})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.client = dashboard.app.test_client()

    def test_endpoint_requires_doctor_authentication(self):
        with patch.object(dashboard, "get_clinical_knowledge_sources") as service:
            response = self.client.get("/api/doctor/knowledge-graph/sources")
            self.assertEqual(401, response.status_code)
            service.assert_not_called()

        with patch.object(auth_module, "_decode_token", return_value={
            "sub": "patient-user", "app_metadata": {"role": "patient"}
        }), patch.object(dashboard, "get_clinical_knowledge_sources") as service:
            response = self.client.get("/api/doctor/knowledge-graph/sources", headers=auth_headers())
            self.assertEqual(403, response.status_code)
            service.assert_not_called()

    def test_doctor_receives_bibliography(self):
        payload = {
            "source": "repository-bibliography",
            "version": "1.0",
            "sha256": "a" * 64,
            "totalReferences": 1,
            "references": [{"ref": "[1]", "title": "Test reference"}],
        }
        with patch.object(auth_module, "_decode_token", return_value={
            "sub": "doctor-user", "app_metadata": {"role": "doctor"}
        }), patch.object(dashboard, "get_clinical_knowledge_sources", return_value=payload):
            response = self.client.get("/api/doctor/knowledge-graph/sources", headers=auth_headers())
        self.assertEqual(200, response.status_code)
        self.assertEqual(payload, response.json)

    def test_invalid_bibliography_returns_503(self):
        with patch.object(auth_module, "_decode_token", return_value={
            "sub": "doctor-user", "app_metadata": {"role": "doctor"}
        }), patch.object(dashboard, "get_clinical_knowledge_sources",
                         side_effect=source_service.ClinicalKnowledgeSourcesUnavailableError("Bibliography invalid")):
            response = self.client.get("/api/doctor/knowledge-graph/sources", headers=auth_headers())
        self.assertEqual(503, response.status_code)
        self.assertEqual("repository-bibliography", response.json["source"])


if __name__ == "__main__":
    unittest.main()
