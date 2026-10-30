# Aura audit reconciliation — 2026-10-23

## Status

**Read-only audit only. No migration, deletion, seed, or approval query from this package has been run against Aura.**

This report compares the audit output supplied by the project developer with the proposed v1 Type 2 Diabetes concept-only package. It is a reconciliation record, not a clinical approval.

## Runtime compatibility

The instance reported Neo4j Kernel `5.27-aura`, Enterprise edition, with Cypher versions `5` and `25`. The package uses individual static relationship-type seed statements, so the proposed seed approach does not depend on dynamic relationship-type syntax.

## Existing graph versus proposed target

- Existing `:MedicalConcept` nodes: **45**.
- Proposed target concepts: **37**.
- Current concepts absent from the target allowlist (10): `Blood Urea Nitrogen`, `C-peptide`, `Cholesterol`, `Creatinine`, `Food`, `HDL Cholesterol`, `LDL Cholesterol`, `Meal`, `Triglyceride`, `Uric Acid`.
- Concepts proposed but not present in the current inventory (2): `Dietary Intake`, `Physical Activity`.
- Existing concept-to-concept relationships reported by the audit: **42**.
- Proposed relationship catalogue: **42**.
- Exact `(from concept, relationship type, to concept)` triples shared by both catalogues: **31**. There are **11 existing-only triples** and **11 proposed-only triples**; the migration is therefore a redesign of some semantics, not merely filling in evidence properties.

### Existing-only relationship triples

1. `Blood Glucose -[:USED_TO_IDENTIFY]-> Hyperglycemia`
2. `Blood Glucose -[:USED_TO_IDENTIFY]-> Hypoglycemia`
3. `CGM -[:DETECTS]-> Hyperglycemia`
4. `Diabetes -[:ASSOCIATED_WITH]-> Chronic Kidney Disease`
5. `Diabetes -[:ASSOCIATED_WITH]-> Macrovascular Complication`
6. `Diabetes -[:ASSOCIATED_WITH]-> Microvascular Complication`
7. `Glucose Management Indicator -[:SUPPORTS_ASSESSMENT_OF]-> Glycaemic Control`
8. `Glycated Albumin -[:INDICATES]-> Glycaemic Control`
9. `HbA1c -[:INDICATES]-> Glycaemic Control`
10. `Insulin -[:USED_IN_TREATMENT_OF]-> Diabetes`
11. `Meal -[:INFLUENCES]-> Blood Glucose`

### Proposed-only relationship triples

1. `Blood Glucose -[:SUPPORTS_ASSESSMENT_OF]-> Hyperglycemia`
2. `Blood Glucose -[:SUPPORTS_ASSESSMENT_OF]-> Hypoglycemia`
3. `CBG -[:MEASURES]-> Blood Glucose`
4. `Dietary Intake -[:INFORMS_MANAGEMENT_OF]-> Type 2 Diabetes`
5. `Glucose Management Indicator -[:ASSESSES]-> Glycaemic Control`
6. `Glycated Albumin -[:ALTERNATIVE_MARKER_FOR]-> Glycaemic Control`
7. `HbA1c -[:USED_TO_ASSESS]-> Glycaemic Control`
8. `Physical Activity -[:INFORMS_MANAGEMENT_OF]-> Type 2 Diabetes`
9. `Type 2 Diabetes -[:ASSOCIATED_WITH]-> Chronic Kidney Disease`
10. `Type 2 Diabetes -[:ASSOCIATED_WITH]-> Macrovascular Complication`
11. `Type 2 Diabetes -[:ASSOCIATED_WITH]-> Microvascular Complication`

These are candidate model choices. Review each against its full cited source and project scope before accepting it. In particular, do not assume a relationship is clinically validated just because it appears in the proposed catalogue.

## Provenance and patient/event data

- The current node inventory includes non-concept labels such as `Patient`, `Person`, `Project`, `CGMReading`, `CBGReading`, `ClinicalMeasurement`, `InsulinAdministration`, `MealEvent`, and `Food`.
- The Type 1 audit output identifies at least one patient record marked Type 1 Diabetes connected to CGM readings, insulin events, and clinical measurements. The intended concept-only Aura target excludes all patient/event/measurement nodes, not only Type 1 records.
- Nine existing concept records had empty/missing `sourceRefs` in the supplied inventory: `Blood Ketone`, `Blood Urea Nitrogen`, `Cholesterol`, `Creatinine`, `HDL Cholesterol`, `LDL Cholesterol`, `Triglyceride`, `Uric Acid`, and `eGFR`.
- The supplied relationship inventory showed `sourceRefs` and `evidenceType`, but no `evidenceNote`. The audit query `09_relationships_missing_sources.cypher` should therefore be checked; current relationships without evidence notes do not pass the package's evidence gate.
- The supplied output did not include a visible result frame for `05_duplicate_concept_names.cypher`. Confirm that it returned **zero rows** before migration. If it returned any rows, stop and consolidate duplicates first.

## Legacy constraints found

The current graph reported these constraints:

- `concept_name_unique` on `:MedicalConcept(name)` — retain this concept-name uniqueness constraint.
- `patient_id_unique`
- `cgm_reading_id_unique`
- `cbg_reading_id_unique`
- `ketone_reading_id_unique`
- `insulin_event_id_unique`
- `medication_event_id_unique`
- `meal_event_id_unique`

Deleting nodes does not remove schema constraints. After backing up and approving the destructive migration, run each script in `cypher/migration/05_drop_legacy_constraints/` individually after the non-concept nodes have been removed. These scripts drop only the seven listed patient/reading/event constraints; they do not drop `concept_name_unique`.

## Gate before any destructive query

1. Confirm the Aura instance is the intended database.
2. Confirm the duplicate-concept audit returns zero rows.
3. Create and verify a restorable private backup/export before deletion. Do not commit the backup or patient/event export to the repository.
4. Approve the concept allowlist and all relationship changes above.
5. Only then run the cleanup scripts individually in the order listed in `MIGRATION_CHECKLIST.md`.

The proposed AI read queries return only edges whose `evidenceStatus` is `reviewed`. Leave edges as `candidate_for_review` until a human completes source review and approves them individually.
