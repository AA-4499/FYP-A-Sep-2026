# Six-hour prediction and model cleanup

Implemented 2026-11-16 on TrainingModel.

## Active prediction path

- Shanghai T1DM/T2DM conditional GRU v3: `models/evaluation/conditional_6h_20261116`, exact registered weights exported to `web/frontend/public/conditional-models`.
- Each network was trained against 24 glucose targets at 15-minute intervals through six hours. Displays at 30 and 60 minutes select genuine trained outputs; they do not interpolate the old 60-to-240-minute gap.
- The CGMacros full nutrition/activity auxiliary GRU was separately retrained for the same 24 targets. Feature inputs and six-hour plan bounds are retained. The auxiliary remains a separate research comparison; no additive correction or Shanghai/causal validation is claimed.
- All 24 outputs are kept when saving, regardless of the display interval. Optional names are stored in JSON snapshots, so no new database column is required. Existing immutable saved results remain readable.

## Lab results

Saved results are a paginated list. Selecting one result shows its chart and values. Changing patient/page clears selection; late responses from another patient are ignored. Laboratory explanations, saved event inputs, model identity and prediction highlights are collapsed by default. Auxiliary predictions save to the same list with their own family and checkpoint identity.

## Cleanup

Removed 394 obsolete files (139,208,556 bytes), including the old multi-variant Shanghai run, conditional v2 experiments and weights, the previous four-hour auxiliary run, browser GRU/precomputed preview assets and unused comparison/physiology pages. Non-deployed six-hour auxiliary candidate weights were also removed after full-checkpoint evaluation; metrics, training histories, source fingerprints, split audits and synthetic parity fixtures remain.

The large new per-window prediction dumps were reduced to a 24-row example and a SHA-256/row-count audit. Aggregate errors and exact reload verification remain in metrics.json. Exports can use the compact example and training can reproduce the complete dump.

Kept `models/weights/gru_t2dm_forecaster.pt` because the active backend initialization/retraining lifecycle still depends on it; also kept the checkpoint referenced by the existing medium-v3 backend API. These are not unused UI alternatives. No backend persistence, administrator initialization or Supabase source rows were deleted.

## Data-source check

Accessible GitHub branches main, TrainingModel and KnowledgeGraph contain the CGMacros loader/documentation but not dataset files. The configured Supabase project could not expose the five documented CGMacros tables (PGRST205). Used the supplied ZIP after source checksum verification, as requested. The check does not rule out uploads to another private project. Full read-only evidence is in `models/evaluation/cgmacros_6h_20261116/source_location_verification.json`.

## Verification

Frontend suite: 261 tests. Python model suite: 52 tests. Backend suite: 158 tests. Typecheck and production build passed. Browser verification used synthetic patient records, real exported weights and a real decoder worker; database calls were intercepted locally. It covered all 24 outputs, 15/30/60-minute switches, auxiliary inference, selected saved-result display and desktop/mobile layouts. It also exercised the real auxiliary save function against the local response substitute, refreshed the list and selected the newly saved auxiliary record. The live saved-results table was checked read-only and returned HTTP 200. No synthetic records were written to the live database.
