"""API authorization tests for controlled Knowledge Graph changes."""
from __future__ import annotations

import os
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "web/backend"))

import app as dashboard
import auth as auth_module
from services import kg_change_management_service as changes

SECRET = "kg-change-management-test-secret-at-least-32-characters"


class KGChangeManagementApiTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"SUPABASE_JWT_SECRET": SECRET})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.client = dashboard.app.test_client()

    def request_as(self, claims, method, path, **kwargs):
        with patch.object(auth_module, "_decode_token", return_value=claims):
            return getattr(self.client, method)(path, headers={"Authorization": "Bearer test-token"}, **kwargs)

    def claims(self, role, user_id="user-1"):
        return {"sub": user_id, "app_metadata": {"role": role}}

    def test_only_doctors_can_submit_and_read_proposals(self):
        with patch.object(dashboard, "submit_kg_change_proposal") as submit:
            denied = self.request_as(self.claims("patient"), "post", "/api/doctor/knowledge-graph/proposals", json={})
            self.assertEqual(403, denied.status_code)
            submit.assert_not_called()

            with patch.object(dashboard, "get_kg_user_permissions", return_value=[]), \
                 patch.object(dashboard, "list_kg_change_proposals", return_value=[]):
                allowed = self.request_as(self.claims("doctor"), "get", "/api/doctor/knowledge-graph/proposals")
            self.assertEqual(200, allowed.status_code)
            self.assertFalse(allowed.json["canReview"])

    def test_doctor_proposal_is_saved_as_unpublished(self):
        saved = {"id": "proposal-1", "status": "submitted"}
        with patch.object(dashboard, "submit_kg_change_proposal", return_value=saved) as submit:
            response = self.request_as(
                self.claims("doctor"), "post", "/api/doctor/knowledge-graph/proposals",
                json={
                    "targetType": "concept", "operation": "create", "targetKey": "New concept",
                    "proposedPayload": {"name": "New concept"}, "reason": "Add missing vocabulary.",
                },
            )
        self.assertEqual(201, response.status_code)
        self.assertFalse(response.json["published"])
        self.assertEqual("user-1", submit.call_args.args[0])

    def test_doctor_without_reviewer_permission_cannot_review(self):
        with patch.object(dashboard, "review_kg_change_proposal",
                          side_effect=PermissionError("A KG reviewer permission is required.")):
            response = self.request_as(
                self.claims("doctor"), "post",
                "/api/doctor/knowledge-graph/proposals/proposal-1/review",
                json={"decision": "approved", "note": "Reviewed."},
            )
        self.assertEqual(403, response.status_code)

    def test_only_platform_admin_can_manage_kg_permissions(self):
        with patch.object(dashboard, "list_kg_permissions") as list_permissions:
            denied = self.request_as(self.claims("doctor"), "get", "/api/admin/knowledge-graph/permissions")
            self.assertEqual(403, denied.status_code)
            list_permissions.assert_not_called()

        with patch.object(dashboard, "list_kg_permissions", return_value=[]) as list_permissions:
            allowed = self.request_as(self.claims("admin", "admin-1"), "get", "/api/admin/knowledge-graph/permissions")
            self.assertEqual(200, allowed.status_code)
            self.assertEqual([], allowed.json["permissions"])

    def test_admin_permission_grant_records_the_admin_identity(self):
        result = {"success": True, "affected": 1, "enabled": True}
        with patch.object(dashboard, "set_kg_permission", return_value=result) as set_permission:
            response = self.request_as(
                self.claims("admin", "admin-1"), "post", "/api/admin/knowledge-graph/permissions",
                json={"userId": "doctor-2", "permission": "kg_reviewer", "enabled": True, "reason": "Clinical reviewer appointment."},
            )
        self.assertEqual(200, response.status_code)
        self.assertEqual("admin-1", set_permission.call_args.args[0])
        self.assertEqual("doctor-2", set_permission.call_args.args[1])


if __name__ == "__main__":
    unittest.main()
