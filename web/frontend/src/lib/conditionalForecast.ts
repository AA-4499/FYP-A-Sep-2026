import type { Patient } from '../types';
import type { Cohort } from './conditionalDecoder';
import type { ConditionalHistory, Plan } from './conditionalFeatures';
import type { GlucoseForecast } from './forecast';
import type { ConditionalResult } from './conditionalPrediction';

export function cohortForPatient(patient: Pick<Patient, 'recordedFields' | 'condition'>): Cohort {
  const dataset = patient.recordedFields?.source_dataset;
  if (dataset === 'ShanghaiT1DM' || dataset === 'ShanghaiT2DM') return dataset;
  if (dataset != null && dataset !== '') throw Error('This source dataset is outside the supported Shanghai training cohorts.');
  // Older imports lack source_dataset. Use only an explicit recorded diagnosis,
  // show this choice in the UI, and never infer diabetes type from glucose/age.
  const diagnosis = patient.condition.trim().toLowerCase().replace(/\s+/g, ' ');
  if (['t1d', 't1dm', 'type 1', 'type 1 diabetes', 'type 1 diabetes mellitus'].includes(diagnosis)) return 'ShanghaiT1DM';
  if (['t2d', 't2dm', 'type 2', 'type 2 diabetes', 'type 2 diabetes mellitus'].includes(diagnosis)) return 'ShanghaiT2DM';
  throw Error('A supported source dataset or explicit type 1/type 2 diagnosis is required to choose a research model.');
}

export function conditionalForecast(patientId: string, source: string, cohort: Cohort, digest: string, version: string, history: ConditionalHistory, result: ConditionalResult, baseline: Plan, scenario: Plan): GlucoseForecast {
  if (history.recordId !== patientId) throw Error('The model history belongs to a different record.');
  const horizons = [15, 30, 60, 240];
  if ([...result.baseline, ...result.scenario].some(n => !Number.isFinite(n) || n <= 0) || result.baseline.length !== 4 || result.scenario.length !== 4) throw Error('The decoder returned invalid glucose estimates; this comparison is unavailable.');
  const origin = new Date(history.origin).toISOString();
  const anchor = { timestamp: origin, value: history.features[23][0] };
  const points = (values: number[]) => [anchor, ...horizons.map((minutes, i) => ({timestamp: new Date(history.origin + minutes * 60000).toISOString(), value: values[i]}))];
  return {
    patient_id: patientId, record_id: patientId, source, horizon_hours: 4,
    model_sha256: digest, model_family: 'conditional-v3', model_version: version,
    horizons_minutes: horizons, delivery: 'browser', generated_at: new Date().toISOString(),
    sequence_length: 24, forecast_start: origin, latest_glucose: anchor.value,
    baseline_end: result.baseline[3], scenario_end: result.scenario[3],
    scenario_enabled: JSON.stringify(baseline) !== JSON.stringify(scenario),
    baseline: points(result.baseline), scenario: points(result.scenario),
    observed: history.features.map((row, i) => ({timestamp: new Date(history.origin - (23-i)*900000).toISOString(), value: row[0]})),
    metrics: null, training: [], validation: [], testing: [], testing_actual: [],
    exposure: {iob_units: history.features[23][10], described_meals: history.coverage.describedMeals, converted_meals: history.coverage.convertedMeals, excluded_insulin: history.coverage.excludedInsulin, warmup_incomplete: history.coverage.warmupIncomplete},
    uncertainty: 'No calibrated prediction interval is available. Four sampled horizons do not describe every intervening glucose value. Experimental conditional prediction does not identify treatment effects or recommend insulin doses.',
    plans: {cohort, baseline, scenario, assumptions: 'Only supplied future events are encoded; unrecorded intake and insulin exposure remain unknown. Estimated IOB covers supported boluses only.'},
  };
}
