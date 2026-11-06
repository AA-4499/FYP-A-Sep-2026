# Model deployment on Render

The main simulator now supports **Medium v3 / Render**, trained from the local
`data/raw/Shanghai_T2DM` workbooks, and the retained original browser v3. The
medium model is a two-layer, 64-hidden-unit GRU encoder/decoder with 82,625
parameters, supporting T2DM only. The original T1DM/T2DM browser models and
Previous GRU are preserved for comparison.

Until a Python service is deployed, the frontend defaults to the original browser
engine. Set `VITE_CONDITIONAL_ENGINE=server` and rebuild to make medium v3 the
default. The Render Blueprint already specifies this setting. There is no silent
fallback: an unavailable server is shown as an error, not a different model.

## Deploy the Python API

In Render, create a Web Service connected to `AA-4499/FYP-A-Sep-2026` (or update
the existing API service). Select branch `TrainingModel`, runtime Python 3, and
leave Root Directory empty (repository root).

Build Command:

```sh
pip install --index-url https://download.pytorch.org/whl/cpu "torch==2.9.1" && pip install -r web/backend/requirements.txt
```

Start Command:

```sh
gunicorn --chdir web/backend -w 1 --threads 2 --timeout 180 -b 0.0.0.0:$PORT app:app
```

Set the health check path to `/api/health`. Configure environment variables:

| Variable | Value |
| --- | --- |
| `PYTHON_VERSION` | `3.11.10` (matches the repository Render configuration) |
| `OMP_NUM_THREADS` | `1` |
| `SUPABASE_URL` | The same project URL as the frontend |
| `SUPABASE_SECRET_KEY` | Backend-only Supabase secret or service-role key |
| `ALLOWED_ORIGINS` | Exact frontend origin, e.g. `https://your-app.vercel.app`; comma-separated for multiple origins |

The medium checkpoint is committed at
`models/evaluation/local_v3_medium_20261106/ShanghaiT2DM/gru_future_event_decoder/checkpoint.pt`.
The new `/api/patients/<patient_id>/conditional-forecast` route loads this model
through `models/registry/local_v3_medium.json` and verifies its hash and food
reference. No separate model upload or training on Render is required.

The Previous GRU endpoint still uses `models/weights/gru_t2dm_forecaster.pt`.
Do not change `T2DM_CHECKPOINT_PATH` to a v3 checkpoint: those architectures
are different. Keep existing Neo4j or other feature configuration if
the service also supports those features. Local workbook mode additionally
requires the matching source workbooks in the deployed service; use Supabase
mode when they are not present.

Deploy the selected branch. Open `https://<service>.onrender.com/api/health` and
check for JSON with `status: healthy`. This confirms the API starts, not that
model inference, Supabase access, and patient assignments all succeed.

## Connect the frontend

Set `VITE_API_BASE_URL=https://<service>.onrender.com` in the frontend hosting
environment, set `VITE_CONDITIONAL_ENGINE=server`, and rebuild/redeploy the
frontend. Keep `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` pointing to the same Supabase project. Never put the
backend secret in a `VITE_` variable.

For an immediate per-browser check, select **Medium v3 / Render** in the main
simulator's Model selector and enter the base URL using its connection icon.
Use the base URL without `/api/health`. A saved browser URL
overrides the build-time default; update it when changing services.

Sign in as a Doctor with an Admin-assigned T2DM patient, open the main simulator,
select Medium v3 and Authorized Supabase visit, and run a forecast. Expand model
details and verify version `local-v3-medium-20261106`. Add a meal, run what-if,
and save to Lab Results; the saved snapshot includes the model version and hash.
A network failure suggests
URL, server availability, HTTPS or CORS; a returned 401/403 indicates an
authentication or authorization check. Inspect Render logs for server errors.

## Retained browser v3 and rollback

Build and deploy the frontend from `TrainingModel`. `npm run build` first verifies
the three exported JSON assets against the saved hashes, then includes them in
`dist/conditional-models`. The frontend host can be Render Static Site or the
existing frontend host. On Render Static Site use root `web/frontend`, build
`npm ci && npm run build`, publish directory `dist`, and rewrite `/*` to
`/index.html`. Configure the Supabase/API variables and
`VITE_CONDITIONAL_ENGINE=server` before building to use medium v3 by default.

After publishing, open the default CGM forecast & what-if simulator with an
authorized supported record. Reload to obtain the current manifest and weights.
Future medium retraining requires registering the new checkpoint hash, matching
feature/food contract and evaluation, then redeploying the Python service. It
does not require exporting medium weights to browser JSON. The Admin training
queue still trains the legacy GRU, not medium v3.

For rollback, select **Original v3 / browser**, or set
`VITE_CONDITIONAL_ENGINE=browser` and rebuild. The temporary v3 comparison tab
always uses the original browser model. Original browser-model retraining still
requires exporting matching JSON assets/manifest and redeploying the frontend.

Official references: [Flask deployment](https://render.com/docs/deploy-flask),
[Python versions](https://render.com/docs/python-version),
[health checks](https://render.com/docs/health-checks).

## Separate Knowledge Graph and model services

The integrated frontend can use two servers without changing the prediction
configuration:

```env
VITE_API_BASE_URL=https://your-model-service.onrender.com
VITE_CONDITIONAL_ENGINE=server
VITE_KG_API_BASE_URL=https://your-knowledge-graph-service.onrender.com
```

Set these on the frontend host (for example Vercel) and redeploy. A nonempty
`VITE_KG_API_BASE_URL` routes all Knowledge Graph requests to that dedicated
origin, independently of the saved model service connection. Leave it empty to
use the existing shared backend. Both servers must allow the frontend origin
and authenticate against the same Supabase project. Neo4j credentials belong
on the KG backend, never in frontend `VITE_` variables.

The merged Patient profile can display the Admin-assigned doctor's name. Existing
databases need the updated `docs/supabase_admin_workspace.sql` applied before
that field is available. Initial Patient setup remains compatible without an
assignment table; the final Admin migration installs the owner-scoped,
active-account dashboard RPC. Source integration does not execute any Supabase
migrations or KG migration/seed scripts against live services.
