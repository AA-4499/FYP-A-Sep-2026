# Operator acceptance: frontend → Render → Supabase

**Not executed during implementation, at the project owner's request.**
The code and automated local tests are separate from deployed acceptance.
Use a real authorised account; do not put passwords, JWTs, service-role keys,
raw CGM history, or identifiable patient screenshots into Jira evidence.

## Deploy prerequisites

- Deploy matching frontend and backend versions from `TrainingModel`. Record
  the actual Git commit shown by Render/Vercel, not just a branch name.
- The backend must include the new authorised history route and the frontend
  must include save/readback verification. Deploying only one side is insufficient.
- Keep the current shared API/KG origin and allowed frontend origins correct.
  Verify `SUPABASE_URL` and the existing server-only secret/service-role key.
- Install `models/training/supabase_forecast_outputs.sql` if the transactional
  forecast output tables/RPC are not already installed. Do not open these
  service-only tables to anonymous or authenticated direct reads just for a test.
- For Lab Results snapshots, confirm the existing `patient_prediction_results`
  migration and its role/assignment policies. This table is distinct from the
  transactional legacy online forecast tables.
- Configure/initialize persistent storage using `model-storage-runbook.md`
  before accepting retraining persistence. Keep Medium v3 disabled.

## Frontend flow

1. Sign in as an active Doctor with an Admin-assigned patient, or as a Patient
   linked to their own record. Record role and an anonymized test-record alias.
2. Select the exact visit; check its latest CGM timestamp and value. Open My
   digital twin → Previous GRU and choose the **Supabase/Python online** source,
   not the default browser v3 engine. Check the service address resolves to the
   existing Python backend.
3. Generate a 3-hour forecast. The backend reads that visit's data, loads the
   active release, runs inference and saves the output transactionally. The
   frontend then reads the saved output through the authorised history API and
   compares the entire output, patient, run and model version.
4. Require **Saved and retrieved from Supabase**. Record the run UUID, source,
   model SHA-256, `model_version`, `input_sha256`, forecast origin, and deployed
   `application_commit`. A health check alone is not a model-inference test.
5. Use the existing Save result action where a Lab Results snapshot is desired.
   Open Lab Results/history, switch patients, return to the tested visit, and
   confirm its original model identity and curves remain unchanged. Do not
   label a model prediction as a measured laboratory result.
6. Sign out and confirm prediction/history requests return 401. With a Doctor
   lacking that assignment, or a Patient linked to another record, require 403
   or an appropriate not-found response. Confirm the UI does not retain or show
   the previous patient's result after switching.
7. Test a service error using a local/preview browser service override pointing
   to an unavailable test endpoint, then restore it. Confirm a useful connection
   error and no fake saved-success message. Test readback unavailable separately:
   its message must explain that the prediction may already be saved. Do not
   deliberately stop the shared production KG/API service for this check.

## Optional repeatable API evidence

Run `node scripts/verify-online-prediction.mjs [evidence-file.json]` locally.
Set these environment variables in the shell/session; never commit them:

```text
E2E_API_URL                 existing Render API HTTPS origin
E2E_SUPABASE_URL            project HTTPS origin
E2E_SUPABASE_ANON_KEY       public/publishable key, not a server secret
E2E_ACCESS_TOKEN            current authorised user's short-lived access token
E2E_PATIENT_ID              exact authorised patient-visit ID
E2E_EXPECTED_MODEL_SHA256   full active checkpoint digest
E2E_EXPECTED_COMMIT         full deployed Git commit
E2E_DENIED_PATIENT_ID       optional explicitly unassigned/other patient ID
```

The script verifies the account, authorised CGM read, deployed commit, denied
anonymous request, patient/source/model identity, latest CGM origin, confirmed
save, and full output readback. It intentionally creates **one saved forecast**.
Only provide the denied-record probe for a role that must not access that record;
an Admin's cross-patient access is not a denied-access test.

The evidence file stores hashes/counts, run ID and pass/fail flags, not raw CGM
or credentials. `api_checks_passed` does **not** mean the frontend, restart,
redeployment and service-failure acceptance checks above were completed.

## Evidence entry

| Field | Operator result |
| --- | --- |
| Tested frontend/backend commit(s) | Pending |
| Frontend URL and Render service | Pending |
| Date/time and test role | Pending |
| Anonymized patient/visit alias | Pending |
| Active model SHA-256 and version | Pending |
| Run UUID and input SHA-256 | Pending |
| Save receipt and exact readback | Pending |
| Patient switching and Lab Results | Pending |
| Anonymous / unassigned / other-patient denial | Pending |
| Connection / save / readback failure messages | Pending |
| Restart and redeploy model/baseline persistence | Pending |
| Screenshots/log attachment names, without secrets | Pending |
| Acceptance decision and reviewer | Pending |
