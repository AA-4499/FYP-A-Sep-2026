# Approved data-based retraining policy

Approved by the project owner on **10 November 2026** in the implementation
task conversation. Machine-readable settings: `config/retraining-policy.json`.
This policy applies to the **previous online GRU**. It does not retrain the
default browser Conditional GRU v3, Medium v3, or the Knowledge Graph.

## Count and successful-training baseline

The primary measure is **distinct eligible CGM observations**, identified by
the complete patient-visit identifier (`Patient Number`, including visit/date)
and UTC-normalized observation timestamp. Raw database row counts, newly
registered accounts, and repeated copies of a reading do not measure growth.

An eligible observation has a nonempty exact-visit ID, a valid timestamp, and
a finite positive numeric CGM value in the dataset's mg/dL field. Missing CGM
values and timestamps are excluded, never interpolated for this count.
Timezone-naive source timestamps are interpreted as UTC, matching the API
contract; supply timezone-aware timestamps if the source uses another clock.

- Exact duplicate observations and events count once, without summing repeated
  insulin doses or meal entries.
- Conflicting CGM/event values for the same visit and timestamp exclude that
  identity until the source conflict is resolved. Exclusion can split a timeline.
- A trainable segment contains at least **40 consecutive observations** at
  15-minute spacing, with at most one second of timestamp tolerance. Forty
  observations support a 24-step history before the training/validation cut.
  Observations in shorter segments are excluded from the growth count.
- Missing optional meal/insulin fields retain the legacy GRU's zero-event
  encoding; that encoding does not establish that no exposure occurred.
- Additional eligible visit timelines and patients are secondary descriptive
  counts. Existing patients adding new observations can satisfy the policy.

Each accepted activation stores the exact eligible observation identities and
content fingerprints, eligible visit/patient counts, and a dataset SHA-256 in
the active release's baseline. Identities are hashed; progress APIs expose
counts, not observation IDs or raw patient records.

Growth is the **set difference** between current eligible observation identities
and the last accepted baseline. Edited values count as corrections, not new
observations. Deletions cannot inflate growth. A rejected, failed, interrupted,
or unsaved training run does not update the baseline.

The bundled checkpoint's original data membership cannot be reconstructed
reliably from summary metrics. Therefore initializing storage does **not** claim
a historical baseline. The first manually started, quality-accepted training
establishes the first exact baseline; progress states this explicitly until then.

## Recommendation and interval

Recommend retraining only when all conditions hold:

1. New eligible observations reach
   `max(10,000, ceil(10% × last accepted baseline's eligible observations))`.
2. Those new observations occur in at least **5 trainable exact-visit timelines**.
3. At least **7 days** have passed since the last successful activation.
4. A successful-training baseline and writable persistent model storage exist.

The recommendation never starts training. An active Admin chooses whether to
run it. The minimum seven-day interval is also enforced by the server for
manual retraining after the first accepted run. The first baseline-building run
is exempt. The growth recommendation is advisory: an Admin can train before
the growth threshold after the interval, for example after a data correction;
the data and quality checks still apply.

Counts are loaded on opening the Admin page and on **Refresh data count**,
cached for at most five minutes, and invalidated after an evaluated run.
All training uses a separately fetched, frozen in-memory dataset. Data arriving
after that snapshot remains new data for the next run.

## Quality gate before activation

Recompute both active and candidate predictions on the **same frozen
chronological 20% holdout** from each included exact visit. Candidate training
and scaler fitting exclude those holdout targets. Both checkpoints must use
the same feature contract and 24-step history. At least **100 complete held-out
windows** are required.

Both MAE and RMSE must be finite, nonnegative, and **no greater than the active
model's value**. Permitted relative degradation is **0% for each metric**.
An improvement in one metric does not compensate for deterioration in the other.
Store both metric pairs, window count, evaluation-data digest, decision and
scope in the job/release record. A comparable candidate that violates the limits
produces `rejected`, not `completed`. Invalid checkpoints or evaluation failures
produce `failed`. Both leave the current model and baseline unchanged.

This comparison is a retrospective model-release check. It does not establish
unseen-patient generalization, causal scenario validity, or clinical suitability.

## Performance monitoring

Review paired quality results whenever a candidate is trained and inspect
new-data rejection/correction counts before starting a job. Worsening errors
in a separately reviewed labelled monitoring set should prompt a data-quality
and drift investigation; they are not permission to relax the quality gate.
Automatic production drift alerting and clinical threshold calibration are not
implemented by this policy. Any future threshold change needs recorded project
approval and a versioned configuration change.
