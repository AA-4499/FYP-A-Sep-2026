import type { ForecastPoint } from "./forecast";

export interface RangePoint {
  timestamp: string;
  inner: [number, number];
  outer: [number, number];
}
export interface RangeEnvelope {
  points: RangePoint[];
  method: "historical-error-reference" | "assumption-sensitivity";
  samples: number;
}
const time = (value: string) =>
  Date.parse(/[zZ]$|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
export function quantile(sorted: number[], fraction: number): number {
  if (!sorted.length) return NaN;
  const index = (sorted.length - 1) * fraction;
  const left = Math.floor(index),
    right = Math.ceil(index);
  return sorted[left] + (sorted[right] - sorted[left]) * (index - left);
}

/** Exploratory reference ONLY: one-step residuals do not calibrate future coverage.
 * sqrt(step) is an explicit error-growth assumption, not a learned interval model.
 * Do not call these 50/90% prediction intervals or reuse them for physiology.
 */
export function historicalErrorRange(
  forecast: ForecastPoint[],
  predicted: ForecastPoint[],
  actual: ForecastPoint[],
): RangeEnvelope | null {
  if (
    !forecast.length ||
    !forecast.every(
      (point) =>
        Number.isFinite(point.value) && Number.isFinite(time(point.timestamp)),
    )
  )
    return null;
  const origin = time(forecast[0].timestamp);
  if (
    forecast.some((point, i) => {
      const step = (time(point.timestamp) - origin) / 900000;
      return (
        step < 0 ||
        !Number.isInteger(step) ||
        (i > 0 && time(point.timestamp) <= time(forecast[i - 1].timestamp))
      );
    })
  )
    return null;
  const observed = new Map(
    actual
      .filter(
        (point) =>
          Number.isFinite(point.value) && time(point.timestamp) <= origin,
      )
      .map((point) => [time(point.timestamp), point.value]),
  );
  const residuals = new Map<number, number>();
  for (const point of predicted) {
    const at = time(point.timestamp),
      value = observed.get(at);
    if (value !== undefined && Number.isFinite(point.value))
      residuals.set(at, Math.abs(value - point.value));
  }
  const sorted = [...residuals.values()].sort((a, b) => a - b);
  if (sorted.length < 30) return null;
  const typical = quantile(sorted, 0.5),
    wider = quantile(sorted, 0.9);
  return {
    method: "historical-error-reference",
    samples: sorted.length,
    points: forecast.map((point) => {
      const step = (time(point.timestamp) - origin) / 900000;
      const growth = Math.sqrt(step);
      // Do not silently clip implausible bounds to the normal/target range.
      return {
        timestamp: point.timestamp,
        inner: [point.value - typical * growth, point.value + typical * growth],
        outer: [point.value - wider * growth, point.value + wider * growth],
      };
    }),
  };
}

/** Parameter-grid spread is a sensitivity envelope, not a probability distribution. */
export function sensitivityRange(
  trajectories: ForecastPoint[][],
): RangeEnvelope | null {
  if (trajectories.length < 3 || !trajectories[0].length) return null;
  const first = trajectories[0];
  if (
    first.some(
      (row, i) => i > 0 && time(row.timestamp) <= time(first[i - 1].timestamp),
    )
  )
    return null;
  if (
    trajectories.some(
      (rows) =>
        rows.length !== first.length ||
        rows.some(
          (row, i) =>
            !Number.isFinite(row.value) ||
            !Number.isFinite(time(row.timestamp)) ||
            time(row.timestamp) !== time(first[i].timestamp),
        ),
    )
  )
    return null;
  return {
    method: "assumption-sensitivity",
    samples: trajectories.length,
    points: first.map((point, i) => {
      const values = trajectories
        .map((rows) => rows[i].value)
        .sort((a, b) => a - b);
      return {
        timestamp: point.timestamp,
        inner: [quantile(values, 0.25), quantile(values, 0.75)],
        outer: [values[0], values[values.length - 1]],
      };
    }),
  };
}
