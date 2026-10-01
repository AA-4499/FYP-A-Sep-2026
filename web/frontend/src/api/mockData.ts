/**
 * Comprehensive Realistic Mock Dataset for ShanghaiT2DM Longitudinal Cohort
 * Provides full offline demonstration capability and seamless API fallback.
 * Swinburne University of Technology Sarawak · Ts. Dr. Vong Wan Tze
 */
import type {
  PatientProfile,
  PatientListResponse,
  TimelineResponse,
  RiskAssessmentResponse,
  XAIResponse,
  InsightsResponse,
  DigitalTwinResponse,
  KnowledgeGraphResponse,
  PatientReportResponse,
  CohortStats,
  AuditLogItem,
  User,
} from '../types';

export const DEMO_USERS: Record<string, User> = {
  patient_1001: {
    id: 'user_1001',
    name: 'Chen Wei',
    email: 'chen.wei@patient.health',
    role: 'patient',
    patientId: '1001',
    title: 'Patient (ShanghaiT2DM Cohort)',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    department: 'Outpatient Endocrinology',
  },
  patient_1002: {
    id: 'user_1002',
    name: 'Lin Na',
    email: 'lin.na@patient.health',
    role: 'patient',
    patientId: '1002',
    title: 'Patient (ShanghaiT2DM Cohort)',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    department: 'Outpatient Endocrinology',
  },
  admin_clinician: {
    id: 'admin_wong',
    name: 'Dr. Alex Wong',
    email: 'dr.wong@swinburne.edu.my',
    role: 'admin',
    title: 'Chief Endocrinologist & Platform Admin',
    avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80',
    department: 'Metabolic & Digital Health Lab',
  },
};

