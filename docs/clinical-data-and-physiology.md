# Clinical data and physiology workspace

Implemented 24 October 2026. This change removes synthetic clinical results from the active cohort and Patient workspaces. It does not establish clinical validation of the prediction model.

## Verified source and data contract

The project is `dgtaujhgwxmoghqdqkti`. A read-only REST check found 111 `patient_summary` rows and 5,029 `patient_detail` rows at the time of implementation. These are observations at a point in time, not constants in the application. No database rows or policies were changed.

- All available PostgREST pages are fetched in stable identifier order. A per-response server cap is not treated as a complete dataset. Patient-only reads include the exact linked Patient Number and reject a response containing another record.
- Missing numeric values remain unavailable. HbA1c columns explicitly labelled mmol/mol use `0.09148 × value + 2.152`; fasting glucose columns labelled mg/dL use `value / 18.0182`. There is no magnitude-based unit guessing.
- Only finite, positive CGM values with valid dates are used. Duplicate timestamps are resolved deterministically. Missing dates and gaps are not filled with invented glucose.
- The overview derives counts and HbA1c distributions from accessible records. Its review signals are transparent measurement filters, not complication probabilities. Undated summary laboratories are not described as current live measurements.
- Monitoring retains actual CGM, clock-time percentile AGP, original meal annotations, and explicitly separated insulin routes/rates. The percentage of available observations in a band is labelled as a share of readings, not complete sensor wear time.
- The digital twin shows recorded physiological evidence. It does not infer pancreas, retinal or liver stress scores. The record graph contains stored attributes and identifies their source; it is not a causal or diagnostic graph.
- Reports export recorded summary fields as CSV with spreadsheet formula escaping. No synthetic predicted improvement, clinical signature or prescribed therapy is generated.
- The public research preview reads only what the existing database permissions allow. An authenticated Patient still uses the account-bound dashboard RPC and exact-record, RLS-governed reads. It cannot browse the cohort through that workspace.

The Knowledge Graph uses the interactive Cytoscape component from `origin/KnowledgeGraph` (`f7176bd`) with its filters, node details and recommendation review/share prototype. Its measurements come from the selected database record, including CGM counts and available insulin/C-peptide laboratories; conceptual links and example suggestions remain labelled as a prototype. Suggestions are isolated by record and browser session, with only approved items eligible to be shared into the patient preview. They are not sent to a real Patient account or saved to a medical record.

The patient Home page uses JodyTesting's dashboard/compact AGP work (`1445bcd`) with the subsequent missing-data protections and recommendation layout. The database source, newer monitoring/reporting pages and physiology lab remain available. Temporary authentication bypasses from the older branch are not used.

Doctor Health monitoring and Patient My health share the original KnowledgeGraph-branch longitudinal monitor, including its date-range/single-day views, calendar and daily distribution. AGP bands retain green in-range shading, orange below 70 mg/dL and red above 180 mg/dL, with a blue median; legends now match the actual fills. The same database-record adapter supplies both pages, and unavailable risk/measurements remain explicitly unassessed/unrecorded. Original meal/insulin annotations remain available underneath the monitor.

Legacy backend endpoints that generated synthetic timelines, risk probabilities, organ scores and reports now return explicit `501` unavailability. Patient directory/profile endpoints use Supabase instead of generated profiles.

## Prediction versus mechanism exploration

**CGM forecast** temporarily defaults to the [browser GRU](browser-gru.md) while Render is being configured. It runs the repository checkpoint and exact matching workbook history locally in a Worker. Repository history is clearly distinguished from fresh Supabase observations, with no database writes. Explicit **Supabase Cloud** mode still calls the authenticated Python service and requires its existing server credentials/storage setup. Cloud connection errors never silently switch input sources. The updated what-if planner computes a separately labelled physiological comparison, not a modified GRU trajectory.

