"""Graph-grounded interpretation of the selected patient's condition graph."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Mapping

import requests

from services.clinical_knowledge_graph_service import get_clinical_knowledge_graph

_OPENAI_URL = "https://api.openai.com/v1/responses"


class KnowledgeGraphAnalysisUnavailableError(RuntimeError):
    """The requested Knowledge Graph analysis provider is unavailable."""


def _normalise(value: Any) -> str:
    return " ".join(str(value or "").casefold().replace("_", " ").split())


def _string_list(value: Any, limit: int = 8) -> List[str]:
    if not isinstance(value, list):
        return []
    return [
        str(item).strip()[:700]
        for item in value
        if isinstance(item, (str, int, float)) and str(item).strip()
    ][:limit]


def _graph_context(patient_graph: Mapping[str, Any], clinical_graph: Mapping[str, Any]) -> Dict[str, Any]:
    elements = patient_graph.get("elements") or {}
    nodes = elements.get("nodes") or []
    conditions = []
    for element in nodes:
        data = element.get("data") if isinstance(element, dict) else None
        if not isinstance(data, dict) or str(data.get("kind") or "").casefold() != "condition":
            continue
        name = str(data.get("label") or "").strip()
        if name and name not in conditions:
            conditions.append(name)

    concepts = clinical_graph.get("nodes") or []
    aliases = {
        "t2dm": "type 2 diabetes",
        "type 2 diabetes mellitus": "type 2 diabetes",
        "t1dm": "type 1 diabetes",
        "type 1 diabetes mellitus": "type 1 diabetes",
    }
    by_name = {}
    for concept in concepts:
        name = str(concept.get("name") or "").strip()
        if name:
            by_name[aliases.get(_normalise(name), _normalise(name))] = concept

    matched = []
    matched_ids = set()
    for name in conditions:
        key = aliases.get(_normalise(name), _normalise(name))
        concept = by_name.get(key)
        if concept:
            matched.append({
                "name": concept.get("name"),
                "category": concept.get("category"),
                "description": concept.get("description"),
                "sourceRefs": concept.get("sourceRefs") or [],
            })
            matched_ids.add(str(concept.get("id") or ""))

    relationship_records = clinical_graph.get("edges") or []
    reviewed = [
        edge for edge in relationship_records
        if str(edge.get("evidenceStatus") or "").casefold() == "reviewed"
        and (str(edge.get("source") or "") in matched_ids or str(edge.get("target") or "") in matched_ids)
    ]
    candidate_count = sum(
        1 for edge in relationship_records
        if str(edge.get("evidenceStatus") or "").casefold() == "candidate_for_review"
    )
    reviewed_context = [{
        "source": edge.get("sourceName"),
        "predicate": edge.get("predicate"),
        "target": edge.get("targetName"),
        "sourceRefs": edge.get("sourceRefs") or [],
        "evidenceNote": edge.get("evidenceNote") or "",
    } for edge in reviewed]

    return {
        "recordedConditions": conditions,
        "matchedClinicalConcepts": matched,
        "reviewedRelationships": reviewed_context,
        "unreviewedCandidateRelationshipCount": candidate_count,
        "conditionNodeCount": len(conditions),
        "matchedConceptCount": len(matched),
        "reviewedRelationshipCount": len(reviewed_context),
        "sharedConceptCount": len(concepts),
    }


def _local_analysis(context: Mapping[str, Any]) -> Dict[str, Any]:
    conditions = list(context.get("recordedConditions") or [])
    matched = [str(item.get("name")) for item in context.get("matchedClinicalConcepts") or []]
    relationships = list(context.get("reviewedRelationships") or [])
    shared_count = int(context.get("sharedConceptCount") or 0)

    if not shared_count:
        summary = "The shared clinical concept graph is empty. Seed the curated concept graph before using relationship-based interpretation."
    elif not conditions:
        summary = "No condition nodes are recorded in the selected patient's graph. No condition-specific interpretation was produced."
    elif matched and relationships:
        summary = (
            "The patient graph records " + ", ".join(conditions) +
            ". The shared graph has reviewed relationships connected to " +
            ", ".join(matched) + ". This is a source-grounded summary for clinician review, not a diagnosis."
        )
    elif matched:
        summary = (
            "The patient graph records " + ", ".join(conditions) +
            " and matches " + ", ".join(matched) +
            " to the shared concept graph. No reviewed relationship is linked to these matched concepts, so no relationship-based inference was made."
        )
    else:
        summary = (
            "The patient graph records " + ", ".join(conditions) +
            ", but no recorded condition matched a named concept in the shared clinical graph."
        )

    observations = []
    if conditions:
        observations.append("Recorded condition labels: " + ", ".join(conditions) + ".")
    else:
        observations.append("No condition labels are recorded in this patient graph.")
    if matched:
        observations.append("Matched shared concepts: " + ", ".join(matched) + ".")
    else:
        observations.append("No exact condition-to-concept match was found.")
    if relationships:
        observations.extend(
            str(edge.get("source")) + " —" + str(edge.get("predicate")) + "→ " + str(edge.get("target")) +
            " (sources: " + (", ".join(edge.get("sourceRefs") or []) or "not recorded") + ")."
            for edge in relationships[:6]
        )
    else:
        observations.append("No reviewed relationship connects a matched patient condition to the shared clinical graph.")
    if context.get("unreviewedCandidateRelationshipCount"):
        observations.append(
            str(context["unreviewedCandidateRelationshipCount"]) +
            " candidate relationship(s) were excluded because they are not marked reviewed."
        )
    if not shared_count:
        observations.append("The shared graph has zero clinical concepts available.")

    return {
        "provider": "rules",
        "model": None,
        "summary": summary,
        "observations": observations[:8],
        "followUpQuestions": [
            "Do the recorded condition labels match the patient's current clinical record?",
            "Are relevant clinical concepts or relationships missing from the reviewed knowledge graph?",
            "Have the cited sources and relationship evidence been checked before using this graph in clinical decisions?",
        ],
        "contextStats": {
            "recordedConditions": len(conditions),
            "matchedConcepts": len(matched),
            "reviewedRelationships": len(relationships),
            "candidateRelationshipsExcluded": int(context.get("unreviewedCandidateRelationshipCount") or 0),
            "sharedConceptsAvailable": shared_count,
        },
        "safetyNote": "Graph interpretation supports clinician review. It does not diagnose a condition or prescribe treatment.",
    }


def _openai_analysis(context: Mapping[str, Any]) -> Dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise KnowledgeGraphAnalysisUnavailableError(
            "KG_AI_PROVIDER is set to openai, but OPENAI_API_KEY is not configured on the backend."
        )
    model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini").strip() or "gpt-4.1-mini"
    system_prompt = (
        "You are a clinical knowledge-graph interpretation assistant supporting a doctor. "
        "Use only the supplied graph context. Do not diagnose, prescribe, recommend medication or dosage, "
        "or claim causation. Only use relationships explicitly marked reviewed in the supplied context. "
        "Unreviewed candidate relationships are excluded and must never be treated as evidence. "
        "If the graph is insufficient, state that limitation. Return valid JSON with keys summary (string), "
        "observations (array of short strings), and followUpQuestions (array of short strings). "
        "Use cautious language and make no claim beyond the supplied graph."
    )
    # This payload deliberately excludes patient ID, demographics, raw measurements and unreviewed edges.
    user_prompt = json.dumps(context, ensure_ascii=False, separators=(",", ":"))
    try:
        response = requests.post(
            _OPENAI_URL,
            headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json"},
            json={
                "model": model,
                "store": False,
                "max_output_tokens": 1000,
                "text": {"format": {"type": "json_object"}},
                "input": [
                    {"role": "system", "content": [{"type": "input_text", "text": system_prompt}]},
                    {"role": "user", "content": [{"type": "input_text", "text": user_prompt}]},
                ],
            },
            timeout=35,
        )
        response.raise_for_status()
        body = response.json()
        raw = body.get("output_text")
        if not raw:
            pieces = []
            for item in body.get("output") or []:
                for part in item.get("content") or []:
                    if part.get("type") == "output_text" and part.get("text"):
                        pieces.append(part["text"])
            raw = "".join(pieces)
        parsed = json.loads(raw or "{}")
    except (requests.RequestException, ValueError, TypeError, KeyError):
        raise KnowledgeGraphAnalysisUnavailableError(
            "The language-model analysis could not be completed. Check the provider, model and backend API key."
        ) from None

    summary = str(parsed.get("summary") or "").strip()[:2500]
    if not summary:
        raise KnowledgeGraphAnalysisUnavailableError("The language model returned no analysis summary.")
    return {
        "provider": "openai",
        "model": model,
        "summary": summary,
        "observations": _string_list(parsed.get("observations")),
        "followUpQuestions": _string_list(parsed.get("followUpQuestions")),
        "contextStats": {
            "recordedConditions": int(context.get("conditionNodeCount") or 0),
            "matchedConcepts": int(context.get("matchedConceptCount") or 0),
            "reviewedRelationships": int(context.get("reviewedRelationshipCount") or 0),
            "candidateRelationshipsExcluded": int(context.get("unreviewedCandidateRelationshipCount") or 0),
            "sharedConceptsAvailable": int(context.get("sharedConceptCount") or 0),
        },
        "safetyNote": "AI output is a graph summary for clinician review, not a diagnosis or treatment plan.",
    }


def analyze_patient_knowledge_graph(patient_graph: Mapping[str, Any]) -> Dict[str, Any]:
    """Read the clinical graph and analyse only reviewed relationship evidence."""
    try:
        clinical_graph = get_clinical_knowledge_graph()
    except Exception:
        raise KnowledgeGraphAnalysisUnavailableError(
            "The shared clinical concept graph could not be read. Check the Aura connection and seed data."
        ) from None
    context = _graph_context(patient_graph, clinical_graph)
    provider = os.getenv("KG_AI_PROVIDER", "rules").strip().casefold()
    if provider == "openai":
        result = _openai_analysis(context)
    else:
        result = _local_analysis(context)
    result["source"] = "neo4j-aura"
    result["createdAt"] = datetime.now(timezone.utc).isoformat()
    return result
