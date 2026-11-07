# Knowledge Graph Phase 0 — baseline and branch audit

**Audit date:** 7 November 2026  
**Target branch:** `KnowledgeGraph`  
**Audited branch head:** `424ce85544b3ed69f69143edc0a42789a9f934b3`  
**Scope:** Repository and source inspection only. No Aura queries, Supabase migrations, deployments, graph writes or branch merges were performed during this audit.

## Branch and integration baseline

- The work target is `KnowledgeGraph`. `TrainingModel` and `main` were inspected as references only.
- At the audited point, `TrainingModel` was 48 commits ahead of `KnowledgeGraph`, with the KnowledgeGraph head as their common base. This is why the later prediction implementation should be ported selectively rather than merging the entire TrainingModel branch.
- `KnowledgeGraph` and `main` had diverged. No branch was rebased or merged as part of this phase.
- The repository CI workflow runs backend tests and frontend type-check, tests and build for pushes and pull requests to `KnowledgeGraph`.

## Current Knowledge Graph implementation

The Doctor workspace currently exposes three tabs:

1. **Patient graph** — a patient-specific condition graph composed from authorised application/Supabase records.
2. **Clinical concepts** — reusable `MedicalConcept` nodes and concept relationships read from Neo4j Aura.
3. **Graph analysis** — a rules-based summary by default, with an optional server-side OpenAI provider.

The shared Aura service executes read transactions for concepts and concept-to-concept relationships. It does not provide browser editing or a generic Cypher endpoint. The backend protects the Doctor endpoints with authentication; patient-specific routes additionally verify that the selected patient is assigned to the current Doctor and fail closed when assignment verification is unavailable.

The existing graph-analysis service matches recorded patient condition labels to shared concepts. It only includes relationships explicitly marked `reviewed`; candidate relationships are counted and excluded. Its optional OpenAI provider summarises the supplied graph context and is instructed not to diagnose, prescribe medication or dosage, or claim causation. It does not consume glucose-model predictions and is not the future recommendation pipeline.

## Curated evidence package and bibliography

The curated package is checked in at:

`knowledge_graph/clinical_t2dm_kg_pack_reconciled_clean/knowledge_graph/clinical_t2dm/`

This nested path is the result of extracting the archive while retaining its enclosing folders. Important files include `references.json`, `relationship_evidence_matrix.csv`, `concept_catalog.json`, `relationship_catalog.json`, `AI_APP_HANDOFF.md` and the audit, seed, verification and migration Cypher scripts.

The bibliography contains 29 structured reference entries with reference IDs, authors, title, publication, year, DOI/URL, source type and project usage notes. Graph nodes and relationships store `sourceRefs` IDs and relationship evidence notes; the bibliography is a separate repository file, not a set of source nodes in Aura.

The evidence matrix contains 42 candidate relationship rows, involving 37 distinct concept names and 15 relationship types. The package marks every proposed relationship `candidate_for_review`. This is an evidence-package count, not proof of current Aura node/relationship counts or clinical approval.

The package scope is Type 2 Diabetes. It includes publisher/bibliography reconciliation notes and a warning to check publisher terms before using affected guideline-derived material in AI/ML. The package also contains destructive migration scripts that delete existing relationships/non-concept nodes and drop legacy constraints. They must not be run merely because the package is checked in.

## Risks and implementation constraints

### Aura connection fallback needs attention

`web/backend/services/clinical_knowledge_graph_service.py` contains a fallback URI and username for the historical Aura instance (`e72f4649`) when environment variables are absent. The repository's operational notes state that the Aura instance was replaced. Before a future deployment, confirm the current Render secrets and remove or replace the historical fallback so a missing configuration cannot silently direct the service to a retired database. This Phase 0/1 change does not contact or alter Aura.

### Live service state was not independently verified

Repository inspection does not establish the live Neo4j Aura contents, whether the curated seed has been executed on the replacement instance, whether the prediction-results SQL migration is applied in Supabase, or whether the deployed Render/Vercel pair is currently using this exact commit. Those require separate authorised operational checks.

### Patient and shared medical data remain separate

Supabase remains the authoritative patient-data store. The shared Aura graph is intended for reusable medical concepts and relationships only. Patient-specific graph context should be composed at request time and not persisted as Patient/measurement/event nodes in the shared Aura database.

## Phase 1 delivered by this change

A read-only **Literature sources** tab is added to the Doctor Knowledge Graph workspace. It resolves source IDs to citation metadata from the checked-in `references.json`, displays DOI/publisher links and shows which currently loaded concepts and relationships reference each source.

The endpoint is Doctor-authenticated and validates the bibliography before returning it. The feature does not write to Neo4j or Supabase, edit the bibliography, approve evidence, or declare that a source supports a relationship. The repository file remains the source of truth for bibliography changes.

## Next phases (not implemented here)

- Controlled source and concept change proposals with role-based review.
- Reviewer decisions with rationale, immutable audit history and soft retirement.
- Versioned KG releases with backup and rollback before any application-controlled graph publication.
- Selective v3 model integration from `TrainingModel`, with model contract, cohort, feature and checkpoint-hash verification preserved.
- A separate, versioned clinical-rule layer that interprets prediction signals before KG evidence retrieval and recommendation drafting.
- Doctor approval/edit/reject and explicit patient-sharing workflows.

## Verification status

The backend source-registry service and endpoint tests are included in CI. The frontend changes are covered by the repository's TypeScript check, test suite and production build. The outcome of the new CI run should be recorded against the resulting commit before treating the feature as deployment-ready.


## Cross-branch authentication/session audit — 8 November 2026

The frontend authentication implementation was compared across all six remote branches:

| Branch | Session persistence | Initial restored session accepted? | Finding |
|---|---|---|---|
| `KnowledgeGraph` | `persistSession: false` | No | No persistent login restoration. |
| `TrainingModel` | `persistSession: false` | No | Same restore limitation; also has database access-state checks. |
| `main` | `persistSession: false` | No | Same restore limitation. |
| `AndyTest` | `persistSession: false` | No | Same restore limitation. |
| `Boon` | `persistSession: false` | No | Contains an additional password-recovery session handling path, but does not restore a normal persisted login. |
| `JodyTesting` | `persistSession: false` | No | Same restore limitation. |

The common `AuthGateway` pattern also treated same-user token-refresh events as a new session state change. Its `[session, retry]` verification effect then cleared the current user, showed the checking screen and unmounted the workspace. When verification completed, the workspace could mount again at its default page. This is a credible cause of the page-reset behaviour reported by the team.

### Fix applied on KnowledgeGraph

- Supabase auth now persists sessions in the browser and enables automatic token refresh.
- `INITIAL_SESSION` restores a saved session candidate after reload; `auth.getUser()` still verifies it before any workspace is displayed.
- Same-user `TOKEN_REFRESHED` / `USER_UPDATED` events update current user claims without changing the session state that triggers the verification effect. This keeps the current workspace mounted during normal refresh.
- Explicit sign-out, a mismatched user identity and password-recovery events retain their separate handling.
- Unit tests cover initial restoration, token refresh, identity mismatch and sign-out.

The fix is committed to `KnowledgeGraph` only. Other branches were inspected but not modified or merged. Browser local storage now contains the Supabase-managed persisted session; protect accounts and devices as usual, and use explicit sign-out on shared computers.
