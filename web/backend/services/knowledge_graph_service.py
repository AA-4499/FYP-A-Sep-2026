"""Patient-to-condition knowledge graph backed by a dedicated Neo4j container.

Only the patient anchor and recorded diabetes/other conditions are represented.
Patient data remains owned by the application's existing patient-data service
(Supabase in the integrated deployment). A limited frontend payload is accepted
as a development fallback when that service does not recognise the selected ID.
"""
from __future__ import annotations

import logging
import os
import re
from typing import Any, Dict, Iterable, List, Mapping, Optional, Tuple

from neo4j import GraphDatabase
from .patient_service import get_patient

logger = logging.getLogger(__name__)

class KnowledgeGraphUnavailableError(RuntimeError):
    """The separate Patient Neo4j instance could not be reached or queried."""

class PatientNotFoundError(ValueError):
    """The selected patient is not available from the patient service or payload."""

_DRIVER = None

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

def _neo4j_settings() -> Tuple[str, str, str, str]:
    """Resolve connection settings at runtime, preferring the shared Aura instance."""
    uri = (os.getenv("CLINICAL_KG_NEO4J_URI") or os.getenv("PATIENT_NEO4J_URI") or "").strip()
    username = (os.getenv("CLINICAL_KG_NEO4J_USER") or os.getenv("PATIENT_NEO4J_USER") or "").strip()
    password = os.getenv("CLINICAL_KG_NEO4J_PASSWORD") or os.getenv("PATIENT_NEO4J_PASSWORD") or ""
    database = (os.getenv("CLINICAL_KG_NEO4J_DATABASE") or os.getenv("PATIENT_NEO4J_DATABASE") or "").strip()
    if not uri or not username or not password:
        raise KnowledgeGraphUnavailableError(
            "Patient KG connection is not configured. Set CLINICAL_KG_NEO4J_URI, "
            "CLINICAL_KG_NEO4J_USER, CLINICAL_KG_NEO4J_PASSWORD and CLINICAL_KG_NEO4J_DATABASE "
            "on the backend."
        )
    return uri, username, password, database


def _driver():
    global _DRIVER
    if _DRIVER is None:
        try:
            uri, username, password, _ = _neo4j_settings()
            candidate = GraphDatabase.driver(
                uri, auth=(username, password), connection_timeout=10, max_connection_pool_size=10
            )
            candidate.verify_connectivity()
            _DRIVER = candidate
        except KnowledgeGraphUnavailableError:
            raise
        except Exception as exc:
            logger.warning("Could not connect to the Patient KG Neo4j instance: %s", type(exc).__name__)
            raise KnowledgeGraphUnavailableError(
                "Could not connect to the shared Neo4j Aura graph. Check backend-side Aura settings."
            ) from exc
    return _DRIVER


def close_driver() -> None:
    """Close the Neo4j driver during process shutdown."""
    global _DRIVER
    if _DRIVER is not None:
        _DRIVER.close()
        _DRIVER = None

def _write_and_read(tx, patient_id: str, conditions: List[Dict[str, str]]) -> Dict[str, Any]:
    tx.run(
        "MERGE (p:Patient {patientId: $patientId}) "
        "SET p.displayLabel = 'Patient', p.source = 'application patient record'",
        patientId=patient_id,
    ).consume()
    tx.run(
        "MATCH (p:Patient {patientId: $patientId}) "
        "OPTIONAL MATCH (p)-[r:HAS_CONDITION]->(:Condition) "
        "WITH collect(r) AS oldRels "
        "FOREACH (rel IN oldRels | DELETE rel)",
        patientId=patient_id,
    ).consume()
    if conditions:
        tx.run(
            "MATCH (p:Patient {patientId: $patientId}) "
            "UNWIND $conditions AS item "
            "MERGE (c:Condition {conditionId: item.id}) "
            "SET c.name = item.name, c.category = item.category "
            "MERGE (p)-[r:HAS_CONDITION {category: item.category}]->(c) "
            "SET r.label = item.edgeLabel, r.source = 'application patient record'",
            patientId=patient_id, conditions=conditions,
        ).consume()
    row = tx.run(
        "MATCH (p:Patient {patientId: $patientId}) "
        "OPTIONAL MATCH (p)-[r:HAS_CONDITION]->(c:Condition) "
        "RETURN p.patientId AS patientId, collect(CASE WHEN c IS NULL THEN null ELSE "
        "{id:c.conditionId,name:c.name,category:c.category,edgeLabel:r.label} END) AS conditions",
        patientId=patient_id,
    ).single()
    return {"patientId": row["patientId"], "conditions": [x for x in row["conditions"] if x is not None]}

def get_patient_knowledge_graph(
    patient_id: str,
    patient_payload: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    """Synchronise a selected patient's conditions and return Cytoscape elements.

    The existing patient service is authoritative. The restricted payload is
    used only as a fallback for the app's currently selected record when that
    ID is not present in the backend service (for example, a Supabase-backed
    record while local mock data is still installed).
    """
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
        with _driver().session(database=_neo4j_settings()[3] or None) as session:
            data = session.execute_write(_write_and_read, patient_id, conditions)
    except KnowledgeGraphUnavailableError:
        raise
    except Exception as exc:
        logger.exception("Failed to synchronise the Patient KG for %s", patient_id)
        raise KnowledgeGraphUnavailableError("Patient data was found, but Neo4j could not update the Patient KG.") from exc

    nodes: List[Dict[str, Any]] = [{
        "data": {"id": "patient", "label": "Patient", "kind": "Patient", "category": "patient"}
    }]
    edges: List[Dict[str, Any]] = []
    for condition in data["conditions"]:
        nodes.append({"data": {
            "id": condition["id"], "label": condition["name"],
            "kind": "Condition", "category": condition["category"],
        }})
        edges.append({"data": {
            "id": f"edge-{_slug(condition['category'])}-{_slug(condition['name'])}",
            "source": "patient", "target": condition["id"],
            "label": condition.get("edgeLabel") or _EDGE_LABELS.get(condition["category"], "has condition"),
        }})

    return {
        "patient_id": patient_id,
        "elements": {"nodes": nodes, "edges": edges},
        "stats": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "condition_count": len(edges),
            "graph_scope": "Patient and recorded diabetes/other conditions only",
        },
    }
