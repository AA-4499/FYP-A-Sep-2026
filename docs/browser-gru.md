# Prediction lab without Render

The temporary default is **Repository GRU · browser (no Render)**. It executes the checked-in `models/weights/gru_t2dm_forecaster.pt` weights in a Web Worker. It does not run Python on GitHub, retrain the model, substitute a generated curve, or merely display the existing baseline snapshots.

Prediction screens now require a verified **Doctor** role (the legacy `clinician` role normalizes to Doctor). Doctor Prediction lab includes its own accessible-patient selector. Changing record remounts the forecast/lab and clears previous events, ranges and results; it never grants access to records outside the database's SELECT policies. A Doctor viewing a patient's workspace retains prediction access. Real Patient accounts and anonymous previews have no prediction menu, Home simulation card or prediction page route. Online `glucose-forecast` requests additionally reject non-Doctor roles before entering the route. Admin accounts do not receive prediction permission merely by being Admin. These controls do not privatize already published model weights or record-history static assets.

Open Prediction lab and choose a 6- or 12-hour horizon (default 6). The GRU computes the baseline forecast. The clock-time event planner now uses the separate reduced physiology model for a matched no-added-event / scheduled-event comparison; the chart, table, result receipt and CSV label this switch explicitly. It does not add an arbitrary physiological offset to the GRU output. Clear the scenario to return to the GRU. The three-hour option is no longer exposed in either view; older model/API compatibility and numerical reference tests still support it. No model-service URL, model-service login, or Supabase write is needed. Database pages still read Supabase normally.

Historical training/validation/testing charts, evaluation tables and model details are grouped in a default-collapsed section at the bottom, after the prediction and simulator. The historical chart is rendered only when expanded.

## Range-first presentation (25 October 2026)

Prediction lab defaults to two shaded reference bands when sufficient supporting data exist, with a centre-estimate toggle. The centre outputs and checkpoint are unchanged; shading does not improve their predictive accuracy. The table, ending-range card and CSV include numerical outer bounds and identify the method. Historical AGP bands in Health monitoring remain observational summaries, not forecast intervals.

For the GRU, `forecastRanges.ts` matches finite held-out one-step predictions and actual CGM by timestamp within this exact record and at or before the forecast origin. Duplicate timestamps count once. With at least 30 pairs, median and 90th-percentile absolute residuals define the darker/lighter half-widths. At step h these are multiplied by sqrt(h). This is explicitly an **illustrative historical-error reference**, not an empirically calibrated multi-horizon interval. The independence/error-growth assumptions need not hold for the recursive GRU. Neither band claims 50%, 90% or any other future coverage. Missing/insufficient data yield an unavailable message and centre estimates, without substituting MAE or another patient's errors. Bounds are not clipped to glucose targets; references beyond the physiological domain are flagged.

For physiological events, `physiologyRanges.ts` runs all 27 combinations of beta response multipliers 0.5/1/1.5, sensitivity multipliers 0.75/1/1.25 and per-meal absorption-time multipliers 0.75/1/1.25. Beta response/sensitivity and absorption time stay within the reduced model's supported limits. Food amount, dose, event times, weight, reference glucose and exercise coefficients are fixed. The outer band is the min/max across the grid; the inner band is its interquartile spread. Grid settings are not a fitted posterior, equally likely virtual patients, calibrated probabilities or a complete inventory of uncertainty. The no-added-event and scheduled-event scenarios use the same varied assumptions. If any extreme setting fails, no surviving-subset band is shown, since that could hide uncertainty. Medication/stress/illness exclusions and incomplete-scenario warnings still apply.

