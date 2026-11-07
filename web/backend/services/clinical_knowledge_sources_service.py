"""Read-only bibliography registry for the Doctor Knowledge Graph workspace."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parents[3]
REFERENCES_PATH = (
    ROOT
    / "knowledge_graph"
    / "clinical_t2dm_kg_pack_reconciled_clean"
    / "knowledge_graph"
    / "clinical_t2dm"
    / "references.json"
)
REFERENCE_FIELDS = (
    "ref",
    "authors",
    "title",
    "publication",
    "year",
    "details",
    "doi",
    "url",
    "kind",
    "v1_usage",
    "note",
    "projectCitationAsSupplied",
    "firstPublishedOnlineYear",
)
REFERENCE_ID = re.compile(r"^\\[\\d+\\]$")


class ClinicalKnowledgeSourcesUnavailableError(RuntimeError):
    """The checked-in clinical literature bibliography is unavailable or invalid."""


def _is_http_url(value: Any) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    try:
        parsed = urlsplit(value.strip())
    except ValueError:
        return False
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _normalise_reference(raw: Any) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        raise ClinicalKnowledgeSourcesUnavailableError("A bibliography entry is not a JSON object.")
    ref = raw.get("ref")
    if not isinstance(ref, str) or not REFERENCE_ID.fullmatch(ref):
        raise ClinicalKnowledgeSourcesUnavailableError("A bibliography entry has an invalid reference ID.")
    for field in ("authors", "title", "publication"):
        if not isinstance(raw.get(field), str) or not raw[field].strip():
            raise ClinicalKnowledgeSourcesUnavailableError("A bibliography entry is missing required citation metadata.")
    url = raw.get("url")
    if url is not None and not _is_http_url(url):
        raise ClinicalKnowledgeSourcesUnavailableError("A bibliography entry contains an invalid publisher URL.")
    doi = raw.get("doi")
    if doi is not None and not isinstance(doi, str):
        raise ClinicalKnowledgeSourcesUnavailableError("A bibliography entry contains an invalid DOI value.")
    year = raw.get("year")
    if year is not None and (isinstance(year, bool) or not isinstance(year, int)):
        raise ClinicalKnowledgeSourcesUnavailableError("A bibliography entry contains an invalid publication year.")
    return {field: raw[field] for field in REFERENCE_FIELDS if field in raw}


def get_clinical_knowledge_sources() -> Dict[str, Any]:
    """Return validated citation metadata; this service never writes to Aura or the repository."""
    try:
        content = REFERENCES_PATH.read_bytes()
        payload = json.loads(content.decode("utf-8-sig"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        raise ClinicalKnowledgeSourcesUnavailableError(
            "The project bibliography could not be read. Check the checked-in references.json file."
        ) from None
    if not isinstance(payload, dict) or not isinstance(payload.get("version"), str):
        raise ClinicalKnowledgeSourcesUnavailableError("The project bibliography has an unsupported format.")
    raw_references = payload.get("references")
    if not isinstance(raw_references, list):
        raise ClinicalKnowledgeSourcesUnavailableError("The project bibliography has no reference list.")
    references = [_normalise_reference(item) for item in raw_references]
    ids = [item["ref"] for item in references]
    if len(ids) != len(set(ids)):
        raise ClinicalKnowledgeSourcesUnavailableError("The project bibliography contains duplicate reference IDs.")
    return {
        "source": "repository-bibliography",
        "version": payload["version"],
        "sha256": hashlib.sha256(content).hexdigest(),
        "totalReferences": len(references),
        "references": references,
    }
