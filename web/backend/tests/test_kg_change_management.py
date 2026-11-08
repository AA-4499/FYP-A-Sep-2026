"""Validation tests for the controlled Knowledge Graph change service."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "web/backend"))

from services import kg_change_management_service as kg_changes


class KGProposalValidationTests(unittest.TestCase):
    def test_accepts_a_well_formed_relationship_proposal(self):
        payload = {
            "from": "Obesity", "relationship": "RISK_FACTOR_FOR", "to": "Type 2 Diabetes",
            "sourceRefs": ["[1]", "[17]"], "evidenceNote": "Proposed population-level risk association.",
        }
        result = kg_changes.validate_proposal(
            "relationship", "create", "Obesity|RISK_FACTOR_FOR|Type 2 Diabetes", payload, "Add a sourced risk relationship."
        )
        self.assertEqual(payload, result)

    def test_rejects_review_state_and_database_command_fields(self):
        for invalid in (
            {"from": "A", "relationship": "ASSOCIATED_WITH", "to": "B", "evidenceStatus": "reviewed"},
            {"cypher": "MATCH (n) DETACH DELETE n"},
            {"from": "A", "relationship": "associated with", "to": "B"},
        ):
            with self.subTest(invalid=invalid):
                with self.assertRaises(kg_changes.KGProposalValidationError):
                    kg_changes.validate_proposal("relationship", "update", "edge-key", invalid, "Reason.")

    def test_retirement_is_soft_and_cannot_carry_deletion_payload(self):
        self.assertEqual({}, kg_changes.validate_proposal("concept", "retire", "Obsolete Concept", {}, "No longer in scope."))
        with self.assertRaises(kg_changes.KGProposalValidationError):
            kg_changes.validate_proposal("concept", "retire", "Obsolete Concept", {"delete": True}, "Reason.")

    def test_source_reference_ids_and_publisher_urls_are_validated(self):
        valid = {"ref": "[17]", "authors": "A. Author", "title": "A study", "publication": "Journal", "year": 2024, "url": "https://doi.org/10.1234/example"}
        kg_changes.validate_proposal("source", "create", "[17]", valid, "Add reference.")
        with self.assertRaises(kg_changes.KGProposalValidationError):
            kg_changes.validate_proposal("concept", "update", "Obesity", {"sourceRefs": ["17"]}, "Reason.")
        with self.assertRaises(kg_changes.KGProposalValidationError):
            kg_changes.validate_proposal("source", "update", "[17]", {"url": "javascript:alert(1)"}, "Reason.")

    def test_only_known_permission_names_can_be_granted(self):
        self.assertEqual({"kg_reviewer", "kg_curator"}, kg_changes.PERMISSIONS)
        with self.assertRaises(kg_changes.KGProposalValidationError):
            kg_changes.set_permission("admin", "user", "admin", True, "Reason.")


if __name__ == "__main__":
    unittest.main()
