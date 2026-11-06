// DESTRUCTIVE. Keep only the v1 allowlist; all other MedicalConcept nodes, including Type 1 Diabetes, are removed.
// Confirm the allowlist against concept_catalog.json before running.
MATCH (c:MedicalConcept)
WHERE c.name IS NULL OR NOT c.name IN [
  'Diabetes', 'Type 2 Diabetes', 'Prediabetes', 'Blood Glucose', 'CGM', 'CBG',
  'HbA1c', 'Fasting Plasma Glucose', 'Postprandial Glucose', 'Glycated Albumin',
  'BMI', 'Obesity', 'Insulin Resistance', 'Insulin', 'Medication', 'Glycaemic Control',
  'Glycaemic Variability', 'Mean Glucose', 'Time in Range', 'Time Below Range',
  'Time Above Range', 'Glucose Management Indicator', 'Hypoglycemia', 'Hyperglycemia',
  'Blood Ketone', 'Diabetic Ketoacidosis', 'Hyperglycemic Crisis',
  'Microvascular Complication', 'Macrovascular Complication', 'Diabetic Retinopathy',
  'Diabetic Neuropathy', 'Diabetic Nephropathy', 'Chronic Kidney Disease',
  'Cardiovascular Disease', 'eGFR', 'Dietary Intake', 'Physical Activity'
]
DETACH DELETE c;
