# Unified conditional GRU v3 with physical activity

The T2DM simulator uses one jointly trained GRU checkpoint for food, supported
rapid/regular boluses, optional meal composition and physical activity. There is
no scenario-model selector and no auxiliary glucose prediction added to v3.
The T1DM checkpoint retains its existing meal/bolus contract; no T1D activity
training targets were supplied by CGMacros.

## Event workflow

1. In What-if simulator, add **Physical activity**.
2. Search an activity and optionally filter Walking, Cycling or Conditioning.
3. Choose a reference intensity preset, then enter start time and 1–120 whole
   minutes. Activities must finish within six hours and cannot overlap.
4. Run the simulation. Food, insulin and activity can share the same plan.
   Save to Lab Results preserves all inputs, model SHA and 24 future outputs.

The nine activity names/intensities are reference presets from the
[2024 Adult Compendium](https://pacompendium.com/adult-compendium/), using
[walking](https://pacompendium.com/walking/),
[cycling](https://pacompendium.com/bicycling/) and
[conditioning](https://pacompendium.com/conditioning-exercise/) entries.
CGMacros contains minute-level Fitbit METs, not named sport labels. These must
not be presented as nine separately trained sports. All presets fall within
the observed training intensity range (1.00–7.74 MET); this is intensity
coverage, not activity-specific validation.

Exercise volume is `MET × minutes` (MET-min). Above-rest volume is
`(MET − 1) × minutes`. At each 15-minute output boundary the future input uses
`1 + sum((MET − 1) × overlap_minutes) / 15` for bins touched by an activity.
This assumes rest at 1 MET outside entered intervals within a partial bin;
untouched bins remain unknown, rather than fabricated resting observations.
Activity timing and duration enter the recurrent decoder. There is no fixed
MET-min-to-mg/dL multiplier or guaranteed glucose decrease. Different presets
with identical MET/time/duration encode identical model inputs.

## Training and evaluation

Reproduce with `python -m models.training.train_integrated_v3 --output <empty directory>`
and export with `python -m models.training.export_integrated_v3 --run <directory>`.
The retained Shanghai T2DM v3 weights initialize a 15-history-feature,
17-future-feature, two-layer GRU (32 hidden units). Extra channels include
protein, fat, fiber, macro availability, MET, activity availability and insulin
source availability. CGMacros insulin administration is unavailable and is
masked, rather than treated as observed zero insulin.

Shanghai retains its whole-session calendar split. CGMacros retains the
previous participant-disjoint split and native Libre phase exclusions, using
only its HbA1c-defined T2D group: 9 train, 2 validation and 3 test participants.
There are 15,473 Shanghai / 2,153 CGMacros training windows. Domains are sampled
with equal expected weight. Training scalers use training data only; existing
normalization is retained for warm-started features. Early stopping selects
the mean validation MAE across domains, selecting epoch 1 of 8 completed.

Held-out mean MAE across the 24 horizons is 25.19 mg/dL on Shanghai T2DM and
26.31 mg/dL on CGMacros T2D. The warm-start checkpoint evaluated on the same
inputs gives 25.41 / 29.46 mg/dL respectively. These are retrospective
recorded-future-event errors, not patient bounds or causal validation. Shanghai
does not record activity/macros and CGMacros does not record administered
insulin; joint insulin/activity intervention effects remain unvalidated.

Weights, metrics, partitions, training history, source fingerprints and a
synthetic Python/JavaScript parity case are retained under
`models/evaluation/integrated_v3_20261116`. The active manifest identifies
`ShanghaiT2DMIntegrated.json`; the previous T2DM asset is retained for regression
parity, with no selectable legacy mode.

Verification: 275 frontend tests, 15 related Python tests, TypeScript checking
and production build. Real Chrome exercised the actual exported model and
worker, activity search/filter/selection, 30/45-minute duration changes,
15/30/60-minute display, two saved plans and desktop/mobile layout using
synthetic records and a local database substitute. No live database writes.
