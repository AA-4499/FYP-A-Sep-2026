# Doctor Knowledge Graph — Aura audit, seed, and integration

This folder is the curated replacement for the long scratchpad of Cypher experiments. It separates read-only inspection from optional data changes.

## What the doctor page reads

The doctor Knowledge Graph page in `web/frontend/src/components/KnowledgeGraphView.tsx` combines:

1. **The shared ontology from Neo4j**: `MedicalConcept` nodes and their existing literature-backed relationships.
2. **Only the currently selected patient record from Supabase**: `patient_summary` and a small recent slice of `patient_detail`.
3. **Existing Aura patient links, if present**: the backend looks up the exact selected record identifier (for example, `2000_0_20201230`) and reads its direct links and nearby medical concepts.

The API endpoint is `GET /api/doctor/knowledge-graph?patient_id=<Patient Number>`. It requires a doctor/clinician/admin access token. The backend service is read-only: it does not insert, update, seed, or delete Aura nodes or relationships. The frontend does not write to Supabase.

## Configure the Aura connection

The server-side driver accepts the following variables in the local ignored `.env` file or server secret store:

```dotenv
DOCTOR_KG_NEO4J_URI=neo4j+s://<your-aura-instance>.databases.neo4j.io
DOCTOR_KG_NEO4J_USER=neo4j
DOCTOR_KG_NEO4J_PASSWORD=<your-aura-password>
DOCTOR_KG_NEO4J_DATABASE=neo4j
```

The service falls back to the existing `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, and optional `NEO4J_DATABASE` if the Doctor KG-specific values are absent. Prefer the `DOCTOR_KG_NEO4J_*` names if the repository uses a different Neo4j instance elsewhere. Never commit the real Aura password or a secret key. Do not paste credentials into GitHub issues or chat.

The URI format above is a template, not a verified live Aura endpoint. This development environment does not have direct access to the team's local secrets or an Aura console, so the real URI/credentials and connectivity must be verified by the team locally.

## Suggested Neo4j cleanup workflow

**Do not run the original 1,410-line scratchpad as one script.** It contains old experiments, repeated graph creation commands, duplicate checks, sample patient data, and a destructive Type 1 Diabetes deletion from an earlier iteration. Run each statement separately, and review its result before continuing.

1. **Take an Aura backup/snapshot** using your team's normal process before any write operation.
2. Run `doctor_kg_audit.cypher` one query block at a time. Record the current labels, relationship counts, concept inventory, source references, duplicate reports, orphan nodes and a focused query for the selected patient.
3. Review duplicate and orphan query results. An orphan concept is not automatically wrong; a concept may be intended for later use.
4. If the ontology is missing nodes, run each query in `doctor_kg_seed_concepts.cypher` separately. It uses `MERGE` by `MedicalConcept.name`, and does not seed, replace, or delete patient observations.
5. If relationships are missing, run each query in `doctor_kg_seed_relationships.cypher` separately. It uses `MERGE` and preserves the supplied `sourceRefs` and `evidenceType` metadata. Check those reference numbers against the team's bibliography before presenting them as evidence.
6. Re-run the audit and compare the results. Confirm expected types, duplicate checks, and that patient nodes still have their observations/relationships.
7. Only after the duplicate `Patient.patientId` and `MedicalConcept.name` checks both return zero rows, consider running `doctor_kg_constraints.cypher` statement by statement.

## Type 1 Diabetes is not a cleanup target by default

The shared ontology represents general diabetes concepts, so `Type 1 Diabetes` is retained as a reusable `MedicalConcept`. A specific patient who is not Type 1 should simply not have a patient-specific `HAS_CONDITION` relationship to it. Do **not** run `DETACH DELETE` on the Type 1 concept merely to remove it from one patient's visualisation. If the audit finds a wrong patient-condition edge, review that one edge and its patient identifier first, then agree on a narrowly scoped correction with the team before modifying Aura.

## How the page relates the two data sources

- Supabase patient fields are displayed as patient-specific nodes, with source field names and raw values shown in the inspector.
- Values map to an ontology concept only when a matching concept exists in Neo4j. Missing concept mappings are not silently created in Aura.
- Recent CGM, CBG, blood-ketone, dietary and medication events are capped for visual readability; this is not a complete history export or clinical timeline.
- Concept relationships with `evidenceType = "Literature"` represent the research ontology, not a relationship measured in the selected patient's own data.
- The page marks source nodes and source properties so patient observation, ontology concepts, and connections do not get confused.

## Authentication and patient-scope dependency

The endpoint deliberately requires a trusted backend role of `doctor`, `clinician`, or `admin`. The current backend `auth.py` resolves roles from trusted `app_metadata.role` or recognized signed token claims; it must not be weakened to trust a browser-editable `user_metadata.role` value.

If sign-in succeeds but `/api/doctor/knowledge-graph` returns **403**, ask Member 3 to reconcile the token role claim with the role-assignment flow before weakening the endpoint. The frontend's visual mode alone is not authorization.

This first integration also does not add a new clinician-to-patient assignment check. Before using it with real patient data, Member 3 and Member 5 must verify that existing server-side authorization/RLS actually restricts a clinician to their assigned records. The current UI selects one record, but selected-record presentation by itself is not an access-control boundary.

## Local verification

From the repository root, install the existing backend dependencies if needed, set the Aura env variables in your local ignored environment, then run the Flask backend from `web/backend` and the Vite frontend from `web/frontend`.

1. Sign in with a doctor/admin account using the current app authentication.
2. Select a patient from the doctor workspace and open **Knowledge graph**.
3. Confirm the page's selected patient ID matches the chosen `Patient Number`.
4. Confirm the data-connection cards show Supabase and Neo4j as loaded.
5. Select several nodes and inspect their source properties and relationships.
6. In the browser Network panel, inspect `/api/doctor/knowledge-graph`: it should be a GET request with a Bearer token and patient ID, not a database write request.
7. Test a missing or invalid patient ID and a disconnected Neo4j endpoint; the UI should show a notice rather than silently fabricating Aura data.

No build/test against the team's real Aura instance has been performed from this environment. That final live check remains to be run locally with the group's actual credentials.