export const MOCK_PATIENTS: PatientProfile[] = [
  {
    id: '1001',
    name: 'Chen Wei',
    age: 62,
    gender: 'Female',
    bmi: 26.4,
    diabetes_duration_years: 8.5,
    hypertension: 1,
    smoking: 0,
    phys_activity_level: 'Moderate',
    fasting_glucose: 7.8,
    hba1c: 7.4,
    systolic_bp: 138,
    diastolic_bp: 84,
    ldl_cholesterol: 3.1,
    hdl_cholesterol: 1.2,
    triglycerides: 2.1,
    egfr: 78.5,
    medications: ['Metformin 1000mg BID', 'Gliclazide 60mg QD'],
    cgm_days_recorded: 14,
    risk_category: 'Moderate Risk',
  },
  {
    id: '1002',
    name: 'Lin Na',
    age: 54,
    gender: 'Male',
    bmi: 29.8,
    diabetes_duration_years: 4.0,
    hypertension: 1,
    smoking: 1,
    phys_activity_level: 'Sedentary',
    fasting_glucose: 9.4,
    hba1c: 8.6,
    systolic_bp: 146,
    diastolic_bp: 90,
    ldl_cholesterol: 3.8,
    hdl_cholesterol: 0.95,
    triglycerides: 2.9,
    egfr: 82.0,
    medications: ['Metformin 1000mg BID', 'Empagliflozin 10mg QD', 'Atorvastatin 20mg QN'],
    cgm_days_recorded: 14,
    risk_category: 'High Risk',
  },
  {
    id: '1003',
    name: 'Zhang Yong',
    age: 48,
    gender: 'Female',
    bmi: 22.8,
    diabetes_duration_years: 2.0,
    hypertension: 0,
    smoking: 0,
    phys_activity_level: 'Active',
    fasting_glucose: 6.1,
    hba1c: 6.3,
    systolic_bp: 118,
    diastolic_bp: 74,
    ldl_cholesterol: 2.4,
    hdl_cholesterol: 1.5,
    triglycerides: 1.3,
    egfr: 98.2,
    medications: ['Metformin 500mg BID'],
    cgm_days_recorded: 14,
    risk_category: 'Controlled / Low Risk',
  },
  {
    id: '1004',
    name: 'Liu Kang',
    age: 71,
    gender: 'Male',
    bmi: 27.5,
    diabetes_duration_years: 15.0,
    hypertension: 1,
    smoking: 0,
    phys_activity_level: 'Sedentary',
    fasting_glucose: 8.7,
    hba1c: 8.1,
    systolic_bp: 142,
    diastolic_bp: 82,
    ldl_cholesterol: 2.9,
    hdl_cholesterol: 1.1,
    triglycerides: 2.4,
    egfr: 58.4,
    medications: ['Insulin Glargine 18U QN', 'Metformin 850mg TID', 'Amlodipine 5mg QD'],
    cgm_days_recorded: 14,
    risk_category: 'High Risk',
  },
  {
    id: '1005',
    name: 'Huang Ming',
    age: 59,
    gender: 'Male',
    bmi: 28.1,
    diabetes_duration_years: 6.5,
    hypertension: 1,
    smoking: 1,
    phys_activity_level: 'Moderate',
    fasting_glucose: 8.2,
    hba1c: 7.8,
    systolic_bp: 135,
    diastolic_bp: 86,
    ldl_cholesterol: 3.3,
    hdl_cholesterol: 1.05,
    triglycerides: 2.3,
    egfr: 76.1,
    medications: ['Metformin 1000mg BID', 'Sitagliptin 100mg QD'],
    cgm_days_recorded: 14,
    risk_category: 'Moderate Risk',
  },
  {
    id: '1006',
    name: 'Wang Fang',
    age: 65,
    gender: 'Female',
    bmi: 24.2,
    diabetes_duration_years: 3.5,
    hypertension: 0,
    smoking: 0,
    phys_activity_level: 'Active',
    fasting_glucose: 6.7,
    hba1c: 6.7,
    systolic_bp: 124,
    diastolic_bp: 78,
    ldl_cholesterol: 2.6,
    hdl_cholesterol: 1.4,
    triglycerides: 1.6,
    egfr: 89.0,
    medications: ['Acarbose 50mg TID with meals'],
    cgm_days_recorded: 14,
    risk_category: 'Controlled / Low Risk',
  },
  {
    id: '1007',
    name: 'Zhao Lei',
    age: 51,
    gender: 'Male',
    bmi: 31.4,
    diabetes_duration_years: 9.0,
    hypertension: 1,
    smoking: 1,
    phys_activity_level: 'Sedentary',
    fasting_glucose: 10.2,
    hba1c: 9.2,
    systolic_bp: 152,
    diastolic_bp: 94,
    ldl_cholesterol: 4.1,
    hdl_cholesterol: 0.88,
    triglycerides: 3.4,
    egfr: 69.2,
    medications: ['Metformin 1000mg BID', 'Dapagliflozin 10mg QD', 'Telmisartan 40mg QD'],
    cgm_days_recorded: 14,
    risk_category: 'High Risk',
  },
  {
    id: '1008',
    name: 'Sun Mei',
    age: 58,
    gender: 'Female',
    bmi: 25.1,
    diabetes_duration_years: 5.0,
    hypertension: 0,
    smoking: 0,
    phys_activity_level: 'Moderate',
    fasting_glucose: 7.2,
    hba1c: 7.1,
    systolic_bp: 130,
    diastolic_bp: 80,
    ldl_cholesterol: 2.8,
    hdl_cholesterol: 1.3,
    triglycerides: 1.8,
    egfr: 84.5,
    medications: ['Glimepiride 2mg QD', 'Metformin 500mg BID'],
    cgm_days_recorded: 14,
    risk_category: 'Moderate Risk',
  },
];

export const MOCK_COHORT_STATS: CohortStats = {
  totalPatients: 112,
  highRiskCount: 28,
  moderateRiskCount: 46,
  lowRiskCount: 38,
  averageHbA1c: 7.68,
  averageBMI: 26.8,
  activeSensors: 98,
  hypoAlertRate: 3.2,
};

