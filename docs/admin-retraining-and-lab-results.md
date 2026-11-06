# Model retraining, saved predictions, and text size

**2026-11-04 update:** the default Digital twin now uses the retrained v3
conditional browser decoders. The Admin queue described below remains a legacy
GRU comparison service, and is explicitly labelled in the UI. Lab results now
also displays recorded laboratory measurements and text-first prediction
highlights. See the [models overview](../models/README.md) for the current model
training, export and deployment workflow.

This integration combines `AndyTesting`, `AndyTest` (including the live Admin
workspace), and `KnowledgeGraph` into `TrainingModel`.

## Doctor identity, assignments, and prediction services

Supabase Auth verifies the signed-in account, and `get_my_access_state` reads its
authoritative profile role/status. Admin assigns patients through
`admin_set_patient_assignment`; the relationship is stored in
`clinician_patient_assignments`. The Doctor workspace reads only assignment rows
for the verified user ID, then scopes clinical queries to those patient IDs.
An empty or failed assignment lookup never falls back to the full cohort.
Clinical RLS and the Python endpoints retain their own assignment checks.
Refresh the Doctor workspace after Admin changes an assignment.

Doctor-list loading and v3 browser inference use Supabase directly. They do not
require Render. The previous GRU's **Supabase data · Python service** option also
needs a reachable Python backend, configured through `VITE_MODEL_API_BASE_URL` or
Service connection, with the website allowed by CORS. A browser `Failed to fetch`
cannot by itself identify missing deployment, a wrong URL, HTTPS/network failure,
or CORS; it does not establish that Admin assignments or Supabase data are wrong.
The repository-browser comparison uses bundled historical records rather than
refreshed Supabase data.

## Deployment

1. Apply the existing account migrations in the order described in
   `supabase_admin_workspace.sql`, then apply/reapply that Admin migration. This
   version fixes anonymous clinical reads to return no rows without requiring
   access to the private profiles table.
2. Apply `docs/supabase_prediction_results.sql` after the Admin migration. It
   creates the immutable saved-results table and access policies. The migration
   is safe to rerun; it does not delete existing predictions.
3. Deploy the frontend and Python backend. Configure `VITE_MODEL_API_BASE_URL` on the
   frontend and `SUPABASE_URL` plus the server-only `SUPABASE_SECRET_KEY` on the
   backend. Existing forecast output migrations are still required for online
   inference's audit save.
4. Use the configured **one Gunicorn worker** in `render.yaml`. Background
   retraining shares the writable model directory with inference. For durable
   retrained models, mount a persistent disk and set `T2DM_CHECKPOINT_PATH` to
   a file there, for example `/var/data/models/gru_t2dm_forecaster.pt`. Without
   persistent storage, a restart or redeployment can restore the bundled model.
   Supply an initial checkpoint at that path or run Admin retraining before
   making predictions. Do not scale this in-process job runner to multiple
   instances; a separate durable task queue is required for that deployment.

## Using the features

- **Admin → Retrain model:** fetch all current Supabase CGM records, train the
  GRU for 25 epochs using the existing chronological train/validation/test
  pipeline, check that the checkpoint loads and metrics are finite, then
  atomically replace the active checkpoint. The page polls status every five
  seconds and shows the run time, sample count, held-out errors, and model digest.
  Concurrent requests are rejected. Failed training retains the active model;
  a server restart marks an interrupted job as failed so Admin can retry.
- **Digital twin:** online Supabase inference is the default and reads the active
  checkpoint on every request, with a cache keyed by its modification time.
  Browser GRU and static preview remain fixed repository snapshots and do not
  receive retrained weights. Doctor can open Physiology lab. Patient
  can use CGM prediction only for their own linked record and has no lab tab/link.
- **Save to lab results:** explicitly save a completed forecast or applied
  scenario. The snapshot includes server save time, forecast origin, event
  schedule, source, model digest, curves, results, and scenario assumptions.
  Inference's existing automatic audit storage remains separate. Saved snapshots
  are not recalculated after retraining. Client-computed simulations are labelled
  separately from GRU predictions; these entries are not measured laboratory tests.
- **Patient details → Lab results:** available to a signed-in Patient for their
  own record, the assigned Doctor, and Admin. In the patient sidebar it follows
  Knowledge graph (when available) and precedes Reports. Results are paginated.
  Direct updates/deletes and access from unrelated or suspended accounts are
  denied by database policies.
- **Settings → Text size:** available in Admin, Doctor, and Patient workspaces.
  Four sizes apply immediately to the interface and persist in this browser.

The code and database policy tests use isolated fixtures. They do not modify the
hosted Supabase schema, start production training, or deploy the application.
