# Chronological retraining evaluation

Target: oldest 56% / next 14% / latest 30%, separately per cohort. Closest feasible calendar cutoffs are chosen from session dates and row counts only; entire boundary-crossing sessions are purged. Exact row proportions are impossible with indivisible sessions. Earlier models are preserved.

History-only forecasts and oracle future-event conditional forecasts answer different questions. Their errors must not be interpreted as a fair unconditional model ranking. Event-conditioned errors assume future recorded annotations are known. No causal treatment-effect claim is supported.

| Cohort | Model | Evaluation | 15 min MAE | 30 min MAE | 60 min MAE | Last horizon MAE |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| ShanghaiT1DM | gru_future_event_decoder | oracle conditional | 8.37 | 15.94 | 28.07 | 67.85 (360 min) |
| ShanghaiT2DM | gru_future_event_decoder | oracle conditional | 5.96 | 10.75 | 17.52 | 30.59 (360 min) |

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
