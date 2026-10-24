# Prediction lab without Render

The temporary default is **Repository GRU · browser (no Render)**. It executes the checked-in `models/weights/gru_t2dm_forecaster.pt` weights in a Web Worker. It does not run Python on GitHub, retrain the model, substitute a generated curve, or merely display the existing baseline snapshots.

Open Prediction lab, choose a 3-, 6- or 12-hour horizon, and add meal/insulin events in the what-if panel. Both baseline and scenario are newly computed. No model-service URL, model-service login, or Supabase write is needed. Database pages still read Supabase normally.

## Model and input identity

- Original checkpoint SHA-256: `9e0522534ff164b07163cfb3e247a275d865348c21a2bcd2de93495bb2fe5e4b`.
- Same two-layer, 64-hidden-state GRU, nine feature columns, 24-observation window, feature normalization, delta-target normalization and Linear/GELU/Linear head. Dropout is disabled for inference, as in `model.eval()`.
- Weights are exported losslessly as little-endian float32 tensors; no extra inference dependency or GPU is required.
- Inputs are the exact matched repository workbook's latest complete history segment. There are 109 bundled record histories. An absent record is unavailable; it never falls back to a different person, visit or the current user's clinical summary.
- Repository workbook data are historical and do not refresh from Supabase. This source is called out above the chart and in model details. The model never combines the repository seed with new database observations and labels that mixture as live inference.
- Existing saved observed/training/validation/test charts and one-step metrics are reused only when patient ID, checkpoint digest and forecast origin all match. The forecast and what-if curves are always calculated again. Missing historical diagnostics do not prevent inference and are not invented.

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
npm run build
```

Numerical tests compare 3/6/12-hour baseline and combined meal/insulin forecasts for two actual repository records against Python/PyTorch, with a maximum permitted deviation of 0.001 mg/dL. Tests also verify the original checkpoint digest, all bundled histories, event timing, deterministic resets, invalid events and corrupted weights. The browser regression executes the real Worker, checks new what-if results and complete 12-hour outputs, and retains missing-record and Patient-isolation checks.

This is numerical compatibility with the existing research model, not evidence of clinical accuracy. Long-horizon forecast validity and causal treatment effects are not established by parity tests. The legacy model's food-mass and insulin feature limitations remain described in [the model audit](conditional-model-audit.md). The separate Physiology lab still uses explicit hypothetical mechanisms and is not the GRU.

## Switch back to cloud history later

Once the Python API is deployed, use **Service connection** or select **Supabase Cloud (online service)**. That explicit mode reads cloud history and retains the existing authenticated inference/save workflow. A failed cloud request does not silently become a repository-data prediction; use the labelled repository-model action to change modes.
