import { getSupabaseClient } from './supabase';
import { loadForecastPreview } from './forecastPreview';

export type ForecastSource = 'preview' | 'local' | 'supabase';

export interface ForecastPoint { timestamp: string; value: number }
export interface ForecastEvent { kind: 'meal' | 'insulin'; amount: number; minutes_ahead: number }
export interface GlucoseForecast {
  patient_id: string; record_id: string; source: string; horizon_hours: number;
  model_sha256: string;
  delivery?: 'precomputed'; generated_at?: string;
  storage?: { saved: boolean; run_id: string; patient_id: string; created_at: string; test_predictions_saved: number; metrics_saved: number; timeline_splits_saved: number };
  sequence_length: number; forecast_start: string; latest_glucose: number;
  baseline_end: number; scenario_end: number; scenario_enabled: boolean;
  metrics: { mae_mg_dl: number; rmse_mg_dl: number; test_windows: number } | null;
  baseline: ForecastPoint[]; scenario: ForecastPoint[]; observed: ForecastPoint[];
  training: ForecastPoint[]; validation: ForecastPoint[]; testing: ForecastPoint[]; testing_actual: ForecastPoint[];
}


const API_URL_STORAGE_KEY = 'dt_forecast_api_url';

export function getForecastApiUrl(): string {
  const saved = typeof window !== 'undefined' ? localStorage.getItem(API_URL_STORAGE_KEY) : null;
  return (saved || (import.meta.env.VITE_API_BASE_URL as string) || (import.meta.env.DEV ? 'http://localhost:5000' : '')).trim().replace(/\/+$/, '');
}

export function saveForecastApiUrl(value: string): void {
  const trimmed = value.trim();
  if (!trimmed) { localStorage.removeItem(API_URL_STORAGE_KEY); return; }
  let url: URL;
  try { url = new URL(trimmed); } catch { throw new Error('Enter the full public model service address, starting with https://.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('Enter the model service origin, such as https://your-service.onrender.com, without /api or credentials.');
  }
  localStorage.setItem(API_URL_STORAGE_KEY, url.origin);
}

export async function fetchGlucoseForecast(patientId: string, options: {
  source: ForecastSource; horizon_hours: number; events: ForecastEvent[]; run_id: string;
}, signal: AbortSignal): Promise<GlucoseForecast> {
  if (options.source === 'preview') {
    if (options.events.length) throw new Error('Interactive what-if simulation requires the online prediction service.');
    return loadForecastPreview(patientId, options.horizon_hours, signal);
  }
  const base = getForecastApiUrl();
  if (!base && !import.meta.env.DEV) throw new Error('The model service is not connected. Open Service connection and enter the Python prediction service address.');
  const client = getSupabaseClient();
  const session = client ? (await client.auth.getSession()).data.session : null;
  if (!session) throw new Error('Sign in to access patient forecasts.');
  const response = await fetch(`${base}/api/patients/${encodeURIComponent(patientId)}/glucose-forecast`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(options),
  });
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new Error('This address did not return prediction data. Use the Python model service address, rather than your Vercel webpage or Supabase project URL.');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The forecast could not be generated.');
  return result;
}
