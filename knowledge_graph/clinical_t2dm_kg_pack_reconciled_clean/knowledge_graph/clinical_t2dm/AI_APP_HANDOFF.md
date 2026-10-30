# KG → AI → Doctor App: implementation handoff

## Architectural decision

Aura stores reusable clinical knowledge, not patient records. Supabase remains the authoritative store for `public.patient_summary` and `public.patient_detail`. Only the selected patient's relevant summary and observations are retrieved for a request. There is no scheduled import of all 109 patients, no persistent Patient node, and no CGM/insulin/meal event import into Aura.

This avoids a second patient database that could drift out of sync, avoids copying health data unnecessarily, and keeps the graph focused on explainable medical relationships. It also removes the experimental Type 1 Diabetes records from this project KG.

## Recommended runtime flow

1. The doctor selects a patient in the existing app. Use `Patient Number` as the patient record key.
2. The backend authenticates the user and verifies that the caller is a doctor/clinician allowed to use the KG. The patient data comes from the existing approved Supabase/data-service layer, never from an untrusted client-supplied clinical profile.
3. The backend maps applicable values to canonical concept names: BMI → `BMI`; fasting plasma glucose → `Fasting Plasma Glucose`; 2-hour postprandial glucose → `Postprandial Glucose`; HbA1c → `HbA1c`; glycated albumin → `Glycated Albumin`; CGM/CBG readings → `Blood Glucose`/`CGM`/`CBG`; blood ketone → `Blood Ketone`; dietary intake → `Dietary Intake`; insulin fields → `Insulin`; non-insulin agents → `Medication`; eGFR → `eGFR`. Preserve original values, units, timestamps and missingness. Do not infer missing data or silently convert units.
4. From those inputs, the backend selects relevant concept names and reads a small subgraph from Aura using a parameterized read-only Neo4j query. The query returns node/edge definitions and source IDs. The AI should get patient context from Supabase plus cited graph facts, not a database dump.
5. Only reviewed evidence edges may support generation. AI produces draft recommendations with `sourceRefs`, supporting rationale and plain-language patient text, while explicitly marking uncertainty and missing data. It must not treat a graph path as causal proof or make up citations.
6. The doctor approves, edits or declines each draft. Only recommendations the doctor explicitly shares are later returned to the patient view. Persist recommendation/review/share status through the agreed application data service (not the medical KG in Aura).
7. The doctor-only app graph can visually compose one temporary patient-context node/measurement nodes into the response for that selected patient. Those elements are assembled from Supabase data at request time and never persisted to Aura. A patient login must never receive the graph response or see a graph navigation item.

## Query pattern for the AI/backend

Use a Neo4j driver on the backend and parameter binding; never concatenate patient values or user input into Cypher. The following is a **read-only query pattern**; it returns direct relationships adjacent to supplied relevant concepts. `sourceRefs` maps to `references.json`.

    UNWIND $relevantConceptNames AS conceptName
    MATCH (anchor:MedicalConcept {name: conceptName})
    MATCH (anchor)-[r]-(neighbor:MedicalConcept)
    WHERE r.evidenceStatus = 'reviewed'
    WITH DISTINCT r, startNode(r) AS subject, endNode(r) AS object
    RETURN subject.name AS subject,
           type(r) AS predicate,
           object.name AS object,
           r.evidenceNote AS evidenceNote,
           r.sourceRefs AS sourceRefs,
           r.evidenceType AS evidenceType,
           r.evidenceStatus AS evidenceStatus,
           r.scope AS scope,
           r.schemaVersion AS schemaVersion
    ORDER BY subject, predicate, object

The seed pack initially marks relationship edges `candidate_for_review`; the AI query therefore intentionally returns no clinical edges until you/the group have reviewed the mapped claim and its cited source and explicitly changed that particular edge to `reviewed`. Do not bulk-approve all candidates. This pattern is intentionally one hop for an initial retrieval. A controlled 2-hop expansion may be added after testing that it does not create noise or imply causality. Keep retrieval bounded and filter by the selected patient’s relevant concepts; do not give the AI the whole database unnecessarily.

