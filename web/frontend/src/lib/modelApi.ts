import { getSupabaseClient } from './supabase';
import { getForecastApiUrl } from './forecast';

export interface TrainingJob {
  status: 'idle' | 'running' | 'completed' | 'failed';
  run_id?: string;
  started_at?: string;
  finished_at?: string;
  rows?: number;
  records?: number;
  model_sha256?: string;
  error?: string;
  metrics?: { mae_mg_dl: number; rmse_mg_dl: number };
}

export async function trainingRequest(method: 'GET' | 'POST'): Promise<TrainingJob> {
  const client = getSupabaseClient();
  const session = client ? (await client.auth.getSession()).data.session : null;
  if (!session) throw new Error('Sign in as an administrator.');
  const base = getForecastApiUrl();
  if (!base) throw new Error('Configure the model service address in Service connection on the Digital twin page.');
  const response = await fetch(`${base}/api/admin/model/retrain`, {
    method, headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The model service did not return JSON. Check the service address.');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Model service unavailable.');
  return result;
}
