import type { Plan, PlannedEvent } from './conditionalFeatures';
import type { compileScenario } from './scenario';

export const emptyConditionalPlan: Plan = {carbs:0,mealAt:30,bolus:0,bolusAt:30,formulation:'rapid'};

/** Preserve each event's time and insulin formulation; never sum dose into food. */
export function conditionalPlanFromSchedule(compiled: ReturnType<typeof compileScenario>): Plan {
  if (compiled.unmodelled.length || !compiled.schedule.length || compiled.schedule.length > 12)
    throw Error('Use between 1 and 12 supported meal/bolus events for this model.');
  const events: PlannedEvent[] = compiled.schedule.map(row => {
    if (!Number.isFinite(row.minute) || row.minute <= 0 || row.minute >= 240)
      throw Error('Place events after the forecast origin and before the four-hour endpoint.');
    if (row.kind === 'meal') return {kind:'meal', minutesAhead:row.minute, amount:Number(row.carbohydrate)};
    if (row.kind === 'insulin' && ['rapid','regular'].includes(row.insulinFormulation ?? ''))
      return {kind:'bolus', minutesAhead:row.minute, amount:Number(row.amount), formulation:row.insulinFormulation!};
    throw Error('Only carbohydrate and explicitly typed rapid/regular boluses are trained scenario inputs.');
  });
  return {...emptyConditionalPlan, events};
}
