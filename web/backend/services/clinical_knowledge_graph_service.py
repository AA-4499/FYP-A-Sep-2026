"""Read-only clinical concept graph service backed by Neo4j Aura.

This service only reads :MedicalConcept nodes and relationships between them.
Patient-specific records remain in Supabase and are never written to this graph.
"""
from __future__ import annotations

import logging
import os
import re
from typing import Any, Dict, List

from neo4j import GraphDatabase

logger = logging.getLogger(__name__)

class ClinicalKnowledgeGraphUnavailableError(RuntimeError):
    """The shared clinical concept graph cannot be reached or queried."""


_DRIVER = None

_NODES_QUERY = """
MATCH (n:MedicalConcept)
RETURN
    n.name AS name,
    coalesce(n.category, 'Uncategorised') AS category,
    coalesce(n.description, '') AS description,
    coalesce(n.sourceRefs, []) AS sourceRefs,
    coalesce(n.scope, '') AS scope,
    coalesce(n.schemaVersion, '') AS schemaVersion
ORDER BY name
"""

_RELATIONSHIPS_QUERY = """
MATCH (source:MedicalConcept)-[r]->(target:MedicalConcept)
RETURN
    source.name AS sourceName,
    type(r) AS predicate,
    target.name AS targetName,
    coalesce(r.sourceRefs, []) AS sourceRefs,
    coalesce(r.evidenceNote, '') AS evidenceNote,
    coalesce(r.evidenceStatus, 'candidate_for_review') AS evidenceStatus,
    coalesce(r.evidenceType, 'literature') AS evidenceType,
    coalesce(r.scope, 'Type 2 Diabetes') AS scope,
    coalesce(r.schemaVersion, 't2dm-medical-kg-v1') AS schemaVersion
ORDER BY sourceName, predicate, targetName
"""


def _concept_id(name: str) -> str:
    return "concept-" + (re.sub(r"[^a-z0-9]+", "-", name.casefold()).strip("-") or "unnamed")


def _string_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        return [str(item) for item in value if item is not None and str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _driver():
    """Create a process-wide driver from server-only environment variables."""
    global _DRIVER
    if _DRIVER is not None:
        return _DRIVER

    uri = (os.getenv("CLINICAL_KG_NEO4J_URI") or os.getenv("NEO4J_URI") or "neo4j+s://e72f4649.databases.neo4j.io").strip()
    username = (os.getenv("CLINICAL_KG_NEO4J_USER") or os.getenv("NEO4J_USERNAME") or os.getenv("NEO4J_USER") or "e72f4649").strip()
    password = os.getenv("CLINICAL_KG_NEO4J_PASSWORD") or os.getenv("NEO4J_PASSWORD", "")
    if not uri or not password:
        raise ClinicalKnowledgeGraphUnavailableError(
            "The clinical knowledge graph is not configured. Set the Aura URI and password "
            "as server-side CLINICAL_KG_NEO4J_* environment variables."
        )

    try:
        candidate = GraphDatabase.driver(
            uri,
            auth=(username, password),
            connection_timeout=10,
            max_connection_pool_size=10,
        )
        candidate.verify_connectivity()
        _DRIVER = candidate
        return _DRIVER
    except Exception as exc:
        logger.warning("Could not connect to the clinical Neo4j Aura instance: %s", type(exc).__name__)
        raise ClinicalKnowledgeGraphUnavailableError(
            "Neo4j Aura is unavailable. Check the server-side Aura URI, username, password and database access."
        ) from exc


def _read_graph(tx) -> Dict[str, Any]:
    """Read only concepts and concept-to-concept edges in one read transaction."""
    raw_nodes = [dict(record) for record in tx.run(_NODES_QUERY)]
    nodes: List[Dict[str, Any]] = []
    id_by_name: Dict[str, str] = {}

    for record in raw_nodes:
        name = str(record.get("name") or "").strip()
        if not name:
            continue
        node_id = _concept_id(name)
        id_by_name[name] = node_id
        nodes.append({
            "id": node_id,
            "name": name,
            "category": str(record.get("category") or "Uncategorised"),
            "description": str(record.get("description") or ""),
            "sourceRefs": _string_list(record.get("sourceRefs")),
            "scope": str(record.get("scope") or ""),
            "schemaVersion": str(record.get("schemaVersion") or ""),
        })

    raw_edges = [dict(record) for record in tx.run(_RELATIONSHIPS_QUERY)]
    edges: List[Dict[str, Any]] = []
    for record in raw_edges:
        source_name = str(record.get("sourceName") or "").strip()
        target_name = str(record.get("targetName") or "").strip()
        predicate = str(record.get("predicate") or "").strip()
        # Do not return edges if either endpoint could not be resolved in this graph response.
        if source_name not in id_by_name or target_name not in id_by_name or not predicate:
            continue
        source_refs = _string_list(record.get("sourceRefs"))
        evidence_status = str(record.get("evidenceStatus") or "candidate_for_review")
        edges.append({
            "id": f"{id_by_name[source_name]}__{predicate.lower()}__{id_by_name[target_name]}",
            "source": id_by_name[source_name],
            "target": id_by_name[target_name],
            "sourceName": source_name,
            "targetName": target_name,
            "predicate": predicate,
            "label": predicate.replace("_", " ").lower(),
            "sourceRefs": source_refs,
            "evidenceNote": str(record.get("evidenceNote") or ""),
            "evidenceStatus": evidence_status,
            "evidenceType": str(record.get("evidenceType") or "literature"),
            "scope": str(record.get("scope") or "Type 2 Diabetes"),
            "schemaVersion": str(record.get("schemaVersion") or "t2dm-medical-kg-v1"),
        })

    reviewed_count = sum(1 for edge in edges if edge["evidenceStatus"].casefold() == "reviewed")
    candidate_count = sum(
        1 for edge in edges if edge["evidenceStatus"].casefold() == "candidate_for_review"
    )
    return {
        "source": "neo4j-aura",
        "readOnly": True,
        "scope": "Reusable Type 2 Diabetes clinical concepts; no patient-specific records",
        "stats": {
            "totalNodes": len(nodes),
            "totalEdges": len(edges),
            "reviewedEdges": reviewed_count,
            "candidateEdges": candidate_count,
        },
        "nodes": nodes,
        "edges": edges,
    }


def get_clinical_knowledge_graph() -> Dict[str, Any]:
    """Return the shared clinical concept graph without changing Neo4j data."""
    try:
        database = (os.getenv("CLINICAL_KG_NEO4J_DATABASE") or os.getenv("NEO4J_DATABASE") or "neo4j").strip() or "neo4j"
        with _driver().session(database=database) as session:
            return session.execute_read(_read_graph)
    except ClinicalKnowledgeGraphUnavailableError:
        raise
    except Exception as exc:
        logger.warning("Could not read the clinical Neo4j Aura graph: %s", type(exc).__name__)
        raise ClinicalKnowledgeGraphUnavailableError(
            "The clinical graph could not be read from Neo4j Aura. Check database access and graph contents."
        ) from exc


def close_driver() -> None:
    """Close the Neo4j driver during process shutdown."""
    global _DRIVER
    if _DRIVER is not None:
        _DRIVER.close()
        _DRIVER = None