export const MOCK_AUDIT_LOGS: AuditLogItem[] = [
  {
    id: 'aud_1',
    timestamp: 'Today, 10:24 AM',
    user: 'Dr. Alex Wong',
    role: 'Admin / Clinician',
    action: 'Prescription Adjustment',
    details: 'Initiated Empagliflozin 10mg QD titration for Patient #1002 following high glycemic variability alert.',
    type: 'clinical',
  },
  {
    id: 'aud_2',
    timestamp: 'Today, 09:42 AM',
    user: 'AI Risk Monitor',
    role: 'System Agent',
    action: 'Hypoglycemia Warning',
    details: 'Nocturnal glucose dip detected (<3.9 mmol/L at 03:15 AM) for Patient #1008 on Glimepiride.',
    type: 'alert',
  },
  {
    id: 'aud_3',
    timestamp: 'Today, 08:30 AM',
    user: 'CGM Telemetry Sync',
    role: 'Automated Pipeline',
    action: 'Cohort Telemetry Ingest',
    details: 'Synced 14-day continuous glucose streams for 98 active ShanghaiT2DM sensors (28,224 readings).',
    type: 'system',
  },
  {
    id: 'aud_4',
    timestamp: 'Yesterday, 04:15 PM',
    user: 'Dr. Alex Wong',
    role: 'Admin / Clinician',
    action: 'Counterfactual Simulation',
    details: 'Evaluated lifestyle + Metformin boost scenario for Patient #1001: projected HbA1c drop -0.6%.',
    type: 'simulation',
  },
  {
    id: 'aud_5',
    timestamp: 'Yesterday, 02:00 PM',
    user: 'TreeSHAP Engine',
    role: 'System Agent',
    action: 'Model Recalibration',
    details: 'XGBoost complication model AUROC verified at 0.892 with 1,420 biomedical ontology connections.',
    type: 'system',
  },
];

export function getMockPatient(id: string): PatientProfile {
  return MOCK_PATIENTS.find((p) => p.id === id) || MOCK_PATIENTS[0];
}

export function getMockPatientList(query = '', page = 1, perPage = 12): PatientListResponse {
  let filtered = [...MOCK_PATIENTS];
  if (query.trim()) {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.id.includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.risk_category.toLowerCase().includes(q) ||
        p.medications.some((m) => m.toLowerCase().includes(q))
    );
  }
  const total = filtered.length;
  const total_pages = Math.ceil(total / perPage) || 1;
  const start = (page - 1) * perPage;
  const patients = filtered.slice(start, start + perPage);

  return { total, page, per_page: perPage, total_pages, patients };
}

export function getMockTimeline(id: string): TimelineResponse {
  const p = getMockPatient(id);
  const baseGlucose = p.fasting_glucose;

  const hours = [
    '00:00', '02:00', '04:00', '06:00', '08:00', '10:00',
    '12:00', '14:00', '16:00', '18:00', '20:00', '22:00',
  ];

  const hourly_cgm_profile = hours.map((hour, idx) => {
    // Generate realistic diurnal fluctuation: peaks after meals at 08:00, 12:00, 18:00
    let wave = 0;
    if (idx === 4) wave = 2.4; // breakfast spike
    else if (idx === 5) wave = 1.6;
    else if (idx === 6) wave = 2.8; // lunch spike
    else if (idx === 7) wave = 1.9;
    else if (idx === 9) wave = 3.2; // dinner spike
    else if (idx === 10) wave = 2.0;
    else if (idx === 1 || idx === 2) wave = -1.2; // dawn / night nadir

    const glucose = Number(Math.max(3.8, baseGlucose + wave + (Math.sin(idx) * 0.4)).toFixed(1));
    return {
      hour,
      glucose,
      target_low: 3.9,
      target_high: 10.0,
    };
  });

  const daily_trends = Array.from({ length: 14 }).map((_, i) => {
    const dayNum = i + 1;
    const variation = (Math.sin(dayNum) * 0.5) + (Math.cos(dayNum * 0.7) * 0.3);
    const mean = Number((baseGlucose + variation).toFixed(1));
    const minG = Number((mean - 2.1).toFixed(1));
    const maxG = Number((mean + 3.4).toFixed(1));
    const tir = Math.min(95, Math.max(45, Math.round(75 - (p.hba1c - 6.5) * 12 + variation * 5)));

    return {
      day: `Day ${dayNum}`,
      day_number: dayNum,
      mean_glucose: mean,
      min_glucose: minG,
      max_glucose: maxG,
      time_in_range_pct: tir,
      time_below_range_pct: 3,
      time_above_range_pct: 100 - tir - 3,
    };
  });

  return {
    patient_id: id,
    summary: {
      average_glucose: Number(baseGlucose.toFixed(1)),
      time_in_range_pct: p.hba1c > 8.0 ? 56 : p.hba1c > 7.0 ? 72 : 88,
      time_below_range_pct: 3.1,
      time_above_range_pct: p.hba1c > 8.0 ? 40.9 : p.hba1c > 7.0 ? 24.9 : 8.9,
      glucose_management_indicator: Number((p.hba1c - 0.2).toFixed(1)),
      days_recorded: 14,
    },
    daily_trends,
    hourly_cgm_profile,
    historical_visits: [
      {
        visit: 'Baseline',
        date: '2025-04-10',
        hba1c: Number((p.hba1c + 0.7).toFixed(1)),
        fasting_glucose: Number((p.fasting_glucose + 0.9).toFixed(1)),
        systolic_bp: p.systolic_bp + 6,
        bmi: p.bmi + 0.4,
      },
      {
        visit: '3-Month',
        date: '2025-07-15',
        hba1c: Number((p.hba1c + 0.3).toFixed(1)),
        fasting_glucose: Number((p.fasting_glucose + 0.4).toFixed(1)),
        systolic_bp: p.systolic_bp + 2,
        bmi: p.bmi + 0.1,
      },
      {
        visit: 'Current (6-Month)',
        date: '2025-10-20',
        hba1c: p.hba1c,
        fasting_glucose: p.fasting_glucose,
        systolic_bp: p.systolic_bp,
        bmi: p.bmi,
      },
    ],
  };
}

