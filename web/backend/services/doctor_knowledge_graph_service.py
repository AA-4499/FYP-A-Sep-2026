"""Read-only adapter for the clinician-facing medical knowledge graph in Neo4j Aura.

The reusable MedicalConcept ontology and the selected patient's existing Aura
neighbourhood are read only. Patient summary fields remain sourced from
Supabase in the frontend; this service never writes, seeds, or deletes data.
"""
from __future__ import annotations

import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping, Optional

from dotenv import load_dotenv
from neo4j import GraphDatabase

logger = logging.getLogger(__name__)

_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(_ROOT / ".env")
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

class DoctorKnowledgeGraphUnavailable(RuntimeError):
    """Raised when the configured Neo4j knowledge graph cannot be read."""


_DRIVER = None
_DRIVER_CONFIG = None

_CONCEPT_QUERY = """
MATCH (a:MedicalConcept)-[r]->(b:MedicalConcept)
RETURN a, r, b
LIMIT $limit
"""

_CONCEPT_NODES_QUERY = """
MATCH (c:MedicalConcept)
RETURN c
LIMIT $limit
"""

_PATIENT_NEIGHBOURS_QUERY = """
MATCH (p:Patient {patientId: $patient_id})-[r]-(n)
WHERE NOT n:CGMReading
  AND NOT n:CBGReading
  AND NOT n:BloodKetoneReading
RETURN p, r, n
LIMIT $limit
"""

_PATIENT_CONCEPT_PATHS_QUERY = """
MATCH (p:Patient {patientId: $patient_id})-[r1]-(middle)-[r2]-(c:MedicalConcept)
WHERE NOT middle:CGMReading
  AND NOT middle:CBGReading
  AND NOT middle:BloodKetoneReading
RETURN p, r1, middle, r2, c
LIMIT $limit
"""

_PATIENT_EXISTS_QUERY = """
MATCH (p:Patient {patientId: $patient_id})
RETURN p
LIMIT 1
"""


def _configuration() -> tuple[str, str, str, str]:
    """Resolve Aura credentials from server environment without exposing them."""
    uri = (
        os.getenv("DOCTOR_KG_NEO4J_URI")
        or os.getenv("NEO4J_URI")
        or ""
    ).strip()
    user = (
        os.getenv("DOCTOR_KG_NEO4J_USER")
        or os.getenv("NEO4J_USER")
        or ""
    ).strip()
    password = (
        os.getenv("DOCTOR_KG_NEO4J_PASSWORD")
        or os.getenv("NEO4J_PASSWORD")
        or ""
    ).strip()
    database = os.getenv("DOCTOR_KG_NEO4J_DATABASE") or os.getenv("NEO4J_DATABASE") or "neo4j"
    if not uri or not user or not password:
        raise DoctorKnowledgeGraphUnavailable(
            "Neo4j is not configured for the Doctor Knowledge Graph. Set the existing "
            "NEO4J_URI, NEO4J_USER and NEO4J_PASSWORD server variables, or the "
            "DOCTOR_KG_NEO4J_* equivalents for a separate Aura connection."
        )
    return uri, user, password, database


def _get_driver():
    global _DRIVER, _DRIVER_CONFIG
    config = _configuration()
    if _DRIVER is not None and _DRIVER_CONFIG == config:
        return _DRIVER, config[3]
    if _DRIVER is not None:
        _DRIVER.close()
        _DRIVER = None
    try:
        _DRIVER = GraphDatabase.driver(
            config[0],
            auth=(config[1], config[2]),
            connection_timeout=8,
            max_connection_lifetime=300,
        )
        _DRIVER.verify_connectivity()
        _DRIVER_CONFIG = config
        return _DRIVER, config[3]
    except Exception as exc:
        _DRIVER = None
        _DRIVER_CONFIG = None
        logger.warning("Doctor KG Neo4j connectivity check failed (%s).", type(exc).__name__)
        raise DoctorKnowledgeGraphUnavailable(
            "Could not connect to the configured Neo4j knowledge graph. Check the server-side "
            "Aura URI, username, password, database name, and Aura network access settings."
        ) from exc


def _slug(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "-", str(value).casefold()).strip("-") or "node"


