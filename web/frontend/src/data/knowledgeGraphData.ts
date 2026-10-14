/**
 * Knowledge graph dataset matching Figma Image 3:
 * Patient 2000_0_20201230 (Elena Morales), 14 entities across 4 categories
 */
import type { KnowledgeGraphNode, KnowledgeGraphEdge } from '../types';

export const KG_NODES: KnowledgeGraphNode[] = [
  // Core Patient Node
  /**
   * The central node representing the patient
   
  {
    id: '2000_0_20201230',
    label: '2000_0_20201230',
    category: 'Patient',
    entityType: 'Patient Core Node',
    value: 'Type 2 diabetes',
    description: 'Central longitudinal patient record for Elena Morales.',
    details: {
      'Entity': '2000_0_20201230',
      'Category': 'Patient',
      'Description': 'Patient cohort identifier',
      'Patient ID': '2000_0_20201230',
      'Condition': 'Type 2 diabetes',
      'Data type': 'Longitudinal',
      'Graph role': 'Core node',
      'Recorded data': 'Time-based patient observations',
    },
    x: 400,
    y: 190,
  },

  // Category Nodes
  {
    id: 'cat_demographics',
    label: 'Demographics',
    category: 'Demographics',
    entityType: 'Category Hub',
    value: '4 entities',
    description: 'Patient demographic attributes and baseline physical measurements.',
    details: {
      'Entity': 'Demographics',
      'Category': 'Demographics',
      'Entities Count': '4 entities',
      'Description': 'Baseline patient anthropometry and demographic profile',
      'Graph role': 'Category cluster hub',
      'Source': 'Hospital registration record',
    },
    x: 400,
    y: 80,
  },
  {
    id: 'cat_clinical',
    label: 'Clinical Data',
    category: 'Clinical Data',
    entityType: 'Category Hub',
    value: '3 entities',
    description: 'Continuous and discrete biomarker measurements and sensor data.',
    details: {
      'Entity': 'Clinical Data',
      'Category': 'Clinical Data',
      'Entities Count': '3 entities',
      'Description': 'CGM telemetry and laboratory blood tests',
      'Graph role': 'Category cluster hub',
      'Source': 'Abbott FreeStyle Libre & Lab LIS',
    },
    x: 230,
    y: 190,
  },
  {
    id: 'cat_lifestyle',
    label: 'Lifestyle',
    category: 'Lifestyle',
    entityType: 'Category Hub',
    value: '1 entity',
    description: 'Behavioral, nutritional, and physical activity logs.',
    details: {
      'Entity': 'Lifestyle',
      'Category': 'Lifestyle',
      'Entities Count': '1 entity',
      'Description': 'Caloric and carbohydrate tracking telemetry',
      'Graph role': 'Category cluster hub',
      'Source': 'Digital Twin mobile companion app',
    },
    x: 400,
    y: 300,
  },
  {
    id: 'cat_medical',
    label: 'Medical Data',
    category: 'Medical Data',
    entityType: 'Category Hub',
    value: '2 entities',
    description: 'Prescription history, medication classes, and pharmacological dosing.',
    details: {
      'Entity': 'Medical Data',
      'Category': 'Medical Data',
      'Entities Count': '2 entities',
      'Description': 'Active pharmacotherapy regimens',
      'Graph role': 'Category cluster hub',
      'Source': 'Electronic Health Record (EHR)',
    },
    x: 570,
    y: 190,
  },

  // Demographics Leaf Nodes (4 entities)
  {
    id: 'leaf_age',
    label: 'Age',
    category: 'Demographics',
    entityType: 'Attribute',
    value: '58 y',
    description: 'Chronological age at evaluation.',
    details: {
      'Entity': 'Age',
      'Category': 'Demographics',
      'Value': '58 years',
      'Graph role': 'Risk covariate',
      'Data type': 'Integer',
    },
    x: 320,
    y: 30,
  },
  {
    id: 'leaf_gender',
    label: 'Gender',
    category: 'Demographics',
    entityType: 'Attribute',
    value: 'Female',
    description: 'Biological sex.',
    details: {
      'Entity': 'Gender',
      'Category': 'Demographics',
      'Value': 'Female',
      'Graph role': 'Categorical feature',
      'Data type': 'String',
    },
    x: 380,
    y: 20,
  },
  {
    id: 'leaf_height',
    label: 'Height',
    category: 'Demographics',
    entityType: 'Attribute',
    value: '162 cm',
    description: 'Standing stadiometer height.',
    details: {
      'Entity': 'Height',
      'Category': 'Demographics',
      'Value': '162 cm',
      'Graph role': 'Biometric measurement',
      'Data type': 'Float',
    },
    x: 440,
    y: 20,
  },
  {
    id: 'leaf_weight',
    label: 'Weight',
    category: 'Demographics',
    entityType: 'Attribute',
    value: '71.6 kg',
    description: 'Body weight measured at Visit 14.',
    details: {
      'Entity': 'Weight',
      'Category': 'Demographics',
      'Value': '71.6 kg (BMI 27.3)',
      'Graph role': 'Biometric measurement',
      'Data type': 'Float',
    },
    x: 500,
    y: 30,
  },

  // Clinical Data Leaf Nodes (3 entities)
  {
    id: 'leaf_cgm',
    label: 'CGM',
    category: 'Clinical Data',
    entityType: 'Continuous Sensor',
    value: '154 mg/dL',
    description: 'Subcutaneous interstitial glucose sensor streaming at 15-minute intervals.',
    details: {
      'Entity': 'Continuous Glucose Monitoring (CGM)',
      'Category': 'Clinical Data',
      'Mean Glucose': '154 mg/dL',
      'Time in Range': '38.0%',
      'Sensor Type': 'FreeStyle Libre 3',
      'Data type': 'Time-series stream',
      'Graph role': 'High-frequency telemetry',
    },
    x: 100,
    y: 150,
  },
  {
    id: 'leaf_cbg',
    label: 'CBG',
    category: 'Clinical Data',
    entityType: 'Capillary Measurement',
    value: '9.4 mmol/L',
    description: 'Capillary blood glucose fingerstick validation test.',
    details: {
      'Entity': 'Capillary Blood Glucose (CBG)',
      'Category': 'Clinical Data',
      'Fasting Value': '9.4 mmol/L (169 mg/dL)',
      'Timestamp': 'Morning Fasting 07:45 AM',
      'Data type': 'Discrete point',
      'Graph role': 'Validation biomarker',
    },
    x: 100,
    y: 200,
  },
  {
    id: 'leaf_blood_ketone',
    label: 'Blood Ketone',
    category: 'Clinical Data',
    entityType: 'Biomarker Test',
    value: '0.3 mmol/L',
    description: 'Beta-hydroxybutyrate blood ketone concentration.',
    details: {
      'Entity': 'Blood Ketone',
      'Category': 'Clinical Data',
      'Value': '0.3 mmol/L (Normal < 0.6)',
      'Risk Flag': 'Normal range (DKA unindicated)',
      'Data type': 'Quantitative assay',
      'Graph role': 'Metabolic safety marker',
    },
    x: 100,
    y: 250,
  },

  // Medical Data Leaf Nodes (2 entities)
  {
    id: 'leaf_insulin',
    label: 'Insulin',
    category: 'Medical Data',
    entityType: 'Medication',
    value: '18 U Glargine',
    description: 'Basal insulin glargine once daily at bedtime.',
    details: {
      'Entity': 'Insulin Glargine',
      'Category': 'Medical Data',
      'Dose': '18 Units subcutaneous at 22:00',
      'Drug Class': 'Long-acting basal insulin analog',
      'Data type': 'Pharmacological Rx',
      'Graph role': 'Therapeutic intervention',
    },
    x: 700,
    y: 165,
  },
  {
    id: 'leaf_medication',
    label: 'Medication',
    category: 'Medical Data',
    entityType: 'Medication',
    value: 'Metformin 1000mg',
    description: 'Biguanide insulin sensitizer taken twice daily with meals.',
    details: {
      'Entity': 'Metformin HCl ER',
      'Category': 'Medical Data',
      'Dose': '1000 mg BID with morning & evening meals',
      'Drug Class': 'Biguanide (AMPK activator)',
      'Data type': 'Oral antihyperglycemic',
      'Graph role': 'Primary insulin sensitizer',
    },
    x: 700,
    y: 225,
  },

  // Lifestyle Leaf Node (1 entity)
  {
    id: 'leaf_diet',
    label: 'Dietary Intake',
    category: 'Lifestyle',
    entityType: 'Lifestyle Log',
    value: '1850 kcal/day',
    description: 'Estimated daily macronutrient intake logged via mobile diet assistant.',
    details: {
      'Entity': 'Dietary Intake',
      'Category': 'Lifestyle',
      'Average Calories': '1,850 kcal/day',
      'Carbohydrate Load': '48% of total daily energy',
      'Fiber Intake': '18 g/day',
      'Data type': 'Nutritional telemetry',
      'Graph role': 'Behavioral modifier',
    },
    x: 400,
    y: 370,
  },
  */
];

