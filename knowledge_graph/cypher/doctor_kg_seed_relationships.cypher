// Idempotent ontology relationships from the team's existing literature-backed KG notes.
// Run one statement at a time. Every relationship is MERGE'd; no patient records are changed.
// Source references are preserved from the team's research notes and should be checked against the report bibliography.

MATCH (a:MedicalConcept {name: "Insulin"}), (b:MedicalConcept {name: "Diabetes"})
MERGE (a)-[r:USED_IN_TREATMENT_OF]->(b)
SET r.sourceRefs = ["[7]", "[16]", "[17]", "[26]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "CGM"}), (b:MedicalConcept {name: "Blood Glucose"})
MERGE (a)-[r:MONITORS]->(b)
SET r.sourceRefs = ["[8]", "[18]", "[19]", "[24]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "HbA1c"}), (b:MedicalConcept {name: "Glycaemic Control"})
MERGE (a)-[r:INDICATES]->(b)
SET r.sourceRefs = ["[9]", "[18]", "[20]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Obesity"}), (b:MedicalConcept {name: "Type 2 Diabetes"})
MERGE (a)-[r:RISK_FACTOR_FOR]->(b)
SET r.sourceRefs = ["[1]", "[2]", "[3]", "[4]", "[6]", "[17]", "[25]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Insulin Resistance"}), (b:MedicalConcept {name: "Type 2 Diabetes"})
MERGE (a)-[r:CONTRIBUTES_TO]->(b)
SET r.sourceRefs = ["[3]", "[11]", "[17]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Obesity"}), (b:MedicalConcept {name: "Insulin Resistance"})
MERGE (a)-[r:ASSOCIATED_WITH]->(b)
SET r.sourceRefs = ["[2]", "[3]", "[11]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "eGFR"}), (b:MedicalConcept {name: "Chronic Kidney Disease"})
MERGE (a)-[r:USED_TO_ASSESS]->(b)
SET r.sourceRefs = ["[27]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Diabetes"}), (b:MedicalConcept {name: "Chronic Kidney Disease"})
MERGE (a)-[r:ASSOCIATED_WITH]->(b)
SET r.sourceRefs = ["[12]", "[17]", "[27]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Cardiovascular Disease"}), (b:MedicalConcept {name: "Macrovascular Complication"})
MERGE (a)-[r:IS_A]->(b)
SET r.sourceRefs = ["[4]", "[12]", "[17]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Diabetic Nephropathy"}), (b:MedicalConcept {name: "Microvascular Complication"})
MERGE (a)-[r:IS_A]->(b)
SET r.sourceRefs = ["[12]", "[27]", "[28]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Diabetic Neuropathy"}), (b:MedicalConcept {name: "Microvascular Complication"})
MERGE (a)-[r:IS_A]->(b)
SET r.sourceRefs = ["[12]", "[28]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Diabetic Retinopathy"}), (b:MedicalConcept {name: "Microvascular Complication"})
MERGE (a)-[r:IS_A]->(b)
SET r.sourceRefs = ["[12]", "[28]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Meal"}), (b:MedicalConcept {name: "Blood Glucose"})
MERGE (a)-[r:INFLUENCES]->(b)
SET r.sourceRefs = ["[14]", "[18]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "BMI"}), (b:MedicalConcept {name: "Obesity"})
MERGE (a)-[r:USED_TO_ASSESS]->(b)
SET r.sourceRefs = ["[21]", "[25]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Insulin"}), (b:MedicalConcept {name: "Blood Glucose"})
MERGE (a)-[r:REGULATES]->(b)
SET r.sourceRefs = ["[7]", "[11]", "[17]", "[26]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Medication"}), (b:MedicalConcept {name: "Type 2 Diabetes"})
MERGE (a)-[r:USED_IN_TREATMENT_OF]->(b)
SET r.sourceRefs = ["[7]", "[15]", "[17]", "[26]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Insulin"}), (b:MedicalConcept {name: "Type 2 Diabetes"})
MERGE (a)-[r:USED_IN_TREATMENT_OF]->(b)
SET r.sourceRefs = ["[7]", "[17]", "[26]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Insulin"}), (b:MedicalConcept {name: "Type 1 Diabetes"})
MERGE (a)-[r:USED_IN_TREATMENT_OF]->(b)
SET r.sourceRefs = ["[7]", "[16]", "[26]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Blood Ketone"}), (b:MedicalConcept {name: "Diabetic Ketoacidosis"})
MERGE (a)-[r:SUPPORTS_ASSESSMENT_OF]->(b)
SET r.sourceRefs = ["[29]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Diabetic Ketoacidosis"}), (b:MedicalConcept {name: "Hyperglycemic Crisis"})
MERGE (a)-[r:IS_A]->(b)
SET r.sourceRefs = ["[23]", "[29]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "CGM"}), (b:MedicalConcept {name: "Hyperglycemia"})
MERGE (a)-[r:DETECTS]->(b)
SET r.sourceRefs = ["[8]", "[20]", "[24]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Blood Glucose"}), (b:MedicalConcept {name: "Hyperglycemia"})
MERGE (a)-[r:USED_TO_IDENTIFY]->(b)
SET r.sourceRefs = ["[18]", "[20]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Blood Glucose"}), (b:MedicalConcept {name: "Hypoglycemia"})
MERGE (a)-[r:USED_TO_IDENTIFY]->(b)
SET r.sourceRefs = ["[10]", "[20]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Glycaemic Variability"}), (b:MedicalConcept {name: "Glycaemic Control"})
MERGE (a)-[r:ASSESSES]->(b)
SET r.sourceRefs = ["[20]", "[22]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Glucose Management Indicator"}), (b:MedicalConcept {name: "Glycaemic Control"})
MERGE (a)-[r:SUPPORTS_ASSESSMENT_OF]->(b)
SET r.sourceRefs = ["[20]", "[22]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Mean Glucose"}), (b:MedicalConcept {name: "Glycaemic Control"})
MERGE (a)-[r:ASSESSES]->(b)
SET r.sourceRefs = ["[20]", "[22]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Time Above Range"}), (b:MedicalConcept {name: "Glycaemic Control"})
MERGE (a)-[r:ASSESSES]->(b)
SET r.sourceRefs = ["[20]", "[22]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Time Below Range"}), (b:MedicalConcept {name: "Glycaemic Control"})
MERGE (a)-[r:ASSESSES]->(b)
SET r.sourceRefs = ["[20]", "[22]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Time in Range"}), (b:MedicalConcept {name: "Glycaemic Control"})
MERGE (a)-[r:ASSESSES]->(b)
SET r.sourceRefs = ["[20]", "[22]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "CGM"}), (b:MedicalConcept {name: "Mean Glucose"})
MERGE (a)-[r:SUPPORTS_CALCULATION_OF]->(b)
SET r.sourceRefs = ["[20]", "[22]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "CGM"}), (b:MedicalConcept {name: "Time in Range"})
MERGE (a)-[r:SUPPORTS_CALCULATION_OF]->(b)
SET r.sourceRefs = ["[20]", "[22]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "CGM"}), (b:MedicalConcept {name: "Time Below Range"})
MERGE (a)-[r:SUPPORTS_CALCULATION_OF]->(b)
SET r.sourceRefs = ["[20]", "[22]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "CGM"}), (b:MedicalConcept {name: "Time Above Range"})
MERGE (a)-[r:SUPPORTS_CALCULATION_OF]->(b)
SET r.sourceRefs = ["[20]", "[22]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "CGM"}), (b:MedicalConcept {name: "Glucose Management Indicator"})
MERGE (a)-[r:SUPPORTS_CALCULATION_OF]->(b)
SET r.sourceRefs = ["[20]", "[22]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "CGM"}), (b:MedicalConcept {name: "Glycaemic Variability"})
MERGE (a)-[r:SUPPORTS_CALCULATION_OF]->(b)
SET r.sourceRefs = ["[20]", "[22]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Glycated Albumin"}), (b:MedicalConcept {name: "Glycaemic Control"})
MERGE (a)-[r:INDICATES]->(b)
SET r.sourceRefs = ["[18]", "[23]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "HbA1c"}), (b:MedicalConcept {name: "Diabetes"})
MERGE (a)-[r:USED_FOR_DIAGNOSIS_OF]->(b)
SET r.sourceRefs = ["[9]", "[23]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Postprandial Glucose"}), (b:MedicalConcept {name: "Glycaemic Control"})
MERGE (a)-[r:USED_TO_ASSESS]->(b)
SET r.sourceRefs = ["[18]", "[20]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Fasting Plasma Glucose"}), (b:MedicalConcept {name: "Diabetes"})
MERGE (a)-[r:USED_FOR_DIAGNOSIS_OF]->(b)
SET r.sourceRefs = ["[23]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Prediabetes"}), (b:MedicalConcept {name: "Type 2 Diabetes"})
MERGE (a)-[r:RISK_FACTOR_FOR]->(b)
SET r.sourceRefs = ["[13]", "[23]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Type 2 Diabetes"}), (b:MedicalConcept {name: "Diabetes"})
MERGE (a)-[r:IS_A]->(b)
SET r.sourceRefs = ["[17]", "[23]"], r.evidenceType = "Literature";

MATCH (a:MedicalConcept {name: "Type 1 Diabetes"}), (b:MedicalConcept {name: "Diabetes"})
MERGE (a)-[r:IS_A]->(b)
SET r.sourceRefs = ["[16]", "[23]"], r.evidenceType = "Literature";

// Verify the ontology edges after running all required statements.
MATCH (a:MedicalConcept)-[r]->(b:MedicalConcept)
RETURN a.name AS from, type(r) AS relationship, b.name AS to,
       r.sourceRefs AS sourceRefs, r.evidenceType AS evidenceType
ORDER BY from, relationship, to;
