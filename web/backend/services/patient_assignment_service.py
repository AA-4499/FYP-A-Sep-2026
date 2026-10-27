"""Read doctor-to-patient assignment rows using the caller's Supabase token."""
from __future__ import annotations

import logging
from typing import List

import requests

from models.training.supabase_io import SupabaseStorageError, supabase_config, supabase_headers

logger = logging.getLogger(__name__)


class PatientAssignmentUnavailableError(RuntimeError):
    """The doctor's assigned patient list could not be verified."""


def get_doctor_assigned_patient_ids(doctor_id: str, access_token: str) -> List[str]:
    """Return the caller's assigned IDs, respecting assignment-table RLS."""
    if not doctor_id or not access_token:
        raise PatientAssignmentUnavailableError("The doctor identity could not be verified.")
    try:
        url, key = supabase_config()
        response = requests.get(
            url.rstrip("/") + "/rest/v1/clinician_patient_assignments",
            headers={
                **supabase_headers(key),
                "Authorization": "Bearer " + access_token,
            },
            params={
                "select": "patient_id",
                "clinician_id": "eq." + doctor_id,
                "order": "patient_id.asc",
            },
            timeout=12,
        )
        response.raise_for_status()
        rows = response.json()
    except (requests.RequestException, ValueError, SupabaseStorageError) as exc:
        logger.warning("Could not verify doctor assignments: %s", type(exc).__name__)
        raise PatientAssignmentUnavailableError(
            "Could not read the doctor assignment list from Supabase."
        ) from None
    if not isinstance(rows, list):
        raise PatientAssignmentUnavailableError("Supabase returned an invalid assignment list.")
    return sorted({
        str(row.get("patient_id")).strip()
        for row in rows
        if isinstance(row, dict) and row.get("patient_id") is not None and str(row.get("patient_id")).strip()
    })
