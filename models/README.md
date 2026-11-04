# Models

This directory contains training code, saved checkpoints, evaluation artifacts,
model metadata, and tests for the project's glucose forecasting models.

The default Digital twin workspace uses the **v3 conditional GRU decoders**,
trained separately for ShanghaiT1DM and ShanghaiT2DM. The main chart and what-if
event editor use these decoders for baseline and scheduled scenarios, including
multiple meals and explicitly typed rapid/regular boluses. The standalone v3
comparison page is temporarily retained. The previous T2DM GRU remains available
in the legacy tab. The Admin retraining queue updates
that previous online GRU; it does not update the bundled v3 decoders.

## Folder guide

| Folder | Contents and purpose |
| --- | --- |
| [`training/`](training/) | Data loading, feature engineering, training, inference, verification, reporting, and browser export scripts. Run these modules from the repository root. |
| [`training/t2dm/`](training/t2dm/) | The original T2DM GRU pipeline and notebook, plus the earlier conditional v2 experiments, prediction tools, audits, and comparison reports. |
| [`weights/`](weights/) | The previous GRU checkpoint and earlier conditional v2 checkpoints. These are separate from the v3 run checkpoints. |
| [`evaluation/`](evaluation/) | Saved evaluation results, preprocessing contracts, prediction CSVs, training histories, source audits, and reproducibility metadata. |
| [`evaluation/t2dm/`](evaluation/t2dm/) | Results from the previous T2DM forecasting pipeline. Its `audit/` subfolder contains model/data audits; `conditional_v2/` contains the earlier conditional experiments. |
| [`evaluation/t2dm/conditional_v2/retrospective_labs/`](evaluation/t2dm/conditional_v2/retrospective_labs/) | A separate retrospective experiment including undated laboratory summary fields. It is not the default v3 model and should not be treated as prospective validation. |
| [`evaluation/shanghai_v3_20261104/`](evaluation/shanghai_v3_20261104/) | The complete v3 retraining run: 16 checkpoints, two cohort split manifests, feature coverage, conversion audits, aggregate error intervals, and evaluation reports. |
| [`registry/`](registry/) | `conditional_v3.json` catalogs the 16 v3 models, checkpoint paths/hashes, validation-based history-model selection, and held-out metrics. This file does not activate a model in Supabase. |
| [`tests/`](tests/) | Automated tests for preprocessing, insulin and meal parsing, chronological boundaries, scaling, checkpoint loading, inference, and the old/new model pipelines. |
| [`xai/`](xai/) | Documentation for planned SHAP/explainer work. This folder currently contains a README, not a trained SHAP artifact. The v3 interface instead uses explicitly labelled grouped sensitivity ablations. |

Python may create `__pycache__/` directories while running these modules. They
are ignored runtime caches, not model artifacts.

## V3 run layout

```text
evaluation/shanghai_v3_20261104/
  ShanghaiT1DM/
    <model variant>/
  ShanghaiT2DM/
    <model variant>/
  evaluation_report.md
  integration_report.md
  training_summary.json
  verification.json
  cluster_bootstrap.json
  *_split_manifest.json
  ...source, conversion, coverage and runtime audits
```

Each cohort contains the following eight variants:

| Variant folder | Purpose |
| --- | --- |
| `gru_glucose_2h/` | Glucose-only baseline with direct 15/30/60/120-minute outputs. |
| `gru_glucose_4h/` | Glucose-only baseline with direct 15/30/60/240-minute outputs. |
| `gru_context/` | Adds clock time and age/BMI context. |
| `gru_context_insulin/` | Adds recorded insulin annotations to context. Recorded insulin is distinct from estimated IOB. |
| `lstm_context_insulin/` | LSTM comparison using context and recorded insulin annotations. |
| `gru_carb_iob/` | History-only GRU with reference carbohydrate, recent recorded carbohydrate, estimated bolus IOB, and missingness/coverage flags. |
| `lstm_carb_iob/` | LSTM comparison using the carbohydrate/IOB feature set. |
| `gru_future_event_decoder/` | GRU encoder/decoder for explicit future meal and supported bolus plans. These are the two cohort models exported to the website. |

Each variant folder contains:

