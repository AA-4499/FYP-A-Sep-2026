import type { ConditionalHistory } from './conditionalFeatures';
import type { GlucoseForecast } from './forecast';
import type { NutritionPlan } from './auxiliaryNutrition';

export function auxiliaryForecast(history:ConditionalHistory,result:{baseline:number[];scenario:number[]},baseline:NutritionPlan,scenario:NutritionPlan,identity:{version:string;checkpoint_sha256:string;evaluation_scope:string},label:string):GlucoseForecast {
  if(result.baseline.length!==24||result.scenario.length!==24||[...result.baseline,...result.scenario].some(v=>!Number.isFinite(v)||v<=0))throw Error('Incomplete auxiliary six-hour forecast.');
  const origin=new Date(history.origin).toISOString();
  const points=(values:number[])=>[{timestamp:origin,value:history.features[23][0]},...values.map((value,i)=>({timestamp:new Date(history.origin+(i+1)*900000).toISOString(),value}))];
  return {patient_id:history.recordId,record_id:history.recordId,source:'CGMacros research transfer',horizon_hours:6,model_family:'cgmacros-auxiliary',model_version:identity.version,model_sha256:identity.checkpoint_sha256,result_label:label.trim()||undefined,delivery:'browser',generated_at:new Date().toISOString(),sequence_length:24,forecast_start:origin,latest_glucose:history.features[23][0],baseline_end:result.baseline[23],scenario_end:result.scenario[23],scenario_enabled:JSON.stringify(baseline)!==JSON.stringify(scenario),baseline:points(result.baseline),scenario:points(result.scenario),observed:history.features.map((row,i)=>({timestamp:new Date(history.origin-(23-i)*900000).toISOString(),value:row[0]})),training:[],validation:[],testing:[],testing_actual:[],metrics:null,horizons_minutes:Array.from({length:24},(_,i)=>(i+1)*15),plans:{baseline,scenario,shanghai_transfer_validated:false,causal_treatment_effect_validated:false},uncertainty:identity.evaluation_scope+'; not a validated intervention effect; no calibrated interval.'};
}
