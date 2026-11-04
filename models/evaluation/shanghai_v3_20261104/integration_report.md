# Retrained v3 models

History-only and oracle-conditional evaluations answer different questions. Rows must not be ranked across these two evaluation types. All errors are mg/dL.

| Cohort | Model | Evaluation | 15m MAE | 30m MAE | 60m MAE | Last horizon MAE |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| ShanghaiT1DM | gru_glucose_2h | history only | 8.47 | 15.39 | 26.89 | 40.74 (120m) |
| ShanghaiT1DM | gru_glucose_4h | history only | 8.50 | 15.34 | 26.89 | 52.13 (240m) |
| ShanghaiT1DM | gru_context | history only | 8.39 | 15.76 | 27.22 | 57.36 (240m) |
| ShanghaiT1DM | gru_context_insulin | history only | 8.37 | 16.11 | 27.63 | 58.30 (240m) |
| ShanghaiT1DM | lstm_context_insulin | history only | 8.11 | 15.29 | 27.86 | 56.13 (240m) |
| ShanghaiT1DM | gru_carb_iob | history only | 8.16 | 15.33 | 26.51 | 54.04 (240m) |
| ShanghaiT1DM | lstm_carb_iob | history only | 8.19 | 15.54 | 26.78 | 56.34 (240m) |
| ShanghaiT1DM | gru_future_event_decoder | oracle conditional | 8.28 | 15.76 | 27.90 | 60.30 (240m) |
| ShanghaiT2DM | gru_glucose_2h | history only | 4.25 | 9.42 | 17.02 | 26.51 (120m) |
| ShanghaiT2DM | gru_glucose_4h | history only | 4.24 | 9.44 | 17.10 | 32.35 (240m) |
| ShanghaiT2DM | gru_context | history only | 4.25 | 9.31 | 16.60 | 29.70 (240m) |
| ShanghaiT2DM | gru_context_insulin | history only | 4.35 | 9.36 | 16.56 | 29.55 (240m) |
| ShanghaiT2DM | lstm_context_insulin | history only | 4.42 | 9.43 | 16.63 | 29.70 (240m) |
| ShanghaiT2DM | gru_carb_iob | history only | 4.39 | 9.28 | 16.37 | 29.66 (240m) |
| ShanghaiT2DM | lstm_carb_iob | history only | 4.40 | 9.33 | 16.57 | 30.15 (240m) |
| ShanghaiT2DM | gru_future_event_decoder | oracle conditional | 4.37 | 9.35 | 16.38 | 29.42 (240m) |

## Interpretation

- Each cohort has eight new checkpoints. The website uses the future-event decoder for explicit plan comparisons, not because it wins an unconditional test ranking.
- The original legacy checkpoint remains available in the comparison tab. Its older evaluation population differs; this report does not claim a head-to-head improvement over it.
- Additional features do not guarantee better errors at every horizon. Compare glucose/context/carb-IOB ablations within the same cohort and protocol.
- Conditional test metrics assume actual future annotations are known. Unknown-plan prospective accuracy has not been established by this run.
- Only 96 source meal descriptions map completely; basal/premixed/long-acting/IV exposure is outside estimated bolus IOB.
- cluster_bootstrap.json uses 1,000 patient-cluster resamples for aggregate MAE. Small T1DM test cohorts limit precision. These are not per-prediction uncertainty bands.
- See models/README.md for the model directory layout, training workflow and limitations.
