# TrainingModel AI and prediction architecture review

**Reviewed branch:** `TrainingModel`
**Comparison point:** `KnowledgeGraph` head `424ce85544b3ed69f69143edc0a42789a9f934b3`
**Purpose:** Describe what the prediction/AI code currently does and what still needs to be built for KG-grounded recommendations. This is a repository-code review, not a clinical validation or deployment verification.

## Executive finding

`TrainingModel` contains a substantial glucose forecasting and hypothetical event-comparison system. It does **not** contain a completed pipeline that takes model predictions, retrieves approved KG evidence, generates recommendations, obtains Doctor approval and publishes shared recommendations to the patient workspace.

There are two distinct uses of AI-like functionality in the current repository:

- **Prediction models:** trained GRU/LSTM models estimate future glucose from historical CGM and supported context/event features.
- **KG graph analysis:** the KnowledgeGraph branch has an optional OpenAI-backed summarisation provider for recorded patient conditions and reviewed KG relationships. It does not consume prediction-model output or generate treatment recommendations.

They should not be described as one integrated recommender yet.

## Prediction model families and training

The chronological v3 training pipeline defines eight candidate variants for each of two cohorts, ShanghaiT1DM and ShanghaiT2DM (16 checkpoints in total):

| Variant | Model purpose |
|---|---|
| `gru_glucose_2h` | Glucose-history baseline with 15/30/60/120-minute outputs. |
| `gru_glucose_4h` | Glucose-history baseline with 15/30/60/240-minute outputs. |
| `gru_context` | Adds clock-time and age/BMI context. |
| `gru_context_insulin` | Adds recorded insulin annotation features. |
| `lstm_context_insulin` | LSTM comparison with context and insulin annotations. |
| `gru_carb_iob` | Adds mapped carbohydrate history, estimated rapid/regular bolus IOB and missingness/coverage flags. |
| `lstm_carb_iob` | LSTM comparison using carbohydrate/IOB features. |
| `gru_future_event_decoder` | Conditional GRU encoder/decoder for explicit future meal and supported bolus plans. |

The conditional v3 decoder uses 24 consecutive 15-minute CGM readings (six hours) and 16 future 15-minute event bins (four hours). It returns direct estimates at 15, 30, 60 and 240 minutes. Its history feature contract includes glucose, clock-time encodings, supported carbohydrate features, meal conversion/status flags, estimated bolus IOB, insulin annotation/exclusion flags and session warm-up status. Static context includes age and BMI with missingness handling.

Training uses chronological per-cohort partitions, train-only feature scaling/imputation, Huber loss, Adam optimisation, validation-MAE early stopping and saved checkpoint metadata. Whole sessions crossing calendar cutoffs are purged. The held-out evaluation is retrospective and reports both test performance and limitations. The saved test checkpoints are reloaded and their held-out predictions recomputed to verify inference consistency.

## What the conditional evaluation means

The future-event decoder's test evaluation is **oracle-conditional**: actual future meal and insulin annotations from the recorded dataset are available to the evaluation. This is not the same question as forecasting when future intake and insulin are unknown. The conditional metrics must not be ranked directly against history-only forecasts as if they were equivalent tasks, and they do not demonstrate causal intervention effects.

The evaluation report explicitly notes:
- Only 96 meal descriptions in the source cohort map completely to the reference-food mapping; unresolved diary entries are unknown, not zero.
- Estimated IOB covers identifiable rapid/regular boluses under fixed triangular action assumptions. Basal, premixed, long-acting, IV and unresolved exposure are excluded.
- Exercise is not a trained input.
- No randomized/causal treatment-effect validation is provided.
- Test-patient overlap differs by cohort and chronological partition; window counts are not independent patient counts.
- No calibrated per-patient prediction interval is available. Four sampled horizons do not determine every intervening value.

## Runtime path in the Doctor digital-twin workspace

The current default prediction tab in `RiskSimulationView.tsx` renders `ConditionalSimulatorPanel`, which uses the browser v3 conditional GRU by default. A temporary v3 comparison panel is also available. The older repository/online GRU path remains in a legacy tab; the Physiology Lab is a separate reduced-physiology simulator, not the trained v3 model.

The browser v3 pipeline is:

