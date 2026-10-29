import { getSupabaseClient } from './supabase';
import type { GlucoseForecast, ForecastPoint } from './forecast';

export interface SavedPrediction {
  id: string;
  patient_id: string;
  created_at: string;
  event_summary: string;
  engine: 'gru' | 'physiology';
  model_sha256: string;
  output: GlucoseForecast;
  scenario: { baseline: ForecastPoint[]; scenario: ForecastPoint[]; baseline_end: number; scenario_end: number; [key: string]: unknown } | null;
}

export async function savePrediction(record: Omit<SavedPrediction, 'created_at'>) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Connect to Supabase to save predictions.');
  const { error } = await client.from('patient_prediction_results').insert(record);
  // A repeated request with the same snapshot ID is already saved.
  if (error && error.code !== '23505') throw new Error(`Unable to save prediction: ${error.message}. Check the prediction results migration and your access.`);
}

export async function listPredictionResults(patientId: string, offset = 0): Promise<SavedPrediction[]> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Connect to Supabase to load lab results.');
  const { data, error } = await client.from('patient_prediction_results').select('*')
    .eq('patient_id', patientId).order('created_at', { ascending: false }).order('id').range(offset, offset + 19);
  if (error) throw new Error(`Unable to load lab results: ${error.message}`);
  return data as SavedPrediction[];
}
