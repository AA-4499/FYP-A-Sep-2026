import {
  simulatePhysiology,
  type PhysiologyAssumptions,
  type PhysiologyEvent,
} from "./physiology";
import { sensitivityRange } from "./forecastRanges";
import type { ForecastPoint } from "./forecast";

/** 27 explicit settings, not random patients and not samples of a fitted posterior. */
export function physiologyRanges(
  initial: number,
  hours: number,
  assumptions: PhysiologyAssumptions,
  events: PhysiologyEvent[],
  origin: number,
) {
  const baseline: ForecastPoint[][] = [],
    scenario: ForecastPoint[][] = [];
  const sample = (rows: ReturnType<typeof simulatePhysiology>) =>
    rows
      .filter((row) => row.minute % 15 === 0)
      .map((row) => ({
        timestamp: new Date(origin + row.minute * 60000).toISOString(),
        value: row.glucose,
      }));
  try {
    for (const betaFactor of [0.5, 1, 1.5])
      for (const sensitivityFactor of [0.75, 1, 1.25])
        for (const speedFactor of [0.75, 1, 1.25]) {
          const variation = {
            ...assumptions,
            betaResponse: Math.min(1.5, assumptions.betaResponse * betaFactor),
            sensitivity: Math.min(
              2,
              assumptions.sensitivity * sensitivityFactor,
            ),
          };
          const variedEvents = events.map((event) =>
            event.kind === "carbohydrate"
              ? {
                  ...event,
                  absorptionMinutes: Math.max(
                    20,
                    Math.min(
                      120,
                      (event.absorptionMinutes ??
                        assumptions.absorptionMinutes) * speedFactor,
                    ),
                  ),
                }
              : event,
          );
          baseline.push(sample(simulatePhysiology(initial, hours, variation)));
          scenario.push(
            sample(simulatePhysiology(initial, hours, variation, variedEvents)),
          );
        }
    return {
      baseline: sensitivityRange(baseline),
      scenario: sensitivityRange(scenario),
      error: "",
    };
  } catch {
    // Dropping failed extreme settings would hide uncertainty and narrow the envelope.
    return {
      baseline: null,
      scenario: null,
      error:
        "Sensitivity range unavailable: at least one assumption setting left the model domain. No failed settings were silently discarded.",
    };
  }
}
