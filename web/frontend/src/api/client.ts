/**
 * API Client & Front-End Demo Provider for Smart Diabetes Digital Twin.
 * Optimized for high-speed Figma demo walkthroughs and standalone UI presentations.
 * Swinburne University of Technology Sarawak · Ts. Dr. Vong Wan Tze
 */
import type {
  PatientProfile,
  PatientListResponse,
  TimelineResponse,
  RiskAssessmentResponse,
  XAIResponse,
  KnowledgeGraphResponse,
  InsightsResponse,
  DigitalTwinResponse,
  SimulationResponse,
  PatientReportResponse,
} from '../types';
import {
  getMockPatient,
  getMockPatientList,
  getMockTimeline,
  getMockRiskAssessment,
  getMockXAI,
  getMockDigitalTwin,
  getMockInsights,
  getMockKnowledgeGraph,
  getMockSimulation,
  getMockPatientReport,
} from './mockData';

// Standalone mode is enabled for the Figma presentation and instant front-end demonstration
const IS_STANDALONE_DEMO = true;
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '') + '/api';

export function isFallbackActive(): boolean {
  return true;
}

export async function fetchHealth(): Promise<{ status: string; dataset: string; version: string; isFallback: boolean }> {
  if (IS_STANDALONE_DEMO) {
    return {
      status: 'healthy',
      dataset: 'ShanghaiT2DM Longitudinal Cohort (Figma Demo Mode)',
      version: '2.4.0-standalone',
      isFallback: false,
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);
    const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error('Health check status not ok');
    const data = await res.json();
    return { ...data, isFallback: false };
  } catch {
    return {
      status: 'healthy',
      dataset: 'ShanghaiT2DM Cohort (Figma Demo Mode)',
      version: '2.4.0-standalone',
      isFallback: true,
    };
  }
}

export async function fetchMeta(): Promise<{ default_patient_id: string; supported_dataset: string }> {
  return {
    default_patient_id: '1001',
    supported_dataset: 'ShanghaiT2DM Longitudinal Cohort',
  };
}

export async function fetchPatients(query = '', page = 1, perPage = 12): Promise<PatientListResponse> {
  return getMockPatientList(query, page, perPage);
}

export async function fetchPatient(patientId: string): Promise<PatientProfile> {
  return getMockPatient(patientId);
}

export async function fetchTimeline(patientId: string): Promise<TimelineResponse> {
  return getMockTimeline(patientId);
}

export async function fetchRiskAssessment(
  patientId: string,
  _customFeatures?: Record<string, any>
): Promise<RiskAssessmentResponse> {
  return getMockRiskAssessment(patientId);
}

export async function fetchXAI(
  patientId: string,
  _customFeatures?: Record<string, any>
): Promise<XAIResponse> {
  return getMockXAI(patientId);
}

export async function fetchKnowledgeGraph(patientId: string): Promise<KnowledgeGraphResponse> {
  return getMockKnowledgeGraph(patientId);
}

export async function fetchInsights(
  patientId: string,
  _customFeatures?: Record<string, any>
): Promise<InsightsResponse> {
  return getMockInsights(patientId);
}

export async function fetchDigitalTwin(
  patientId: string,
  _customFeatures?: Record<string, any>
): Promise<DigitalTwinResponse> {
  return getMockDigitalTwin(patientId);
}

export async function runSimulation(
  patientId: string,
  scenarioDeltas: Record<string, any>
): Promise<SimulationResponse> {
  return getMockSimulation(patientId, scenarioDeltas);
}

export async function fetchPatientReport(patientId: string): Promise<PatientReportResponse> {
  return getMockPatientReport(patientId);
}
