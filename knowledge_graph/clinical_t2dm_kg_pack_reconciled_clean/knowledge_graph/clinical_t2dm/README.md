# Type 2 Diabetes Clinical Knowledge Graph — v1 candidate

## Audit reconciliation

See `AUDIT_RECONCILIATION.md` for a comparison of the 2026-10-23 read-only Aura audit results against this proposed target. This file records the observed differences; it does not approve the changes or authorize destructive cleanup.

## Status and safety boundary

This is a proposed, reviewable cleanup-and-reseed package for the existing Neo4j Aura graph. **It has not been run against Aura.** The earlier Cypher blocks were already executed in Aura, so this plan treats that graph as existing state and requires a read-only audit plus a private backup before any deletion.

The target is a **reusable, literature-backed Type 2 Diabetes clinical concept graph**, not a patient database. After cleanup, the intended persistent graph contains only `MedicalConcept` nodes and literature-backed concept-to-concept relationships. It deliberately does not persist any `Patient`, patient ID, demographic, clinical measurement, CGM/CBG observation, meal, insulin event, SHAP contribution, model prediction, or recommendation nodes.

Type 1 Diabetes is out of scope for this project KG. The v1 schema does not seed a Type 1 Diabetes concept, any Type 1 Diabetes patient, or any Type 1-specific relationship. Reference [16] remains in the supplied bibliography only for completeness and is not used by this v1 graph. Publisher metadata for the supplied hypoglycaemia reference [10] gives Jean-François Yale (not “D. J. Yale”), and publisher metadata for ADA Standards references [20] and [23]–[28] attributes the chapters to the American Diabetes Association Professional Practice Committee for Diabetes rather than the supplied “M. Bajaj et al.” shorthand; see `EVIDENCE_REVIEW_NOTES.md`. Reference [8] is explicitly about Type 1 CGM and therefore is not used to support a Type 2 CGM relationship.

## Why preserve references on relationships?

Neo4j can function without literature references, but this graph is meant to support clinician-reviewed AI recommendations. Each proposed relationship therefore stores:

- `sourceRefs`: source IDs from `references.json`, preserving the supplied bibliography numbering.
- `evidenceNote`: a cautious summary of what the references support.
- `evidenceType`: `literature`.
- `evidenceStatus`: initially `candidate_for_review`; after a human source/content check, explicitly approve each accepted relationship by changing its status to `reviewed`. No bulk approval is included.
- `scope`: `Type 2 Diabetes`.
- `schemaVersion`: `t2dm-medical-kg-v1`.

Sources are maintained in a separate JSON catalogue rather than as visible graph nodes to keep the medical graph readable. The AI/backend resolves each `sourceRefs` item through `references.json` and must retain citations when it uses a claim. Do not assign a citation to an edge unless it actually supports that edge.

## Target schema

- Node label: `MedicalConcept`
- Stable matching key: `name` (canonical display name)
- Node properties: `name`, `category`, `description`, `scope`, `sourceRefs`, `schemaVersion`
- Semantic edge types: `IS_A`, `RISK_FACTOR_FOR`, `USED_TO_ASSESS`, `ASSOCIATED_WITH`, `CONTRIBUTES_TO`, `USED_FOR_DIAGNOSIS_OF`, `ALTERNATIVE_MARKER_FOR`, `MONITORS`, `MEASURES`, `SUPPORTS_CALCULATION_OF`, `ASSESSES`, `SUPPORTS_ASSESSMENT_OF`, `INFORMS_MANAGEMENT_OF`, `REGULATES`, `USED_IN_TREATMENT_OF`

The proposed relationship list is deliberately conservative and still requires project-owner/group review before any destructive Aura migration: risk/association language is preferred over causal language, and no numerical clinical threshold is hard-coded in v1. Any future threshold must be represented as a separately reviewed clinical rule with units, population/context, effective guideline/source, and version.

The canonical node and relationship catalogues are `concept_catalog.json` and `relationship_catalog.json`. This package is a reviewed candidate design, not yet the finalized Aura state; the catalogue/source mappings require your review before migration. The Cypher seed queries mirror those catalogues. Keep them synchronized if a concept or relationship is revised.

## Before using migration scripts

