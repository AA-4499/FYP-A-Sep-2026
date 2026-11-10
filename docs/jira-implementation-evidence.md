# Jira implementation and acceptance handoff

**Date:** 10 November 2026 (Asia/Kuala_Lumpur)

**Repository:** `AA-4499/FYP-A-Sep-2026`

**Branch:** `TrainingModel`

The project owner approved the initial retraining thresholds, requested that
online acceptance and Jira updates be performed by them later, and cancelled
the poster task. No Jira transitions/comments/attachments, production account
tests, server disk provisioning, or poster changes were performed here.

## Ticket status and suggested evidence

| Jira task | Implementation | Automated local verification | Deployment / acceptance still needed |
| --- | --- | --- | --- |
| Verify End-to-End Online Prediction Deployment | Patient-scoped saved-output API, automatic frontend readback comparison, input/model/deployment fingerprints, and operator API-check script | Prediction/history permission tests, exact identity checks, complete curve readback tests | Deploy both sides, run with authorised account, check patient switching/history and visible error messages; record deployed commits |
| Define a Data-Based Retraining Policy | Approved, versioned policy and counting specification in `docs/retraining-policy.md` and `config/retraining-policy.json` | Invalid/missing data, duplicate conflicts, minimum segments, growth/interval/timeline thresholds, corrections and missing baseline tested | Project approval already recorded; use the approved specification as policy evidence |
| Add Retraining Recommendations Based on New Data | Admin progress, threshold, eligible counts, rejected-data counts, last success, manual recommendation, and protected readiness API | Count refresh/cache, permissions, accepted baseline reset, rejected/failed baseline preservation | Deploy, open Admin against real data, record initial baseline and threshold progress |
| Persist Retrained Models Across Service Restarts | Mounted-storage requirement, immutable checkpoints, atomic model+baseline pointer, restart recovery, clear storage errors, operator setup guide | Separate-process model reload; seed redeployment does not replace the active release; missing/corrupt/unwritable storage; failed pointer commit; interrupted training | Operator must attach/configure a persistent disk, initialize/migrate the active model, then restart AND redeploy to verify it |
| Add Model Quality Comparison Before Activation | Common frozen holdout, active/candidate MAE+RMSE, 0% permitted degradation, minimum 100 windows, rejected status, Admin comparison table | Real checkpoint paired evaluation plus metric rejection, insufficient holdout and no-activation regressions | Deploy; record an actual training comparison and its release decision |
| Obtain Final Poster Review and Prepare Print Submission | **Cancelled by project owner; poster already complete** | Not applicable | Do not reopen or claim a new review/print submission |
| Validate Post-Sprint Integration and Update Jira Evidence | Regression coverage, versioned policy/runbooks and this evidence map | Frontend, backend and production build results below | Operator completes online checklist, attaches sanitized evidence to the matching issue IDs, and changes Jira status according to verified acceptance |

## Automated verification record

The final test counts and source commit are recorded in
`docs/evidence/model-lifecycle-verification.json` after the final implementation
checks. The tests use synthetic/local fixtures and isolated temporary storage;
they are not proof of a production Render/Supabase session.

Commands:

```text
python -m unittest discover -s web/backend/tests
cd web/frontend
npm test
npm run build
node --check ../../scripts/verify-online-prediction.mjs
```

Local implementation checks cover:

- Cross-origin Admin preflights succeed only for configured origins; actual
  GET/POST requests still require authentication and live Admin checks.
- Active Admin checks on both training and data-readiness endpoints; ordinary
  Doctor/Patient or unauthenticated callers cannot inspect training data counts.
- Anonymous, unassigned Doctor and other-patient historical prediction access
  is denied before the service-only database reader runs.
- Exact patient filtering on CGM and saved outputs; mismatched patient, model,
  run or curves fail readback rather than showing a saved-success message.
- No baseline is fabricated when original bundled training membership is unknown.
- The 10,000 / 10% / five-timeline recommendation and seven-day interval, with
  manual start and an enforced minimum interval after the first accepted run.
- Candidate training, quality rejection, transport/training failure, interrupted
  jobs and crashes around the activation pointer keep model/baseline consistent.
- Real model evaluation uses a common holdout and rejects insufficient windows;
  neither MAE nor RMSE can be worse than the current model.
- An independent Python process reads the same active release after the seed
  changes, and missing/corrupt storage never silently selects bundled weights.

## Owner actions, in order

1. Review the code/policy change and deploy matching backend and frontend builds.
   Existing browser v3 and KG configuration remain in place. Do not restore the
   deleted Medium v3 service for these tasks.
2. Follow `model-storage-runbook.md`: make the hosting/disk decision, back up any
   existing ephemeral checkpoint, add the disk/environment values, and initialize
   once. Merely setting a checkpoint path is not durable storage.
3. Confirm the existing forecast-output and Lab Results migrations and role /
   assignment policies. The new history API does not require making private
   output tables directly readable by browser users.
4. Follow `online-prediction-acceptance.md`, including actual frontend behaviour,
   saved result readback, denied access and useful failure messages. The optional
   API script produces a sanitized JSON attachment but does not replace UI tests.
5. Run one authorised manual retraining when data/resources permit. Capture both
   metric pairs and the activation decision. An accepted first run establishes
   the baseline; rejected/failed runs leave it unchanged.
6. Verify the digest and baseline after a real restart and redeploy. Check old
   Lab Results retain their original model identity.
7. Paste the relevant implementation/evidence summary into each Jira issue.
   Use “Ready for verification” / “In progress” while production acceptance is
   pending. Mark an issue done only when its stated criteria were actually met.
   The policy ticket can cite the explicit approval; the poster ticket is cancelled.

## Attachment checklist

Attach the tested frontend/backend commit IDs, date/time, anonymized role/record
alias, run UUID, model/input digests, comparison metrics/evaluation digest,
storage restart/redeploy results, and relevant screenshots/error messages.
Never attach access tokens, service-role keys, raw patient records, entire
training snapshots, or the private persistent model directory.
