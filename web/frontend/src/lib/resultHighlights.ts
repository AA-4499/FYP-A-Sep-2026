import type { Patient } from '../types';
import type { GlucoseForecast } from './forecast';

export const labGroups = [
  { title: 'Blood sugar', purpose: 'Recorded measures of glucose control.', tests: [
    ['HbA1c', 'HbA1c (mmol/mol)', 'mmol/mol'],
    ['Fasting plasma glucose', 'Fasting Plasma Glucose (mg/dl)', 'mg/dL'],
    ['2-hour plasma glucose', '2-hour Postprandial Plasma Glucose (mg/dl)', 'mg/dL'],
    ['Glycated albumin', 'Glycated Albumin (%)', '%'],
  ] },
  { title: 'Kidney function', purpose: 'Kidney measurements provide context for a clinician reviewing diabetes and medicines.', tests: [
    ['Creatinine', 'Creatinine (umol/L)', 'µmol/L'],
    ['Estimated GFR', 'Estimated Glomerular Filtration Rate  (ml/min/1.73m²)', 'mL/min/1.73m²'],
    ['Blood urea nitrogen', 'Blood Urea Nitrogen (mmol/L)', 'mmol/L'],
    ['Uric acid', 'Uric Acid (mmol/L)', 'mmol/L'],
  ] },
  { title: 'Cholesterol & lipids', purpose: 'Recorded lipid measurements for review with the care team.', tests: [
    ['Total cholesterol', 'Total Cholesterol (mmol/L)', 'mmol/L'],
    ['LDL cholesterol', 'Low-Density Lipoprotein Cholesterol (mmol/L)', 'mmol/L'],
    ['HDL cholesterol', 'High-Density Lipoprotein Cholesterol (mmol/L)', 'mmol/L'],
    ['Triglycerides', 'Triglyceride (mmol/L)', 'mmol/L'],
  ] },
  { title: 'Insulin & C-peptide', purpose: 'Laboratory insulin and C-peptide measurements are distinct from estimated bolus IOB.', tests: [
    ['Fasting C-peptide', 'Fasting C-peptide (nmol/L)', 'nmol/L'],
    ['2-hour C-peptide', '2-hour Postprandial C-peptide (nmol/L)', 'nmol/L'],
    ['Fasting insulin', 'Fasting Insulin (pmol/L)', 'pmol/L'],
    ['2-hour insulin', '2-hour Postprandial insulin (pmol/L)', 'pmol/L'],
  ] },
] as const;

const number = (value: unknown) => value == null || typeof value === 'boolean' || String(value).trim() === '' ? NaN : Number(value);
const format = (value: number) => value.toFixed(1);

export function laboratoryHighlights(patient: Pick<Patient, 'recordedFields'>): string[] {
  const fields = patient.recordedFields ?? {};
  const facts = labGroups.flatMap(group => group.tests.flatMap(([label, key, unit]) => {
    const value = number(fields[key]);
    return Number.isFinite(value) ? [`${label}: ${format(value)} ${unit}.${key === 'HbA1c (mmol/mol)' ? ` Equivalent to approximately ${format(value * 0.09148 + 2.152)}%.` : ''}`] : [];
  }));
  return [
    ...(facts.length ? facts : ['No numerical laboratory measurements are recorded for this visit.']),
    'Collection dates and laboratory reference intervals are unavailable in this summary. These values cannot establish a current result, trend or normal/abnormal classification.',
  ];
}

export function predictionHighlights(output: GlucoseForecast, engine: 'gru' | 'physiology' = 'gru'): string[] {
  const points = output.scenario_enabled ? output.scenario : output.baseline;
  const future = points.filter(point => Date.parse(point.timestamp) > Date.parse(output.forecast_start) && Number.isFinite(point.value));
  const values = future.map(point => point.value);
  if (!values.length) return ['No finite future prediction points are available in this saved result.'];
  const end = values[values.length - 1], change = end - output.latest_glucose;
  const low = future.filter(point => point.value < 70), high = future.filter(point => point.value > 180);
  const lines = [
    `Starting recorded CGM: ${format(output.latest_glucose)} mg/dL at ${output.forecast_start.replace('T', ' ').slice(0, 19)} (source clock).`,
    `At the last displayed horizon (${output.horizon_hours * 60} minutes), the ${engine === 'physiology' ? 'simulation' : 'model'} estimates ${format(end)} mg/dL, ${format(Math.abs(change))} mg/dL ${change >= 0 ? 'above' : 'below'} the starting reading.`,
    `Estimated values at the displayed future points span ${format(Math.min(...values))}–${format(Math.max(...values))} mg/dL.`,
    low.length || high.length
      ? `${low.length} displayed future point(s) below 70 mg/dL; ${high.length} above 180 mg/dL. These are model estimates at sampled horizons, not measured events, probabilities or time in range.`
      : 'All displayed future estimates are within the general 70–180 mg/dL reference band; this does not establish that glucose stays in range between points or that the plan is safe.',
  ];
  if (output.scenario_enabled) lines.push(`Changed plan minus baseline at the last horizon: ${output.scenario_end - output.baseline_end >= 0 ? '+' : ''}${format(output.scenario_end - output.baseline_end)} mg/dL. This is model sensitivity, not an identified treatment effect.`);
  if (output.exposure) lines.push(`Estimated bolus IOB at origin: ${output.exposure.iob_units.toFixed(2)} U. ${output.exposure.converted_meals}/${output.exposure.described_meals} meal descriptions mapped in the preceding six hours; ${output.exposure.excluded_insulin} excluded insulin annotation(s) in eight hours.${output.exposure.warmup_incomplete ? ' Less than eight hours of source history are available.' : ''} Missing diary entries do not establish zero intake or zero exposure.`);
  if (output.model_evaluation) lines.push(`Cohort test mean absolute errors: ${Object.entries(output.model_evaluation.mae_mg_dl).map(([h,mae]) => `${h} min: ${format(mae)} mg/dL`).join('; ')}. These retrospective errors assume recorded future events are supplied; they are not this patient's error bounds or a validation of the proposed plan.`);
  lines.push(output.uncertainty ?? 'No calibrated prediction interval is available. This research result needs clinician interpretation; it does not recommend medication doses.');
  return lines;
}