def _json_value(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Mapping):
        return {str(key): _json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_value(item) for item in value]
    isoformat = getattr(value, "isoformat", None)
    if callable(isoformat):
        try:
            return isoformat()
        except Exception:
            pass
    return str(value)


def _node_id(node: Any) -> str:
    labels = set(node.labels)
    props = dict(node)
    if "Patient" in labels:
        value = props.get("patientId") or props.get("id")
        if value is not None:
            return f"patient:{_slug(value)}"
    if "MedicalConcept" in labels and props.get("name"):
        return f"concept:{_slug(props['name'])}"
    for prop in ("readingId", "eventId", "measurementId", "id"):
        if props.get(prop) is not None:
            primary = sorted(labels)[0] if labels else "node"
            return f"{_slug(primary)}:{_slug(props[prop])}"
    if "name" in props and props["name"]:
        primary = sorted(labels)[0] if labels else "node"
        return f"{_slug(primary)}:{_slug(props['name'])}"
    element_id = getattr(node, "element_id", None) or getattr(node, "id", None)
    return f"neo4j:{_slug(element_id if element_id is not None else repr(node))}"


def _node_kind(labels: Iterable[str]) -> tuple[str, str]:
    names = set(labels)
    if "Patient" in names:
        return "Patient", "patient"
    if "MedicalConcept" in names:
        return "MedicalConcept", "ontology"
    if names.intersection({"CGMReading", "CBGReading", "BloodKetoneReading", "ClinicalMeasurement", "Measurement"}):
        return "Measurement", "clinical_data"
    if names.intersection({"MealEvent", "Food"}):
        return "Event", "lifestyle"
    if names.intersection({"InsulinAdministration", "MedicationAdministration"}):
        return "Event", "medical_data"
    if names.intersection({"RiskFactor", "Biomarker"}):
        return "ClinicalEntity", "clinical_data"
    return (sorted(names)[0] if names else "Node", "other")


def _node_label(labels: Iterable[str], props: Mapping[str, Any]) -> str:
    names = set(labels)
    if "Patient" in names:
        patient_id = props.get("patientId") or props.get("id")
        return f"Patient {patient_id}" if patient_id is not None else "Patient"
    if "MedicalConcept" in names:
        return str(props.get("name") or "Medical concept")
    if "CGMReading" in names:
        value, unit = props.get("value"), props.get("unit", "mg/dL")
        return f"CGM: {value} {unit}" if value is not None else "CGM reading"
    if "CBGReading" in names:
        value, unit = props.get("value"), props.get("unit", "mg/dL")
        return f"CBG: {value} {unit}" if value is not None else "CBG reading"
    if "BloodKetoneReading" in names:
        value, unit = props.get("value"), props.get("unit", "mmol/L")
        return f"Blood ketone: {value} {unit}" if value is not None else "Blood ketone reading"
    if "ClinicalMeasurement" in names:
        concept = props.get("concept") or props.get("name") or props.get("type") or "Clinical measurement"
        value = props.get("value")
        return f"{concept}: {value}" if value is not None else str(concept)
    if "InsulinAdministration" in names or "MedicationAdministration" in names:
        medication = props.get("medication") or props.get("insulinType") or props.get("name") or "Medication"
        dose = props.get("dose")
        unit = props.get("unit") or ""
        return f"{medication} {dose} {unit}".strip() if dose is not None else str(medication)
    if "MealEvent" in names:
        timestamp = props.get("timestamp")
        return f"Meal · {timestamp}" if timestamp else "Meal event"
    return str(props.get("name") or props.get("label") or props.get("condition") or props.get("eventId") or (sorted(names)[0] if names else "Node"))


def _node_element(node: Any) -> Dict[str, Any]:
    labels = sorted(str(label) for label in node.labels)
    props = {str(key): _json_value(value) for key, value in dict(node).items()}
    kind, category = _node_kind(labels)
    category = str(props.get("category") or category)
    return {
        "data": {
            "id": _node_id(node),
            "label": _node_label(labels, props),
            "kind": kind,
            "category": category,
            "labels": labels,
            "properties": props,
            "source": "Neo4j",
        }
    }