The existing GRU is a next-step predictor rolled forward in 15-minute steps. A held-out one-step MAE is not evidence of validated 3-, 6- or 12-hour accuracy. The separate direct multi-step candidate already present in `models/training/t2dm/conditional_pipeline.py` remains an experimental candidate; no claim of new predictive accuracy is made here. See [the existing conditional model audit](conditional-model-audit.md).

**Physiology lab** is a new local research simulation seeded from the last recorded CGM. It runs without the Python service and does not write to clinical tables. It is deliberately labelled as an unvalidated reduced model, not the published UVA/Padova or GIM simulator, a fitted patient digital twin, an insulin prescription, or a replacement for the GRU.

Glucose-responsive endogenous insulin secretion is not a universal threshold switch. In T2D, remaining beta-cell responsiveness and tissue sensitivity vary. A later rise may result from new absorption, reduced insulin action, endogenous glucose production or other influences; it is not a required periodic rebound. A constant basal state with no new inputs therefore remains stable in this model.

### Reduced model and units

The implementation is in `web/frontend/src/lib/physiology.ts`. Numerical integration uses one-minute steps and emits five-minute samples. It follows a compartment structure rather than copying third-party source code.

- `G`: plasma-glucose surrogate, mg/dL. Initialized from the last CGM as an explicit approximation.
- `C`: sensor-glucose surrogate, mg/dL, with `dC/dt = (G-C)/10` (minutes).
- `Q1`, `Q2`: unabsorbed carbohydrate, g. An event enters `Q1`; `dQ1/dt=-Q1/tau`, `dQ2/dt=(Q1-Q2)/tau`. Absorbed glucose appearance is `0.8 × 1000 × Q2 / (tau × 1.6 × weightKg)` mg/dL/min.
- `S`: dimensionless excess endogenous insulin response. `dS/dt = (beta × max((G-Gb)/100,0)-S)/25`.
- `D1`, `D2`: hypothetical subcutaneous insulin depots, units. Each has a 55-minute transfer time; absorption feeds a relative exogenous activity state with a 60-minute decay time. The conversion factor `0.35` is an explicit, uncalibrated research assumption; these states are not measured insulin concentrations.
- `X`: relative delayed insulin action, `dX/dt=(S+E-X)/60`.
- Net glucose balance: `dG/dt = H - 0.008G - 0.008 × sensitivity × X × G + appearance`, where `H = 0.008Gb/(1+0.6X) + 0.02 × max(70-G,0)` is a simplified basal hepatic-return/counter-regulation term.

Constants are provisional assumptions with the units stated above. The model is not calibrated to this cohort. It omits many physiological processes and drug types. It does not identify beta-cell function or insulin sensitivity from CGM. The lab exposes these assumptions, the reference basal glucose and weight; recorded fasting glucose/weight initialize the controls when present, and missing values are explicitly labelled as assumed. Absorption speed is now set per meal rather than by an ineffective global control.

### Clock-time what-if planner (24 October update)

Both views use `ScenarioBuilder.tsx` and the validated schedule contract in `scenario.ts`. A dropdown adds an expandable event card. Up to 12 food/drink, rapid-insulin, activity, other medicine, stress or illness events can be scheduled. Dates and clock times are entered on the historical record's explicitly labelled UTC clock, including the next day. No device-timezone conversion or reinterpretation as today's events is made. Events must be after the seed and before the end of a 6- or 12-hour window. Drafts do not change the applied scenario until Run is pressed. The applied schedule remains visible, and changing patient, source or horizon clears obsolete scenarios.

Food description, total portion mass, available carbohydrate and assumed absorption speed are separate fields. Food names do not invent nutrient values; the user must supply carbohydrate from a label or estimate. Each meal has independent gut compartments with tau 25, 45 or 75 minutes, explicitly illustrative speed assumptions. Insulin accepts only a named hypothetical rapid-acting injection, not an arbitrary medicine converted into insulin units. No dose is prefilled or recommended.

