# Evidence mapping review notes (candidate, not clinical approval)

This file separates what has been checked against publisher/abstract records from the additional review still required before any AI consumes the relationships.

## Checked against external publisher/abstract records

- [1] DOI `10.1371/journal.pone.0229716` resolves to Gupta & Bansal's PLOS ONE study on BMI and diabetes in India. It can contribute to a population-risk edge but should not be represented as proof that obesity causes diabetes in every individual.
- [2] DOI `10.3390/ijms25031882` resolves to the 2024 review of obesity in Type 2 diabetes.
- [3] DOI `10.1016/j.cmet.2021.12.012` resolves to Klein et al.'s 2022 review on mechanisms linking obesity and diabetes.
- [6] DOI `10.2337/dc19-1782` resolves to Seiglie et al.'s analysis of diabetes prevalence in low-/middle-income countries; use as epidemiological association, not individual causation.
- [9] DOI `10.4137/BMI.S38440` resolves to the HbA1c diagnosis/prognosis review.
- [11] DOI `10.1152/physrev.00063.2017` resolves to Petersen & Shulman's review on insulin action/resistance.
- [14] DOI `10.1007/s10654-017-0246-y` resolves to a systematic review/meta-analysis of food groups and Type 2 diabetes risk; it does not support prescribing a specific meal to a patient.
- [20] DOI `10.2337/dc26-s006` resolves to the 2026 Standards chapter on glycaemic goals, hypoglycaemia and hyperglycaemic crises. It discusses A1C and CGM metrics.
- [22] DOI `10.2337/dci19-0028` resolves to the international CGM time-in-range consensus.
- [23] DOI `10.2337/dc26-s002` resolves to the 2026 diagnosis/classification chapter, which includes A1C and plasma-glucose diagnostic criteria.
- [25] DOI `10.2337/dc26-s008` resolves to the 2026 obesity/weight-management chapter, including BMI screening and individualized nutrition/physical-activity therapy.
- [26] DOI `10.2337/dc26-s009` resolves to the 2026 pharmacologic-approaches chapter, including Type 2 diabetes medication and insulin treatment context.
- [27] DOI `10.2337/dc26-s011` resolves to the 2026 chronic kidney disease chapter, which describes eGFR assessment in people with Type 2 diabetes.
- [28] DOI `10.2337/dc26-s012` resolves to the 2026 retinopathy, neuropathy and foot-care chapter.
- [29] DOI `10.2337/dci24-0032` resolves to the 2024 consensus report on hyperglycaemic crises in adults.

## Bibliography discrepancies to reconcile

- Reference [10]: the publisher record lists Jean-François Yale, Breay Paty and Peter A. Senior; the supplied project reference uses “D. J. Yale”. Please correct the final bibliography to the publisher record after confirming with the group. Source: [Canadian Journal of Diabetes publisher page](https://www.canadianjournalofdiabetes.com/article/S1499-2671%2817%2930820-1/fulltext).
- References [20], [23]–[28]: the DOI/publisher records list the American Diabetes Association Professional Practice Committee for Diabetes as the authoring body. The supplied project references use “M. Bajaj et al.”. Reconcile these entries with the official citations before final submission. Example publisher records: [section 6](https://doi.org/10.2337/dc26-s006), [section 2](https://doi.org/10.2337/dc26-s002), [section 8](https://doi.org/10.2337/dc26-s008), [section 9](https://doi.org/10.2337/dc26-s009), [section 11](https://doi.org/10.2337/dc26-s011), [section 12](https://doi.org/10.2337/dc26-s012).
- Reference [8] is explicitly a review of CGM use in adults with Type 1 diabetes and reference [16] is a Type 1 diabetes review. Neither is used as support for this Type 2-only graph. The wider bibliography can retain them for the project report, but the v1 KG intentionally excludes them from every graph edge.

## Still required before a final Aura migration

1. Read/check the full source or relevant guidance section for each row in `relationship_evidence_matrix.csv`, not only the title/abstract.
2. Confirm that each edge's direction, predicate and note match what the source supports.
3. Confirm the target clinical scope is appropriate for this group project and that no claim implies a patient-specific diagnosis.
4. Mark only accepted graph relationships as `reviewed`. The seed script writes every proposed edge as `candidate_for_review`; the AI read query filters for `evidenceStatus = 'reviewed'`.
5. Keep all numerical thresholds outside v1 until the clinical rule, unit, population, source version and evaluation plan are agreed.

## Source permissions for AI use

The official ADA Standards of Care chapter pages/PDFs include usage language restricting reproduction and text/data mining, machine learning or similar technology use without permission. This package contains short, human-authored relationship summaries and citations, not copied guideline text; however, the team should **check applicable publisher terms and any institutional permissions with the supervisor/library before using ADA-derived graph facts as AI input in a deployed or evaluated system**. Keep affected edges at `candidate_for_review` until the source claim and its permitted project use have been reviewed. This note is a risk flag, not legal advice. Official examples: [ADA 2026 section 2](https://doi.org/10.2337/dc26-s002), [section 6](https://doi.org/10.2337/dc26-s006).