1. Run **every query** under `cypher/audit/` separately. Neo4j Browser tabs may reject multiple statements in one query editor; every file here contains one query.
2. Inspect the concept/relationship results and check duplicates. If `05_duplicate_concept_names.cypher` returns any rows, **stop**. Do not run the cleanup until duplicate handling is decided.
3. Export/backup the current Aura graph privately before proceeding. The graph currently contains patient/event nodes from historical commands, so exports may contain health-related data. Do not commit an export, `.env`, Aura password, or patient data into GitHub. Use the Aura Console's supported backup/export option for your database tier and also export audit query results locally if needed.
4. Compare audit results with the target list and ensure any historical data needed elsewhere is backed up. The migration intentionally removes all non-`MedicalConcept` nodes and all pre-existing relationships, then prunes concepts outside the reviewed target allowlist. That is a **destructive full re-seed of this database**, not a cosmetic filter.
5. Only after reviewing the audit and backup, run `cypher/migration/01_delete_existing_relationships.cypher`, `02_delete_non_concept_nodes.cypher`, and `03_remove_unapproved_concepts.cypher` in order. Then create/confirm the name constraint, seed concepts, run each static relationship seed under `cypher/seed/relationships/` separately, and run the verification queries.
6. After every relationship row is reviewed, mark only accepted edges as `reviewed`, one edge at a time using the template in `cypher/review/`. The AI query intentionally retrieves only `reviewed` edges; candidate edges must not be used by AI. Do not bulk-approve all edges. See `EVIDENCE_REVIEW_NOTES.md` for publisher-terms review needed before AI use of ADA-derived facts.
7. Do not point `knowledge_graph/knowledge_graph.py` (the separate SHAP/BRFSS graph implementation) or the legacy `knowledge_graph/seed_graph.py` at this same Aura database. The latter models patient records/biomarkers and conflicts with the target boundary.

## Current database schema observations

Prior commands used `MedicalConcept(name, category, sourceRefs)` and put `sourceRefs`/`evidenceType` on relationships. They also created patient-record identifiers, readings, insulin events, meal events, foods and Type 1 Diabetes links. Specific patient-record identifiers are deliberately omitted from this public package. The cleanup scripts are designed to replace that mixed prototype with the concept-only schema. The `Patient` data remains authoritative in Supabase.

## How the app and AI should consume the graph

**Runtime — recommended.** Neo4j Aura remains the source for reusable medical knowledge. The backend uses the official Neo4j driver with server-side secrets (`NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`) and read-only access for graph reads. It fetches the selected patient summary/observations from the existing approved Supabase/data-service path, derives relevant concept names from those fields, and queries the relevant 1-hop/2-hop concept subgraph from Aura. The patient is never written back to Aura. The AI receives patient context from Supabase plus evidence-bearing graph facts from Aura. AI output is a *candidate* recommendation for doctor review, not an autonomous patient-facing decision.

**Offline export — for handoff, reproducibility or AI experiments.** Run `cypher/verify/06_export_relationship_rows.cypher` and `07_export_concept_rows.cypher` as separate queries, then export the result tables from Neo4j Browser to CSV. Keep `references.json` alongside those files and record the schema version, export date, and source commit. CSV/JSON snapshots are not the live source of truth and should not contain patient data. Do not put private exports into the repository.

## AI query contract

The backend should pass only a list of relevant concept names to a parameterized, read-only Aura query. Use the pattern in `AI_APP_HANDOFF.md`. The result includes `subject`, `predicate`, `object`, `evidenceNote`, `sourceRefs`, `evidenceType`, and `schemaVersion`. The AI query returns only relationships explicitly marked `reviewed`; the initial seed marks all edges `candidate_for_review`. The AI must not infer causation from a path, fabricate citation IDs, or convert associations into personalized diagnoses. It should pass through cited source IDs to generated draft recommendations for the doctor to review.

## App visibility and recommendation boundary

- Only authenticated doctors/clinicians should see the KG view.
- Patient-facing views must not display the graph or the raw ontology.
- Patient records remain in Supabase; only the selected patient's context is fetched.
- Graph nodes/edges added to the browser response to visualize that one selected patient are an **ephemeral response composition**, not persistent Aura nodes. The response should include data from Supabase alongside the queried clinical subgraph; never write a patient ID or measurement value to Aura.
- AI recommendations and doctor approval/share state should be persisted by the application's agreed data service (likely Supabase after the team agrees the schema), not stored as KG concepts in Aura. A patient sees only recommendations explicitly shared by their doctor, in patient-friendly wording.

## Relevant links

- [Neo4j MERGE and constraints documentation](https://neo4j.com/docs/cypher-manual/current/clauses/merge/)
- [Supabase integration in this repository](https://github.com/AA-4499/FYP-A-Sep-2026/blob/KnowledgeGraph/web/frontend/src/lib/supabase.ts)
- [Current doctor KG UI prototype](https://github.com/AA-4499/FYP-A-Sep-2026/blob/KnowledgeGraph/web/frontend/src/components/KnowledgeGraphView.tsx)

## Folder map

- `references.json` — provided clinical references and Type 2-only usage notes.
- `concept_catalog.json` — proposed canonical concept vocabulary.
- `relationship_catalog.json` — proposed edge predicates, evidence notes and source IDs; all rows remain candidates until source review.
- `cypher/audit/` — read-only inventory; run before deletion.
- `cypher/migration/` — destructive cleanup steps; do not run before backup and audit review.
- `cypher/seed/` — target concepts and literature-backed relationships.
- `cypher/verify/` — checks, counts, candidate review queue and data-only export queries.
- `cypher/ai/` — parameterized, read-only templates for relevant concept and reviewed-edge retrieval.
- `cypher/seed/relationships/` — one-query-per-file static relationship seeds, for compatibility across Neo4j versions.
- `cypher/review/` — parameterized template to approve a single reviewed relationship at a time.
- `AI_APP_HANDOFF.md` — groupmate-facing runtime/export/app contract.