| File | Purpose |
| --- | --- |
| `checkpoint.pt` | Saved PyTorch state dictionary, architecture, feature definitions, scalers, and training metadata. |
| `model.json` | Portable weights and inference metadata. |
| `preprocessing_contract.json` | Required features, normalization, event assumptions, and prediction semantics. |
| `training_history.json` | Training loss and validation error by epoch. |
| `metrics.json` | Held-out errors, persistence comparison, data/window counts, and verification information. |
| `test_predictions.csv` | Saved held-out predictions and actual values at each trained horizon. |
| `test_input_example.json` | A held-out inference example and expected outputs for checkpoint replay. |

Start with [integration_report.md](evaluation/shanghai_v3_20261104/integration_report.md)
for the model comparison and [evaluation_report.md](evaluation/shanghai_v3_20261104/evaluation_report.md)
for chronological split and feature coverage details. `cluster_bootstrap.json`
contains patient-cluster bootstrap intervals for aggregate test MAE, not
individual prediction intervals.

## Other saved weights

| Checkpoint | Purpose |
| --- | --- |
| `weights/gru_t2dm_forecaster.pt` | Previous one-step T2DM GRU used by the legacy Flask/browser comparison workflow. |
| `weights/conditional_gru_v2.pt` | Earlier conditional v2 research candidate; separate from the v3 decoders. |
| `weights/conditional_gru_v2_retrospective.pt` | Earlier retrospective candidate with undated laboratory features; not a prospective clinical model. |

## Training and export

Use a Python 3 environment with
[`training/requirements-v3.txt`](training/requirements-v3.txt). The saved run used
Python 3.13.13, CPU PyTorch 2.9.1, NumPy 2.2.6, and pandas 2.3.3; see
[`runtime_environment.json`](evaluation/shanghai_v3_20261104/runtime_environment.json).
Keep the v3 training environment separate from the legacy backend environment.

Required source archives:

- [Shanghai dataset v5](https://doi.org/10.6084/m9.figshare.21600933.v5): SHA-256
  `59b5f5c4053a32bb6b7827844a0191597dc82228fe88ce332a189fdfc659c4cb`.
- [USDA SR Legacy April 2018](https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip): SHA-256
  `b80817294b8850530aaedf2e515c02593b1824f763a0ff356e5c2081643e6fd0`.

From the repository root, replace the placeholders with actual paths and a new
version name:

```text
python -m models.training.train_chronological --archive <Shanghai.zip> --nutrients <USDA.zip> --output <new-empty-run-directory>
python -m models.training.verify_chronological --run <run-directory>
python -m models.training.export_conditional_browser --run <run-directory> --archive <Shanghai.zip> --version <version-name>
python -m models.training.report_v3 --run <run-directory> --version <version-name>
python -m unittest discover -s models/tests -v
```

The default training command trains all 16 candidates, with up to 30 epochs,
validation early stopping, and training-only normalization. The independent
verifier currently expects the complete 16-model run. Preserve old runs rather
than overwriting them. If exporting a different run, update the checkpoint paths
in `web/frontend/tests/conditionalDecoder.test.mjs` before testing the release.

The exporter writes inference-only assets to
`web/frontend/public/conditional-models/`, version/hash metadata to
`web/frontend/src/lib/conditionalManifest.json`, and numerical reference fixtures
to frontend tests. Deploy the matching weights and manifest together after
running `npm test` and `npm run build` in `web/frontend`.

Hashed public JSON assets are exported as UTF-8 with LF line endings and pinned
to LF in `.gitattributes`. Their SHA-256 must describe the deployed bytes, not a
Windows CRLF working copy. The frontend's `prebuild` check rejects mismatched
assets before publication. Browser downloads include the expected digest in
the request URL to keep model versions separate in caches.

## Interpretation

The v3 decoder uses 24 consecutive 15-minute CGM readings and 16 future event
bins, with direct outputs at 15, 30, 60, and 240 minutes. It does not produce
trained 6-hour or 12-hour forecasts. Its future-event evaluation assumes recorded
future annotations are known; history-only and conditional errors answer
different questions and must not be ranked as equivalent forecasts.

Estimated IOB covers identifiable rapid/regular boluses under fixed triangular
action assumptions. It excludes basal, premixed, long-acting, intravenous, and
unresolved exposure. Meal conversion is incomplete, and missing diary entries
do not establish fasting or zero insulin. Exercise is not a trained input.
Undated laboratory measurements are displayed as recorded facts rather than
silently added to historical v3 inputs. These models support research prediction
and sensitivity comparisons, not validated causal treatment effects or insulin
dose recommendations.
