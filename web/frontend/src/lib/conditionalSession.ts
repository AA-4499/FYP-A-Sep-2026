import type { Patient } from '../types';
import type { Cohort, ConditionalModel } from './conditionalDecoder';
import { buildConditionalHistory, type ConditionalHistory, type Plan } from './conditionalFeatures';
import { cohortForPatient, conditionalForecast } from './conditionalForecast';
import { decoderManifest, loadConditionalModel, loadFoodReference, runConditionalComparison } from './conditionalPrediction';
import { getSupabaseClient, fetchSupabasePatientDetail } from './supabase';
import { getForecastApiUrl } from './forecast';
import { requestModelService } from './modelServiceRequest';
import type { GlucoseForecast } from './forecast';
import type { ConditionalResult } from './conditionalPrediction';

export type ConditionalSource = 'supabase' | 'local';
export type ConditionalEngine = 'browser' | 'server';
export const defaultConditionalEngine = (): ConditionalEngine => import.meta.env.VITE_CONDITIONAL_ENGINE === 'server' ? 'server' : 'browser';
export interface ConditionalSession {
  patientId: string;
  source: ConditionalSource;
  cohort: Cohort;
  engine?: ConditionalEngine;
  model?: ConditionalModel;
  history?: ConditionalHistory;
}

/** Both the chart simulator and the retained v3 page use this exact input path. */
export async function loadConditionalSession(patient: Patient, source: ConditionalSource, signal: AbortSignal, engine: ConditionalEngine = defaultConditionalEngine()): Promise<ConditionalSession> {
  if (engine === 'server') {
    if (cohortForPatient(patient) !== 'ShanghaiT2DM') throw Error('The local-data medium v3 supports T2DM only. Select the original browser model for T1DM.');
    if (signal.aborted) throw new DOMException('Cancelled','AbortError');
    return {patientId:patient.id,source,cohort:'ShanghaiT2DM',engine};
  }
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
  if (session.engine === 'server') {
    const client = getSupabaseClient();
    const auth = client ? (await client.auth.getSession()).data.session : null;
    if (!auth) throw Error('Sign in to use the medium v3 model service.');
    const response = await requestModelService(`${getForecastApiUrl()}/api/patients/${encodeURIComponent(session.patientId)}/conditional-forecast`, {method:'POST',signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${auth.access_token}`},body:JSON.stringify({source:session.source,baseline,scenario})});
    if (!response.headers.get('content-type')?.includes('application/json')) throw Error('Connect the medium v3 Python service. It must support /conditional-forecast.');
    const result = await response.json();
    if (!response.ok) throw Error(result.error ?? 'Medium v3 prediction unavailable.');
    const forecast = result.forecast as GlucoseForecast;
    if (forecast?.patient_id !== session.patientId || forecast.delivery !== 'server' || forecast.model_family !== 'conditional-v3' || forecast.horizons_minutes?.join(',') !== '15,30,60,240' || !Array.isArray(forecast.baseline) || !Array.isArray(forecast.scenario) || forecast.baseline.length !== 5 || forecast.scenario.length !== 5 || [...forecast.baseline,...forecast.scenario].some(p=>!Number.isFinite(p.value)||p.value<=0||!Number.isFinite(Date.parse(p.timestamp))) || !Array.isArray(result.comparison?.explanations)) throw Error('The model service returned an inconsistent forecast.');
    return {forecast,comparison:result.comparison as ConditionalResult};
  }
  if (!session.model || !session.history) throw Error('The browser model session is incomplete.');
  const comparison = await runConditionalComparison(session.model,session.history,baseline,scenario,240,signal);
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  const entry = decoderManifest[session.cohort];
  const forecast = {...conditionalForecast(session.patientId,session.source,session.cohort,session.model.checkpoint_sha256,entry.version,session.history,comparison,baseline,scenario),
    model_evaluation:{scope:entry.evaluation_scope,mae_mg_dl:Object.fromEntries(Object.entries(entry.test_metrics).map(([h,metric])=>[h,metric.mae_mg_dl]))}};
  return {forecast, comparison};
}
