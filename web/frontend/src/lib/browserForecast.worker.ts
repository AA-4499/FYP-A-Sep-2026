/// <reference lib="webworker" />
import {
  decodeBrowserModel,
  rolloutBrowserGru,
  validateBrowserHistory,
  type BrowserHistory,
  type BrowserModelFile,
} from "./browserGru";
import type { ForecastEvent, GlucoseForecast } from "./forecast";

async function jsonAsset<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("application/json")
  )
    throw new Error(
      "No bundled model/history is available for this exact record. Select a repository record or use the online service.",
    );
  return response.json();
}
// Web Worker keeps GRU matrix operations off the UI thread. No API, auth,
// credentials, cloud requests, training or clinical writes are involved.
self.onmessage = async ({
  data,
}: MessageEvent<{
  patientId: string;
  hours: number;
  events: ForecastEvent[];
}>) => {
  try {
    const [modelFile, history] = await Promise.all([
      jsonAsset<BrowserModelFile>("/browser-model/gru.json"),
      jsonAsset<BrowserHistory>(
        `/browser-model/history/${encodeURIComponent(data.patientId)}.json`,
      ),
    ]);
    const model = decodeBrowserModel(modelFile);
    validateBrowserHistory(model, history, data.patientId);
    const baseline = rolloutBrowserGru(model, history, data.hours);
    const scenario = data.events.length
      ? rolloutBrowserGru(model, history, data.hours, data.events)
      : baseline;
    // Reuse historical diagnostics only when they belong to the identical
    // record, checkpoint and origin. Predictions above are always newly run.
    let diagnostics: GlucoseForecast | null = null;
    try {
      const saved = await jsonAsset<GlucoseForecast>(
        `/forecast-preview/${encodeURIComponent(data.patientId)}.json`,
      );
      if (
        saved.patient_id === data.patientId &&
        saved.model_sha256 === model.model_sha256 &&
        saved.forecast_start === baseline[0].timestamp
      )
        diagnostics = saved;
    } catch {
      /* Prediction works without a matching historical diagnostic. */
    }
    const result: GlucoseForecast = {
      patient_id: data.patientId,
      record_id: history.record_id,
      source: "browser",
      data_origin: "repository-workbook",
      horizon_hours: data.hours,
      model_sha256: model.model_sha256,
      delivery: "browser",
      generated_at: new Date().toISOString(),
      sequence_length: model.sequence_length,
      forecast_start: baseline[0].timestamp,
      latest_glucose: baseline[0].value,
      baseline_end: baseline[baseline.length - 1].value,
      scenario_end: scenario[scenario.length - 1].value,
      scenario_enabled: data.events.length > 0,
      metrics: diagnostics?.metrics ?? null,
      baseline,
      scenario,
      observed:
        diagnostics?.observed ??
        history.timestamps.map((timestamp, i) => ({
          timestamp,
          value: history.features[i][0],
        })),
      training: diagnostics?.training ?? [],
      validation: diagnostics?.validation ?? [],
      testing: diagnostics?.testing ?? [],
      testing_actual: diagnostics?.testing_actual ?? [],
    };
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error
          ? error.message
          : "Browser GRU inference failed.",
    });
  }
};
