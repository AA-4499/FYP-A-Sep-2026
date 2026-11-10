# TrainingModel integration: 10 November 2026

The base is the `TrainingModel` branch from
`AA-4499/FYP-A-Sep-2026`, as checked out in `FYP-New/FYP-A-Sep-2026`.
The starting commit was `0eb1bd6`. The separate `FZhen2450` fork is not a
source for this integration.

## Branch review

- `KnowledgeGraph`: incorporated 29 newer commits through `eb53e98`, including
  bibliography viewing, evidence-backed change proposals, review permissions,
  reviewer administration, and session restoration.
- `Boon`: incorporated the doctor-registration branch through `d57f4d2`.
  The current database-backed Admin approval flow takes precedence over its
  older frontend registration implementation. Pending-doctor API restrictions
  and provisioning safeguards are retained.
- `main`, `AndyTest`, and `JodyTesting`: already ancestors of TrainingModel.
- `patient-right-sidebar`: discovered during the final remote refresh and
  incorporated through `465c840`. The interactive sidebar is retained, but
  generated demo recommendations are not promoted to approved patient advice.
  Its graph shows only recorded profile/measurement facts, and its advice list
  filters out drafts and recommendations belonging to another patient.

Conflict resolution retains TrainingModel's model checkpoints, browser inference,
prediction results, Admin retraining, direct Supabase assignment reads, and
patient dashboard RPC. KG navigation and reviewer administration coexist with
these features. Duplicate KG rendering introduced by the automatic merge was
removed.

No Render configuration, backend-origin resolver, model-service selection,
Neo4j credentials, or trained model weights were changed. The deleted Medium v3
service was not recreated. The stored Medium v3 implementation has a small
Pandas 3 fix: validate 15-minute spacing with timedeltas rather than assuming
integer timestamps are always nanoseconds.

## Model connection review

| Model | Current execution path | Render verification |
| --- | --- | --- |
| Conditional GRU v3, ShanghaiT1DM / ShanghaiT2DM | Default Digital Twin model; verified JSON weights run in a browser worker | Browser inference does not require a Render model service |
| Previous GRU, `gru_t2dm_forecaster.pt` | Browser worker and optional authenticated Python `/glucose-forecast` route | Python integration exists in TrainingModel; a real authenticated production prediction was not exercised |
| Medium v3, `local-v3-medium-20261106` | Checkpoint and authenticated `/conditional-forecast` code retained; default remains browser | Dedicated service was deleted by the user and was not restored |
| Neo4j clinical KG / rule-based analysis | Existing KG backend and Aura integration | This is a graph/rule service, not a trained glucose model |

The existing `diabetes-digital-twin-api-ra6x.onrender.com/api/health`
returned HTTP 200 and `status: healthy` during this review. An unauthenticated
forecast-path request returned 401, confirming authentication is enforced;
neither response proves that a checkpoint was loaded or a prediction succeeded.
One 55-second request to the separate KG health endpoint timed out; this alone
does not establish that the KG service is down.

## Validation and database boundary

- Frontend: 234 tests passed, production build passed, and all three conditional
  model/reference deployment assets passed their SHA-256 checks.
- Backend: 122 tests passed, including real GRU/Medium v3 inference and KG API
  authorization tests.
- The integration adds `docs/supabase_kg_change_management.sql`. Its live
  application was not performed or verified here. Proposal/reviewer features
  require that migration; existing graph reads do not require enabling a model
  service. No live database or Aura graph was modified during integration.