The meal editor also offers an **explicitly selected cooked-white-rice reference**, never inferred from the free-text food name. [USDA SR28 NDB 20045](https://www.ars.usda.gov/ARSUserFiles/80400535/Data/SR/SR28/reports/sr28fg20.pdf#page=325) lists 28.17 g carbohydrate by difference and 0.4 g dietary fibre per 100 g cooked rice. The model-entry estimate subtracts fibre as a stated approximation: `portionGrams × (28.17 − 0.4) / 100`, rounded to 0.1 g. Thus 200 g cooked rice supplies a reference estimate of 55.5 g, rather than 200 g, carbohydrate. The preset is for an entire cooked-white-rice portion, not dry rice, mixed meals or a measured nutrient assay; cooking water and recipes vary. Portion edits update the estimate, and applied receipts record its source. Manual entry remains available, with a unit-check hint for entries that are at least 90% carbohydrate by food mass. This hint is not a universal food-composition rule and does not block concentrated carbohydrate foods.

Domain failures now report the elapsed minute and simulated plasma-glucose value, distinct from measured patient CGM. The 20–600 mg/dL limit and numerical equations are unchanged. A failed draft is not marked applied: the main chart displays a prominent explanation and identifies either the untouched GRU baseline or the last successfully applied schedule still shown. Existing successful values are retained on a failed retry. Reset clears both the applied scenario and failure state. Regression cases reproduce record `2097_0_20201116`, whose repository seed is 217.8 mg/dL at 2020-11-30 09:30: entering 200 g carbohydrate at +120 min leaves the model domain under the test assumptions, while explicitly converting a 200 g cooked-rice portion produces a finite scenario. Successful computation does not validate this reduced model's glucose magnitudes.

Activity adds a provisional uptake term while active: `0.002G` mg/dL/min for moderate aerobic activity, or `0.001G` plus `0.45` mg/dL/min of hepatic stress release for intense activity. Overlapping activities do not stack these coefficients. These constants illustrate distinct mechanisms; they are not derived from a fitted exercise model and do not establish direction or magnitude for a real patient. The model currently omits delayed exercise effects. The [ADA explanation of exercise-related rises](https://diabetes.org/health-wellness/fitness/why-does-exercise-sometimes-raise-blood-sugar) supports the mechanisms, not these numerical coefficients.

Other medicines (name/formulation, time, mg dose), stress and illness are **context only**, excluded from numeric integration, and produce prominent **Incomplete scenario** labels above the chart and in the applied schedule. Medication-only scenarios cannot estimate a medicine response. [NIDDK's medicine overview](https://www.niddk.nih.gov/health-information/diabetes/overview/insulin-medicines-treatments) distinguishes drug mechanisms; a medicine name and dose do not identify a patient-specific pharmacodynamic response. There is deliberately no generic immediate drug-related glucose drop.

In CGM forecast, running the planner switches the plotted curves and table to a matched reduced-physiology baseline/scenario seeded from the **same selected forecast record**. The initial no-event reference defaults to the seed glucose bounded to 60–250 mg/dL, so neutral physiological balance is an explicit starting assumption, not a prediction of stable fasting glucose. Recorded weight is used only if within 30–250 kg; otherwise 70 kg is assumed. Beta response 0.5, sensitivity 0.7 and zero residual gut contents/injected insulin are hypothetical defaults. The reference, weight, beta response and sensitivity are editable in the assumptions foldout and require rerunning; applied values are shown in the result receipt. Curves use one-minute integration and are sampled every 15 minutes. GRU historical metrics remain labelled separately. CSV identifies the engine. No physiological scenario is saved through the online GRU forecast-storage API.

The dedicated Physiology lab still seeds from actual selected database CGM and uses its visible fasting-reference/weight controls. Its applied event schedule is fixed until Run, while the advanced assumption controls update that scenario immediately. Neither view implements the validated GIM/UVA-Padova equations or infers insulin requirements. [CDC's liver explanation](https://www.cdc.gov/diabetes/diabetes-complications/type-2-diabetes-liver-disease.html) also clarifies why glucose can rise without eating: endogenous hepatic production remains relevant. No periodic rebound or arbitrary display-only peak is imposed.

The simulation rejects invalid events and stops outside its stated numerical domain instead of clipping an implausible curve into a convincing-looking flat result. Event effects cannot precede their event time. Changing the horizon clears events that may no longer fit. The lab never automatically selects an insulin dose.

## Research and product references

1. [Dalla Man et al., GIM: Simulation Software of Meal Glucose–Insulin Model, 2007](https://pmc.ncbi.nlm.nih.gov/articles/PMC2769591/). Supports separating meal absorption, glucose kinetics, insulin secretion and insulin action; includes normal, T1D and T2D simulation contexts. Our reduced model is inspired by this structure, not its validated implementation or fitted parameter sets.
2. [Dalla Man, Rizza and Cobelli, Meal Simulation Model of the Glucose–Insulin System, 2007](https://www.research.unipd.it/handle/11577/2471009?mode=complete). Physiological flux/compartment modelling reference, including endogenous production and secretion. DOI: 10.1109/TBME.2007.893506.
3. [NIDDK diabetes mathematical models](https://www.niddk.nih.gov/research-funding/at-niddk/labs-branches/laboratory-biological-modeling/mathematical-models/diabetes-models). Explains the interaction of insulin resistance and impaired beta-cell compensation, with links to research implementations. CGM alone cannot uniquely identify these latent mechanisms.
4. [simglucose GitHub](https://github.com/jxx123/simglucose). Reviewed as an open research simulator. It targets T1D; directly treating its physiology as a T2D endogenous-insulin model would be inappropriate. Its open implementation is not a regulatory approval of this application.
5. [Tidepool provider workflow](https://www.tidepool.org/providers/how-it-works) and [Tidepool's Blip repository](https://github.com/tidepool-org/blip). Inspired the combined observation/insulin/meal context, cohort-to-record navigation, and explicit record summaries. No Tidepool code was copied.
6. [Twin Health](https://usa.twinhealth.com/). Product reference for personalized sensor-informed context and care-team workflow. Its proprietary model and outcome claims are not evidence that our model is validated.
7. [International Consensus on Time in Range, 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6973648/). Reference for glucose bands and checking recording coverage before clinical interpretation. Individual targets vary.

## Verification and deployment

- Frontend: `node --test tests/*.test.mjs`, `npm run build`.
- Browser: start Vite on port 3000, then `npm run test:navigation`; set `CHROME_PATH` for a nonstandard Chrome installation. Browser fixtures are local, synthetic test records and do not write to the real project.
- Backend: `python -m unittest discover -s web/backend/tests -v` using the existing Python 3 environment.
- Additional manual browser verification reads the real project, checks the complete row counts, navigation, graph and report, and compares hypothetical carbohydrate events with a no-added-event scenario on desktop and mobile.
- The existing local server configuration was also used for read-only GRU inference on a real cloud record: 3/6/12-hour requests returned 13/25/49 finite forecast points from 585 prepared observations. No forecast-save call was made. Successful inference is not a prospective accuracy validation.
- At verification time, all 51 frontend tests and all 43 backend tests passed. The browser regression also covered an authenticated Patient fixture, database-denied and empty-cohort cases, complete paging, scenario events and a 390-pixel mobile viewport.

Live GRU deployment, forecast-storage installation and a real Patient login require the deployed services/account configuration. None is implied by a successful local UI or simulation test. Prospective, patient-separated, multi-horizon validation and parameter-identifiability analysis remain necessary before presenting physiology scenarios as personalized clinical predictions.

Account-management actions in the separately labelled Admin demo and clinician-published recommendation storage are not implemented by the clinical dataset tables. The clinical workspace does not invent either account activity or care plans from laboratory values.
