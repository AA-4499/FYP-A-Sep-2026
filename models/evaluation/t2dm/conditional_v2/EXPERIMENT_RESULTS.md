# Conditional GRU experiment results

All errors below are in mg/dL. One fixed seed (2026); checkpoints selected by validation trajectory MAE.

## Matched legacy comparison

Same 108 origins, one per eligible record. Future event plan unknown. Legacy recursion alignment is fixed.

| Model | 3h trajectory MAE | 6h trajectory MAE | 12h trajectory MAE |
| --- | ---: | ---: | ---: |
| Latest-CGM persistence | 22.91 | 29.77 | 34.64 |
| Legacy GRU (fixed recursion) | 22.22 | 27.66 | 29.70 |
| Conditional GRU v2, 7 summary fields | 20.55 | 22.98 | 24.77 |

## Static-context experiment

1422 test trajectories, overlapping windows within known records; not unseen-patient evaluation.

| Inputs | 3h trajectory MAE | 6h trajectory MAE | 12h trajectory MAE |
| --- | ---: | ---: | ---: |
| Without summary | 19.91 | 23.49 | 25.80 |
| 7 baseline summary fields | 19.90 | 23.16 | 25.16 |
| 23 fields incl. undated labs (retrospective only) | 19.69 | 22.92 | 24.80 |

## Scenario sensitivity

These are predictive input sensitivities on the same fixed origins, not causal treatment effects.

| Supplied input | Median maximum absolute curve change | Median signed peak change | Fraction with negative peak | Median 12h endpoint change |
| --- | ---: | ---: | ---: | ---: |
| meal_60g_at_60min | 12.334 | -11.148 | 79.6% | 0.00277 |
| meal_60g_at_120min | 12.504 | -11.659 | 84.3% | 0.00796 |
| bolus_2iu_at_60min | 5.395 | 5.395 | 0.0% | 0.00259 |

Important: a near-zero endpoint can coexist with a meaningful transient response. No sign or magnitude was artificially enforced.

Signed peak is scenario minus baseline at the point with the largest absolute change. Both meal and insulin directions remain unvalidated: the example plot includes an immediate meal-associated fall and bolus-associated rise. These failures prevent promotion as a physiological what-if simulator; nonzero sensitivity alone is insufficient. Treatment-selection confounding and coarse event labels remain unresolved. Undated laboratory measurements may not have been available at forecast time.

The legacy production checkpoint was not replaced. Both new checkpoints are experimental. See docs/conditional-model-audit.md for assumptions, remaining omissions and reproduction commands.
