// Idempotent MedicalConcept node seed, curated from the team's existing doctor-KG Cypher.
// Run one statement at a time. This updates only MedicalConcept.name/category/sourceRefs.
// It does not create/delete patient records or observations and does not delete Type 1 Diabetes.

UNWIND [
  {name: "Diabetes", category: "Disease", sources: ["[16]", "[17]"]},
  {name: "Type 1 Diabetes", category: "Disease", sources: ["[16]", "[23]"]},
  {name: "Type 2 Diabetes", category: "Disease", sources: ["[17]", "[23]"]},
  {name: "Prediabetes", category: "Clinical State", sources: ["[13]", "[23]"]},
  {name: "Blood Glucose", category: "Health Indicator", sources: ["[18]", "[19]"]},
  {name: "Fasting Plasma Glucose", category: "Health Indicator", sources: ["[23]"]},
  {name: "Postprandial Glucose", category: "Health Indicator", sources: ["[18]", "[20]"]},
  {name: "CGM", category: "Monitoring Technology", sources: ["[8]", "[19]"]},
  {name: "CBG", category: "Health Indicator", sources: ["[19]"]},
  {name: "HbA1c", category: "Health Indicator", sources: ["[9]", "[18]"]},
  {name: "BMI", category: "Health Indicator", sources: ["[1]", "[2]", "[6]", "[21]", "[25]"]},
  {name: "Obesity", category: "Risk Factor", sources: ["[1]", "[2]", "[3]", "[4]", "[6]"]},
  {name: "Insulin", category: "Treatment", sources: ["[7]", "[16]", "[17]", "[26]"]},
  {name: "Medication", category: "Treatment", sources: ["[7]", "[15]", "[17]"]},
  {name: "Meal", category: "Lifestyle/Event", sources: ["[14]", "[17]"]},
  {name: "Food", category: "Lifestyle/Event", sources: ["[14]"]},
  {name: "Hypoglycemia", category: "Glycaemic Event", sources: ["[10]", "[18]", "[20]"]},
  {name: "Hyperglycemia", category: "Glycaemic Event", sources: ["[18]", "[20]"]},
  {name: "Glycaemic Control", category: "Clinical Concept", sources: ["[9]", "[18]", "[20]", "[22]"]},
  {name: "Insulin Resistance", category: "Pathophysiology", sources: ["[3]", "[11]", "[17]"]},
  {name: "Microvascular Complication", category: "Complication", sources: ["[12]", "[17]"]},
  {name: "Macrovascular Complication", category: "Complication", sources: ["[12]", "[17]"]},
  {name: "C-peptide", category: "Health Indicator", sources: ["[16]", "[17]"]},
  {name: "Glycated Albumin", category: "Health Indicator", sources: ["[18]", "[23]"]},
  {name: "Cholesterol", category: "Health Indicator", sources: []},
  {name: "Triglyceride", category: "Health Indicator", sources: []},
  {name: "HDL Cholesterol", category: "Health Indicator", sources: []},
  {name: "LDL Cholesterol", category: "Health Indicator", sources: []},
  {name: "Creatinine", category: "Health Indicator", sources: []},
  {name: "eGFR", category: "Health Indicator", sources: ["[27]"]},
  {name: "Uric Acid", category: "Health Indicator", sources: []},
  {name: "Blood Urea Nitrogen", category: "Health Indicator", sources: []},
  {name: "Blood Ketone", category: "Health Indicator", sources: ["[29]"]},
  {name: "Mean Glucose", category: "CGM Metric", sources: ["[20]", "[22]"]},
  {name: "Time in Range", category: "CGM Metric", sources: ["[20]", "[22]"]},
  {name: "Time Below Range", category: "CGM Metric", sources: ["[20]", "[22]"]},
  {name: "Time Above Range", category: "CGM Metric", sources: ["[20]", "[22]"]},
  {name: "Glucose Management Indicator", category: "CGM Metric", sources: ["[20]", "[22]"]},
  {name: "Glycaemic Variability", category: "CGM Metric", sources: ["[20]", "[22]"]},
  {name: "Hyperglycemic Crisis", category: "Glycaemic Crisis", sources: ["[20]", "[23]", "[29]"]},
  {name: "Diabetic Ketoacidosis", category: "Glycaemic Crisis", sources: ["[20]", "[23]", "[29]"]},
  {name: "Diabetic Retinopathy", category: "Complication", sources: ["[12]", "[28]"]},
  {name: "Diabetic Neuropathy", category: "Complication", sources: ["[12]", "[28]"]},
  {name: "Diabetic Nephropathy", category: "Complication", sources: ["[12]", "[27]", "[28]"]},
  {name: "Cardiovascular Disease", category: "Macrovascular Complication", sources: ["[4]", "[12]", "[17]"]},
  {name: "Chronic Kidney Disease", category: "Complication", sources: ["[12]", "[17]", "[27]"]},
  {name: "Hypertension", category: "Comorbidity", sources: []},
  {name: "Hyperlipidemia", category: "Comorbidity", sources: []},
  {name: "Hyperuricemia", category: "Comorbidity", sources: []},
  {name: "Peripheral Arterial Disease", category: "Macrovascular Complication", sources: []},
  {name: "Coronary Heart Disease", category: "Macrovascular Complication", sources: []},
  {name: "Cerebrovascular Disease", category: "Macrovascular Complication", sources: []}
] AS item
MERGE (c:MedicalConcept {name: item.name})
SET c.category = item.category,
    c.sourceRefs = item.sources
RETURN count(c) AS conceptsMerged;

// Then run this verification query separately.
MATCH (c:MedicalConcept)
RETURN c.name AS concept, c.category AS category, c.sourceRefs AS sourceRefs
ORDER BY category, concept;
