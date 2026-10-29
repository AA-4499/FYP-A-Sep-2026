"""Compose an authorised patient's condition graph from Supabase and Aura concepts.

The shared Aura database stores reusable MedicalConcept knowledge only.
Patient-specific nodes and identifiers are not persisted to Aura.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, Iterable, List, Mapping, Optional, Tuple

from .patient_service import get_patient

logger = logging.getLogger(__name__)

class KnowledgeGraphUnavailableError(RuntimeError):
    """A patient graph source was unavailable."""

class PatientNotFoundError(ValueError):
    """The selected patient is not available from the patient service or payload."""


_EMPTY = {"", "/", "-", "--", "none", "null", "n/a", "na", "not available", "unknown"}
_FIELDS = {
    "diabetes_type": ("diabetes_type", "diabetesType", "type_of_diabetes", "typeOfDiabetes", "Type of Diabetes", "Diabetes Type", "condition"),
    "comorbidity": ("comorbidities", "comorbidity", "co_morbidities", "other_conditions", "Comorbidities", "otherConditions"),
    "acute_complication": ("acute_diabetic_complications", "acute_complications", "acute_complication", "Acute Diabetic Complications", "acuteComplications"),
    "macrovascular_complication": ("macrovascular_complications", "diabetic_macrovascular_complications", "macrovascular_complication", "Diabetic Macrovascular Complications", "macrovascularComplications"),
    "microvascular_complication": ("microvascular_complications", "diabetic_microvascular_complications", "microvascular_complication", "Diabetic Microvascular Complications", "microvascularComplications"),
}
_EDGE_LABELS = {
    "diabetes_type": "has diabetes",
    "comorbidity": "has comorbidity",
    "acute_complication": "has acute complication",
    "macrovascular_complication": "has macrovascular complication",
    "microvascular_complication": "has microvascular complication",
}
_ALIASES = {
    "t2dm": "Type 2 Diabetes",
    "type 2 diabetes": "Type 2 Diabetes",
    "type 2 diabetes mellitus": "Type 2 Diabetes",
    "t1dm": "Type 1 Diabetes",
    "type 1 diabetes": "Type 1 Diabetes",
    "type 1 diabetes mellitus": "Type 1 Diabetes",
    "pad": "Peripheral Arterial Disease",
    "chd": "Coronary Heart Disease",
    "peripheral arterial disease": "Peripheral Arterial Disease",
    "coronary heart disease": "Coronary Heart Disease",
    "diabetic nephropathy": "Diabetic Nephropathy",
    "nephropathy": "Diabetic Nephropathy",
    "diabetic neuropathy": "Diabetic Neuropathy",
    "neuropathy": "Diabetic Neuropathy",
    "diabetic retinopathy": "Diabetic Retinopathy",
    "retinopathy": "Diabetic Retinopathy",
    "dka": "Diabetic Ketoacidosis",
    "hypertension": "Hypertension",
    "hyperlipidemia": "Hyperlipidemia",
    "hyperuricemia": "Hyperuricemia",
    "cerebrovascular disease": "Cerebrovascular Disease",
}

def _empty(value: Any) -> bool:
    return value is None or (isinstance(value, str) and value.strip().casefold() in _EMPTY)

def _first(record: Mapping[str, Any], keys: Iterable[str]) -> Any:
    for key in keys:
        value = record.get(key)
        if not _empty(value):
            return value
    return None

def _names(value: Any) -> List[str]:
    if _empty(value):
        return []
    if isinstance(value, Mapping):
        return _names(value.get("name") or value.get("label") or value.get("condition"))
    if isinstance(value, (list, tuple, set)):
        return [name for part in value for name in _names(part)]
    if not isinstance(value, str):
        return []
    return [part.strip() for part in re.split(r"[,;|\n]+", value) if part.strip() and not _empty(part)]

def _canonical(value: str) -> str:
    name = re.sub(r"\s+", " ", value.strip())
    return _ALIASES.get(name.casefold(), name[:1].upper() + name[1:])

def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-") or "condition"

def _true(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    return isinstance(value, str) and value.strip().casefold() in {"yes", "y", "true", "1", "present"}

def extract_patient_conditions(patient: Mapping[str, Any]) -> List[Dict[str, str]]:
    """Extract diabetes type, comorbidities and complications from a record."""
    # Supabase patient_service puts the original summary columns in recorded_fields.
    recorded = patient.get("recorded_fields")
    if isinstance(recorded, Mapping):
        patient = {**recorded, **patient}
    collected: List[Tuple[str, str]] = []
    diabetes_value = _first(patient, _FIELDS["diabetes_type"])
    for name in _names(diabetes_value):
        canonical = _canonical(name)
        if "diabetes" in canonical.casefold() or canonical.casefold() in {"t1dm", "t2dm"}:
            collected.append((canonical, "diabetes_type"))

    for category, keys in _FIELDS.items():
        if category == "diabetes_type":
            continue
        for name in _names(_first(patient, keys)):
            canonical = _canonical(name)
            # Avoid re-adding a primary diabetes diagnosis as a comorbidity.
            if canonical.casefold() in {"type 1 diabetes", "type 2 diabetes"}:
                continue
            collected.append((canonical, category))

    if _true(patient.get("hypertension")):
        collected.append(("Hypertension", "comorbidity"))
    hypo = _first(patient, ("hypoglycemia_status", "hypoglycemia", "had_hypoglycemia", "Hypoglycemia (yes/no)", "hypoglycemiaStatus"))
    if hypo is not None and _true(hypo):
        collected.append(("Hypoglycemia", "acute_complication"))

    unique = []
    seen = set()
    for raw_name, category in collected:
        name = _canonical(raw_name)
        key = (name.casefold(), category)
        if _empty(name) or key in seen:
            continue
        seen.add(key)
        unique.append({
            "id": f"{category}::{_slug(name)}",
            "name": name,
            "category": category,
            "edgeLabel": _EDGE_LABELS[category],
        })
    return unique

def _concept_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", _canonical(value).casefold()).strip()


def _concept_node_data(concept: Mapping[str, Any]) -> Dict[str, Any]:
    refs = concept.get("sourceRefs") or []
    if not isinstance(refs, list):
        refs = [str(refs)]
    return {
        "id": str(concept.get("id") or ""),
        "label": str(concept.get("name") or "Unnamed concept"),
        "kind": "MedicalConcept",
        "category": str(concept.get("category") or "Clinical concept"),
        "description": str(concept.get("description") or ""),
        "sourceRefs": [str(item) for item in refs],
        "scope": str(concept.get("scope") or ""),
        "schemaVersion": str(concept.get("schemaVersion") or ""),
    }


def _compose_patient_graph(
    patient_id: str,
    conditions: List[Dict[str, str]],
    clinical_graph: Mapping[str, Any],
) -> Dict[str, Any]:
    """Compose a selected patient's graph in memory without persisting PHI to Aura."""
    nodes_by_id: Dict[str, Dict[str, Any]] = {
        "patient": {
            "data": {
                "id": "patient",
                "label": "Patient",
                "kind": "Patient",
                "category": "patient",
                "description": "Patient anchor composed for this request from the authorised Supabase record.",
            }
        }
    }
    edges_by_id: Dict[str, Dict[str, Any]] = {}

    for condition in conditions:
        condition_id = condition["id"]
        nodes_by_id[condition_id] = {
            "data": {
                "id": condition_id,
                "label": condition["name"],
                "kind": "Condition",
                "category": condition["category"],
                "description": "Recorded in the selected patient's Supabase summary.",
                "source": "Supabase patient record",
            }
        }
        edge_id = "patient-" + _slug(condition_id)
        edges_by_id[edge_id] = {
            "data": {
                "id": edge_id,
                "source": "patient",
                "target": condition_id,
                "label": condition.get("edgeLabel") or _EDGE_LABELS.get(condition["category"], "has condition"),
                "status": "recorded",
                "evidenceStatus": "recorded",
            }
        }

    clinical_nodes = [
        node for node in (clinical_graph.get("nodes") or [])
        if isinstance(node, Mapping) and node.get("id") and node.get("name")
    ]
    clinical_by_id = {str(node["id"]): node for node in clinical_nodes}
    clinical_by_key = {_concept_key(str(node["name"])): node for node in clinical_nodes}
    matched_concept_ids = set()

    for condition in conditions:
        concept = clinical_by_key.get(_concept_key(condition["name"]))
        if not concept:
            continue
        concept_data = _concept_node_data(concept)
        concept_id = concept_data["id"]
        if not concept_id:
            continue
        nodes_by_id.setdefault(concept_id, {"data": concept_data})
        matched_concept_ids.add(concept_id)
        edge_id = "match-" + _slug(condition["id"]) + "-" + _slug(concept_id)
        edges_by_id[edge_id] = {
            "data": {
                "id": edge_id,
                "source": condition["id"],
                "target": concept_id,
                "label": "matches clinical concept",
                "status": "matched",
                "evidenceStatus": "matched",
            }
        }

    # Surface only one-hop context around matched concepts. Evidence status is
    # carried through unchanged so downstream analysis can reject candidates.
    for edge in clinical_graph.get("edges") or []:
        if not isinstance(edge, Mapping):
            continue
        source_id = str(edge.get("source") or "")
        target_id = str(edge.get("target") or "")
        if not source_id or not target_id:
            continue
        if source_id not in matched_concept_ids and target_id not in matched_concept_ids:
            continue
        source_node = clinical_by_id.get(source_id)
        target_node = clinical_by_id.get(target_id)
        if not source_node or not target_node:
            continue
        nodes_by_id.setdefault(source_id, {"data": _concept_node_data(source_node)})
        nodes_by_id.setdefault(target_id, {"data": _concept_node_data(target_node)})
        predicate = str(edge.get("predicate") or "RELATED_TO")
        edge_id = "clinical-" + str(edge.get("id") or (
            _slug(source_id) + "-" + _slug(predicate) + "-" + _slug(target_id)
        ))
        refs = edge.get("sourceRefs") or []
        if not isinstance(refs, list):
            refs = [str(refs)]
        status = str(edge.get("evidenceStatus") or "candidate_for_review")
        edges_by_id[edge_id] = {
            "data": {
                "id": edge_id,
                "source": source_id,
                "target": target_id,
                "label": str(edge.get("label") or predicate.lower().replace("_", " ")),
                "predicate": predicate,
                "status": status,
                "evidenceStatus": status,
                "sourceRefs": [str(item) for item in refs],
                "evidenceNote": str(edge.get("evidenceNote") or ""),
                "evidenceType": str(edge.get("evidenceType") or ""),
                "scope": str(edge.get("scope") or ""),
                "schemaVersion": str(edge.get("schemaVersion") or ""),
            }
        }

    return {
        "patient_id": patient_id,
        "elements": {
            "nodes": list(nodes_by_id.values()),
            "edges": list(edges_by_id.values()),
        },
        "stats": {
            "total_nodes": len(nodes_by_id),
            "total_edges": len(edges_by_id),
            "condition_count": len(conditions),
            "matched_concept_count": len(matched_concept_ids),
            "graph_scope": "Ephemeral graph composed from Supabase and Aura concepts; not persisted to Aura",
            "persistence": "Patient-specific graph exists only in the API response.",
        },
    }


