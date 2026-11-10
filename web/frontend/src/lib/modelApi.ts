import { getSupabaseClient } from './supabase';
import { getForecastApiUrl } from './forecast';

export interface ModelMetrics { mae_mg_dl: number; rmse_mg_dl: number }
export interface ModelComparison {
  accepted: boolean;
  reasons: string[];
  active: ModelMetrics;
  candidate: ModelMetrics;
  evaluation_windows: number;
  evaluation_sha256: string;
  scope: string;
}
export interface ModelStorage {
  configured: boolean;
  writable: boolean;
  initialized: boolean;
  active_model_sha256?: string | null;
  last_activation?: string | null;
  error?: string;
}
export interface TrainingJob {
  status: 'idle' | 'running' | 'completed' | 'failed' | 'rejected';
  run_id?: string;
  started_at?: string;
  finished_at?: string;
  rows?: number;
  records?: number;
  model_sha256?: string;
  error?: string;
  metrics?: ModelMetrics;
  comparison?: ModelComparison;
  storage?: ModelStorage;
}
export interface RetrainingReadiness {
  recommended: boolean;
  reasons: string[];
  baseline_available: boolean;
  new_observations: number;
  changed_observations: number;
  removed_observations: number;
  new_data_timelines: number;
  additional_timelines: number;
  additional_patients: number;
  threshold: number;
  progress_fraction: number;
  last_success_at: string | null;
  days_since_success: number | null;
  current: { valid_observations: number; complete_timelines: number; patients: number };
  quality: { raw_rows: number; invalid_rows: number; duplicate_rows: number; conflicting_duplicate_rows: number; short_segment_rows: number };
  policy: { minimum_new_timelines: number; minimum_interval_days: number; minimum_segment_observations: number; minimum_evaluation_windows: number; version: string };
  storage: ModelStorage;
  checked_at: string;
}

async function modelRequest(method: 'GET' | 'POST', path: string) {
  const client = getSupabaseClient();
  const session = client ? (await client.auth.getSession()).data.session : null;
  if (!session) throw new Error('Sign in as an administrator.');
  const base = getForecastApiUrl();
  if (!base) throw new Error('Configure the model service address in Service connection on the Digital twin page.');
  let response: Response;
  try {
    response = await fetch(`${base}/api/admin/model/${path}`, {
      method, headers: { Authorization: `Bearer ${session.access_token}` }, signal: AbortSignal.timeout(90000),
    });
  } catch { throw new Error('The model service could not be reached. Check its address, Render availability and allowed origins.'); }
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The model service did not return JSON. Check the service address and deployed version.');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Model service unavailable.');
  return result;
}

export async function trainingRequest(method: 'GET' | 'POST'): Promise<TrainingJob> {
  return modelRequest(method, 'retrain');
}
export async function retrainingReadiness(refresh = false): Promise<RetrainingReadiness> {
  return modelRequest('GET', `readiness${refresh ? '?refresh=1' : ''}`);
}
