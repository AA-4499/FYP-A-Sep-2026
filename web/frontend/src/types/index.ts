/**
 * TypeScript Type Definitions for Smart Diabetes Digital Twin
 * Swinburne University of Technology Sarawak · Ts. Dr. Vong Wan Tze
 * ShanghaiT2DM Longitudinal Cohort
 */

export interface PatientProfile {
  id: string;
  name: string;
  age: number;
  gender: string;
  bmi: number;
  diabetes_duration_years: number;
  hypertension: number;
  smoking: number;
  phys_activity_level: string;
  fasting_glucose: number;
  hba1c: number;
  systolic_bp: number;
  diastolic_bp: number;
  ldl_cholesterol: number;
  hdl_cholesterol: number;
  triglycerides: number;
  egfr: number;
  medications: string[];
  cgm_days_recorded: number;
  risk_category: string;
}

export interface PatientListResponse {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  patients: PatientProfile[];
}

export interface CGMSummary {
  average_glucose: number;
  time_in_range_pct: number;
  time_below_range_pct: number;
  time_above_range_pct: number;
  glucose_management_indicator: number;
  days_recorded: number;
}

export interface DailyCGMTrend {
  day: string;
  day_number: number;
  mean_glucose: number;
  min_glucose: number;
  max_glucose: number;
  time_in_range_pct: number;
  time_below_range_pct: number;
  time_above_range_pct: number;
}

export interface HourlyCGMPoint {
  hour: string;
  glucose: number;
  target_low: number;
  target_high: number;
}

export interface HistoricalVisit {
  visit: string;
  date: string;
  hba1c: number;
  fasting_glucose: number;
  systolic_bp: number;
  bmi: number;
}

export interface TimelineResponse {
  patient_id: string;
  summary: CGMSummary;
  daily_trends: DailyCGMTrend[];
  hourly_cgm_profile: HourlyCGMPoint[];
  historical_visits: HistoricalVisit[];
}

export interface SubRiskItem {
  name: string;
  score: number;
  level: 'Low' | 'Moderate' | 'High';
  key_driver: string;
}

export interface RiskAssessmentResponse {
  patient_id: string;
  composite_risk_score: number;
  composite_risk_pct: number;
  risk_category: string;
  risk_color: string;
  sub_risks: {
    glycemic_variability: SubRiskItem;
    cardiovascular: SubRiskItem;
    hypoglycemia: SubRiskItem;
    nephropathy: SubRiskItem;
    [key: string]: SubRiskItem;
  };
  model_metadata: {
    model_name: string;
    model_architecture: string;
    dataset: string;
    validation_auroc: number;
    last_calibrated: string;
  };
}

export interface SHAPContribution {
  feature: string;
  label: string;
  value: string;
  shap_value: number;
  impact: string;
  category: string;
  description: string;
}

export interface XAIResponse {
  patient_id: string;
  base_expected_value: number;
  predicted_risk_score: number;
  explanation_summary: string;
  contributions: SHAPContribution[];
  methodology: string;
}

export interface OrganHealth {
  name: string;
  stress_score: number;
  status: string;
  color: string;
  details: string;
}

export interface DigitalTwinResponse {
  patient_id: string;
  twin_status: string;
  avatar_glow: string;
  avatar_status_color: string;
  composite_risk: number;
  organs: {
    pancreas: OrganHealth;
    cardiovascular: OrganHealth;
    kidneys: OrganHealth;
    liver: OrganHealth;
    [key: string]: OrganHealth;
  };
  morphometry: {
    height_cm: number;
    weight_kg: number;
    bmi: number;
    body_fat_est_pct: number;
  };
}

export interface SimulationChangeItem {
  baseline: number;
  simulated: number;
  unit: string;
}

export interface SimulationResponse {
  patient_id: string;
  scenario_inputs: Record<string, any>;
  baseline_comparison: {
    hba1c: SimulationChangeItem;
    time_in_range: SimulationChangeItem;
    systolic_bp: SimulationChangeItem;
    bmi: SimulationChangeItem;
    fasting_glucose: SimulationChangeItem;
  };
  risk_outcome: {
    baseline_risk_pct: number;
    simulated_risk_pct: number;
    risk_delta_pct: number;
    baseline_category: string;
    simulated_category: string;
    status: 'Improved' | 'Worsened' | 'Unchanged';
  };
  organ_stress_comparison: {
    pancreas: { baseline: number; simulated: number };
    cardiovascular: { baseline: number; simulated: number };
    kidneys: { baseline: number; simulated: number };
    liver: { baseline: number; simulated: number };
  };
}

export interface ClinicalRecommendation {
  category: string;
  priority: string;
  title: string;
  detail: string;
  target: string;
}

export interface InsightsResponse {
  patient_id: string;
  alert_level: 'normal' | 'warning' | 'urgent';
  alert_message: string;
  longitudinal_summary: string;
  recommendations: ClinicalRecommendation[];
  generated_by: string;
}

export interface KnowledgeGraphElementNode {
  data: {
    id: string;
    label: string;
    type: string;
    category: string;
    color: string;
    size?: number;
  };
}

export interface KnowledgeGraphElementEdge {
  data: {
    id: string;
    source: string;
    target: string;
    label: string;
  };
}

export interface KnowledgeGraphResponse {
  patient_id: string;
  elements: {
    nodes: KnowledgeGraphElementNode[];
    edges: KnowledgeGraphElementEdge[];
  };
  stats: {
    total_nodes: number;
    total_edges: number;
    ontology_standard: string;
  };
}

export interface PatientReportResponse {
  report_id: string;
  generated_at: string;
  institution: string;
  supervision: string;
  patient_profile: PatientProfile;
  longitudinal_summary: CGMSummary;
  risk_evaluation: {
    composite_risk_pct: number;
    risk_category: string;
    sub_risks: Record<string, SubRiskItem>;
  };
  explainable_ai: {
    summary: string;
    top_factors: SHAPContribution[];
  };
  digital_twin: {
    status: string;
    organs: Record<string, OrganHealth>;
  };
  clinical_insights: {
    alert_level: string;
    recommendations: ClinicalRecommendation[];
  };
  clinical_sign_off: {
    status: string;
    notes: string;
  };
}
