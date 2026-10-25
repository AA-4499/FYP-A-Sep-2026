import type { PhysiologyEvent } from "./physiology";

export type ScenarioKind =
  "meal" | "insulin" | "medication" | "activity" | "stress" | "illness";
export interface ScenarioDraft {
  id: string;
  kind: ScenarioKind;
  at: string;
  description: string;
  amount: string;
  carbohydrate: string;
  carbohydrateSource?: "manual" | "usda-cooked-white-rice";
  absorption: string;
  intensity: "moderate" | "intense";
}
// USDA SR28 NDB 20045: 28.17 g carbohydrate by difference and 0.4 g fibre / 100 g.
// Subtracting fibre is an explicit approximate available-carbohydrate convention.
export const cookedRiceReferenceUrl =
  "https://www.ars.usda.gov/ARSUserFiles/80400535/Data/SR/SR28/reports/sr28fg20.pdf#page=325";
export function cookedRiceCarbohydrate(foodGrams: number): number | null {
  if (!Number.isFinite(foodGrams) || foodGrams <= 0 || foodGrams > 2000)
    return null;
  return Number(((foodGrams * (28.17 - 0.4)) / 100).toFixed(1));
}
export const eventNames: Record<ScenarioKind, string> = {
  meal: "Food / drink",
  insulin: "Rapid-acting insulin injection",
  medication: "Oral / other diabetes medicine",
  activity: "Physical activity",
  stress: "Stress",
  illness: "Illness",
};
// Dataset timestamps without an offset follow the forecast service's UTC convention.
// datetime-local is intentionally a record-clock input, never the device timezone.
export function recordTime(value: string): number {
  return Date.parse(/[zZ]$|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
}
export function clockInput(value: number): string {
  return Number.isFinite(value)
    ? new Date(value).toISOString().slice(0, 16)
    : "";
}
export function compileScenario(
  drafts: ScenarioDraft[],
  start: string,
  hours: number,
) {
  const origin = recordTime(start);
  if (!Number.isFinite(origin) || ![6, 12].includes(hours))
    throw new Error(
      "A valid record time and 6- or 12-hour horizon are required.",
    );
  if (!drafts.length || drafts.length > 12)
    throw new Error("Add between 1 and 12 events before running the scenario.");
  const events: PhysiologyEvent[] = [];
  const unmodelled: string[] = [];
  const schedule = drafts
    .map((draft, index) => {
      const label = `Event ${index + 1}`;
      if (!Object.prototype.hasOwnProperty.call(eventNames, draft.kind))
        throw new Error(`${label}: select a supported event type.`);
      if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(draft.at))
        throw new Error(`${label}: enter a date and clock time.`);
      const at = recordTime(draft.at);
      if (clockInput(at) !== draft.at)
        throw new Error(`${label}: enter a valid calendar date and time.`);
      // Compare rounded minute boundaries, not fractional minutes in a recorded seed.
      const minute = (at - Math.floor(origin / 60000) * 60000) / 60000;
      if (!Number.isInteger(minute) || minute < 1 || minute >= hours * 60)
        throw new Error(
          `${label}: choose a time after the seed observation and inside the ${hours}-hour window.`,
        );
      if (!draft.description.trim())
        throw new Error(
          `${label}: describe the food, insulin, medicine or activity.`,
        );
      const amount = Number(draft.amount);
      if (
        ["meal", "insulin", "medication", "activity"].includes(draft.kind) &&
        (!draft.amount.trim() || !Number.isFinite(amount) || amount <= 0)
      )
        throw new Error(`${label}: enter a positive amount.`);
      if (draft.kind === "meal") {
        const carbohydrate = Number(draft.carbohydrate);
        const absorptionMinutes = Number(draft.absorption);
        if (
          draft.carbohydrateSource === "usda-cooked-white-rice" &&
          carbohydrate !== cookedRiceCarbohydrate(amount)
        )
          throw new Error(
            `${label}: the cooked-rice estimate no longer matches the portion. Re-select the reference or choose manual entry.`,
          );
        if (
          !draft.carbohydrate.trim() ||
          !Number.isFinite(carbohydrate) ||
          carbohydrate <= 0 ||
          carbohydrate > 200 ||
          carbohydrate > amount ||
          amount > 2000 ||
          ![25, 45, 75].includes(absorptionMinutes)
        )
          throw new Error(
            `${label}: enter food mass up to 2,000 g and available carbohydrate up to 200 g (no greater than food mass), and select absorption speed.`,
          );
        events.push({
          kind: "carbohydrate",
          minute,
          amount: carbohydrate,
          absorptionMinutes,
        });
      } else if (draft.kind === "insulin") {
        if (amount > 20)
          throw new Error(
            `${label}: the research model supports up to 20 hypothetical units per injection.`,
          );
        events.push({ kind: "insulin", minute, amount });
      } else if (draft.kind === "activity") {
        if (
          !Number.isInteger(amount) ||
          amount > 120 ||
          minute + amount > hours * 60 ||
          !["moderate", "intense"].includes(draft.intensity)
        )
          throw new Error(
            `${label}: activity must last 1–120 whole minutes and finish inside the simulation window.`,
          );
        events.push({
          kind: "activity",
          minute,
          amount,
          intensity: draft.intensity,
        });
      } else {
        // A medicine name/dose cannot identify a patient-specific pharmacodynamic curve.
        // Keep these events visible rather than silently treating all medicines as insulin.
        unmodelled.push(
          `${eventNames[draft.kind]}: ${draft.description.trim()}`,
        );
      }
      return { ...draft, minute };
    })
    .sort((a, b) => a.minute - b.minute);
  return {
    events: events.sort((a, b) => a.minute - b.minute),
    unmodelled,
    schedule,
  };
}
