import type { ConditionalSession } from './conditionalSession';
import type { AuxiliaryEvent } from './auxiliaryNutrition';
import { compareAuxiliaryEvents } from './auxiliaryNutrition';
import { loadAuxiliaryModel } from './auxiliaryModelLoader';
import { auxiliaryForecast } from './auxiliaryForecast';
import manifest from './auxiliaryManifest.json';

export async function forecastAuxiliarySession(session:ConditionalSession,events:AuxiliaryEvent[],signal:AbortSignal) {
  if(!session.history||session.history.recordId!==session.patientId)throw Error('A matching recorded CGM history is required.');
  if(signal.aborted)throw new DOMException('Cancelled','AbortError');
  const model=await loadAuxiliaryModel(signal);
  if(signal.aborted)throw new DOMException('Cancelled','AbortError');
  const result=compareAuxiliaryEvents(model,session.history,session.cohort,[],events);
  const forecast={...auxiliaryForecast(session.history,result,[],events,manifest,''),model_evaluation:{scope:manifest.evaluation_scope,mae_mg_dl:manifest.evaluation.mae_mg_dl}};
  return {forecast,comparison:{...result,explanations:[],baselineFuture:[],scenarioFuture:[]}};
}
