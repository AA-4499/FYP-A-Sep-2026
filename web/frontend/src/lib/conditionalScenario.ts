import type { Plan, PlannedEvent } from './conditionalFeatures';
import type { compileScenario } from './scenario';

export const emptyConditionalPlan: Plan = {carbs:0,mealAt:30,bolus:0,bolusAt:30,formulation:'rapid'};

/** Preserve each event's time and insulin formulation; never sum dose into food. */
export function conditionalPlanFromSchedule(compiled: ReturnType<typeof compileScenario>): Plan {
  if (compiled.unmodelled.length || !compiled.schedule.length || compiled.schedule.length > 12)
    throw Error('Use between 1 and 12 supported meal/bolus events for this model.');
  const events: PlannedEvent[] = compiled.schedule.map(row => {
    if (!Number.isFinite(row.minute) || row.minute <= 0 || row.minute > 360)
      throw Error('Place events after the forecast origin and at or before the six-hour endpoint.');
    if (row.kind === 'meal') {
      const macros=[row.protein,row.fat,row.fiber];
      const supplied=macros.some(v=>typeof v==='string'&&v.trim()!=='');
      if(supplied&&macros.some(v=>typeof v!=='string'||!v.trim()))throw Error('Enter all three meal macros or leave all unknown.');
      return {kind:'meal', minutesAhead:row.minute, amount:Number(row.carbohydrate),...(supplied?{protein:Number(row.protein),fat:Number(row.fat),fiber:Number(row.fiber)}:{})};
    }
    if(row.kind==='activity')return {kind:'activity',minutesAhead:row.minute,amount:Number(row.amount),activityId:row.activityId,met:Number(row.met)};
    if (row.kind === 'insulin' && ['rapid','regular'].includes(row.insulinFormulation ?? ''))
      return {kind:'bolus', minutesAhead:row.minute, amount:Number(row.amount), formulation:row.insulinFormulation!};
    throw Error('Only carbohydrate and explicitly typed rapid/regular boluses are trained scenario inputs.');
  });
  return {...emptyConditionalPlan, events};
}
