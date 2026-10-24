# Deployment truth

Facts recorded on 2026-10-25 (Asia/Kuala_Lumpur). Every row states how it was
verified, so a reader can re-run the check instead of trusting this file.

## 1. What is live

| Fact | Value | How verified |
| --- | --- | --- |
| Vercel project | `smart-diabetes-digital-twin-and-personalised-health-management-platform` | Vercel project API |
| Public URL | https://frontend-ecru-nine-89.vercel.app | HTTP GET returned 200 with the app shell |
| Production branch | `main` | Vercel project settings |
| Production deployment | `dpl_86x5yNtEfNJtFu1fm1SDToxV8VFf`, commit `09c5867`, built 2026-10-15 01:24 UTC | Vercel deployments API |
| Root Directory | `web/frontend` | Vercel project settings |
| Node.js at build | 24.x for `main`; becomes 22.x once `package.json` `engines` ships | Vercel build log |
| Custom environment variables | **none in Production, Preview or Development** | Vercel environment-variable API returned an empty list |

Because there are no `VITE_*` variables in Production, the deployed `main`
bundle has no Supabase URL/key and no model-service URL. It renders the local
fallback dataset only.

## 2. Deployment protection

| Surface | Result |
| --- | --- |
| Production alias `frontend-ecru-nine-89.vercel.app` | Public (HTTP 200) |
| Preview/fixed deployment URLs | **HTTP 401, "Protected by Vercel Authentication"** |

Consequence: work that exists only on a preview deployment cannot be opened by
a supervisor or examiner. Only whatever is promoted to production is visible.

## 3. Missing static assets return 200, not 404

```text
GET /browser-model/gru.json  ->  200, content-type text/html (the SPA shell)
```

The SPA rewrite `/(.*) -> /` catches unmatched paths, so a missing JSON asset
looks like success at the HTTP level. Any check for model or forecast assets
must assert on `content-type` (or parse the body), never on the status code.
`web/frontend/src/lib/forecastPreview.ts` already does this correctly; keep that
pattern for new assets.

## 4. Clinical data access (open issue)

The Supabase project `dgtaujhgwxmoghqdqkti` currently allows **anonymous reads**
with the publishable key:

```text
GET /rest/v1/patient_detail?select=Patient Number&limit=1&apikey=<publishable>  ->  200, one row
GET /rest/v1/patient_summary?select=Patient Number&limit=1&apikey=<publishable> ->  200, one row
```

The migrations that close this already exist in the repository and only need to
be applied, in this order:

1. `docs/supabase_doctor_role_migration.sql`
2. `docs/supabase_patient_registration.sql`
3. `docs/supabase_patient_auto_provision.sql`
4. `docs/supabase_patient_dashboard.sql`

`docs/supabase_phase2.sql` still ends with a commented-out sketch for these
tables. That comment is superseded by `supabase_patient_dashboard.sql`; do not
implement a second, competing policy set.

Do not add `VITE_SUPABASE_ANON_KEY` to Vercel Production until the anonymous
read above returns `[]` or 401.

## 5. Prototype clinical endpoints are gated

`web/backend/app.py` returns 501 with `available: false` for `timeline`,
`risk-assessment`, `xai-explanation`, `insights`, `digital-twin`, `simulate` and
`report`. The underlying heuristic modules remain in the tree, so they are
documented and tagged with a `provenance` block rather than deleted: if the 501
guard is ever removed, the response must not claim model performance it never
measured.

## 6. Deliberate mentions in grep checks

`grep -ri "auroc\|xgboost\|bilstm" web/backend` must return nothing.
`grep -ri "shap" web/backend web/frontend/src` is expected to return only
statements that say the attributions are **not** SHAP (module docstrings,
`provenance.methodology`, and the UI label "not SHAP"). Those are intentional.
Any other hit is a regression.

## 7. Not verified here

- Which branch Render builds from, and its current service state.
- Whether the applied Supabase state matches the migrations above.
- Real-browser behaviour of the in-browser GRU once promoted (it has only ever
  run on a developer machine or behind Vercel Authentication).
