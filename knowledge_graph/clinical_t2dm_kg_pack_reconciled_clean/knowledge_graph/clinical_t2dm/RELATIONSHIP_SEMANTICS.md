# Relationship semantics and direction

All predicates are directional. Do not reverse an edge just because the visual graph layout places nodes differently. The current 42 edges are proposed candidate mappings, each with a source list and an evidence note.

| Predicate | Read as | Direction / guardrail |
|---|---|---|
| `IS_A` | subject is a kind of object | Specific type → broader category. Example: Type 2 Diabetes → Diabetes. |
| `RISK_FACTOR_FOR` | subject is associated with increased risk of object | Risk relationship, not certainty or an individual diagnosis. |
| `ASSOCIATED_WITH` | subject is associated with object | Non-causal unless separately supported and explicitly modeled. |
| `CONTRIBUTES_TO` | subject contributes to the mechanisms of object | Mechanistic summary, not the only cause or complete explanation. |
| `USED_TO_ASSESS` | subject is used to assess object | A test/measure → the clinical construct it informs. |
| `USED_FOR_DIAGNOSIS_OF` | subject is a recognized diagnostic test for object | Does not mean the value alone establishes diagnosis; criteria and confirmation depend on the guideline and setting. |
| `ALTERNATIVE_MARKER_FOR` | subject is an alternative biomarker for assessing object in selected contexts | Not necessarily interchangeable with other markers. |
| `MONITORS` | subject monitors object | Technology → measured signal/concept. |
| `MEASURES` | subject measures object | Measurement method → measured quantity. |
| `SUPPORTS_CALCULATION_OF` | subject data support calculation of object | CGM → derived metric; specified time window/range still matters. |
| `ASSESSES` | subject is a metric used in assessment of object | Metric → the assessment construct. |
| `SUPPORTS_ASSESSMENT_OF` | subject supports assessment of object | A supporting measure is not independently diagnostic. |
| `INFORMS_MANAGEMENT_OF` | subject is one context considered in management of object | Not a prescribed action or patient-specific plan. |
| `REGULATES` | subject has a physiological role in regulating object | Mechanism-level relationship; actual treatment effects vary by person and treatment details. |
| `USED_IN_TREATMENT_OF` | subject is used as a treatment option for object | Does not recommend the treatment for any specific person. |

## Why no `CAUSES` relationship?

The current use case needs the AI to explain evidence without converting a broad association into a guaranteed causal conclusion for an individual. This candidate ontology therefore uses association, risk, and mechanism labels with cautious evidence notes. Numeric clinical rules, if added later, need explicit threshold value, units, population/context, source, effective date/version and validation; v1 has no numerical threshold rule nodes.
