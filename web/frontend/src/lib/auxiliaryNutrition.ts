import type { ConditionalHistory } from './conditionalFeatures';

export const AUX_HISTORY = ['glucose_mg_dl','hour_sin','hour_cos'];
export const AUX_FUTURE = ['hour_sin','hour_cos','carbs_g','protein_g','fat_g','fiber_g','meal_recorded','macros_known','met','activity_known'];
export interface AuxiliaryModel {
  version: number; architecture: string; mode: string; checkpoint_sha256: string;
  source_sha256: string; input_dim: number; hidden_dim: number; num_layers: number;
  sequence_length: number; future_steps: number; dynamic_features: string[];
  future_features: string[]; horizons_minutes: number[];
  causal_treatment_effect_validated: boolean; shanghai_transfer_validated: boolean;
  scalers: Record<string,number[]>;
  weights: Record<string,{shape:number[];values:number[]}>;
}
export interface NutritionPlan {
  at: number; carbs: number; protein: number; fat: number; fiber: number;
  activityAt: number; activityMinutes: number; met: number;
}
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export function validateAuxiliary(model: AuxiliaryModel) {
  if (model.version !== 1 || model.architecture !== 'cgmacros-auxiliary-gru-v1' ||
      !['macros','macros_activity'].includes(model.mode) || model.input_dim !== 3 ||
      model.hidden_dim !== 32 || model.num_layers !== 2 || model.sequence_length !== 24 || model.future_steps !== 24 ||
      model.causal_treatment_effect_validated !== false || model.shanghai_transfer_validated !== false ||
      !/^[a-f0-9]{64}$/.test(model.checkpoint_sha256) ||
      JSON.stringify(model.dynamic_features) !== JSON.stringify(AUX_HISTORY) ||
      JSON.stringify(model.future_features) !== JSON.stringify(AUX_FUTURE) ||
      JSON.stringify(model.horizons_minutes) !== JSON.stringify(Array.from({length:24},(_,i)=>(i+1)*15))) throw Error('Unsupported auxiliary research model.');
  const shapes: Record<string,number[]> = {};
  for (const prefix of ['encoder','decoder']) for (let layer=0;layer<2;layer++) {
    shapes[`${prefix}.weight_ih_l${layer}`]=[96,layer ? 32 : prefix==='encoder' ? 3 : 10];
    shapes[`${prefix}.weight_hh_l${layer}`]=[96,32];
    shapes[`${prefix}.bias_ih_l${layer}`]=[96];shapes[`${prefix}.bias_hh_l${layer}`]=[96];
  }
  Object.assign(shapes,{'static_initial.weight':[64,4],'static_initial.bias':[64],'head.0.weight':[16,32],'head.0.bias':[16],'head.2.weight':[1,16],'head.2.bias':[1]});
  for (const [name,shape] of Object.entries(shapes)) {
    const tensor=model.weights?.[name];
    if (!tensor || JSON.stringify(tensor.shape)!==JSON.stringify(shape) || tensor.values.length!==shape.reduce((a,b)=>a*b,1) || !tensor.values.every(finite)) throw Error('Corrupt auxiliary tensor.');
  }
  for (const [name,size] of Object.entries({history_mean:3,history_scale:3,future_mean:10,future_scale:10,static_mean:2,static_scale:2,static_median:2,target_mean:24,target_scale:24})) {
    const values=model.scalers?.[name];
    if (!values || values.length!==size || !values.every(finite) || (name.endsWith('scale') && values.some(x=>x<=0))) throw Error('Corrupt auxiliary normalization.');
  }
  return model;
}

/** Exact future bins; duration is a measured MET average, not an insulin dose. */
export function nutritionSchedule(origin: number, plan: NutritionPlan, activityEnabled: boolean): number[][] {
  if (!finite(origin) || Object.values(plan).some(v=>!finite(v))) throw Error('Use finite nutrition and activity values.');
  if (plan.at<=0 || plan.at>360 || plan.carbs<0 || plan.carbs>150 || plan.protein<0 || plan.protein>100 || plan.fat<0 || plan.fat>100 || plan.fiber<0 || plan.fiber>40 || plan.fiber>plan.carbs) throw Error('Use a meal within six hours: carbs 0–150 g, protein/fat 0–100 g, fiber 0–40 g and no more than total carbs.');
  if (activityEnabled && (plan.activityAt<0 || plan.activityMinutes<15 || plan.activityMinutes>120 || plan.activityAt+plan.activityMinutes>360 || plan.met<1 || plan.met>8 || plan.activityAt%15!==0 || plan.activityMinutes%15!==0)) throw Error('Use a 15-minute activity grid within six hours, duration 15–120 minutes and MET 1–8.');
  const meal=Math.ceil(plan.at/15)-1;
  return Array.from({length:24},(_,i)=>{
    const date=new Date(origin+(i+1)*900000),hour=date.getUTCHours()+date.getUTCMinutes()/60;
    const active=activityEnabled && i*15>=plan.activityAt && i*15<plan.activityAt+plan.activityMinutes;
    return [Math.sin(2*Math.PI*hour/24),Math.cos(2*Math.PI*hour/24),...(i===meal?[plan.carbs,plan.protein,plan.fat,plan.fiber,1,1]:[0,0,0,0,0,0]),active?plan.met:0,Number(active)];
  });
}

