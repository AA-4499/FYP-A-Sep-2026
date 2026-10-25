/**
 * Reduced research model, inspired by glucose/insulin compartment models.
 * This is NOT an implementation of the validated Dalla Man / UVA-Padova model.
 * Constants and latent states are explicit assumptions, not patient estimates.
 * See docs/clinical-data-and-physiology.md for equations, units and limitations.
 */
export interface PhysiologyAssumptions {
  basalGlucose: number;
  weightKg: number;
  betaResponse: number;
  sensitivity: number;
  absorptionMinutes: number;
}
export interface PhysiologyEvent {
  kind: "carbohydrate" | "insulin" | "activity";
  minute: number;
  amount: number;
  absorptionMinutes?: number;
  intensity?: "moderate" | "intense";
}
export interface PhysiologyPoint {
  minute: number;
  glucose: number;
  plasma: number;
  secretion: number;
  action: number;
  gutGrams: number;
  insulinOnBoard: number;
}
export class PhysiologyDomainError extends Error {
  constructor(
    public minute: number,
    public simulatedGlucose: number,
  ) {
    super(
      `The simulated plasma glucose ${Number.isFinite(simulatedGlucose) ? `reached ${simulatedGlucose.toFixed(0)} mg/dL` : "became non-finite"} at +${minute} minutes, outside this model's 20–600 mg/dL domain. Review carbohydrate grams, event amounts and model assumptions. This is a model limit, not a measured patient result.`,
    );
    this.name = "PhysiologyDomainError";
  }
}
export function simulatePhysiology(
  initialGlucose: number,
  hours: number,
  assumptions: PhysiologyAssumptions,
  events: PhysiologyEvent[] = [],
): PhysiologyPoint[] {
  const {
    basalGlucose,
    weightKg,
    betaResponse,
    sensitivity,
    absorptionMinutes,
  } = assumptions;
  if (
    ![initialGlucose, hours, ...Object.values(assumptions)].every(
      Number.isFinite,
    ) ||
    initialGlucose < 30 ||
    initialGlucose > 500 ||
    hours < 1 ||
    hours > 12 ||
    basalGlucose < 60 ||
    basalGlucose > 250 ||
    weightKg < 30 ||
    weightKg > 250 ||
    betaResponse < 0 ||
    betaResponse > 1.5 ||
    sensitivity < 0 ||
    sensitivity > 2 ||
    absorptionMinutes < 20 ||
    absorptionMinutes > 120
  ) {
    throw new Error(
      "The physiology assumptions are outside the supported research range.",
    );
  }
  if (
    events.length > 12 ||
    events.some(
      (e) =>
        !["carbohydrate", "insulin", "activity"].includes(e.kind) ||
        !Number.isInteger(e.minute) ||
        e.minute < 0 ||
        e.minute >= hours * 60 ||
        !Number.isFinite(e.amount) ||
        e.amount <= 0 ||
        e.amount >
          (e.kind === "carbohydrate"
            ? 200
            : e.kind === "activity"
              ? 120
              : 20) ||
        (e.kind === "carbohydrate" &&
          e.absorptionMinutes !== undefined &&
          (!Number.isFinite(e.absorptionMinutes) ||
            e.absorptionMinutes < 20 ||
            e.absorptionMinutes > 120)) ||
        (e.kind === "activity" &&
          (!Number.isInteger(e.amount) ||
            e.minute + e.amount > hours * 60 ||
            !["moderate", "intense"].includes(e.intensity || ""))),
    )
  ) {
    throw new Error(
      "Enter events within the simulation window: up to 200 g carbohydrate, 20 hypothetical insulin units, or 120 minutes of activity per event.",
    );
  }
  let glucose = initialGlucose,
    sensor = initialGlucose,
    secretion = 0,
    action = 0;
  let gut1 = 0,
    gut2 = 0,
    depot1 = 0,
    depot2 = 0,
    exogenous = 0;
  const meals: { first: number; second: number; tau: number }[] = [];
  const points: PhysiologyPoint[] = [];
  const point = (minute: number) => ({
    minute,
    glucose: sensor,
    plasma: glucose,
    secretion,
    action,
    gutGrams: gut1 + gut2,
    insulinOnBoard: depot1 + depot2,
  });
  points.push(point(0));
  for (let minute = 0; minute < hours * 60; minute++) {
    for (const event of events.filter((e) => e.minute === minute)) {
      if (event.kind === "carbohydrate")
        meals.push({
          first: event.amount,
          second: 0,
          tau: event.absorptionMinutes ?? absorptionMinutes,
        });
      else if (event.kind === "insulin") depot1 += event.amount;
    }
    // One-minute explicit integration, all right-hand sides use the prior state.
    let absorption = 0;
    for (const meal of meals) {
      const transfer = meal.first / meal.tau;
      const appearance = meal.second / meal.tau;
      absorption += appearance;
      meal.first -= transfer;
      meal.second += transfer - appearance;
    }
    // Illustrative activity compartments, not fitted exercise response coefficients.
    // Cap overlapping activity at one concurrent session rather than stacking effort.
    const active = events.filter(
      (e) =>
        e.kind === "activity" &&
        minute >= e.minute &&
        minute < e.minute + e.amount,
    );
    const exercising = active.length > 0;
    const intense = active.some((e) => e.intensity === "intense");
    const muscleUptake = exercising ? (intense ? 0.001 : 0.002) * glucose : 0;
    const stressHepaticRelease = intense ? 0.45 : 0;
    const insulinTransfer = depot1 / 55;
    const insulinAbsorption = depot2 / 55;
    const stimulus = betaResponse * Math.max(0, (glucose - basalGlucose) / 100);
    const hepaticReturn =
      (0.008 * basalGlucose) / (1 + 0.6 * action) +
      Math.max(0, 70 - glucose) * 0.02;
    const glucoseChange =
      hepaticReturn +
      stressHepaticRelease -
      muscleUptake -
      0.008 * glucose -
      0.008 * sensitivity * action * glucose +
      (absorption * 1000 * 0.8) / (1.6 * weightKg);
    gut1 = meals.reduce((total, meal) => total + meal.first, 0);
    gut2 = meals.reduce((total, meal) => total + meal.second, 0);
    depot1 -= insulinTransfer;
    depot2 += insulinTransfer - insulinAbsorption;
    exogenous += insulinAbsorption * 0.35 - exogenous / 60;
    action += (secretion + exogenous - action) / 60;
    secretion += (stimulus - secretion) / 25;
    sensor += (glucose - sensor) / 10;
    glucose += glucoseChange;
    if (!Number.isFinite(glucose) || glucose < 20 || glucose > 600)
      throw new PhysiologyDomainError(minute + 1, glucose);
    if ((minute + 1) % 5 === 0) points.push(point(minute + 1));
  }
  return points;
}
