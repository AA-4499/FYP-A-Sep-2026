# Supabase model storage without a Render persistent disk

This optional provider keeps immutable online GRU checkpoints and compressed
training baselines in private Supabase Storage. Postgres holds the active
version, latest job and training lease. Render uses a disposable download cache.
It does not purchase a service or require a Render disk/Shell. Supabase project
quotas and Render CPU, memory, sleep and execution limits still apply; this is
storage persistence, not a guarantee that a large training run fits free compute.

## Current handoff

On 10 November 2026, the private `model-artifacts` bucket was created in project
`dgtaujhgwxmoghqdqkti`, with a 50 MiB per-object limit. No checkpoint was uploaded,
database migration executed, or production Render/Vercel configuration changed.
Local tests use fixtures and isolated PostgreSQL, not production acceptance.
The disk provider remains the default until the environment below is selected.

## Owner steps

1. Back up any currently retrained checkpoint before redeploying an ephemeral
   service. If it is already lost, the repository seed cannot recover that model.
2. In the existing Supabase project's **SQL Editor**, run
   [`supabase_model_storage.sql`](supabase_model_storage.sql). It installs one
   private table and one service-role-only function; it does not change clinical
   tables or KG policies. A publishable/secret API key cannot execute this DDL.
3. Confirm **Storage → model-artifacts** is private. If using another project,
   create that private bucket, permit `application/octet-stream` and
   `application/gzip`, and allow the checkpoint size (the current bucket permits
   50 MiB). Never expose it with a public bucket policy.
4. On the **existing backend Render service**, deploy branch `TrainingModel`
   and add these environment variables, retaining existing KG, origin and Auth
   settings:

   ```text
   T2DM_STORAGE_BACKEND=supabase
   T2DM_STORAGE_BUCKET=model-artifacts
   SUPABASE_URL=https://dgtaujhgwxmoghqdqkti.supabase.co
   SUPABASE_SECRET_KEY=<server-only Supabase secret>
   T2DM_CACHE_DIR=/tmp/t2dm-model-cache
   ```

   No `T2DM_MODEL_DIR` or `T2DM_PERSISTENT_MOUNT` is needed for this provider.
   Remove an obsolete `T2DM_CHECKPOINT_PATH` unless deliberately importing a
   backed-up compatible checkpoint. Rotate the secret shared in chat and use its
   replacement here. Never put it in `VITE_*`, GitHub, or browser settings.
5. When the frontend owner can publish, deploy the matching frontend revision.
   Until then, code pushed to GitHub is not evidence that Vercel has updated.
   Sign in as an active Admin, open the retraining panel and click
   **Initialize model storage** once. The protected API is
   `POST /api/admin/model/storage/initialize`; no paid Render Shell is needed.
   Initialization validates/imports the bundled GRU (or explicit backup seed),
   displays its digest and leaves the unknown original training baseline unset.
   Repeating it returns the existing active version.
6. Start training manually when data is ready. The first accepted run establishes
   the baseline; later recommendations use the approved 10,000 / 10% / five
   timelines / seven-day policy. Both MAE and RMSE must pass the common holdout
   gate before model and baseline become active together.
7. Record the digest and baseline, restart and redeploy the backend, then confirm
   both are unchanged. Verify a saved prediction's `model_sha256` separately.
   These production checks remain with the owner.

## Failure and restart behaviour

The server uploads `legacy-gru/versions/<run UUID>/model.pt` and, after training,
`baseline.json.gz` without overwriting older objects. One database transaction
selects the checkpoint, baseline and comparison together after checking the
worker's lease. An upload failure, rejected candidate or expired lease leaves
the old selection unchanged. A stale worker cannot release a newer lease.

The lease lasts 15 minutes and renews every 60 seconds. A killed worker can
block another run until its lease expires; status recovery then records failure.
In-flight training itself is not resumed. Missing/corrupt remote artifacts fail
clearly instead of reverting to bundled weights. Downloads are SHA-256 checked
and can rebuild an entirely empty local cache after redeployment.

No automatic artifact deletion is configured. Monitor project quotas and retain
the active checkpoint and referenced baseline when cleaning old or orphaned
uploads. See [Supabase private downloads](https://supabase.com/docs/guides/storage/serving/downloads)
and [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

## Food composition lookup

The What-if meal editor searches the existing `public.food_composition` table
through authenticated `GET /api/food-composition?q=...`. The backend uses its
server credential; browser users do not receive it or require anonymous table
access. Existing food-table RLS is retained.

The owner confirmed **CHO is available carbohydrate per 100 g edible portion**.
For an edible portion of `P` grams, physiology uses `P × CHO / 100`; Conditional
GRU uses `P × (CHO + dietaryFiber) / 100` for its total-carbohydrate input. For
example, 200 g with CHO 25.9 and fibre 0.3 yields 51.8 g available or 52.4 g total.
Fibre is never subtracted from CHO. Unknown/trace fibre is not guessed for the
total conversion; manual entry remains available. Changing the portion forces
recalculation, and submission rejects an estimate for the wrong portion/model.
Existing model bounds apply. Frozen training food references and model weights
are unchanged.

The real table/schema was inspected successfully with server access; anonymous
lookup returned no rows. End-user online simulator acceptance was not run.