1. `conditionalSession.ts` loads the selected patient's authorised Supabase detail or an explicitly selected local workbook source.
2. `cohortForPatient` selects ShanghaiT1DM/ShanghaiT2DM from the source dataset label, or an explicit recorded diabetes-type diagnosis for older data. It does not infer cohort from glucose values or age.
3. `conditionalFeatures.ts` requires 24 consecutive valid CGM readings at 15-minute intervals; missing readings are not interpolated. It maps only fully recognised food entries and estimates IOB only for supported rapid/regular boluses.
4. `conditionalPrediction.ts` downloads the cohort model and food-reference assets, verifies their SHA-256 digests and validates the feature/model contract.
5. `conditionalPrediction.worker.ts` runs the decoder in a Web Worker, producing baseline and changed-plan predictions plus grouped sensitivity ablations.
6. `ConditionalSimulatorPanel.tsx` displays the forecast and what-if comparison and allows saving an immutable result snapshot.

The interface labels the ablations as sensitivity analysis rather than SHAP or causal explanations. Saved results are associated with patient ID, model SHA-256, model output and event summary.

## Server-side and legacy model paths

The repository also contains `medium_v3_service.py`, a server-side conditional v3 inference implementation for ShanghaiT2DM using the local-data medium checkpoint. It validates supported baseline/scenario events, loads records via the authenticated caller's Supabase token (or the explicitly selected local workbook), validates the checkpoint digest and computes model sensitivity comparisons. The v3 browser is the default in the current UI; this server model is not the default runtime.

The older `forecast_service.py` and `glucose-forecast` endpoint run the previous T2DM GRU checkpoint. Admin retraining (`retraining_service.py` and `retraining_routes.py`) retrains that legacy T2DM checkpoint and replaces it atomically after verification. It does not retrain the 16 v3 conditional models.

## Prediction persistence versus recommendations

The v3 frontend saves prediction snapshots to Supabase `patient_prediction_results`. The corresponding SQL migration defines immutable-style result records with patient ID, creator, timestamp, engine, JSON output, scenario, event summary and model SHA-256. RLS is designed to permit access to the patient, assigned Doctor or Admin. The repository contains the SQL and code, but a repository review cannot prove that the SQL has been applied to the live Supabase project.

There is no recommendation-generation service consuming those prediction snapshots and the shared KG. The older `/insights` route is deliberately blocked by backend middleware because its legacy insight implementation is not considered validated. The Patient Recommendations page currently receives an empty list; its UI is a patient-facing shell awaiting approved/shared records. Prediction highlights describe the forecast and its uncertainty but do not create recommendations.

## Current KG analysis is separate

The KnowledgeGraph branch's `knowledge_graph_analysis_service.py`:
- matches recorded condition labels to canonical shared concepts;
- includes only relationships marked `reviewed`;
- excludes `candidate_for_review` relationships;
- defaults to rules-based summaries/questions;
- can optionally use a server-side OpenAI provider with a constrained prompt.

It receives patient condition graph context plus shared graph concepts/relationships. It does not receive the v3 forecast values, does not resolve the bibliography IDs to full source records, and does not produce recommendation records for doctor approval or patient sharing.

## Proposed integration boundary for later work

The recommended future sequence is deliberately staged:

1. **Authorised patient context:** backend verifies Doctor role and patient assignment, then retrieves selected Supabase records and missingness/units/timestamps.
2. **Trusted prediction:** run the registered v3 model server-side for recommendation generation, or independently verify/reproduce the saved result. Do not treat arbitrary browser-supplied glucose values as trusted evidence.
3. **Clinical signal/rule layer:** evaluate outputs against separately reviewed, versioned rules with units, population/context, threshold, source and approval metadata. Do not turn a graph association into an executable recommendation.
4. **KG evidence retrieval:** query a small, parameterised subgraph and include only reviewed, permitted relationships. Resolve every source ID to citation metadata and preserve the exact source and KG release identifiers.
5. **Draft generation:** a rules engine and/or constrained LLM produces a traceable draft with prediction ID, model version/hash, KG release, clinical rule ID, source IDs, rationale, missing-data caveats and patient-readable wording.
6. **Doctor decision:** a user with explicit KG/recommendation reviewer permission approves, edits or rejects each draft. Approval and sharing are separate actions.
7. **Patient sharing:** only explicitly shared, approved recommendation text is returned to the patient workspace. Clinical graph internals and Doctor-only rationale remain private.

Current curated graph scope is Type 2 Diabetes. Do not apply it to ShanghaiT1DM predictions; until a Type 1 evidence graph and review process exist, Type 1 KG-grounded recommendation generation should remain unavailable.

## Selective-port recommendation

Do not merge all of `TrainingModel` into `KnowledgeGraph`. First agree with the model owner/group on the model contract, active cohort assets, data-source policy and server execution strategy. Then port the minimum required v3 model implementation, preprocessing contract, verified assets and tests as a coherent unit. Keep the older Admin retraining path separate unless the team explicitly decides to replace it.
