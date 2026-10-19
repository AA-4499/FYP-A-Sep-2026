# T2DM model training

Run from the repository root:

```powershell
python -m pip install -r models/training/requirements.txt
python -m models.training.t2dm.train_t2dm --epochs 30
python -m models.training.train_from_supabase --epochs 30 --skip-upload
```

Reports are written to `models/evaluation/t2dm/` and the inference checkpoint to `models/weights/gru_t2dm_forecaster.pt`. See [deployment instructions](../../docs/training-model-migration.md) for the React/Vercel Risk Prediction page and Flask forecasting API.

The notebook is in `t2dm/t2dm_training.ipynb`; install `requirements-notebook.txt` to use it. Personal training data is in `data/raw/t2dm_training/Shanghai_T2DM/`, and the cleaned summary is in `data/processed/t2dm/`. Local credentials are loaded from `models/training/.env` (ignored by Git), with the root `.env` as fallback.

Apply `supabase_forecast_outputs.sql` to the existing database to install the run/patient relationships and atomic forecast save RPC. The dashboard defaults to Supabase data and saves all successful forecasts; `web/backend/verify_supabase_forecast.py` verifies live read, prediction, save, readback and FK joins.
