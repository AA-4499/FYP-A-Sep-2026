# Chronological retraining evaluation

Target: oldest 56% / next 14% / latest 30%, separately per cohort. Closest feasible calendar cutoffs are chosen from session dates and row counts only; entire boundary-crossing sessions are purged. Exact row proportions are impossible with indivisible sessions. Earlier models are preserved.

History-only forecasts and oracle future-event conditional forecasts answer different questions. Their errors must not be interpreted as a fair unconditional model ranking. Event-conditioned errors assume future recorded annotations are known. No causal treatment-effect claim is supported.

| Cohort | Model | Evaluation | 15 min MAE | 30 min MAE | 60 min MAE | Last horizon MAE |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| ShanghaiT1DM | gru_glucose_2h | history only | 8.47 | 15.39 | 26.89 | 40.74 (120 min) |
| ShanghaiT1DM | gru_glucose_4h | history only | 8.50 | 15.34 | 26.89 | 52.13 (240 min) |
| ShanghaiT1DM | gru_context | history only | 8.39 | 15.76 | 27.22 | 57.36 (240 min) |
| ShanghaiT1DM | gru_context_insulin | history only | 8.37 | 16.11 | 27.63 | 58.30 (240 min) |
| ShanghaiT1DM | lstm_context_insulin | history only | 8.11 | 15.29 | 27.86 | 56.13 (240 min) |
| ShanghaiT1DM | gru_carb_iob | history only | 8.16 | 15.33 | 26.51 | 54.04 (240 min) |
| ShanghaiT1DM | lstm_carb_iob | history only | 8.19 | 15.54 | 26.78 | 56.34 (240 min) |
| ShanghaiT1DM | gru_future_event_decoder | oracle conditional | 8.28 | 15.76 | 27.90 | 60.30 (240 min) |
| ShanghaiT2DM | gru_glucose_2h | history only | 4.25 | 9.42 | 17.02 | 26.51 (120 min) |
| ShanghaiT2DM | gru_glucose_4h | history only | 4.24 | 9.44 | 17.10 | 32.35 (240 min) |
| ShanghaiT2DM | gru_context | history only | 4.25 | 9.31 | 16.60 | 29.70 (240 min) |
| ShanghaiT2DM | gru_context_insulin | history only | 4.35 | 9.36 | 16.56 | 29.55 (240 min) |
| ShanghaiT2DM | lstm_context_insulin | history only | 4.42 | 9.43 | 16.63 | 29.70 (240 min) |
| ShanghaiT2DM | gru_carb_iob | history only | 4.39 | 9.28 | 16.37 | 29.66 (240 min) |
| ShanghaiT2DM | lstm_carb_iob | history only | 4.40 | 9.33 | 16.57 | 30.15 (240 min) |
| ShanghaiT2DM | gru_future_event_decoder | oracle conditional | 4.37 | 9.35 | 16.38 | 29.42 (240 min) |

## Achieved split

| Cohort | Train rows (%) | Validation rows (%) | Test rows (%) | Purged sessions | Test patients seen / unseen in development |
| --- | ---: | ---: | ---: | ---: | --- |
| ShanghaiT1DM | 9066 (57.8%) | 2676 (17.1%) | 3953 (25.2%) | 0 | 1 / 3 |
| ShanghaiT2DM | 64657 (60.3%) | 9959 (9.3%) | 32609 (30.4%) | 5 | 0 / 35 |

## Retained feature coverage

| Cohort | Partition | Described meals | Completely mapped reference meals | Modeled boluses |
| --- | --- | ---: | ---: | ---: |
| ShanghaiT1DM | train | 264 | 12 | 273 |
| ShanghaiT1DM | validation | 61 | 1 | 99 |
| ShanghaiT1DM | test | 82 | 6 | 117 |
| ShanghaiT1DM | purged | 0 | 0 | 0 |
| ShanghaiT2DM | train | 1906 | 61 | 226 |
| ShanghaiT2DM | validation | 259 | 1 | 88 |
| ShanghaiT2DM | test | 770 | 14 | 382 |
| ShanghaiT2DM | purged | 128 | 1 | 33 |

MAE and RMSE are in mg/dL. See metrics.json for RMSE, persistence comparison, selected epochs, sample counts and seen/unseen-patient subgroup results. No test-based model selection or live activation.

Carbohydrate conversion remains limited to 96 fully mapped source meals; unmapped intake is not known zero. IOB models only identifiable rapid/regular boluses with explicit triangular action assumptions and coverage flags. Sparse basal, premixed, long-acting and IV exposure are excluded. True meal/entry availability times are not verified.

All preprocessing is fitted on retained training sessions only; all history and target windows remain inside a recording session and assigned partition. Conditional decoder future inputs contain clock and meal/insulin exposure/status features, never measured future glucose. Its recurrent structure prevents a later event from changing an earlier output.

Each checkpoint is safely reloaded and all held-out predictions recomputed. Previous patient-disjoint test errors are not directly comparable to these chronological test errors because test patients and dates differ.