export function getMockRiskAssessment(id: string): RiskAssessmentResponse {
  const p = getMockPatient(id);
  const scorePct = Math.round(
    Math.min(95, Math.max(15, (p.hba1c - 5.5) * 16 + (p.bmi - 20) * 2.2 + p.diabetes_duration_years * 1.5))
  );

  const category = scorePct >= 65 ? 'High Risk' : scorePct >= 38 ? 'Moderate Risk' : 'Low Risk';
  const color = scorePct >= 65 ? '#ef4444' : scorePct >= 38 ? '#f59e0b' : '#10b981';

  return {
    patient_id: id,
    composite_risk_score: scorePct / 100,
    composite_risk_pct: scorePct,
    risk_category: category,
    risk_color: color,
    sub_risks: {
      glycemic_variability: {
        name: 'Glycemic Instability & CGM Variability',
        score: Math.min(90, Math.round(scorePct * 1.05)),
        level: scorePct >= 65 ? 'High' : scorePct >= 40 ? 'Moderate' : 'Low',
        key_driver: `CGM Peak-to-Trough amplitude exceeding target threshold (HbA1c ${p.hba1c}%)`,
      },
      cardiovascular: {
        name: 'Cardiovascular & Macrovascular Strain',
        score: Math.min(92, Math.round((p.systolic_bp - 110) * 1.3 + (p.bmi - 22) * 2)),
        level: p.systolic_bp > 140 ? 'High' : p.systolic_bp > 125 ? 'Moderate' : 'Low',
        key_driver: `Elevated systolic blood pressure (${p.systolic_bp} mmHg) and lipid ratio`,
      },
      hypoglycemia: {
        name: 'Iatrogenic Hypoglycemia Vulnerability',
        score: p.medications.some((m) => m.toLowerCase().includes('glip') || m.toLowerCase().includes('glic'))
          ? 48
          : 22,
        level: p.medications.some((m) => m.toLowerCase().includes('glip') || m.toLowerCase().includes('glic'))
          ? 'Moderate'
          : 'Low',
        key_driver: 'Sulfonylurea secretagogue co-prescription with delayed evening meals',
      },
      nephropathy: {
        name: 'Diabetic Nephropathy & Renal Load',
        score: Math.min(88, Math.max(12, Math.round(100 - p.egfr + 10))),
        level: p.egfr < 60 ? 'High' : p.egfr < 85 ? 'Moderate' : 'Low',
        key_driver: `Estimated GFR at ${p.egfr} mL/min/1.73m² with long diabetes duration`,
      },
    },
    model_metadata: {
      model_name: 'ShanghaiT2DM Complication Risk Ensemble (XGBoost + Ridge)',
      model_architecture: 'Gradient Boosted Decision Trees calibrated via Platt Scaling',
      dataset: 'ShanghaiT2DM Real-World Longitudinal Cohort (n=112)',
      validation_auroc: 0.892,
      last_calibrated: '2025-10-15',
    },
  };
}

