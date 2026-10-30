// Idempotent upsert of the proposed concept vocabulary; run after cleanup and constraint check.
UNWIND [
  {
    "name": "Diabetes",
    "category": "Disease",
    "description": "General disease parent concept used only to classify Type 2 Diabetes in this graph.",
    "sourceRefs": [
      "[17]",
      "[23]"
    ]
  },
  {
    "name": "Type 2 Diabetes",
    "category": "Disease",
    "description": "Type 2 diabetes mellitus; the only diabetes subtype in the v1 KG scope.",
    "sourceRefs": [
      "[17]",
      "[23]"
    ]
  },
  {
    "name": "Prediabetes",
    "category": "Clinical State",
    "description": "A high-risk state associated with future Type 2 diabetes development.",
    "sourceRefs": [
      "[13]",
      "[23]"
    ]
  },
  {
    "name": "Blood Glucose",
    "category": "Health Indicator",
    "description": "Blood glucose concentration used in diabetes assessment and monitoring.",
    "sourceRefs": [
      "[18]",
      "[20]",
      "[23]"
    ]
  },
  {
    "name": "CGM",
    "category": "Monitoring Technology",
    "description": "Continuous glucose monitoring; provides time-series glucose values and derived metrics.",
    "sourceRefs": [
      "[19]",
      "[20]",
      "[22]",
      "[24]"
    ]
  },
  {
    "name": "CBG",
    "category": "Measurement Method",
    "description": "Capillary blood glucose measurement.",
    "sourceRefs": [
      "[20]",
      "[23]"
    ]
  },
  {
    "name": "HbA1c",
    "category": "Health Indicator",
    "description": "Glycated haemoglobin measure used in glycaemic assessment and diabetes diagnosis when appropriate.",
    "sourceRefs": [
      "[9]",
      "[20]",
      "[23]"
    ]
  },
  {
    "name": "Fasting Plasma Glucose",
    "category": "Health Indicator",
    "description": "Fasting plasma glucose laboratory measure used in diabetes diagnosis.",
    "sourceRefs": [
      "[23]"
    ]
  },
  {
    "name": "Postprandial Glucose",
    "category": "Health Indicator",
    "description": "Glucose measured after a meal; can inform glycaemic assessment.",
    "sourceRefs": [
      "[18]",
      "[20]"
    ]
  },
  {
    "name": "Glycated Albumin",
    "category": "Health Indicator",
    "description": "An alternative glycaemic biomarker considered in selected monitoring contexts.",
    "sourceRefs": [
      "[18]",
      "[23]"
    ]
  },
  {
    "name": "BMI",
    "category": "Anthropometric Measure",
    "description": "Body mass index calculated from weight and height; used to screen for overweight and obesity, not a direct measurement of body fat.",
    "sourceRefs": [
      "[1]",
      "[2]",
      "[6]",
      "[21]",
      "[25]"
    ]
  },
  {
    "name": "Obesity",
    "category": "Risk Factor",
    "description": "A clinical condition associated with increased Type 2 diabetes risk and insulin resistance; this does not establish causality for an individual patient.",
    "sourceRefs": [
      "[1]",
      "[2]",
      "[3]",
      "[4]",
      "[6]",
      "[17]",
      "[25]"
    ]
  },
  {
    "name": "Insulin Resistance",
    "category": "Pathophysiology",
    "description": "Reduced biological response to insulin; one mechanism in Type 2 diabetes pathophysiology.",
    "sourceRefs": [
      "[3]",
      "[11]",
      "[17]"
    ]
  },
  {
    "name": "Insulin",
    "category": "Treatment / Physiological Concept",
    "description": "Hormone involved in glucose regulation and medication used for selected people with Type 2 diabetes.",
    "sourceRefs": [
      "[7]",
      "[11]",
      "[17]",
      "[26]"
    ]
  },
  {
    "name": "Medication",
    "category": "Treatment",
    "description": "General concept for glucose-lowering medicines; not a patient-specific prescription.",
    "sourceRefs": [
      "[7]",
      "[15]",
      "[17]",
      "[26]"
    ]
  },
  {
    "name": "Glycaemic Control",
    "category": "Clinical Concept",
    "description": "Clinical assessment of glucose status using suitable biomarkers and monitoring metrics.",
    "sourceRefs": [
      "[9]",
      "[18]",
      "[20]",
      "[22]"
    ]
  },
  {
    "name": "Glycaemic Variability",
    "category": "CGM Metric",
    "description": "Variation in glucose measurements over time; one metric used in CGM interpretation.",
    "sourceRefs": [
      "[20]",
      "[22]"
    ]
  },
  {
    "name": "Mean Glucose",
    "category": "CGM Metric",
    "description": "Mean of glucose values in the selected monitoring window.",
    "sourceRefs": [
      "[20]",
      "[22]"
    ]
  },
  {
    "name": "Time in Range",
    "category": "CGM Metric",
    "description": "Percentage or duration of monitored time within a specified glucose range; interpretation requires range and population context.",
    "sourceRefs": [
      "[20]",
      "[22]"
    ]
  },
  {
    "name": "Time Below Range",
    "category": "CGM Metric",
    "description": "Percentage or duration of monitored time below a specified glucose range.",
    "sourceRefs": [
      "[20]",
      "[22]"
    ]
  },
  {
    "name": "Time Above Range",
    "category": "CGM Metric",
    "description": "Percentage or duration of monitored time above a specified glucose range.",
    "sourceRefs": [
      "[20]",
      "[22]"
    ]
  },
  {
    "name": "Glucose Management Indicator",
    "category": "CGM Metric",
    "description": "A value calculated from CGM mean glucose that approximates, but is not always equivalent to, laboratory HbA1c.",
    "sourceRefs": [
      "[20]",
      "[22]",
      "[24]"
    ]
  },
  {
    "name": "Hypoglycemia",
    "category": "Glycaemic Event",
    "description": "A low-glucose event; any numeric classification or threshold must be interpreted using a cited guideline and patient context.",
    "sourceRefs": [
      "[10]",
      "[20]"
    ]
  },
  {
    "name": "Hyperglycemia",
    "category": "Glycaemic Event",
    "description": "Elevated glucose; numeric thresholds and clinical interpretation depend on the relevant guideline and context.",
    "sourceRefs": [
      "[18]",
      "[20]"
    ]
  },
  {
    "name": "Blood Ketone",
    "category": "Health Indicator",
    "description": "Blood ketone measurement that may support clinical assessment when ketoacidosis is suspected.",
    "sourceRefs": [
      "[29]"
    ]
  },
  {
    "name": "Diabetic Ketoacidosis",
    "category": "Glycaemic Crisis",
    "description": "An acute hyperglycaemic crisis requiring clinical assessment; no diagnostic rule is encoded in v1.",
    "sourceRefs": [
      "[23]",
      "[29]"
    ]
  },
  {
    "name": "Hyperglycemic Crisis",
    "category": "Glycaemic Crisis",
    "description": "Umbrella concept for acute hyperglycaemic crises.",
    "sourceRefs": [
      "[20]",
      "[23]",
      "[29]"
    ]
  },
  {
    "name": "Microvascular Complication",
    "category": "Complication Category",
    "description": "Category for diabetes-associated microvascular complications.",
    "sourceRefs": [
      "[12]",
      "[17]",
      "[28]"
    ]
  },
  {
    "name": "Macrovascular Complication",
    "category": "Complication Category",
    "description": "Category for diabetes-associated macrovascular complications.",
    "sourceRefs": [
      "[4]",
      "[12]",
      "[17]"
    ]
  },
  {
    "name": "Diabetic Retinopathy",
    "category": "Complication",
    "description": "Diabetes-associated retinal complication.",
    "sourceRefs": [
      "[12]",
      "[28]"
    ]
  },
  {
    "name": "Diabetic Neuropathy",
    "category": "Complication",
    "description": "Diabetes-associated nerve complication.",
    "sourceRefs": [
      "[12]",
      "[28]"
    ]
  },
  {
    "name": "Diabetic Nephropathy",
    "category": "Complication",
    "description": "Diabetes-associated kidney complication.",
    "sourceRefs": [
      "[12]",
      "[27]",
      "[28]"
    ]
  },
  {
    "name": "Chronic Kidney Disease",
    "category": "Complication",
    "description": "Chronic kidney disease, relevant to diabetes complication and risk management.",
    "sourceRefs": [
      "[12]",
      "[17]",
      "[27]"
    ]
  },
  {
    "name": "Cardiovascular Disease",
    "category": "Complication",
    "description": "Cardiovascular disease relevant to diabetes-associated macrovascular risk.",
    "sourceRefs": [
      "[4]",
      "[12]",
      "[17]"
    ]
  },
  {
    "name": "eGFR",
    "category": "Health Indicator",
    "description": "Estimated glomerular filtration rate, one measure used in kidney assessment.",
    "sourceRefs": [
      "[27]"
    ]
  },
  {
    "name": "Dietary Intake",
    "category": "Lifestyle / Behaviour",
    "description": "Dietary context considered as part of diabetes and weight-management care; not a patient-specific diet prescription.",
    "sourceRefs": [
      "[14]",
      "[25]"
    ]
  },
  {
    "name": "Physical Activity",
    "category": "Lifestyle / Behaviour",
    "description": "Physical-activity context considered in diabetes and weight-management care.",
    "sourceRefs": [
      "[25]"
    ]
  }
] AS item
MERGE (c:MedicalConcept {name: item.name})
SET c.category = item.category,
    c.description = item.description,
    c.scope = 'Type 2 Diabetes',
    c.sourceRefs = item.sourceRefs,
    c.schemaVersion = 't2dm-medical-kg-v1'
RETURN count(c) AS conceptsProcessed;
