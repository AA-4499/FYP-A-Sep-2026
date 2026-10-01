/**
 * TypeScript Type Definitions for DiabetesTwin Platform
 * Matching the exact mockup specification
 */

export type NavigationModule =
  | 'patients'
  | 'monitoring'
  | 'risk'
  | 'explain_ai'
  | 'knowledge_graph'
  | 'digital_twin'
  | 'what_if'
  | 'reports';

export interface Patient {
  id: string; // e.g. "P07"
  name: string;
  age: number;
  condition: string; // e.g. "Type 2 diabetes"
  visitsCount: number; // e.g. 14
  hba1c: number; // e.g. 8.1
  fastingGlucose: number; // e.g. 9.4
  bmi: number; // e.g. 27.3
  currentRiskPct: number; // e.g. 68
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