export const KG_EDGES: KnowledgeGraphEdge[] = [
  // Core patient connects to category hubs
  /** 
  { source: '2000_0_20201230', target: 'cat_demographics' },
  { source: '2000_0_20201230', target: 'cat_clinical' },
  { source: '2000_0_20201230', target: 'cat_medical' },
  { source: '2000_0_20201230', target: 'cat_lifestyle' },

  // Category hubs connect to leaf entities
  { source: 'cat_demographics', target: 'leaf_age' },
  { source: 'cat_demographics', target: 'leaf_gender' },
  { source: 'cat_demographics', target: 'leaf_height' },
  { source: 'cat_demographics', target: 'leaf_weight' },

  { source: 'cat_clinical', target: 'leaf_cgm' },
  { source: 'cat_clinical', target: 'leaf_cbg' },
  { source: 'cat_clinical', target: 'leaf_blood_ketone' },

  { source: 'cat_medical', target: 'leaf_insulin' },
  { source: 'cat_medical', target: 'leaf_medication' },

  { source: 'cat_lifestyle', target: 'leaf_diet' },
   */
];

export const KG_LONGITUDINAL_CLINICAL_DATA = [
/** 
  { date: '30 Dec', cgm: 8.8, cbg: 9.1 },
  { date: '05 Jan', cgm: 7.2, cbg: 7.6 },
  { date: '12 Jan', cgm: 8.4, cbg: 8.9 },
  { date: '20 Jan', cgm: 6.9, cbg: 7.1 },
  { date: '28 Jan', cgm: 7.8, cbg: 8.0 },
  */
];
