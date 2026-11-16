# CGMacros auxiliary GRU results

Single-seed participant-held-out, recorded-future-input conditional prediction. This is not causal validation or Shanghai accuracy.

| Inputs | Validation subject MAE | Test 15 min | Test 30 min | Test 60 min | Test 240 min | Test 360 min |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| carbs_only | 15.736 | 6.359 | 11.124 | 16.265 | 22.306 | 23.233 |
| macros | 15.165 | 6.272 | 10.995 | 16.149 | 22.881 | 23.578 |
| macros_activity | 15.479 | 6.443 | 11.267 | 16.625 | 23.283 | 24.092 |

Lowest validation ablation: **macros**. Deployed research feature set: **macros_activity**, to retain nutrition and activity inputs; not claimed to be the lowest-error ablation. Units: mg/dL.

Source filtering retained 41 of 45 participants (28 train / 5 validation / 8 test). Test windows overlap; they are not independent people. See source audit for excluded files and reasons.

The nutrition-only gain over carbohydrate-only is small and not established as statistically significant. The full activity model is retained to preserve the requested exercise controls, even though the macros-only ablation has a lower validation error. It uses actual recorded future activity; it does not establish that editing exercise causes this glucose difference.

## T2D subgroup (source dataset, not Shanghai)

| Inputs | Participants | 15 min | 30 min | 60 min | 240 min | 360 min |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| carbs_only | 3 | 7.192 | 13.163 | 21.244 | 31.551 | 33.078 |
| macros | 3 | 7.061 | 12.953 | 20.906 | 32.975 | 33.565 |
| macros_activity | 3 | 7.299 | 13.264 | 21.324 | 32.449 | 34.037 |

No Shanghai macro/activity ground truth was provided, so additive corrections and replacement of Shanghai conditional v3 remain unvalidated. The UI offers a clearly separated, opt-in research comparison. Shanghai conditional v3 is independently retrained to the same six-hour horizon.

Reproduce: `python -m models.training.cgmacros_auxiliary --archive <ZIP> --output <empty-run-dir>`; then use matching `--run` with `models.training.evaluate_cgmacros_auxiliary` and `models.training.export_cgmacros_auxiliary`. All public parity examples are synthetic, not participant traces.
