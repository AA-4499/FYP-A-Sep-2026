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
  kind: "carbohydrate" | "insulin";
  minute: number;
  amount: number;
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
        !["carbohydrate", "insulin"].includes(e.kind) ||
        !Number.isInteger(e.minute) ||
        e.minute < 0 ||
        e.minute >= hours * 60 ||
        !Number.isFinite(e.amount) ||
        e.amount <= 0 ||
        e.amount > (e.kind === "carbohydrate" ? 200 : 20),
    )
  ) {
    throw new Error(
      "Enter events within the simulation window: up to 200 g carbohydrate or 20 units of hypothetical insulin per event.",
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
      if (event.kind === "carbohydrate") gut1 += event.amount;
      else depot1 += event.amount;
    }
    // One-minute explicit integration, all right-hand sides use the prior state.
    const gutTransfer = gut1 / absorptionMinutes;
    const absorption = gut2 / absorptionMinutes;
    const insulinTransfer = depot1 / 55;
    const insulinAbsorption = depot2 / 55;
    const stimulus = betaResponse * Math.max(0, (glucose - basalGlucose) / 100);
    const hepaticReturn =
      (0.008 * basalGlucose) / (1 + 0.6 * action) +
      Math.max(0, 70 - glucose) * 0.02;
    const glucoseChange =
      hepaticReturn -
      0.008 * glucose -
      0.008 * sensitivity * action * glucose +
      (absorption * 1000 * 0.8) / (1.6 * weightKg);
    gut1 -= gutTransfer;
    gut2 += gutTransfer - absorption;
    depot1 -= insulinTransfer;
    depot2 += insulinTransfer - insulinAbsorption;
    exogenous += insulinAbsorption * 0.35 - exogenous / 60;
    action += (secretion + exogenous - action) / 60;
    secretion += (stimulus - secretion) / 25;
    sensor += (glucose - sensor) / 10;
    glucose += glucoseChange;
    if (!Number.isFinite(glucose) || glucose < 20 || glucose > 600)
      throw new Error(
        "This scenario left the model domain (20–600 mg/dL). No trustworthy curve can be shown for these assumptions.",
      );
    if ((minute + 1) % 5 === 0) points.push(point(minute + 1));
  }
  return points;
}