export function getMockXAI(id: string): XAIResponse {
  const p = getMockPatient(id);
  const risk = getMockRiskAssessment(id);

  return {
    patient_id: id,
    base_expected_value: 0.28,
    predicted_risk_score: risk.composite_risk_score,
    explanation_summary: `SHAP feature attribution indicates that elevated HbA1c (${p.hba1c}%) and Diabetes Duration (${p.diabetes_duration_years} yrs) are the primary positive drivers increasing complication risk, partially mitigated by physical activity and preserved renal function.`,
    contributions: [
      {
        feature: 'hba1c',
        label: 'Glycated Hemoglobin (HbA1c)',
        value: `${p.hba1c}%`,
        shap_value: +(0.14 * (p.hba1c - 6.5)).toFixed(3),
        impact: p.hba1c > 7.0 ? 'Increases Risk' : 'Protective / Lowers Risk',
        category: 'Glycemic Control',
        description: 'Primary biomarker for 3-month average plasma glucose concentration.',
      },
      {
        feature: 'fasting_glucose',
        label: 'Fasting Blood Glucose',
        value: `${p.fasting_glucose} mmol/L`,
        shap_value: +(0.08 * (p.fasting_glucose - 6.0)).toFixed(3),
        impact: p.fasting_glucose > 7.0 ? 'Increases Risk' : 'Protective / Lowers Risk',
        category: 'Glycemic Control',
        description: 'Morning baseline glucose indicating basal hepatic glucose production.',
      },
      {
        feature: 'systolic_bp',
        label: 'Systolic Blood Pressure',
        value: `${p.systolic_bp} mmHg`,
        shap_value: +(0.003 * (p.systolic_bp - 120)).toFixed(3),
        impact: p.systolic_bp > 130 ? 'Increases Risk' : 'Protective / Lowers Risk',
        category: 'Cardiovascular',
        description: 'Arterial hemodynamic strain contributing to endothelial microvascular damage.',
      },
      {
        feature: 'bmi',
        label: 'Body Mass Index (BMI)',
        value: `${p.bmi} kg/m²`,
        shap_value: +(0.012 * (p.bmi - 24.0)).toFixed(3),
        impact: p.bmi > 25.0 ? 'Increases Risk' : 'Protective / Lowers Risk',
        category: 'Metabolic & Anthropometric',
        description: 'Surrogate for peripheral insulin resistance and adipose tissue inflammation.',
      },
      {
        feature: 'diabetes_duration',
        label: 'T2DM Duration',
        value: `${p.diabetes_duration_years} Years`,
        shap_value: +(0.008 * (p.diabetes_duration_years - 3.0)).toFixed(3),
        impact: p.diabetes_duration_years > 5 ? 'Increases Risk' : 'Protective / Lowers Risk',
        category: 'Clinical History',
        description: 'Cumulative duration of metabolic dysregulation and beta-cell exhaustion.',
      },
      {
        feature: 'egfr',
        label: 'Estimated GFR (Renal)',
        value: `${p.egfr} mL/min`,
        shap_value: -+(0.004 * (p.egfr - 75.0)).toFixed(3),
        impact: p.egfr > 80 ? 'Protective / Lowers Risk' : 'Increases Risk',
        category: 'Renal Biomarkers',
        description: 'Renal filtration efficiency protecting against nephropathic end-organ failure.',
      },
    ],
    methodology: 'TreeSHAP (Exact Tree Shapley Additive Explanations)',
  };
}

