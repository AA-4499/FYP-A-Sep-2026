"""Controlled Doctor proposals and review for the shared clinical knowledge graph.

This service stores proposals and decisions in Supabase. It never writes to Neo4j Aura.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List
from urllib.parse import urlsplit

import requests

from models.training.supabase_io import supabase_config, supabase_headers


class KGChangeManagementUnavailableError(RuntimeError):
    """The proposal/review store is unavailable or not installed."""


class KGProposalValidationError(ValueError):
    """A proposed change is invalid or outside the editable fields."""


REFERENCE_ID = re.compile(r"^\[\d+\]$")
PREDICATE = re.compile(r"^[A-Z][A-Z0-9_]{1,63}$")
TARGET_TYPES = {"concept", "relationship", "source"}
OPERATIONS = {"create", "update", "retire"}
PERMISSIONS = {"kg_reviewer", "kg_curator"}
DECISIONS = {"under_review", "approved", "rejected", "changes_requested"}

PAYLOAD_FIELDS = {
    "concept": {"name", "category", "description", "sourceRefs", "scope", "schemaVersion"},
    "relationship": {"from", "relationship", "to", "sourceRefs", "evidenceNote", "evidenceType", "scope", "schemaVersion"},
    "source": {
        "ref", "authors", "title", "publication", "year", "details", "doi",
        "url", "kind", "v1_usage", "note", "projectCitationAsSupplied",
        "firstPublishedOnlineYear",
    },
}


def _request(method: str, path: str, *, params=None, payload=None, prefer=None):
    try:
        base_url, key = supabase_config()
        headers = supabase_headers(key)
        headers.update({"Accept": "application/json", "Content-Type": "application/json"})
        if prefer:
            headers["Prefer"] = prefer
        response = requests.request(
            method,
            f"{base_url}/rest/v1/{path.lstrip('/')}",
            headers=headers,
            params=params,
            json=payload,
            timeout=20,
        )
    except (requests.RequestException, RuntimeError) as exc:
        raise KGChangeManagementUnavailableError(
            "The knowledge-graph proposal store is unavailable. Check the server-side Supabase connection."
        ) from exc
    if response.status_code >= 400:
        try:
            code = response.json().get("code", "")
        except (ValueError, AttributeError):
            code = ""
        if code in {"PGRST202", "PGRST205", "42P01", "42883"}:
            raise KGChangeManagementUnavailableError(
                "Knowledge-graph change management is not installed. Apply docs/supabase_kg_change_management.sql first."
            ) from None
        raise KGChangeManagementUnavailableError(
            f"The knowledge-graph change request failed (HTTP {response.status_code})."
        ) from None
    if not response.content:
        return None
    try:
        return response.json()
    except ValueError:
        raise KGChangeManagementUnavailableError(
            "The knowledge-graph change service returned an invalid response."
        ) from None


def _rpc(function: str, arguments: Dict[str, Any]):
    return _request("POST", f"rpc/{function}", payload=arguments)


def _validate_text(value: Any, field: str, *, required=False, maximum=2000):
    if value is None:
        if required:
            raise KGProposalValidationError(f"{field} is required.")
        return
    if not isinstance(value, str):
        raise KGProposalValidationError(f"{field} must be text.")
    if required and not value.strip():
        raise KGProposalValidationError(f"{field} is required.")
    if len(value) > maximum:
        raise KGProposalValidationError(f"{field} is too long (maximum {maximum} characters).")


def validate_proposal(target_type: str, operation: str, target_key: str,
                      proposed_payload: Any, reason: str) -> Dict[str, Any]:
    """Validate constrained proposal fields; arbitrary Cypher is never accepted."""
    if target_type not in TARGET_TYPES:
        raise KGProposalValidationError("Choose concept, relationship or source.")
    if operation not in OPERATIONS:
        raise KGProposalValidationError("Choose create, update or retire.")
    _validate_text(target_key, "Target key", required=True, maximum=240)
    _validate_text(reason, "Change reason", required=True, maximum=2000)
    if not isinstance(proposed_payload, dict):
        raise KGProposalValidationError("Proposed fields must be a JSON object.")
    if operation == "retire":
        if proposed_payload:
            raise KGProposalValidationError("Retirement proposals cannot contain replacement fields.")
        return {}

    allowed = PAYLOAD_FIELDS[target_type]
    unexpected = set(proposed_payload) - allowed
    if unexpected:
        raise KGProposalValidationError(
            "Unsupported fields: " + ", ".join(sorted(unexpected)) +
            ". Review status and publication state cannot be edited in a proposal."
        )
    if not proposed_payload:
        raise KGProposalValidationError("Provide at least one proposed field.")

    required_by_type = {
        "concept": ("name",) if operation == "create" else (),
        "relationship": ("from", "relationship", "to") if operation == "create" else (),
        "source": ("ref", "authors", "title", "publication") if operation == "create" else (),
    }
    for field in required_by_type[target_type]:
        if field not in proposed_payload:
            raise KGProposalValidationError(f"{field} is required for a new {target_type}.")

    for field, value in proposed_payload.items():
        if field == "sourceRefs":
            if not isinstance(value, list) or len(value) > 30:
                raise KGProposalValidationError("sourceRefs must be a list of up to 30 bibliography IDs.")
            if any(not isinstance(item, str) or not REFERENCE_ID.fullmatch(item) for item in value):
                raise KGProposalValidationError("Each sourceRefs entry must match a bibliography ID such as [17].")
        elif field in {"year", "firstPublishedOnlineYear"}:
            if value is not None and (isinstance(value, bool) or not isinstance(value, int) or value < 1800 or value > 2100):
                raise KGProposalValidationError(f"{field} must be a year between 1800 and 2100.")
        elif field == "url":
            if value is not None:
                if not isinstance(value, str):
                    raise KGProposalValidationError("Publisher URL must be text.")
                parsed = urlsplit(value.strip())
                if parsed.scheme not in {"https", "http"} or not parsed.netloc:
                    raise KGProposalValidationError("Publisher URL must use http or https.")
        elif field == "relationship":
            if not isinstance(value, str) or not PREDICATE.fullmatch(value):
                raise KGProposalValidationError("Relationship predicates must use uppercase snake case.")
        elif field == "ref":
            if not isinstance(value, str) or not REFERENCE_ID.fullmatch(value):
                raise KGProposalValidationError("Source ref must match a bibliography ID such as [17].")
        elif field == "name":
            _validate_text(value, field, required=True, maximum=180)
        else:
            _validate_text(value, field, maximum=4000)
    return proposed_payload


def get_user_permissions(user_id: str) -> List[str]:
    rows = _request("GET", "kg_user_permissions", params={
        "select": "permission", "user_id": f"eq.{user_id}", "order": "permission.asc",
    })
    if not isinstance(rows, list):
        raise KGChangeManagementUnavailableError("The permission service returned an invalid response.")
    return [str(row["permission"]) for row in rows if isinstance(row, dict) and row.get("permission") in PERMISSIONS]


def list_proposals(user_id: str, *, can_review: bool = False) -> List[Dict[str, Any]]:
    params = {
        "select": "id,submitted_by,target_type,operation,target_key,proposed_payload,change_reason,status,reviewed_by,review_note,created_at,updated_at,decided_at",
        "order": "created_at.desc", "limit": "200",
    }
    if not can_review:
        params["submitted_by"] = f"eq.{user_id}"
    rows = _request("GET", "kg_change_proposals", params=params)
    if not isinstance(rows, list):
        raise KGChangeManagementUnavailableError("The proposal service returned an invalid response.")
    return rows


def submit_proposal(user_id: str, target_type: str, operation: str, target_key: str,
                    proposed_payload: Any, reason: str) -> Dict[str, Any]:
    clean_payload = validate_proposal(target_type, operation, target_key, proposed_payload, reason)
    result = _rpc("kg_submit_change_proposal", {
        "p_submitted_by": user_id, "p_target_type": target_type, "p_operation": operation,
        "p_target_key": target_key.strip(), "p_proposed_payload": clean_payload,
        "p_change_reason": reason.strip(),
    })
    if not isinstance(result, dict) or not result.get("id"):
        raise KGChangeManagementUnavailableError("The proposal was not saved. No successful save was confirmed.")
    return result


def review_proposal(reviewer_id: str, proposal_id: str, decision: str, note: str) -> Dict[str, Any]:
    if decision not in DECISIONS:
        raise KGProposalValidationError("Choose under review, approve, reject or request changes.")
    _validate_text(note, "Review note", required=True, maximum=2000)
    if "kg_reviewer" not in get_user_permissions(reviewer_id):
        raise PermissionError("A KG reviewer permission is required to review proposals.")
    result = _rpc("kg_review_change_proposal", {
        "p_reviewer_id": reviewer_id, "p_proposal_id": proposal_id,
        "p_decision": decision, "p_review_note": note.strip(),
    })
    if not isinstance(result, dict) or not result.get("id"):
        raise KGChangeManagementUnavailableError("The review decision was not saved. No successful save was confirmed.")
    return result


def list_permissions() -> List[Dict[str, Any]]:
    rows = _request("GET", "kg_user_permissions", params={
        "select": "user_id,permission,granted_by,reason,created_at",
        "order": "created_at.desc", "limit": "500",
    })
    if not isinstance(rows, list):
        raise KGChangeManagementUnavailableError("The permission service returned an invalid response.")
    return rows


def set_permission(admin_id: str, user_id: str, permission: str, enabled: bool, reason: str) -> Dict[str, Any]:
    if permission not in PERMISSIONS:
        raise KGProposalValidationError("Permission must be kg_reviewer or kg_curator.")
    _validate_text(user_id, "Supabase user ID", required=True, maximum=64)
    _validate_text(reason, "Permission reason", required=True, maximum=1000)
    result = _rpc("kg_manage_user_permission", {
        "p_admin_id": admin_id, "p_user_id": user_id.strip(),
        "p_permission": permission, "p_enabled": enabled, "p_reason": reason.strip(),
    })
    if not isinstance(result, dict) or result.get("success") is not True:
        raise KGChangeManagementUnavailableError("The permission change was not saved.")
    return result