The [ConForME multi-horizon conformal forecasting paper](https://proceedings.mlr.press/v230/galvao-lopes24a.html) is a calibration reference, not a claim that its algorithm has been implemented here. Proper probabilistic intervals require horizon-specific calibration and independent coverage evaluation using suitable patient/time-separated data. Existing one-step test diagnostics and uncalibrated physiological assumptions do not establish that validity.

The main prediction chart initially fits its vertical axis to the actual predicted range. A reference-range toggle restores the wider threshold view. Zoom changes no prediction values and does not interpolate new peaks or troughs. The existing recursive GRU can settle towards a stable value; a longer horizon does not guarantee oscillations. A link opens the separate Physiology lab for explicitly hypothetical meal-absorption/insulin-feedback scenarios. The experimental conditional checkpoint was not substituted merely to obtain a more curved plot; its documented event-direction problems remain unresolved.

## Model and input identity

- Original checkpoint SHA-256: `9e0522534ff164b07163cfb3e247a275d865348c21a2bcd2de93495bb2fe5e4b`.
- Same two-layer, 64-hidden-state GRU, nine feature columns, 24-observation window, feature normalization, delta-target normalization and Linear/GELU/Linear head. Dropout is disabled for inference, as in `model.eval()`.
- Weights are exported losslessly as little-endian float32 tensors; no extra inference dependency or GPU is required.
- Inputs are the exact matched repository workbook's latest complete history segment. There are 109 bundled record histories. An absent record is unavailable; it never falls back to a different person, visit or the current user's clinical summary.
- Repository workbook data are historical and do not refresh from Supabase. This source is called out above the chart and in model details. The model never combines the repository seed with new database observations and labels that mixture as live inference.
- Existing saved observed/training/validation/test charts and one-step metrics are reused only when patient ID, checkpoint digest and forecast origin all match. The forecast is calculated again. These GRU diagnostics do not validate the separate physiological event simulation. Missing historical diagnostics do not prevent inference and are not invented.

## Runtime and cancellation

`browserGru.ts` implements the PyTorch r/z/n gate ordering, recurrent reset-gate placement and the default GELU activation. It reproduces `forecast_from_history`, including its rolling-event features and future-event timing. Model execution runs in `browserForecast.worker.ts`, keeping the UI responsive. Changing patient, source, horizon or event request cancels and terminates the obsolete worker. Invalid tensor shapes, nonfinite values, incomplete histories and mismatched record/checkpoint identities are rejected.

References: [PyTorch GRU](https://docs.pytorch.org/docs/2.14/generated/torch.nn.GRU.html), [PyTorch GELU](https://docs.pytorch.org/docs/2.14/generated/torch.nn.GELU.html). This implementation follows those mathematical definitions; no third-party inference source was copied.

## Reproduce exports and checks

From the repository root, using the existing Python training environment:

```powershell
python -m models.training.export_browser_gru
```

This reads the existing checkpoint and workbooks, writes `web/frontend/public/browser-model/`, and generates independent PyTorch reference outputs under `web/frontend/tests/fixtures/`. It makes no cloud requests and no database writes. Static assets contain model tensors and the same record-level time-series inputs already held in the repository; no account credentials or patient demographics are exported.

From `web/frontend`:

```powershell
node --test tests/browserGru.test.mjs
npm test
npm run build
```

Numerical tests compare 3/6/12-hour baseline and legacy combined meal/insulin forecasts for two actual repository records against Python/PyTorch, with a maximum permitted deviation of 0.001 mg/dL. Legacy learned event features remain available internally for compatibility, but the updated UI uses a carbohydrate-based mechanistic scenario instead of treating food mass as carbohydrate. Tests also verify the original checkpoint digest, all bundled histories, event timing, deterministic resets, invalid events and corrupted weights. The browser regression executes the real Worker, checks scheduled physiological scenarios and complete 12-hour GRU outputs, and retains missing-record and Patient-isolation checks.

This is numerical compatibility with the existing research model, not evidence of clinical accuracy. Long-horizon forecast validity and causal treatment effects are not established by parity tests. The legacy model's food-mass and insulin feature limitations remain described in [the model audit](conditional-model-audit.md). The separate Physiology lab still uses explicit hypothetical mechanisms and is not the GRU.

`npm test` runs all `*.test.mjs` unit/numerical suites, including range tests, in CI without Chrome or a dev server. The separate `npm run test:navigation` browser regression requires Vite on port 3000 and a configured Chrome installation; it is not launched implicitly by the unit-test command.

## Switch back to cloud history later

Once the Python API is deployed, use **Service connection** or select **Supabase Cloud (online service)**. That explicit mode reads cloud history and retains the existing authenticated inference/save workflow. A failed cloud request does not silently become a repository-data prediction; use the labelled repository-model action to change modes.