def _relationship_element(relationship: Any) -> Dict[str, Any]:
    start = relationship.start_node
    end = relationship.end_node
    rel_type = str(relationship.type)
    properties = {str(key): _json_value(value) for key, value in dict(relationship).items()}
    element_id = getattr(relationship, "element_id", None)
    edge_id = f"relationship:{_slug(element_id or f'{_node_id(start)}-{rel_type}-{_node_id(end)}')}"
    return {
        "data": {
            "id": edge_id,
            "source": _node_id(start),
            "target": _node_id(end),
            "label": str(properties.get("label") or rel_type.replace("_", " ").lower()),
            "kind": rel_type,
            "properties": properties,
            "sourceSystem": "Neo4j",
        }
    }


def get_doctor_knowledge_graph(patient_id: str) -> Dict[str, Any]:
    """Read the shared concept ontology plus one selected patient's Aura links.

    This function is read-only. It deliberately does not create, merge, delete,
    or modify Neo4j nodes and relationships.
    """
    patient_id = str(patient_id or "").strip()
    if not patient_id:
        raise ValueError("A patient record identifier is required.")

    driver, database = _get_driver()
    nodes: dict[str, Dict[str, Any]] = {}
    edges: dict[str, Dict[str, Any]] = {}
    patient_found = False

    def add_node(node: Any) -> None:
        if node is None:
            return
        element = _node_element(node)
        node_id = element["data"]["id"]
        if node_id in nodes:
            # Keep the richer property set if the node was returned by multiple queries.
            existing = nodes[node_id]["data"]
            existing["properties"] = {**existing.get("properties", {}), **element["data"].get("properties", {})}
            existing["labels"] = sorted(set(existing.get("labels", []) + element["data"].get("labels", [])))
        else:
            nodes[node_id] = element

    def add_edge(relationship: Any) -> None:
        if relationship is None:
            return
        add_node(relationship.start_node)
        add_node(relationship.end_node)
        element = _relationship_element(relationship)
        edges[element["data"]["id"]] = element

    try:
        with driver.session(database=database) as session:
            # Reusable literature-backed MedicalConcept ontology; no patient rows from other patients.
            for record in session.run(_CONCEPT_NODES_QUERY, limit=180):
                add_node(record["c"])
            for record in session.run(_CONCEPT_QUERY, limit=240):
                add_node(record["a"])
                add_node(record["b"])
                add_edge(record["r"])

            exists = session.run(
                _PATIENT_EXISTS_QUERY, patient_id=patient_id
            ).single()
            patient_found = exists is not None
            if patient_found:
                for record in session.run(
                    _PATIENT_NEIGHBOURS_QUERY,
                    patient_id=patient_id,
                    limit=70,
                ):
                    add_node(record["p"])
                    add_node(record["n"])
                    add_edge(record["r"])
                for record in session.run(
                    _PATIENT_CONCEPT_PATHS_QUERY,
                    patient_id=patient_id,
                    limit=120,
                ):
                    add_node(record["p"])
                    add_node(record["middle"])
                    add_node(record["c"])
                    add_edge(record["r1"])
                    add_edge(record["r2"])
    except DoctorKnowledgeGraphUnavailable:
        raise
    except Exception as exc:
        logger.warning("Doctor KG read failed (%s).", type(exc).__name__)
        raise DoctorKnowledgeGraphUnavailable(
            "The selected patient's knowledge graph could not be read. Confirm that the current "
            "patient exists in Aura and that the ontology node labels match the configured schema."
        ) from exc

    uri = _configuration()[0]
    return {
        "patient_id": patient_id,
        "elements": {"nodes": list(nodes.values()), "edges": list(edges.values())},
        "meta": {
            "source": "Neo4j Aura / configured Neo4j",
            "read_only": True,
            "patient_found_in_neo4j": patient_found,
            "ontology_node_count": sum(1 for node in nodes.values() if node["data"]["kind"] == "MedicalConcept"),
            "node_count": len(nodes),
            "relationship_count": len(edges),
            "uri_type": "Aura" if uri.startswith(("neo4j+s://", "neo4j+ssc://")) else "Configured Neo4j",
        },
    }


def close_doctor_knowledge_graph_driver() -> None:
    """Close the process-local driver during controlled shutdown/tests."""
    global _DRIVER, _DRIVER_CONFIG
    if _DRIVER is not None:
        _DRIVER.close()
    _DRIVER = None
    _DRIVER_CONFIG = None
