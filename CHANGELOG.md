# Changelog

## 2026-11-08 — KnowledgeGraph

### Fixed: session persistence and workspace resets

- Enabled Supabase session persistence and automatic token refresh in the KnowledgeGraph frontend.
- Restored a valid saved session on application startup, while still verifying the user through Supabase Auth before showing the workspace.
- Prevented same-user token-refresh events from re-running the full session-verification flow and unmounting the current workspace. Navigating between workspace pages should no longer reset the Doctor/Patient workspace to its default page during a normal token refresh.
- Preserved explicit sign-out, password-recovery handling and fail-closed behavior if the restored session identity does not match the verified user.
- Added unit tests for session restoration, token refresh, identity mismatch and sign-out.

**Branch comparison:** the same issue was found on `main`, `TrainingModel`, `AndyTest`, `Boon` and `JodyTesting`. Those branches still had `persistSession: false` and did not accept `INITIAL_SESSION` as a restored login. This fix is on `KnowledgeGraph` only; it has not been backported to the other branches.

**Verification:** see the CI run attached to the commit containing this entry. This code change does not itself deploy the frontend.

## 2026-11-07 — KnowledgeGraph

- Added a Doctor-only, read-only literature source registry for the clinical knowledge graph.
- Added Phase 0 repository audit and TrainingModel prediction-architecture review.
- Added backend validation and tests for bibliography metadata and reference IDs.