export function getMockDigitalTwin(id: string): DigitalTwinResponse {
  const p = getMockPatient(id);
  const risk = getMockRiskAssessment(id);

  const pancreasStress = Math.min(95, Math.round((p.hba1c - 5.5) * 20 + 20));
  const cardioStress = Math.min(95, Math.round((p.systolic_bp - 110) * 1.2 + (p.bmi - 22) * 1.5));
  const kidneyStress = Math.min(95, Math.max(10, Math.round(110 - p.egfr)));
  const liverStress = Math.min(90, Math.round((p.bmi - 21) * 3 + (p.fasting_glucose - 5.5) * 4));

  return {
    patient_id: id,
    twin_status: risk.composite_risk_pct >= 60 ? 'High Metabolic Load' : risk.composite_risk_pct >= 35 ? 'Moderate Metabolic Load' : 'Optimal Metabolic Equilibrium',
    avatar_glow: risk.risk_color === '#ef4444' ? 'rgba(239, 68, 68, 0.4)' : risk.risk_color === '#f59e0b' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)',
    avatar_status_color: risk.risk_color,
    composite_risk: risk.composite_risk_pct,
    organs: {
      pancreas: {
        name: 'Endocrine Pancreas & Beta-Cell Dynamics',
        stress_score: pancreasStress,
        status: pancreasStress > 65 ? 'Elevated Beta-Cell Strain' : pancreasStress > 40 ? 'Moderate Secretory Load' : 'Preserved Beta-Cell Function',
        color: pancreasStress > 65 ? '#ef4444' : pancreasStress > 40 ? '#f59e0b' : '#10b981',
        details: `Insulin secretion demand is high due to HbA1c ${p.hba1c}%. Early phase insulin response is attenuated.`,
      },
      cardiovascular: {
        name: 'Cardiovascular & Vascular Tree',
        stress_score: cardioStress,
        status: cardioStress > 65 ? 'High Arterial Load' : cardioStress > 40 ? 'Moderate Vascular Strain' : 'Normotensive Flow',
        color: cardioStress > 65 ? '#ef4444' : cardioStress > 40 ? '#f59e0b' : '#10b981',
        details: `Systolic BP ${p.systolic_bp} mmHg with BMI ${p.bmi}. Peripheral arterial stiffness moderate.`,
      },
      kidneys: {
        name: 'Renal Microvasculature & Glomerular Filter',
        stress_score: kidneyStress,
        status: kidneyStress > 65 ? 'Hyperfiltration / Nephropathy Risk' : kidneyStress > 35 ? 'Moderate Renal Load' : 'Optimal Glomerular Function',
        color: kidneyStress > 65 ? '#ef4444' : kidneyStress > 35 ? '#f59e0b' : '#10b981',
        details: `eGFR ${p.egfr} mL/min/1.73m². Minimal microalbuminuria detected.`,
      },
      liver: {
        name: 'Hepatic Glucose Autoregulation',
        stress_score: liverStress,
        status: liverStress > 65 ? 'Elevated Gluconeogenesis' : liverStress > 40 ? 'Moderate Steatosis Burden' : 'Balanced Hepatic Clearance',
        color: liverStress > 65 ? '#ef4444' : liverStress > 40 ? '#f59e0b' : '#10b981',
        details: `Fasting blood glucose ${p.fasting_glucose} mmol/L reflects overnight hepatic glucose release.`,
      },
    },
    morphometry: {
      height_cm: p.gender === 'Male' ? 172 : 160,
      weight_kg: Number((p.bmi * Math.pow((p.gender === 'Male' ? 1.72 : 1.60), 2)).toFixed(1)),
      bmi: p.bmi,
      body_fat_est_pct: p.gender === 'Male' ? Number((p.bmi * 0.95).toFixed(1)) : Number((p.bmi * 1.25).toFixed(1)),
    },
  };
}

export function getMockInsights(id: string): InsightsResponse {
  const p = getMockPatient(id);
  const isHigh = p.hba1c > 8.0;

  return {
    patient_id: id,
    alert_level: isHigh ? 'warning' : 'normal',
    alert_message: isHigh
      ? `Persistent postprandial glucose excursions detected over past 7 days. HbA1c ${p.hba1c}% requires clinical review.`
      : `Glycemic control is stable within target boundaries. Time-in-Range (TIR) meets clinical guidelines.`,
    longitudinal_summary: `Patient #${id} (${p.name}) shows 14-day CGM sensor compliance with average glucose ${p.fasting_glucose} mmol/L. Complication risk is currently ${p.risk_category}.`,
    recommendations: [
      {
        category: 'Nutrition & Diet',
        priority: 'High',
        title: 'Low-Glycemic Evening Meal Modification',
        detail: 'Substitute refined evening carbohydrates with low-GI complex legumes and high-fiber cruciferous vegetables to dampen dinner-to-bedtime glucose spikes.',
        target: 'Aim to reduce post-dinner peak glucose by >1.8 mmol/L',
      },
      {
        category: 'Physical Activity',
        priority: 'High',
        title: 'Postprandial Walking Protocol',
        detail: 'Engage in a 20-25 minute brisk walk within 30 minutes following lunch and dinner. Activates insulin-independent GLUT4 glucose uptake in skeletal muscle.',
        target: 'Increase daily step count to 7,500 - 8,500 steps/day',
      },
      {
        category: 'Pharmacotherapy Adherence',
        priority: 'Medium',
        title: 'Regular Metformin Timetable',
        detail: 'Ensure Metformin is consistently administered immediately with meals to minimize gastrointestinal discomfort and maintain stable basal hepatic suppression.',
        target: 'Adherence score >95%',
      },
      {
        category: 'Digital Twin Goal',
        priority: 'Medium',
        title: 'Target Time-in-Range (TIR) Expansion',
        detail: 'Current TIR is satisfactory. Aim to reach >75% by moderating morning breakfasts with reduced simple sugars.',
        target: 'Time-in-Range >75% for next 14-day CGM cycle',
      },
    ],
    generated_by: 'DiabeTwin Clinical Decision Support Engine (v2.4)',
  };
}

