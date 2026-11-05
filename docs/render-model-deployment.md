# Model deployment on Render

The default v3 simulator runs its exported GRU weights in a browser worker. In
Supabase mode it needs the frontend and authorized Supabase records, not Python
inference on Render. Deploying the API does **not** switch v3 to server inference.
The API currently serves the Previous GRU online forecast and authorized local
workbook inputs. Do not point `T2DM_CHECKPOINT_PATH` at a v3 checkpoint: their
architectures and preprocessing contracts differ.

## Deploy the Python API

In Render, create a Web Service connected to `AA-4499/FYP-A-Sep-2026` (or update
the existing API service). Select branch `TrainingModel`, runtime Python 3, and
leave Root Directory empty (repository root).

Build Command:

```sh
pip install --index-url https://download.pytorch.org/whl/cpu "torch>=2.0" && pip install -r web/backend/requirements.txt
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

The previous GRU checkpoint is already committed at
`models/weights/gru_t2dm_forecaster.pt`; the API loads it by default. No separate
model upload is required. Keep existing Neo4j or other feature configuration if
the service also supports those features. Local workbook mode additionally
requires the matching source workbooks in the deployed service; use Supabase
mode when they are not present.

Deploy the selected branch. Open `https://<service>.onrender.com/api/health` and
check for JSON with `status: healthy`. This confirms the API starts, not that
model inference, Supabase access, and patient assignments all succeed.

## Connect the frontend

Set `VITE_API_BASE_URL=https://<service>.onrender.com` in the frontend hosting
environment and rebuild/redeploy the frontend. Keep `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` pointing to the same Supabase project. Never put the
backend secret in a `VITE_` variable.

For an immediate per-browser check, enter that base URL in Previous GRU's service
connection settings. Use the base URL without `/api/health`. A saved browser URL
overrides the build-time default; update it when changing services.

Sign in as a Doctor with an Admin-assigned patient, open Previous GRU, select
Supabase data / Python service, and run a forecast. A network failure suggests
URL, server availability, HTTPS or CORS; a returned 401/403 indicates an
authentication or authorization check. Inspect Render logs for server errors.

## Publish v3 weights

Build and deploy the frontend from `TrainingModel`. `npm run build` first verifies
the three exported JSON assets against the saved hashes, then includes them in
`dist/conditional-models`. The frontend host can be Render Static Site or the
existing frontend host. On Render Static Site use root `web/frontend`, build
`npm ci && npm run build`, publish directory `dist`, and rewrite `/*` to
`/index.html`. Configure the three `VITE_` variables above before building.

After publishing, open the default CGM forecast & what-if simulator with an
authorized supported record. Reload to obtain the current manifest and weights.
Future v3 retraining requires exporting matching browser assets and manifest and
redeploying the frontend; restarting the Python service does not update them.

Official references: [Flask deployment](https://render.com/docs/deploy-flask),
[Python versions](https://render.com/docs/python-version),
[health checks](https://render.com/docs/health-checks).
