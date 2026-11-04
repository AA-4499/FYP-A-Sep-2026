import type { Patient } from '../types';
import type { Cohort, ConditionalModel } from './conditionalDecoder';
import { buildConditionalHistory, type ConditionalHistory, type Plan } from './conditionalFeatures';
import { cohortForPatient, conditionalForecast } from './conditionalForecast';
import { decoderManifest, loadConditionalModel, loadFoodReference, runConditionalComparison } from './conditionalPrediction';
import { getSupabaseClient, fetchSupabasePatientDetail } from './supabase';
import { getForecastApiUrl } from './forecast';

export type ConditionalSource = 'supabase' | 'local';
export interface ConditionalSession {
  patientId: string;
  source: ConditionalSource;
  cohort: Cohort;
  model: ConditionalModel;
  history: ConditionalHistory;
}

/** Both the chart simulator and the retained v3 page use this exact input path. */
export async function loadConditionalSession(patient: Patient, source: ConditionalSource, signal: AbortSignal): Promise<ConditionalSession> {
  let selected = patient, rows: Record<string, unknown>[];
  if (source === 'supabase') {
    const loaded = await fetchSupabasePatientDetail(patient.id);
    if (!loaded) throw Error('No authorized summary exists for this record.');
    selected = loaded.patient;
    rows = loaded.details as unknown as Record<string, unknown>[];
  } else {
    const client = getSupabaseClient();
    const session = client ? (await client.auth.getSession()).data.session : null;
    if (!session) throw Error('Sign in to read an authorized local workbook.');
    const response = await fetch(`${getForecastApiUrl()}/api/patients/${encodeURIComponent(patient.id)}/conditional-input`, {signal, headers:{Authorization:`Bearer ${session.access_token}`}});
    if (!response.headers.get('content-type')?.includes('application/json')) throw Error('Connect the Python model service to use local workbooks.');
    const loaded = await response.json();
    if (!response.ok) throw Error(loaded.error ?? 'Local source unavailable.');
    if (loaded.patient_id !== patient.id) throw Error('The local source belongs to a different patient.');
    selected = {...patient, recordedFields:{...loaded.summary, source_dataset:loaded.source_dataset}, age:Number(loaded.summary['Age (years)']), bmi:Number(loaded.summary['BMI (kg/m²)'])};
    rows = loaded.rows;
  }
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  const cohort = cohortForPatient(selected);
  const [model, foods] = await Promise.all([loadConditionalModel(cohort,signal),loadFoodReference(signal)]);
  const history = buildConditionalHistory(rows, patient.id, selected.age, selected.bmi, foods);
  return {patientId:patient.id, source, cohort, model, history};
}

export async function forecastConditionalSession(session: ConditionalSession, baseline: Plan, scenario: Plan, signal: AbortSignal) {
  const comparison = await runConditionalComparison(session.model,session.history,baseline,scenario,240,signal);
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  const entry = decoderManifest[session.cohort];
  const forecast = {...conditionalForecast(session.patientId,session.source,session.cohort,session.model.checkpoint_sha256,entry.version,session.history,comparison,baseline,scenario),
    model_evaluation:{scope:entry.evaluation_scope,mae_mg_dl:Object.fromEntries(Object.entries(entry.test_metrics).map(([h,metric])=>[h,metric.mae_mg_dl]))}};
  return {forecast, comparison};
}
