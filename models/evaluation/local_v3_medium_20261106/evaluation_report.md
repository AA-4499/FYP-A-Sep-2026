# Local-data medium v3 evaluation

Local training: 109 source workbooks / 100 patients; 64 hidden units, two GRU layers, 32-unit output head. The original browser model is preserved.

| Model | Plan information | 15 min MAE | 30 min MAE | 60 min MAE | 240 min MAE |
| --- | --- | ---: | ---: | ---: | ---: |
| local_medium | recorded_future_events | 4.34 | 9.27 | 16.18 | 29.14 |
| local_medium | unknown_future_events | 4.34 | 9.27 | 16.34 | 30.54 |
| original_small | recorded_future_events | 4.37 | 9.35 | 16.38 | 29.42 |
| original_small | unknown_future_events | 4.36 | 9.33 | 16.52 | 30.89 |

Units: mg/dL. Persistence baseline errors and RMSE are included in medium_comparison.json. Same held-out records and windows for both model sizes. Selection used validation only.

Source coverage: 77 fully mapped meals / 3060 descriptions; 725 supported bolus annotations. Missing/unresolved intake remains unknown.

All saved test predictions were independently replayed; maximum deviation: 7.717084372416139e-05.

Both sources are Shanghai T2DM; this is not external validation.
Recorded-future evaluation assumes future annotations known. Unknown-plan results use only past exposure, not confirmed fasting.
Overlapping windows are correlated; subjects can repeat across calendar partitions.
No calibrated individual interval, causal effect or insulin dosing validation.
Only 77 completely mapped meals among 3060 meal descriptions; IOB excludes unsupported insulin.