const sigmoid=(x:number)=>1/(1+Math.exp(-x));
function gelu(x:number) {const a=Math.abs(x)/Math.SQRT2,t=1/(1+.3275911*a);const erf=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-a*a);return .5*x*(1+(x<0?-erf:erf));}
function affine(model:AuxiliaryModel,prefix:string,input:ArrayLike<number>) {
  const matrix=model.weights[prefix+'.weight'].values,bias=model.weights[prefix+'.bias'].values;
  return Float32Array.from(bias,(b,row)=>{let v=b;for(let col=0;col<input.length;col++)v+=matrix[row*input.length+col]*input[col];return v;});
}
function gates(model:AuxiliaryModel,prefix:string,layer:number,input:ArrayLike<number>,previous:Float32Array) {
  const dot=(part:'ih'|'hh',v:ArrayLike<number>)=>{
    const w=model.weights[`${prefix}.weight_${part}_l${layer}`].values,b=model.weights[`${prefix}.bias_${part}_l${layer}`].values;
    return Float32Array.from(b,(bias,row)=>{let sum=bias;for(let c=0;c<v.length;c++)sum+=w[row*v.length+c]*v[c];return sum;});
  };
  const gi=dot('ih',input),gh=dot('hh',previous),next=new Float32Array(32);
  for(let i=0;i<32;i++){const reset=sigmoid(gi[i]+gh[i]),update=sigmoid(gi[32+i]+gh[32+i]);next[i]=(1-update)*Math.tanh(gi[64+i]+reset*gh[64+i])+update*previous[i];}
  return next;
}
const normalized=(r:number[],mean:number[],scale:number[])=>Float32Array.from(r,(x,i)=>Math.fround(Math.fround(Math.fround(x)-Math.fround(mean[i]))/Math.fround(scale[i])));

export function predictAuxiliary(model:AuxiliaryModel,history:number[][],staticRaw:(number|null)[],future:number[][]):number[] {
  if(history.length!==24 || history.some(r=>r.length!==3||!r.every(finite)||r[0]<40||r[0]>400) || future.length!==24 || future.some(r=>r.length!==10||!r.every(finite))) throw Error('Auxiliary forecast requires 24 valid glucose samples and 24 future bins.');
  const s=model.scalers,states=[new Float32Array(32),new Float32Array(32)];
  for(const row of history){let input:ArrayLike<number>=normalized(row,s.history_mean,s.history_scale);for(let layer=0;layer<2;layer++){states[layer]=gates(model,'encoder',layer,input,states[layer]);input=states[layer];}}
  const raw=staticRaw.slice(0,2),missing=[0,1].map(i=>!finite(raw[i])||raw[i]!<=0);
  const context=Float32Array.from([...missing.map((m,i)=>( (m?s.static_median[i]:raw[i]!)-s.static_mean[i])/s.static_scale[i]),...missing.map(Number)]);
  const offset=affine(model,'static_initial',context);
  for(let layer=0;layer<2;layer++)for(let i=0;i<32;i++)states[layer][i]+=offset[layer*32+i];
  const result:number[]=[];
  for(let step=0;step<24;step++){
    let input:ArrayLike<number>=normalized(future[step],s.future_mean,s.future_scale);
    for(let layer=0;layer<2;layer++){states[layer]=gates(model,'decoder',layer,input,states[layer]);input=states[layer];}
    const h=step;
    if(h>=0)result.push(affine(model,'head.2',Float32Array.from(affine(model,'head.0',states[1]),gelu))[0]*s.target_scale[h]+s.target_mean[h]+history[23][0]);
  }
  if(result.some(v=>!finite(v)||v<=0)) throw Error('Auxiliary model returned unusable estimates.');
  return result;
}

export function compareNutrition(model:AuxiliaryModel,history:ConditionalHistory,cohort:string,baseline:NutritionPlan,scenario:NutritionPlan) {
  if(cohort!=='ShanghaiT2DM') throw Error('The mixed-status CGMacros research model has no validated T1D transfer.');
  const age=history.staticContext[0],bmi=history.staticContext[1];
  if(!finite(age)||age<18||age>69||!finite(bmi)||bmi<20.69||bmi>49.09) throw Error('Auxiliary research requires recorded age 18–69 and BMI 20.69–49.09.');
  const sourceTime=(t:string)=>{const v=t.trim().replace(' ','T');return Date.parse(/Z$|[+-]\d\d:\d\d$/i.test(v)?v:v+'Z');};
  if(history.timestamps.length!==24 || history.timestamps.some((t,i)=>!finite(sourceTime(t))||(i>0&&sourceTime(t)-sourceTime(history.timestamps[i-1])!==900000)) || sourceTime(history.timestamps[23])!==history.origin) throw Error('Auxiliary history must be consecutive and match the forecast origin.');
  const x=history.features.map(r=>r.slice(0,3));
  const forecast=(plan:NutritionPlan)=>predictAuxiliary(model,x,history.staticContext,nutritionSchedule(history.origin,plan,model.mode==='macros_activity'));
  return {baseline:forecast(baseline),scenario:forecast(scenario)};
}
