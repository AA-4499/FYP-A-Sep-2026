import type {
  AppConfig,
  GuidanceResponse,
  KnowledgeGraphResponse,
  PatientWindowResponse,
  PredictResponse,
  SimulationResponse,
} from '../types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '') + '/api';

export async function fetchConfig(): Promise<AppConfig> {
  const res = await fetch(`${API_BASE}/config`);
  if (!res.ok) throw new Error('Failed to fetch application config');
  return res.json();
}

export async function fetchPatients(number = 1, size = 9): Promise<PatientWindowResponse> {
  const res = await fetch(`${API_BASE}/patients?number=${number}&size=${size}`);
  if (!res.ok) throw new Error('Failed to fetch patients list');
  return res.json();
}

export async function fetchPatientDetail(patientNumber: number): Promise<{
  patient_number: number;
  values: Record<string, number>;
  actual_label: string | null;
}> {
  const res = await fetch(`${API_BASE}/patients/${patientNumber}`);
  if (!res.ok) throw new Error(`Failed to fetch patient #${patientNumber}`);
  return res.json();
}

export async function runPrediction(
  patientNumber: number,
  values?: Record<string, number>
): Promise<PredictResponse> {
  const res = await fetch(`${API_BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_number: patientNumber, values }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Prediction calculation failed');
  }
  return res.json();
}

export async function runSimulation(
  patientNumber: number,
  baseline: Record<string, number>,
  scenario: Record<string, number>
): Promise<SimulationResponse> {
  const res = await fetch(`${API_BASE}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_number: patientNumber, baseline, scenario }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Simulation calculation failed');
  }
  return res.json();
}

export async function fetchKnowledgeGraph(
  patientNumber: number,
  values?: Record<string, number>
): Promise<KnowledgeGraphResponse> {
  const res = await fetch(`${API_BASE}/knowledge-graph`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_number: patientNumber, values }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to generate knowledge graph');
  }
  return res.json();
}

export async function fetchGuidance(
  patientNumber: number,
  values?: Record<string, number>
): Promise<GuidanceResponse> {
  const res = await fetch(`${API_BASE}/guidance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_number: patientNumber, values }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to generate guidance');
  }
  return res.json();
}

export async function uploadDataset(file: File): Promise<{
  source_name: string;
  patient_count: number;
  notice: string;
}> {
  const formData = new FormData();
  formData.append('dataset_file', file);
  const res = await fetch(`${API_BASE}/upload-dataset`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to import CSV dataset');
  }
  return res.json();
}

export function getTwinGlbUrl(assetKeyOrType: string): string {
  if (assetKeyOrType === 'scenario') {
    return `${API_BASE}/digital-twin-scenario.glb`;
  }
  if (assetKeyOrType && assetKeyOrType !== 'current') {
    return `${API_BASE}/digital-twin/${assetKeyOrType}.glb`;
  }
  return `${API_BASE}/digital-twin.glb`;
}
