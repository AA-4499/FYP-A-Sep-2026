import type { ForecastEvent, GlucoseForecast } from "./forecast";

export function runBrowserForecast(
  patientId: string,
  hours: number,
  events: ForecastEvent[],
  signal: AbortSignal,
): Promise<GlucoseForecast> {
  if (signal.aborted)
    return Promise.reject(new DOMException("Forecast cancelled", "AbortError"));
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./browserForecast.worker.ts", import.meta.url),
      { type: "module" },
    );
    let settled = false;
    const finish = (result?: GlucoseForecast, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      worker.terminate();
      if (error) reject(error);
      else resolve(result!);
    };
    const abort = () =>
      finish(undefined, new DOMException("Forecast cancelled", "AbortError"));
    const timeout = setTimeout(
      () =>
        finish(
          undefined,
          new Error(
            "The bundled model took too long to load. Check the connection and retry.",
          ),
        ),
      90000,
    );
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = ({
      data,
    }: MessageEvent<{ result?: GlucoseForecast; error?: string }>) => {
      if (data.error) finish(undefined, new Error(data.error));
      else if (
        !data.result ||
        data.result.patient_id !== patientId ||
        data.result.source !== "browser"
      )
        finish(
          undefined,
          new Error("The browser forecast did not match this record."),
        );
      else finish(data.result);
    };
    worker.onerror = () =>
      finish(
        undefined,
        new Error(
          "The browser model worker could not run. Refresh and retry in a browser that supports Web Workers.",
        ),
      );
    worker.postMessage({ patientId, hours, events });
  });
}
