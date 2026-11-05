# T2DM model training

## Retrained v3 conditional model

The default Digital twin forecast now uses the teacher-derived v3 conditional
GRU decoders (T1DM and T2DM). The legacy training commands below remain for the
previous GRU comparison tab. See the [models overview](../README.md)
for data checksums, reproducible training/export and the research boundaries.

Run from the repository root:

```powershell
python -m pip install -r models/training/requirements.txt
python -m models.training.t2dm.train_t2dm --epochs 30
python -m models.training.train_from_supabase --epochs 30 --skip-upload
```

Reports are written to `models/evaluation/t2dm/` and the inference checkpoint to `models/weights/gru_t2dm_forecaster.pt`. See [deployment instructions](../../docs/training-model-migration.md) for the React/Vercel Risk Prediction page and Flask forecasting API.

The notebook is in `t2dm/t2dm_training.ipynb`; install `requirements-notebook.txt` to use it. Personal training data is in `data/raw/t2dm_training/Shanghai_T2DM/`, and the cleaned summary is in `data/processed/t2dm/`. Local credentials are loaded from `models/training/.env` (ignored by Git), with the root `.env` as fallback.

Apply `supabase_forecast_outputs.sql` to the existing database to install the run/patient relationships and atomic forecast save RPC. The dashboard defaults to Supabase data and saves all successful forecasts; `web/backend/verify_supabase_forecast.py` verifies live read, prediction, save, readback and FK joins.

## Conditional multi-horizon research candidate

`python -m models.training.t2dm.conditional_pipeline --epochs 30 --ablate-static` trains the separate 12-hour conditional model using CGM, typed events, time and patient summary. It does not overwrite the legacy production checkpoint. See [model audit and experiment](../../docs/conditional-model-audit.md) for causal limitations, undated laboratory features, measured comparisons and the separate prediction CLI.

## Local-data medium v3 (server inference)

Run from the repository root with the Python 3 environment in
`requirements-v3.txt`:

```sh
python -m models.training.train_local_v3 --output models/evaluation/local_v3_medium_YYYYMMDD
python -m models.training.evaluate_local_v3 --run models/evaluation/local_v3_medium_YYYYMMDD
```

Use a new empty output directory for each run. Defaults are the local
`data/raw/Shanghai_T2DM` files and exact-session `Shanghai_T2DM_Summary.xlsx`.
The duplicate `data/raw/t2dm_training` directory is not concatenated. No Sample
files, downloaded teacher model weights, test errors or undated lab measurements
are used to fit this model. The initial medium run uses 64 hidden units, two GRU
layers, a 32-unit head, 40 maximum epochs, patience 8 and seed 20261106. The best
validation epoch is restored before testing.

`local_v3_inputs.py` is shared by this trainer and the server. It preserves the
original v3 carbohydrate, bolus IOB and missingness assumptions. The evaluation
command independently replays all test predictions, compares the original size
on the same held-out windows, evaluates unknown future plans, and updates the
medium registry. These are retrospective Shanghai T2DM results, not independent
external or causal validation. Review the registry/report before deployment.
The original online Admin queue is a separate legacy GRU workflow.
