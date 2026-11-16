import {predictConditional,validateConditionalModel,type ConditionalModel} from './conditionalDecoder';
import {buildFuturePlan,withoutPlannedEvents,type ConditionalHistory,type Plan} from './conditionalFeatures';
self.onmessage=({data}:{data:{model:ConditionalModel;history:ConditionalHistory;baseline:Plan;scenario:Plan;minutes:number}})=>{
 try{
  const model=validateConditionalModel(data.model),history=data.history;
  const base=buildFuturePlan(history,data.baseline,model.version===2),changed=buildFuturePlan(history,data.scenario,model.version===2);
  const baseline=predictConditional(model,history.features,history.staticContext,base),scenario=predictConditional(model,history.features,history.staticContext,changed);
  const index=model.horizons_minutes.indexOf(data.minutes);if(index<0)throw Error('Unsupported horizon.');
  const groups=[{name:'Recent glucose',history:[0],future:[]},{name:'Recorded meal history',history:[3,4,5,6,7,8,9],future:[]},{name:'Modeled bolus IOB and coverage',history:[10,11,12,13],future:[6,7,8,9]}];
  const explanations=groups.map(group=>{
   const x=history.features.map(row=>row.map((v,i)=>group.history.includes(i)?model.scalers.history_mean[i]:v));
   const f=changed.map(row=>row.map((v,i)=>group.future.includes(i)?model.scalers.future_mean[i]:v));
   return {name:group.name,change:scenario[index]-predictConditional(model,x,history.staticContext,f)[index]};
  });
  const mealRemoved=buildFuturePlan(history,withoutPlannedEvents(data.scenario,'meal'),model.version===2),bolusRemoved=buildFuturePlan(history,withoutPlannedEvents(data.scenario,'bolus'),model.version===2);
  explanations.push({name:'Planned carbohydrate (removed and rerun)',change:scenario[index]-predictConditional(model,history.features,history.staticContext,mealRemoved)[index]});
  explanations.push({name:'Planned bolus (removed; IOB recalculated)',change:scenario[index]-predictConditional(model,history.features,history.staticContext,bolusRemoved)[index]});
  if(model.version===2){
   const noActivity=buildFuturePlan(history,withoutPlannedEvents(data.scenario,'activity'),true);
   explanations.push({name:'Planned physical activity (removed and rerun)',change:scenario[index]-predictConditional(model,history.features,history.staticContext,noActivity)[index]});
   const noMacros=changed.map(row=>row.map((v,i)=>i>=10&&i<=13?0:v));
   explanations.push({name:'Planned meal composition (masked and rerun)',change:scenario[index]-predictConditional(model,history.features,history.staticContext,noMacros)[index]});
  }
  self.postMessage({result:{baseline,scenario,explanations,baselineFuture:base,scenarioFuture:changed}});
 }catch(e){self.postMessage({error:e instanceof Error?e.message:'Conditional prediction failed.'});}
};
