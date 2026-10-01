/**
 * API Client for Smart Diabetes Digital Twin REST Backend.
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

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '') + '/api';

export async function fetchHealth(): Promise<{ status: string; dataset: string; version: string }> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Backend health check failed');
  return res.json();
}

export async function fetchMeta(): Promise<{ default_patient_id: string; supported_dataset: string }> {
  const res = await fetch(`${API_BASE}/meta`);
  if (!res.ok) throw new Error('Failed to load system metadata');
  return res.json();
}

export async function fetchPatients(query = '', page = 1, perPage = 12): Promise<PatientListResponse> {
  const params = new URLSearchParams({
    query,
    page: page.toString(),
    per_page: perPage.toString(),
  });
  const res = await fetch(`${API_BASE}/patients?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch patient records');
  return res.json();
}

export async function fetchPatient(patientId: string): Promise<PatientProfile> {
  const res = await fetch(`${API_BASE}/patients/${patientId}`);
  if (!res.ok) throw new Error(`Failed to fetch patient #${patientId}`);
  return res.json();
}

export async function fetchTimeline(patientId: string): Promise<TimelineResponse> {
  const res = await fetch(`${API_BASE}/patients/${patientId}/timeline`);
  if (!res.ok) throw new Error(`Failed to fetch timeline for patient #${patientId}`);
  return res.json();
}

export async function fetchRiskAssessment(
  patientId: string,
  customFeatures?: Record<string, any>
): Promise<RiskAssessmentResponse> {
  const options: RequestInit = customFeatures
    ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customFeatures),
      }
    : { method: 'GET' };

  const res = await fetch(`${API_BASE}/patients/${patientId}/risk-assessment`, options);
  if (!res.ok) throw new Error(`Failed to calculate risk for patient #${patientId}`);
  return res.json();
}

export async function fetchXAI(
  patientId: string,
  customFeatures?: Record<string, any>
): Promise<XAIResponse> {
  const options: RequestInit = customFeatures
    ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customFeatures),
      }
    : { method: 'GET' };

  const res = await fetch(`${API_BASE}/patients/${patientId}/xai-explanation`, options);
  if (!res.ok) throw new Error(`Failed to generate XAI explanation for patient #${patientId}`);
  return res.json();
}

export async function fetchKnowledgeGraph(patientId: string): Promise<KnowledgeGraphResponse> {
  const res = await fetch(`${API_BASE}/patients/${patientId}/knowledge-graph`);
  if (!res.ok) throw new Error(`Failed to load knowledge graph for patient #${patientId}`);
  return res.json();
}

export async function fetchInsights(
  patientId: string,
  customFeatures?: Record<string, any>
): Promise<InsightsResponse> {
  const options: RequestInit = customFeatures
    ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customFeatures),
      }
    : { method: 'GET' };

  const res = await fetch(`${API_BASE}/patients/${patientId}/insights`, options);
  if (!res.ok) throw new Error(`Failed to load personalised insights for patient #${patientId}`);
  return res.json();
}

export async function fetchDigitalTwin(
  patientId: string,
  customFeatures?: Record<string, any>
): Promise<DigitalTwinResponse> {
  const options: RequestInit = customFeatures
    ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customFeatures),
      }
    : { method: 'GET' };

  const res = await fetch(`${API_BASE}/patients/${patientId}/digital-twin`, options);
  if (!res.ok) throw new Error(`Failed to load digital twin state for patient #${patientId}`);
  return res.json();
}

export async function runSimulation(
  patientId: string,
  scenarioDeltas: Record<string, any>
): Promise<SimulationResponse> {
  const res = await fetch(`${API_BASE}/patients/${patientId}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenarioDeltas),
  });
  if (!res.ok) throw new Error(`Failed to run simulation for patient #${patientId}`);
  return res.json();
}

export async function fetchPatientReport(patientId: string): Promise<PatientReportResponse> {
  const res = await fetch(`${API_BASE}/patients/${patientId}/report`);
  if (!res.ok) throw new Error(`Failed to compile report for patient #${patientId}`);
  return res.json();
}