export function getMockKnowledgeGraph(id: string): KnowledgeGraphResponse {
  const p = getMockPatient(id);

  return {
    patient_id: id,
    elements: {
      nodes: [
        { data: { id: 'patient', label: `${p.name} (#${id})`, type: 'Patient', category: 'core', color: '#2563eb', size: 45 } },
        { data: { id: 'hba1c', label: `HbA1c: ${p.hba1c}%`, type: 'Biomarker', category: 'glycemic', color: '#ef4444' } },
        { data: { id: 'fasting_glu', label: `FBG: ${p.fasting_glucose} mmol/L`, type: 'Biomarker', category: 'glycemic', color: '#f59e0b' } },
        { data: { id: 'bp', label: `BP: ${p.systolic_bp}/${p.diastolic_bp} mmHg`, type: 'Vital', category: 'cardio', color: '#ec4899' } },
        { data: { id: 'bmi', label: `BMI: ${p.bmi}`, type: 'Anthropometric', category: 'metabolic', color: '#8b5cf6' } },
        { data: { id: 'egfr', label: `eGFR: ${p.egfr} mL/min`, type: 'Biomarker', category: 'renal', color: '#06b6d4' } },
        { data: { id: 'med_metformin', label: 'Metformin', type: 'Medication', category: 'drug', color: '#10b981' } },
        { data: { id: 't2dm', label: 'Type 2 Diabetes Mellitus', type: 'Diagnosis', category: 'disease', color: '#dc2626' } },
        { data: { id: 'hypertension', label: 'Hypertension', type: 'Diagnosis', category: 'disease', color: '#f97316' } },
        { data: { id: 'risk_cardio', label: 'Cardiovascular Risk', type: 'RiskFactor', category: 'outcome', color: '#e11d48' } },
        { data: { id: 'lifestyle_walk', label: 'Brisk Walking 30m', type: 'Intervention', category: 'lifestyle', color: '#059669' } },
        { data: { id: 'guideline_ada', label: 'ADA/EASD 2025 Guideline', type: 'Guideline', category: 'protocol', color: '#475569' } },
      ],
      edges: [
        { data: { id: 'e1', source: 'patient', target: 't2dm', label: 'DIAGNOSED_WITH' } },
        { data: { id: 'e2', source: 'patient', target: 'hba1c', label: 'HAS_LAB_VALUE' } },
        { data: { id: 'e3', source: 'patient', target: 'fasting_glu', label: 'HAS_LAB_VALUE' } },
        { data: { id: 'e4', source: 'patient', target: 'bp', label: 'EXHIBITS_VITAL' } },
        { data: { id: 'e5', source: 'patient', target: 'bmi', label: 'BODY_METRIC' } },
        { data: { id: 'e6', source: 'patient', target: 'egfr', label: 'RENAL_STATUS' } },
        { data: { id: 'e7', source: 'patient', target: 'med_metformin', label: 'PRESCRIBED' } },
        { data: { id: 'e8', source: 'bp', target: 'risk_cardio', label: 'AGGRAVATES' } },
        { data: { id: 'e9', source: 'hba1c', target: 'risk_cardio', label: 'CORRELATES_WITH' } },
        { data: { id: 'e10', source: 'lifestyle_walk', target: 'hba1c', label: 'REDUCES' } },
        { data: { id: 'e11', source: 'guideline_ada', target: 'med_metformin', label: 'RECOMMENDS' } },
        { data: { id: 'e12', source: 'guideline_ada', target: 'lifestyle_walk', label: 'FIRST_LINE_CARE' } },
      ],
    },
    stats: {
      total_nodes: 12,
      total_edges: 12,
      ontology_standard: 'MeSH / SNOMED-CT / ShanghaiT2DM Cohort Graph',
    },
  };
}

