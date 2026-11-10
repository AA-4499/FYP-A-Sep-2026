# Persisting the online GRU on the existing Render service

> For the alternative that requires no Render disk, follow
> [Supabase model storage](supabase-model-storage.md). The steps below apply only
> to the optional disk provider.

**Deployment action required.** No disk was purchased, attached, or configured
by this implementation. The default `render.yaml`, KG origins, Neo4j settings,
and browser inference configuration have not been changed. The deleted Medium
v3 service is not recreated.

Render's default filesystem is ephemeral. A persistent disk is available on a
paid service, and only paths under its mount survive restarts/redeployments.
See [Render persistent disks](https://render.com/docs/disks) and
[Blueprint reference](https://render.com/docs/blueprint-spec#disk).
Choose/approve the hosting cost before applying the example fragment.

## Operator steps

1. Back up any currently retrained online checkpoint **before** redeploying the
   old ephemeral service. Record its SHA-256 and keep its evaluation information.
   If it was already lost, do not claim that the bundled checkpoint is that model.
2. On the existing service that runs `web/backend/app.py`, attach a persistent
   disk at `/var/data`. Do not replace the service, its Supabase credentials,
   `VITE_API_BASE_URL`, KG origins, or Neo4j credentials. Use a disk-compatible
   hosting plan. Keep one Gunicorn worker, as in the existing configuration.
   Size CPU/memory for the cohort and benchmark training in a preview environment
   before running a large job on the shared KG/API service. Disk compatibility
   alone does not establish that the service has sufficient training memory.
3. Add these environment variables:

   ```text
   T2DM_PERSISTENT_MOUNT=/var/data
   T2DM_MODEL_DIR=/var/data/t2dm-model
   ```

   Normally leave `T2DM_CHECKPOINT_PATH` unset. If migrating a backed-up active
   model, upload the validated checkpoint to `/var/data/import/current-gru.pt`
   and temporarily set `T2DM_CHECKPOINT_PATH` to that path as the initial seed.
   It is not the mutable active release after initialization.
4. Deploy the implementation and initialize once **from the repository root**:

   ```sh
   python -m web.backend.services.model_store --initialize
   ```

   The command validates the seed checkpoint and prints its digest. Repeating
   initialization returns the existing release; it does not overwrite it with
   the bundled model. Verify the digest matches the intended seed. Importing
   the initial checkpoint does not create a fictitious training-data baseline.
5. In the Admin model page, confirm writable storage and the active digest.
   Run the first manual training when the source data is ready. It must pass
   the paired quality gate before it establishes a baseline.
6. Record the active digest and baseline count. Restart the service, then
   redeploy it, and confirm both remain unchanged. Generate a new authorised
   prediction and check its `model_sha256`. Complete the acceptance evidence.

`deploy/render-model-storage.fragment.yaml` is a fragment to merge into the
existing service configuration, **not a replacement Blueprint**. Keep existing
environment variables when adding its entries. A plain directory or an
environment-variable change without a real mounted disk does not meet the
persistence requirement.

## Files and activation transaction

```text
/var/data/t2dm-model/
  active.json                    # authoritative model, baseline and quality decision
  versions/<run UUID>/model.pt    # immutable activated checkpoint
  retraining.json                # latest job status
  .retraining-lock/              # one job across the configured single worker
  training-runs/<run UUID>/      # candidate and evaluation artifacts
```

Candidate bytes are copied and fsynced into a new immutable release. The
checkpoint, baseline, activation time and comparison become active together
through one atomic `active.json` replacement. A rejected model or pointer-write
failure leaves the previous pointer unchanged. In-flight predictions keep
using their already loaded model; subsequent requests resolve the new release.
The inference cache is keyed by immutable checkpoint path and file version.

The store checks the actual mount on Render. A missing/unwritable mount, absent
initialized release, corrupted pointer, missing checkpoint or SHA mismatch
produces a clear error. A corrupt active release is never replaced silently by
bundled weights. Storage recovery problems are isolated from startup of the
other API/KG functions; they are logged for operator attention.

After an interrupted job, startup marks it failed unless the active pointer
proves that activation already committed. Failed/rejected runs retain the prior
baseline. Checkpoint baseline files and candidate evaluation outputs are private
server data: do not attach them wholesale to Jira or publish the model directory.

## Retention and rollback

Old immutable releases are deliberately retained. Monitor disk capacity and
back it up; no automatic deletion has been enabled. Before removing old releases,
ensure they are not the active version or needed for rollback/audit. A rollback
must restore a complete verified release pointer, including its matching data
baseline, not just copy older weights over a model filename. Rollback is an
operator recovery action, not an automatic response to a bad candidate.
