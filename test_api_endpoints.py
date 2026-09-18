"""Automated test suite for ShanghaiT2DM Smart Diabetes Digital Twin REST endpoints."""
from __future__ import annotations

import json
import unittest

import app as dashboard


class ShanghaiT2DMApiTests(unittest.TestCase):
    def setUp(self):
        self.client = dashboard.app.test_client()

    def test_health_endpoint(self):
        response = self.client.get("/api/health")
        self.assertEqual(200, response.status_code)
        data = json.loads(response.data)
        self.assertEqual("healthy", data.get("status"))
        self.assertEqual("ShanghaiT2DM Longitudinal Cohort", data.get("dataset"))

    def test_meta_endpoint(self):
        response = self.client.get("/api/meta")
        self.assertEqual(200, response.status_code)
        data = json.loads(response.data)
        self.assertEqual("1001", data.get("default_patient_id"))
        self.assertEqual(9, len(data.get("workflow_steps", [])))

    def test_patients_list_endpoint(self):
        # Default pagination
        response = self.client.get("/api/patients")
        self.assertEqual(200, response.status_code)
        data = json.loads(response.data)
        self.assertGreaterEqual(data.get("total", 0), 100)
        self.assertEqual(12, len(data.get("patients", [])))

        # Search query
        response_search = self.client.get("/api/patients?query=1002")
        self.assertEqual(200, response_search.status_code)
        data_search = json.loads(response_search.data)
        self.assertEqual(1, data_search.get("total"))
        self.assertEqual("1002", data_search["patients"][0]["id"])

    def test_patient_detail_endpoint(self):
        response = self.client.get("/api/patients/1001")
        self.assertEqual(200, response.status_code)
        data = json.loads(response.data)
        self.assertEqual("1001", data.get("id"))
        self.assertIn("hba1c", data)
        self.assertIn("fasting_glucose", data)
        self.assertIn("diabetes_duration_years", data)

        # Non-existent patient
        not_found = self.client.get("/api/patients/999999")
        self.assertEqual(404, not_found.status_code)

    def test_longitudinal_timeline_endpoint(self):
        response = self.client.get("/api/patients/1001/timeline")
        self.assertEqual(200, response.status_code)
        data = json.loads(response.data)
        self.assertEqual("1001", data.get("patient_id"))
        self.assertIn("summary", data)
        self.assertEqual(14, len(data.get("daily_trends", [])))
        self.assertEqual(24, len(data.get("hourly_cgm_profile", [])))
        self.assertEqual(4, len(data.get("historical_visits", [])))

    def test_risk_assessment_endpoint(self):
        # GET request
        response = self.client.get("/api/patients/1001/risk-assessment")
        self.assertEqual(200, response.status_code)
        data = json.loads(response.data)
        self.assertIn("composite_risk_score", data)
        self.assertIn("sub_risks", data)
        self.assertIn("glycemic_variability", data["sub_risks"])

        # POST with custom override
        post_response = self.client.post("/api/patients/1001/risk-assessment", json={"hba1c": 6.2, "time_in_range_pct": 85.0})
        self.assertEqual(200, post_response.status_code)
        post_data = json.loads(post_response.data)
        self.assertLess(post_data["composite_risk_score"], data["composite_risk_score"])

    def test_xai_explanation_endpoint(self):
        response = self.client.get("/api/patients/1001/xai-explanation")
        self.assertEqual(200, response.status_code)
        data = json.loads(response.data)
        self.assertEqual("1001", data.get("patient_id"))
        self.assertIn("contributions", data)
        self.assertGreaterEqual(len(data["contributions"]), 5)
        self.assertIn("explanation_summary", data)

    def test_knowledge_graph_endpoint(self):
        response = self.client.get("/api/patients/1001/knowledge-graph")
        self.assertEqual(200, response.status_code)
        data = json.loads(response.data)
        self.assertIn("elements", data)
        self.assertIn("nodes", data["elements"])
        self.assertIn("edges", data["elements"])
        self.assertGreater(len(data["elements"]["nodes"]), 5)

    def test_insights_endpoint(self):
        response = self.client.get("/api/patients/1001/insights")
        self.assertEqual(200, response.status_code)
        data = json.loads(response.data)
        self.assertIn("alert_level", data)
        self.assertIn("recommendations", data)
        self.assertGreaterEqual(len(data["recommendations"]), 1)

    def test_digital_twin_endpoint(self):
        response = self.client.get("/api/patients/1001/digital-twin")
        self.assertEqual(200, response.status_code)
        data = json.loads(response.data)
        self.assertIn("twin_status", data)
        self.assertIn("organs", data)
        self.assertIn("pancreas", data["organs"])
        self.assertIn("cardiovascular", data["organs"])
        self.assertIn("morphometry", data)

    def test_simulate_endpoint(self):
        payload = {
            "diet_intervention": "low_carb",
            "exercise_intervention": "regular_aerobic",
            "hba1c_change": -0.5,
            "tir_change": 12.0
        }
        response = self.client.post("/api/patients/1001/simulate", json=payload)
        self.assertEqual(200, response.status_code)
        data = json.loads(response.data)
        self.assertIn("baseline_comparison", data)
        self.assertIn("risk_outcome", data)
        self.assertLess(data["risk_outcome"]["risk_delta_pct"], 0)

    def test_patient_report_endpoint(self):
        response = self.client.get("/api/patients/1001/report")
        self.assertEqual(200, response.status_code)
        data = json.loads(response.data)
        self.assertIn("report_id", data)
        self.assertEqual("Swinburne University of Technology Sarawak - Smart Health Platform", data.get("institution"))
        self.assertIn("patient_profile", data)
        self.assertIn("clinical_insights", data)


if __name__ == "__main__":
    unittest.main()
