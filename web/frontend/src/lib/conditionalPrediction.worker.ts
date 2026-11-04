import {predictConditional,validateConditionalModel,type ConditionalModel} from './conditionalDecoder';
import {buildFuturePlan,type ConditionalHistory,type Plan} from './conditionalFeatures';
self.onmessage=({data}:{data:{model:ConditionalModel;history:ConditionalHistory;baseline:Plan;scenario:Plan;minutes:number}})=>{
 try{
  const model=validateConditionalModel(data.model),history=data.history;
  const base=buildFuturePlan(history,data.baseline),changed=buildFuturePlan(history,data.scenario);
  const baseline=predictConditional(model,history.features,history.staticContext,base),scenario=predictConditional(model,history.features,history.staticContext,changed);
  const index=model.horizons_minutes.indexOf(data.minutes);if(index<0)throw Error('Unsupported horizon.');
  const groups=[{name:'Recent glucose',history:[0],future:[]},{name:'Recorded meal history',history:[3,4,5,6,7,8,9],future:[]},{name:'Modeled bolus IOB and coverage',history:[10,11,12,13],future:[6,7,8,9]}];
  const explanations=groups.map(group=>{
   const x=history.features.map(row=>row.map((v,i)=>group.history.includes(i)?model.scalers.history_mean[i]:v));
   const f=changed.map(row=>row.map((v,i)=>group.future.includes(i)?model.scalers.future_mean[i]:v));
   return {name:group.name,change:scenario[index]-predictConditional(model,x,history.staticContext,f)[index]};
  });
  const mealRemoved=buildFuturePlan(history,{...data.scenario,carbs:0}),bolusRemoved=buildFuturePlan(history,{...data.scenario,bolus:0});
  explanations.push({name:'Planned carbohydrate (removed and rerun)',change:scenario[index]-predictConditional(model,history.features,history.staticContext,mealRemoved)[index]});
  explanations.push({name:'Planned bolus (removed; IOB recalculated)',change:scenario[index]-predictConditional(model,history.features,history.staticContext,bolusRemoved)[index]});
  self.postMessage({result:{baseline,scenario,explanations,baselineFuture:base,scenarioFuture:changed}});
 }catch(e){self.postMessage({error:e instanceof Error?e.message:'Conditional prediction failed.'});}
};
