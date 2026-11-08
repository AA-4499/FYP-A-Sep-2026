# Changelog

## 2026-11-08 — Finalized shared workspace UI alignment

- Ported the shared recorded-data patient dashboard and Doctor Care overview from `main` to `KnowledgeGraph`.
- Replaced the older cohort overview with the finalized patient-review dashboard, including search and review-signal filters.
- Aligned the patient home and longitudinal monitoring views with the finalized shared layout.
- Kept the KnowledgeGraph-only Doctor navigation, assigned-patient graph access, Clinical Concepts, Graph Analysis and Literature Sources workspace.
- Kept the KnowledgeGraph branch's actual clinical Lab Results view; the similarly named `main` component is saved prediction history and was not copied into the lab-results screen.
- Updated the Doctor workspace to use the finalized patient registry callback and prediction/digital-twin view.
- Added the dashboard utility tests from `main`.

The port is selective. No other branch was modified, and no model assets, prediction APIs, Aura writes or Supabase migrations were merged.

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
