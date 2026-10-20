import type { GlucoseForecast } from './forecast';

export async function loadForecastPreview(patientId: string, horizon: number, signal: AbortSignal): Promise<GlucoseForecast> {
  if (![3, 6, 12].includes(horizon)) throw new Error('Choose a 3-, 6- or 12-hour forecast.');
  const response = await fetch(`/forecast-preview/${encodeURIComponent(patientId)}.json`, { signal });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('No local chart preview is available for this exact patient record. Select another patient or connect the online service.');
  }
  const data = await response.json() as GlucoseForecast;
  if (data.patient_id !== patientId || data.source !== 'preview' || data.delivery !== 'precomputed' || data.baseline?.length !== 49) {
    throw new Error('The local chart preview does not match this patient or its expected format.');
  }
  const baseline = data.baseline.slice(0, horizon * 4 + 1);
  return { ...data, horizon_hours: horizon, baseline, scenario: baseline,
    baseline_end: baseline[baseline.length - 1].value, scenario_end: baseline[baseline.length - 1].value,
    scenario_enabled: false, storage: undefined };
}
