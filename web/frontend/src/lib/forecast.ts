import { getSupabaseClient } from './supabase';

export interface ForecastPoint { timestamp: string; value: number }
export interface ForecastEvent { kind: 'meal' | 'insulin'; amount: number; minutes_ahead: number }
export interface GlucoseForecast {
  patient_id: string; record_id: string; source: string; horizon_hours: number;
  model_sha256: string;
  storage: { saved: boolean; run_id: string; patient_id: string; created_at: string; test_predictions_saved: number; metrics_saved: number; timeline_splits_saved: number };
  sequence_length: number; forecast_start: string; latest_glucose: number;
  baseline_end: number; scenario_end: number; scenario_enabled: boolean;
  metrics: { mae_mg_dl: number; rmse_mg_dl: number; test_windows: number } | null;
  baseline: ForecastPoint[]; scenario: ForecastPoint[]; observed: ForecastPoint[];
  training: ForecastPoint[]; validation: ForecastPoint[]; testing: ForecastPoint[]; testing_actual: ForecastPoint[];
}

export async function fetchGlucoseForecast(patientId: string, options: {
  source: 'local' | 'supabase'; horizon_hours: number; events: ForecastEvent[]; run_id: string;
}, signal: AbortSignal): Promise<GlucoseForecast> {
  const base = ((import.meta.env.VITE_API_BASE_URL as string) || (import.meta.env.DEV ? 'http://localhost:5000' : '')).replace(/\/$/, '');
  if (!base && !import.meta.env.DEV) throw new Error('The forecasting API is not configured. Set VITE_API_BASE_URL and redeploy the frontend.');
  const client = getSupabaseClient();
  const session = client ? (await client.auth.getSession()).data.session : null;
  if (!session) throw new Error('Sign in to access patient forecasts.');
  const response = await fetch(`${base}/api/patients/${encodeURIComponent(patientId)}/glucose-forecast`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(options),
  });
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new Error('The forecasting API returned an invalid response. Check VITE_API_BASE_URL.');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The forecast could not be generated.');
  return result;
}
