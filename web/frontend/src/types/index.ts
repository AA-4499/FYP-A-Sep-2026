/**
 * TypeScript Type Definitions for Smart Diabetes Digital Twin Platform
 * Grounded in Figma specifications across Clinic, Patient Twin, and Auth modules.
 */

export type ClinicModule =
  | 'overview'
  | 'patients'
  | 'glucose_review'
  | 'clinical_analytics'
  | 'alerts_tasks'
  | 'care_team'
  | 'devices'
  | 'reports'
  | 'settings'
  | 'clinical_support';

export type PatientModule =
  | 'patient_dashboard'
  | 'monitoring'
  | 'risk'
  | 'explain_ai'
  | 'knowledge_graph'
  | 'digital_twin'
  | 'reports';

export type NavigationModule = ClinicModule | PatientModule;

export type AuthFlow =
  | 'signin'
  | 'register_patient'
  | 'register_doctor'
  | 'forgot_password'
  | 'verify_email';

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