## Proposed response shape

    {
      "patientId": "<Patient Number>",
      "patientContext": {
        "summary": { "...": "selected fields from Supabase" },
        "observations": [ { "timestamp": "...", "field": "...", "value": 0, "unit": "..." } ]
      },
      "knowledge": {
        "schemaVersion": "t2dm-medical-kg-v1",
        "concepts": [ { "name": "...", "category": "..." } ],
        "relationships": [
          { "subject": "...", "predicate": "...", "object": "...",
            "sourceRefs": ["[17]"], "evidenceNote": "..." }
        ]
      },
      "recommendations": []
    }

This is an interface contract proposal, not an endpoint currently implemented in the repository. Patient IDs and clinical values should only be returned to authorized callers and should not be logged unnecessarily.

## Supabase field mapping observed for current schema

- `patient_summary."Patient Number"` — canonical record ID.
- `patient_summary."BMI (kg/m²)"` → `BMI`.
- `patient_summary."Fasting Plasma Glucose (mg/dl)"` → `Fasting Plasma Glucose`.
- `patient_summary."2-hour Postprandial Plasma Glucose (mg/dl)"` → `Postprandial Glucose`.
- `patient_summary."HbA1c (mmol/mol)"` → `HbA1c`; preserve mmol/mol unless the consumer explicitly requests a reviewed conversion.
- `patient_summary."Glycated Albumin (%)"` → `Glycated Albumin`.
- `patient_summary."Estimated Glomerular Filtration Rate  (ml/min/1.73m²)"` → `eGFR`.
- `patient_detail."CGM (mg / dl)"` and `"CBG (mg / dl)"` → blood glucose observations, preserving their source type.
- `patient_detail."Blood Ketone (mmol / L)"` → `Blood Ketone`.
- `patient_detail."Dietary intake"` → `Dietary Intake`.
- `patient_detail."Insulin dose - s.c."`, `"Insulin dose - i.v."`, `"CSII - bolus insulin (Novolin R, IU)"`, and `"CSII - basal insulin (Novolin R, IU / H)"` → insulin-treatment context; preserve route/delivery fields.
- `patient_detail."Non-insulin hypoglycemic agents"` → `Medication`.

Only five distinct patient IDs currently have rows in `patient_detail`, despite 109 patient-summary rows. The API must handle patients with no longitudinal detail rows without fabricating a timeline or measurements.

## Export vs live read

- **Live app/AI access:** query Aura directly via a backend-only Neo4j driver. This is preferred because it stays current and preserves query filters.
- **Offline export:** use the two queries under `cypher/verify/` to export the concept rows and relationship rows as CSV; include `references.json` and the schema version in the same private package. This is appropriate for AI prototyping, review, reproducibility or offline fallback only. Version and date each export. Do not export patient-specific data because the target Aura graph contains none.
- **Backup:** a backup of the old mixed graph is different from a cleaned KG export. Back up privately before running destructive migration, since the historical graph contains patient data and sample events. Never commit that old export into GitHub.

## Credentials and access

Keep `NEO4J_URI`, `NEO4J_USERNAME`, and `NEO4J_PASSWORD` server-side, in the backend's configured secret manager/environment. Do not add Aura credentials to Vite `VITE_*` variables, `references.json`, source code, or Git. Use read-only graph privileges for AI retrieval where the Aura plan and team setup permit; reserve write credentials for explicit, reviewed maintenance runs. Do not send the broad RLS/security findings to the KG sprint as an implementation task; those remain for the assigned groupmate, as agreed.

## Recommended API boundaries

- A doctor-only KG endpoint returns the selected patient context plus the relevant knowledge subgraph. It does not allow the browser to issue arbitrary Cypher.
- A separate recommendation service consumes the composed context and returns draft recommendations with source IDs and rationale.
- Doctor review/share state lives in the agreed application database, not Aura.
- Patient-facing endpoint returns only recommendations explicitly shared by the doctor, in plain language; it does not return graph nodes, edges, source-level ontology or clinician-only notes.