def get_patient_knowledge_graph(
    patient_id: str,
    patient_payload: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    """Build the selected patient's graph from an authoritative record and reusable concepts."""
    patient_id = str(patient_id).strip()
    if not patient_id:
        raise PatientNotFoundError("A patient identifier is required.")
    patient = get_patient(patient_id)
    if not patient and patient_payload:
        payload_id = patient_payload.get("id") or patient_payload.get("patientId") or patient_payload.get("patient_id")
        if payload_id is not None and str(payload_id) != patient_id:
            raise PatientNotFoundError("The patient payload does not match the requested patient identifier.")
        patient = patient_payload
    if not patient:
        raise PatientNotFoundError(f"Patient '{patient_id}' was not found.")

    conditions = extract_patient_conditions(patient)
    try:
        from .clinical_knowledge_graph_service import get_clinical_knowledge_graph
        clinical_graph = get_clinical_knowledge_graph()
    except Exception as exc:
        logger.warning("Could not read Aura concepts while composing patient KG: %s", type(exc).__name__)
        # Recorded patient conditions remain readable while the shared concept
        # store is unavailable; the Clinical Concepts/Analysis tabs show errors.
        clinical_graph = {"nodes": [], "edges": []}

    return _compose_patient_graph(patient_id, conditions, clinical_graph)