export function getMockSimulation(
  id: string,
  scenarioDeltas: Record<string, any>
) {
  const p = getMockPatient(id);
  const baselineRisk = getMockRiskAssessment(id);

  const deltaHba1c = Number(scenarioDeltas.hba1c || 0);
  const deltaSys = Number(scenarioDeltas.systolic_bp || 0);
  const deltaBmi = Number(scenarioDeltas.bmi || 0);

  const simHba1c = Number(Math.max(5.4, p.hba1c + deltaHba1c).toFixed(1));
  const simSys = Number(Math.max(105, p.systolic_bp + deltaSys).toFixed(1));
  const simBmi = Number(Math.max(19, p.bmi + deltaBmi).toFixed(1));

  const baselineRiskPct = baselineRisk.composite_risk_pct;
  const simRiskPct = Math.round(
    Math.min(95, Math.max(12, baselineRiskPct + deltaHba1c * 12 + deltaSys * 0.4 + deltaBmi * 1.8))
  );

  return {
    patient_id: id,
    scenario_inputs: scenarioDeltas,
    baseline_comparison: {
      hba1c: { baseline: p.hba1c, simulated: simHba1c, unit: '%' },
      time_in_range: { baseline: 72, simulated: Math.min(95, Math.round(72 - deltaHba1c * 14)), unit: '%' },
      systolic_bp: { baseline: p.systolic_bp, simulated: simSys, unit: 'mmHg' },
      bmi: { baseline: p.bmi, simulated: simBmi, unit: 'kg/m²' },
      fasting_glucose: { baseline: p.fasting_glucose, simulated: Number(Math.max(5.0, p.fasting_glucose + deltaHba1c * 0.8).toFixed(1)), unit: 'mmol/L' },
    },
    risk_outcome: {
      baseline_risk_pct: baselineRiskPct,
      simulated_risk_pct: simRiskPct,
      risk_delta_pct: simRiskPct - baselineRiskPct,
      baseline_category: baselineRisk.risk_category,
      simulated_category: simRiskPct >= 65 ? 'High Risk' : simRiskPct >= 38 ? 'Moderate Risk' : 'Low Risk',
      status: (simRiskPct < baselineRiskPct ? 'Improved' : simRiskPct > baselineRiskPct ? 'Worsened' : 'Unchanged') as 'Improved' | 'Worsened' | 'Unchanged',
    },
    organ_stress_comparison: {
      pancreas: { baseline: 65, simulated: Math.max(15, Math.round(65 + deltaHba1c * 20)) },
      cardiovascular: { baseline: 58, simulated: Math.max(15, Math.round(58 + deltaSys * 0.8)) },
      kidneys: { baseline: 42, simulated: Math.max(15, Math.round(42 + deltaSys * 0.4)) },
      liver: { baseline: 50, simulated: Math.max(15, Math.round(50 + deltaBmi * 2.5)) },
    },
  };
}

export function getMockPatientReport(id: string): PatientReportResponse {
  const p = getMockPatient(id);
  const timeline = getMockTimeline(id);
  const risk = getMockRiskAssessment(id);
  const xai = getMockXAI(id);
  const twin = getMockDigitalTwin(id);
  const insights = getMockInsights(id);

  return {
    report_id: `REP-T2DM-${id}-${Date.now().toString().slice(-4)}`,
    generated_at: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    institution: 'Swinburne University of Technology Sarawak · Faculty of Engineering, Computing and Science',
    supervision: 'Ts. Dr. Vong Wan Tze · Academic Research & Final Year Project',
    patient_profile: p,
    longitudinal_summary: timeline.summary,
    risk_evaluation: {
      composite_risk_pct: risk.composite_risk_pct,
      risk_category: risk.risk_category,
      sub_risks: risk.sub_risks,
    },
    explainable_ai: {
      summary: xai.explanation_summary,
      top_factors: xai.contributions,
    },
    digital_twin: {
      status: twin.twin_status,
      organs: twin.organs,
    },
    clinical_insights: {
      alert_level: insights.alert_level,
      recommendations: insights.recommendations,
    },
    clinical_sign_off: {
      status: 'Preliminary Review Completed',
      notes: 'Digital twin and SHAP factor attribution verified against ShanghaiT2DM longitudinal protocol. Ready for clinical consultation.',
    },
  };
}
