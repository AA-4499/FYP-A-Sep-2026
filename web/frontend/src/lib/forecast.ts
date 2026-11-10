import { getSupabaseClient } from "./supabase";
import { verifyForecastReadback } from "./forecastReadback";
import { loadForecastPreview } from "./forecastPreview";
import { requestModelService } from './modelServiceRequest';
import { isRetiredModelOrigin, readForecastApiOverride } from './retiredModelConnection';
import { resolveMainApiOrigin } from './mainApiOrigin';

export type ForecastSource = "browser" | "preview" | "local" | "supabase";

export interface ForecastPoint {
  timestamp: string;
  value: number;
}
export interface ForecastEvent {
  kind: "meal" | "insulin";
  amount: number;
  minutes_ahead: number;
}
export interface GlucoseForecast {
  model_family?: 'conditional-v3';
  model_version?: string;
  model_evaluation?: { scope: string; mae_mg_dl: Record<string, number> };
  horizons_minutes?: number[];
  exposure?: { iob_units: number; described_meals: number; converted_meals: number; excluded_insulin: number; warmup_incomplete: boolean };
  uncertainty?: string;
  plans?: unknown;
  patient_id: string;
  record_id: string;
  source: string;
  horizon_hours: number;
  model_sha256: string;
  delivery?: "precomputed" | "browser" | "server";
  generated_at?: string;
  data_origin?: "repository-workbook";
  storage?: {
    saved: boolean;
    retrieved?: boolean;
    run_id: string;
    patient_id: string;
    created_at: string;
    test_predictions_saved: number;
    metrics_saved: number;
    timeline_splits_saved: number;
  };
  sequence_length: number;
  forecast_start: string;
  latest_glucose: number;
  baseline_end: number;
  scenario_end: number;
  scenario_enabled: boolean;
  metrics: {
    mae_mg_dl: number;
    rmse_mg_dl: number;
    test_windows: number;
  } | null;
  baseline: ForecastPoint[];
  scenario: ForecastPoint[];
  observed: ForecastPoint[];
  training: ForecastPoint[];
  validation: ForecastPoint[];
  testing: ForecastPoint[];
  testing_actual: ForecastPoint[];
}

const API_URL_STORAGE_KEY = "dt_forecast_api_url";

export function getForecastApiUrl(): string {
  const saved =
    typeof window !== "undefined"
      ? readForecastApiOverride(localStorage)
      : null;
  return resolveMainApiOrigin(import.meta.env.VITE_API_BASE_URL, saved, import.meta.env.DEV);
}

export function saveForecastApiUrl(value: string): void {
  const trimmed = value.trim();
  if (!trimmed) {
    localStorage.removeItem(API_URL_STORAGE_KEY);
    return;
  }
  if (isRetiredModelOrigin(trimmed)) {
    throw new Error('This model service has been deleted. Clear the address to use the original configured backend.');
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(
      "Enter the full public model service address, starting with https://.",
    );
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new Error(
      "Enter the model service origin, such as https://your-service.onrender.com, without /api or credentials.",
    );
  }
  localStorage.setItem(API_URL_STORAGE_KEY, url.origin);
}

export async function fetchGlucoseForecast(
  patientId: string,
  options: {
    source: ForecastSource;
    horizon_hours: number;
    events: ForecastEvent[];
    run_id: string;
  },
  signal: AbortSignal,
): Promise<GlucoseForecast> {
  if (options.source === "browser") {
    const { runBrowserForecast } = await import("./browserForecast");
    return runBrowserForecast(
      patientId,
      options.horizon_hours,
      options.events,
      signal,
    );
  }
  if (options.source === "preview") {
    if (options.events.length)
      throw new Error(
        "Choose the repository browser GRU or online service to calculate new what-if scenarios.",
      );
    return loadForecastPreview(patientId, options.horizon_hours, signal);
  }
  const base = getForecastApiUrl();
  if (!base && !import.meta.env.DEV)
    throw new Error(
      "The model service is not connected. Open Service connection and enter the Python prediction service address.",
    );
  const client = getSupabaseClient();
  const session = client ? (await client.auth.getSession()).data.session : null;
  if (!session) throw new Error("Sign in to access patient forecasts.");
  const response = await requestModelService(
    `${base}/api/patients/${encodeURIComponent(patientId)}/glucose-forecast`,
    {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(options),
    },
  );
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json"))
    throw new Error(
      "This address did not return prediction data. Use the Python model service address, rather than your Vercel webpage or Supabase project URL.",
    );
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "The forecast could not be generated.");
  if (result.patient_id !== patientId || result.storage?.saved !== true || result.storage.run_id !== options.run_id) {
    throw new Error('The model service did not confirm that this patient prediction was saved. Keep the run ID and check the service response.');
  }
  let storedResponse: Response;
  try {
    storedResponse = await requestModelService(
      `${base}/api/patients/${encodeURIComponent(patientId)}/glucose-forecasts/${encodeURIComponent(options.run_id)}`,
      {signal, headers: {Authorization: `Bearer ${session.access_token}`}},
    );
  } catch (failure) {
    if (signal.aborted) throw failure;
    throw new Error(`The prediction was saved (run ${options.run_id}), but retrieval could not be confirmed. Retry history when the model service is available.`);
  }
  if (!storedResponse.ok || !storedResponse.headers.get('content-type')?.includes('application/json')) {
    throw new Error(`The prediction was saved (run ${options.run_id}), but it could not be retrieved. Check the deployed history API and access permissions.`);
  }
  verifyForecastReadback(result, await storedResponse.json());
  return {...result, storage: {...result.storage, retrieved: true}};
}
