import type { compileScenario } from './scenario';
import type { AuxiliaryEvent } from './auxiliaryNutrition';

export function auxiliaryEventsFromSchedule(compiled:ReturnType<typeof compileScenario>):AuxiliaryEvent[] {
  if(compiled.unmodelled.length||!compiled.schedule.length||compiled.schedule.length>12)throw Error('Use between 1 and 12 supported nutrition/activity events.');
  return compiled.schedule.map(row=>{
    if(row.kind==='meal'){
      if([row.carbohydrate,row.protein,row.fat,row.fiber].some(v=>typeof v!=='string'||!v.trim()))throw Error('Enter all meal macros explicitly; missing values are not zero.');
      return {kind:'meal',minutesAhead:row.minute,carbs:Number(row.carbohydrate),protein:Number(row.protein),fat:Number(row.fat),fiber:Number(row.fiber)};
    }
    if(row.kind==='activity')return {kind:'activity',minutesAhead:row.minute,durationMinutes:Number(row.amount),met:Number(row.met)};
    throw Error('Auxiliary prediction supports meals and activity, not insulin or other medicines.');
  });
}
