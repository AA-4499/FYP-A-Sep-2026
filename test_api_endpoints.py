"""Automated test suite for backend /api/* REST endpoints."""
from __future__ import annotations

import json
import unittest

import app as dashboard


class ApiEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = dashboard.app.test_client()

    def test_health_endpoint(self):
        response = self.client.get("/api/health")
        self.assertEqual(200, response.status_code)
        data = json.loads(response.data)
        self.assertEqual("healthy", data.get("status"))
        self.assertIn("model_available", data)
        self.assertIn("model_name", data)

    def test_config_endpoint(self):
        response = self.client.get("/api/config")
        self.assertEqual(200, response.status_code)
        data = json.loads(response.data)
        self.assertEqual(21, len(data.get("fields", [])))
        self.assertEqual(8, len(data.get("scenario_features", [])))
        self.assertIn("patient_count", data)
        self.assertIn("risk_labels", data)

    def test_patients_window_endpoint(self):
        response = self.client.get("/api/patients?number=1&size=5")
        self.assertEqual(200, response.status_code)
        data = json.loads(response.data)
        self.assertEqual(1, data.get("patient_number"))
        self.assertGreater(data.get("patient_count", 0), 1000)
        self.assertEqual(5, len(data.get("window", [])))
        self.assertEqual(21, len(data.get("values", {})))

    def test_patient_detail_endpoint(self):
        response = self.client.get("/api/patients/1")
        self.assertEqual(200, response.status_code)
        data = json.loads(response.data)
        self.assertEqual(1, data.get("patient_number"))
        self.assertIn("BMI", data.get("values", {}))

    def test_predict_endpoint(self):
        response = self.client.post("/api/predict", json={"patient_number": 1})
        self.assertEqual(200, response.status_code)
        data = json.loads(response.data)
        self.assertEqual(1, data.get("patient_number"))
        self.assertIn("current", data)
        self.assertIn("predicted_class", data["current"])
        self.assertEqual(3, len(data["current"]["probabilities"]))
        self.assertEqual(5, len(data.get("explanation", [])))
        self.assertIn("smpl", data)
        self.assertIn("beta0", data["smpl"])

    def test_simulate_endpoint(self):
        baseline_res = self.client.get("/api/patients/1")
        baseline = json.loads(baseline_res.data)["values"]
        scenario = dict(baseline)
        scenario["BMI"] = baseline["BMI"] + 5.0
        scenario["PhysActivity"] = 0.0 if baseline["PhysActivity"] == 1.0 else 1.0

        response = self.client.post(
            "/api/simulate",
            json={"patient_number": 1, "baseline": baseline, "scenario": scenario},
        )
        self.assertEqual(200, response.status_code)
        data = json.loads(response.data)
        self.assertIn("baseline", data)
        self.assertIn("scenario", data)
        self.assertIn("changes", data)
        self.assertGreaterEqual(len(data["changes"]), 1)
        self.assertIn("high_risk_change", data)

    def test_knowledge_graph_endpoint(self):
        response = self.client.post("/api/knowledge-graph", json={"patient_number": 1})
        self.assertEqual(200, response.status_code)
        data = json.loads(response.data)
        self.assertIn("nodes", data)
        self.assertIn("edges", data)
        self.assertIn("attributes", data)
        self.assertIn("legend", data)
        self.assertEqual(21, len(data.get("attributes", [])))

    def test_guidance_endpoint(self):
        response = self.client.post("/api/guidance", json={"patient_number": 1})
        self.assertEqual(200, response.status_code)
        data = json.loads(response.data)
        self.assertIn("guidance", data)
        self.assertIn("source", data)


if __name__ == "__main__":
    unittest.main()
