# Shanghai T2DM CGM forecasting

This is a separate, original PyTorch GRU implementation for forecasting continuous glucose monitor (CGM) readings from the Shanghai T2DM workbooks. It does not modify the parent project or its data.

## Timeline split

- Each workbook is loaded as its own patient record timeline, using IDs such as `2001_0` and `2001_1`. Repeated patient IDs are not combined, so a second record is trained and tested separately.
- Each patient record's rows are split chronologically. The first 80% of timestamped records in that workbook form the training period, and the remaining 20% form the test period.
- `timeline_splits.csv` reports the observed row count, train row count, test row count, boundary timestamps, and window counts for each workbook, so no timestamped records are left unused between training and testing.
- Sliding windows use the preceding 24 CGM samples (6 hours at 15-minute sampling) to predict the next 15-minute CGM value. Training/validation targets use every fourth sample (a one-hour stride) to limit redundant overlapping CPU work; testing still scores every 15-minute target. Windows do not cross gaps longer than 22.5 minutes. Test evaluation is rolling one-step-ahead: observed CGM readings in the held-out period become later test-window history. This is not a free-running four-day forecast.
- The GRU learns the change from the latest observed glucose and adds that change back to the latest reading. Metrics include a persistence baseline, so model results can be compared with simply carrying the latest value forward.
- A chronological tail of each patient record's training-period windows is used for validation and early stopping. Feature scaling is fitted from rows before that record's 80% row boundary; target scaling uses training targets only.

The supplied files have different timeline lengths and some have missing calendar days. The code preserves the requested chronological order, applies the same 80/20 ordered-row split to every workbook, and reports the resulting test coverage. It fails clearly if no usable test windows exist.

## Run

The default data path is `..\data\Shanghai_T2DM` relative to this folder. The reader supports `.xlsx`, `.xls`, and `.xlsm` files; `openpyxl` reads `.xlsx`/`.xlsm`, while `xlrd` reads `.xls`. Use the project's Python environment or install packages listed in `requirements.txt`.

```powershell
python -m pip install -r .\FYP_A_new\requirements.txt
python -m FYP_A_new.train_t2dm
```

Example with explicit paths and a shorter smoke run:

```powershell
python -m FYP_A_new.train_t2dm `
  --data-dir ".\data\Shanghai_T2DM" `
  --output-dir ".\FYP_A_new\outputs" `
  --epochs 2 `
  --sequence-length 24
```

The run writes:

- `outputs\gru_t2dm_forecaster.pt` — model weights, input/target scaling values, and model configuration
- `outputs\metrics.json` — training history, split description, and held-out metrics
- `outputs\timeline_splits.csv` — per-record dates, workbooks, and sample counts
- `outputs\test_predictions.csv` — predicted and actual held-out test values and persistence baseline

The `t2dm_training.ipynb` notebook uses the same Python pipeline and plots an example held-out timeline. Run `python -m unittest discover -s .\FYP_A_new -p "test_*.py"` from the project root for the focused data/split tests.

## Use the trained model in the app

From the project root, train once and then launch the root `app.py` with Streamlit:

```powershell
python -m FYP_A_new.train_t2dm
python -m streamlit run .\app.py --server.port 8502
```

The app reads the default `data\Shanghai_T2DM` folder and the checkpoint and `test_predictions.csv` under `FYP_A_new\outputs`. It loads only this GRU; it does not use the legacy model choices or implementations in `WrongVersion`. The dashboard places the graph on the left and a what-if simulator on the right. The graph shows four lines: GRU predictions on training windows, GRU predictions on held-out test readings, actual CGM values for those test readings, and a future simulation forecast. Training predictions are generated from the loaded checkpoint and the same chronological training windows. For patient records without held-out test windows, the app explains that the test prediction and actual test lines are unavailable. Enable a meal or insulin event in the simulator to change the future forecast; with neither enabled, the simulation line is the normal no-event forecast. Meal amounts use the workbook's recorded food mass in grams (not carbohydrate grams); insulin units are scenario inputs only and are not dosing advice. Events are snapped up to the next 15-minute step on the patient record's sampling timeline. Events at the final forecast step or beyond the selected 3/6/12-hour horizon cannot affect the displayed forecast. The app recursively feeds its own predicted glucose into subsequent forecast steps.

## References and scope

- [GARNN public repository](https://github.com/ChengzhePiao/garnn_public) — reference for multivariate time-series CGM prediction. This project uses an independently written GRU baseline and does not copy the repository's implementation.
- [Shanghai diabetes diagnosis research repository](https://github.com/KartikeyBartwal/Research-Work-On-Detecting-Type-1-and-Type-2-Diabetes-via-Shanghai-Dataset) — context for the Shanghai dataset. Its diagnosis/classification task is not the target here; this project predicts future glucose values (regression).

This is a research/education model, not a medical device or a treatment, insulin-dosing, or diagnostic recommendation.
