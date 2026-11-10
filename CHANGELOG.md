# Changelog

## 2026-11-08 — Finalized Admin workspace alignment

- Replaced the old browser-demo Admin shell with the live Supabase-backed Admin console from `main` / `TrainingModel`.
- Added live account management, Doctor application approvals, patient assignments, activity history, overview and settings.
- Routed Admin accounts directly to the console after Supabase Auth and database-backed `get_my_access_state` verification.
- Added the Doctor application flow and pending/rejected application states.
- Kept the KG reviewer-access page and separate `kg_reviewer` / `kg_curator` permissions.
- Omitted model retraining because its runtime is part of TrainingModel and is not yet ported.
- Added the existing Admin schema SQL as a reference; it is already provisioned in the connected project and must not be reapplied without review.


## 2026-11-08 — Controlled KG change proposals and role permissions

- Added a Doctor-facing Change proposals tab for structured concept, relationship and literature-source proposals.
- Added a reviewer queue with mandatory review notes and approve/reject/request-changes decisions.
- Added Admin-only KG reviewer/curator grant and revoke controls, separate from platform roles.
- Added Supabase tables and transactional RPC functions for proposals, decisions, permission changes and audit events.
- Added strict backend field validation. Review status, publication status, arbitrary Cypher and hard-delete commands are not proposal fields.
- Retirement is a soft proposal only. Approval does not publish to Aura; no Aura write operation is exposed.
- Added `docs/supabase_kg_change_management.sql`; it must be manually reviewed and applied to the target Supabase project before the screens can be used.
- Added backend validation and API authorization tests and documented the migration prerequisite and publication boundary.

## 2026-11-08 — Finalized shared workspace UI alignment

- Ported the shared recorded-data patient dashboard and Doctor Care overview from `main` to `KnowledgeGraph`.
- Replaced the older cohort overview with the finalized patient-review dashboard, including search and review-signal filters.
- Aligned the patient home and longitudinal monitoring views with the finalized shared layout.
- Kept the KnowledgeGraph-only Doctor navigation, assigned-patient graph access, Clinical Concepts, Graph Analysis and Literature Sources workspace.
- Kept the branch's clinical Lab Results view; the similarly named `main` component is saved prediction history and was not copied into the lab-results screen.
- Updated the Doctor workspace to use the finalized patient registry callback and prediction/digital-twin view.
- Added dashboard utility tests from `main`.

## 2026-11-08 — Session persistence and workspace reset fix

- Enabled Supabase session persistence and automatic token refresh in the KnowledgeGraph frontend.
- Restored a valid saved session on application startup, while still verifying the user through Supabase Auth before showing the workspace.
- Prevented same-user token-refresh events from re-running full session verification and unmounting the current workspace.
- Preserved explicit sign-out, password recovery, and fail-closed handling for mismatched user identities.
- Added tests for session restoration, token refresh, identity mismatch and sign-out.
- Compared all six branches; the session fix is committed to KnowledgeGraph only.

## 2026-11-07 — Literature source registry and architecture audit

- Added the Doctor-only, read-only literature source viewer for the clinical KG bibliography.
- Added Phase 0 repository audit and TrainingModel prediction-architecture review.
- Added backend bibliography validation and tests.
