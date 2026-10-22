/**
 * TypeScript Type Definitions for Smart Diabetes Digital Twin Platform
 * Grounded in Figma specifications across Clinic, Patient Twin, and Auth modules.
 */

export type UserRole = 'admin' | 'doctor' | 'patient';

export type AdminModule =
  | 'admin_overview'
  | 'admin_users'
  | 'admin_data_quality'
  | 'admin_twin_config'
  | 'admin_logs';

export type DoctorModule =
  | 'doctor_overview'
  | 'doctor_patients'
  | 'doctor_monitoring'
  | 'doctor_digital_twin'
  | 'doctor_knowledge_graph'
  | 'doctor_reports'
  | 'doctor_settings';

export type PatientModule =
  | 'patient_dashboard'
  | 'monitoring'
  | 'risk'
  | 'explain_ai'
  | 'digital_twin'
  | 'reports'
  | 'patient_home'
  | 'patient_profile'
  | 'patient_monitoring'
  | 'patient_digital_twin'
  | 'patient_insights'
  | 'patient_recommendations'
  | 'patient_reports';

export type NavigationModule = PatientModule | AdminModule | DoctorModule;

export type AuthFlow =
  | 'signin'
  | 'register_patient'
  | 'register_doctor'
  | 'forgot_password'
  | 'verify_email';

export interface CGMReading {
  date: string;
  timestamp: number;
  cgm: number; // in mg/dL
  cbg?: number | null;
  diet?: string | null;
  insulin?: string | null;
}

export interface CGMDailyProfile {
  dayLabel: string; // e.g. "Day 1 (12/30)"
  dayNumber: number;
  mean: number;
  tir: number; // % in 70-180 mg/dL
  min: number;
  max: number;
  readingsCount: number;
}

export interface CGMSummary {
  totalReadings: number;
  startDate: string;
  endDate: string;
  meanGlucose: number;
  timeInRangePct: number; // 70-180 mg/dL
  timeAboveRangePct: number; // >180 mg/dL
  timeBelowRangePct: number; // <70 mg/dL
  cvPct: number; // Coefficient of Variation %
  dailyProfiles: CGMDailyProfile[];
}

export interface AGPProfileBin {
  minuteOfDay: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  readingsCount: number;
}

export interface Patient {
  id: string; // e.g. "2000_0_20201230" or "P07"
  displayId: string; // e.g. "P07"
  name: string;
  age: number;
  condition: string;
  visitsCount: number;
  hba1c: number;
  fastingGlucose: number;
  bmi: number;
  currentRiskPct: number;
  timeInRangePct: number;
  latestSignal: string;
  riskCategory: 'High' | 'Moderate' | 'Stable';
  avatarInitials: string;
  hasContinuousCGM?: boolean;
  cgmReadings?: CGMReading[];
  cgmSummary?: CGMSummary;
  timelineData: {
    visit: number;
    currentHba1c: number;
    avgHba1c: number;
  }[];
  keyFactors: {
    name: string;
    value: number; // percentage (0-100)
    label: string;
  }[];
  organs: {
    pancreas: { status: 'High Strain' | 'Moderate' | 'Normal'; stress: number; color: string };
    kidneys: { status: 'High Strain' | 'Moderate' | 'Normal'; stress: number; color: string };
    cardio: { status: 'High Strain' | 'Moderate' | 'Normal'; stress: number; color: string };
    liver: { status: 'High Strain' | 'Moderate' | 'Normal'; stress: number; color: string };
    retina: { status: 'High Strain' | 'Moderate' | 'Normal'; stress: number; color: string };
  };
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  category: 'Patient' | 'Demographics' | 'Clinical Data' | 'Medical Data' | 'Lifestyle';
  entityType: string;
  value?: string;
  description: string;
  details: Record<string, string>;
  x?: number;
  y?: number;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  label?: string;
}

export interface ServiceHealthItem {
  id: string;
  name: string;
  status: 'Operational' | 'Degraded' | 'Down';
  latencyMs: number;
  uptimePct: number;
  endpoint: string;
  lastChecked: string;
}

export interface ROCPoint {
  fpr: number;
  tpr: number;
  threshold: number;
}

export interface DataCoverageItem {
  indicator: string;
  category: string;
  coveragePct: number;
  totalRecords: number;
  validRecords: number;
  missingRecords: number;
  status: 'Excellent' | 'Good' | 'Needs Attention';
}

export interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'doctor' | 'patient';
  status: 'Active' | 'Inactive';
  assignedCohort?: string;
  lastLogin: string;
  createdAt: string;
  permissions: string[];
}

// New interface for admin dashboard key performance indicators
export interface AdminKPIs {
  totalUsers: number;
  totalPatients: number;
  totalDoctors: number;
  totalDatasets: number;
  serviceHealth: ServiceHealthItem[]; // Reuse ServiceHealthItem defined earlier
  aiModelSummary: {
    auc: number;
    rocPoints: ROCPoint[];
  };
  dataCoverage: DataCoverageItem[]; // Reuse DataCoverageItem
}

export interface TwinIndicatorRule {
  id: string;
  indicator: string;
  sourceDataset: string;
  timeWindow: 'Hourly' | 'Daily' | 'Per-Visit' | 'Continuous (CGM)';
  weight: number;
  enabled: boolean;
  algorithm: string;
}

export interface QuickLogEntry {
  id: string;
  type: 'meal' | 'activity';
  timestamp: string;
  title: string;
  carbsOrMinutes: number;
  notes?: string;
}
