export const HISTORY_FEATURES = ['glucose_mg_dl','hour_sin','hour_cos','reference_complete_meal_carb_g','recorded_complete_meal_carb_0_1h_g','recorded_complete_meal_carb_1_3h_g','recorded_complete_meal_carb_3_6h_g','meal_description_present','meal_conversion_unresolved','meal_explicit_unavailable','modeled_bolus_iob_units','modeled_bolus_annotation_present','excluded_insulin_annotation_8h','iob_session_warmup_incomplete'];
export const FUTURE_FEATURES = [HISTORY_FEATURES[1],HISTORY_FEATURES[2],HISTORY_FEATURES[3],...HISTORY_FEATURES.slice(7)];
export const HORIZONS = [15,30,60,240] as const;
export type Cohort = 'ShanghaiT1DM'|'ShanghaiT2DM';
export interface ConditionalModel {
 version:number;architecture:string;cohort:Cohort;checkpoint_sha256:string;conditional:boolean;input_dim:number;hidden_dim:number;num_layers:number;sequence_length:number;future_steps:number;
 dynamic_features:string[];future_features:string[];horizons_minutes:number[];
 scalers:Record<string,number[]>;
 weights:Record<string,{shape:number[];values:number[]}>;
}
export function validateConditionalModel(model:ConditionalModel){
 if(model.version!==1||model.architecture!=='chronological-history-and-event-gru-v1'||!model.conditional||model.input_dim!==14||model.hidden_dim!==32||model.num_layers!==2||model.sequence_length!==24||model.future_steps!==16||!['ShanghaiT1DM','ShanghaiT2DM'].includes(model.cohort)||!/^[a-f0-9]{64}$/.test(model.checkpoint_sha256)||JSON.stringify(model.dynamic_features)!==JSON.stringify(HISTORY_FEATURES)||JSON.stringify(model.future_features)!==JSON.stringify(FUTURE_FEATURES)||JSON.stringify(model.horizons_minutes)!==JSON.stringify(HORIZONS))throw Error('Unsupported conditional decoder contract.');
 const shapes:Record<string,number[]>={};
 for(const prefix of ['encoder','decoder'])for(let layer=0;layer<2;layer++){
  shapes[`${prefix}.weight_ih_l${layer}`]=[96,layer===0?(prefix==='encoder'?14:10):32];shapes[`${prefix}.weight_hh_l${layer}`]=[96,32];
  shapes[`${prefix}.bias_ih_l${layer}`]=[96];shapes[`${prefix}.bias_hh_l${layer}`]=[96];
 }
 Object.assign(shapes,{'static_initial.weight':[64,4],'static_initial.bias':[64],'head.0.weight':[16,32],'head.0.bias':[16],'head.2.weight':[1,16],'head.2.bias':[1]});
 for(const [name,shape] of Object.entries(shapes)){const w=model.weights[name];if(!w||JSON.stringify(w.shape)!==JSON.stringify(shape)||w.values.length!==shape.reduce((a,b)=>a*b,1)||!w.values.every(Number.isFinite))throw Error(`Invalid decoder tensor: ${name}`);}
 for(const [name,size] of Object.entries({history_mean:14,history_scale:14,static_median:2,static_mean:2,static_scale:2,future_mean:10,future_scale:10,target_mean:4,target_scale:4})){
  const values=model.scalers[name];if(!values||values.length!==size||!values.every(Number.isFinite)||(name.endsWith('scale')&&values.some(x=>x<=0)))throw Error('Invalid decoder normalization.');
 }
 return model;
}
const sigmoid=(x:number)=>1/(1+Math.exp(-x));
function gelu(x:number){const a=Math.abs(x)/Math.SQRT2,t=1/(1+.3275911*a);const erf=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-a*a);return .5*x*(1+(x<0?-erf:erf));}
function affine(model:ConditionalModel,prefix:string,input:ArrayLike<number>){const matrix=model.weights[prefix+'.weight'].values,bias=model.weights[prefix+'.bias'].values;return Float32Array.from(bias,(b,row)=>{let value=b;for(let col=0;col<input.length;col++)value+=matrix[row*input.length+col]*input[col];return value;});}
function gates(model:ConditionalModel,prefix:string,layer:number,input:ArrayLike<number>,previous:Float32Array){
 const dot=(part:'ih'|'hh',v:ArrayLike<number>)=>{const w=model.weights[`${prefix}.weight_${part}_l${layer}`].values,b=model.weights[`${prefix}.bias_${part}_l${layer}`].values;return Float32Array.from(b,(bias,row)=>{let sum=bias;for(let col=0;col<v.length;col++)sum+=w[row*v.length+col]*v[col];return sum;});};
 const gi=dot('ih',input),gh=dot('hh',previous),next=new Float32Array(32);
 for(let i=0;i<32;i++){const reset=sigmoid(gi[i]+gh[i]),update=sigmoid(gi[32+i]+gh[32+i]);next[i]=(1-update)*Math.tanh(gi[64+i]+reset*gh[64+i])+update*previous[i];}
 return next;
}
const normalized=(row:number[],mean:number[],scale:number[])=>Float32Array.from(row,(x,i)=>Math.fround(Math.fround(Math.fround(x)-Math.fround(mean[i]))/Math.fround(scale[i])));
export function predictConditional(model:ConditionalModel,history:number[][],staticRaw:(number|null)[]|null,future:number[][]):number[]{
 if(history.length!==24||history.some(r=>r.length!==14||!r.every(Number.isFinite))||future.length!==16||future.some(r=>r.length!==10||!r.every(Number.isFinite)))throw Error('The decoder requires 24 history rows and 16 future event bins.');
 const s=model.scalers,states=[new Float32Array(32),new Float32Array(32)];
 for(const row of history){let input:ArrayLike<number>=normalized(row,s.history_mean,s.history_scale);for(let layer=0;layer<2;layer++){states[layer]=gates(model,'encoder',layer,input,states[layer]);input=states[layer];}}
 const raw=staticRaw?.slice(0,2)||[null,null],missing=raw.map(x=>typeof x!=='number'||!Number.isFinite(x)||x<=0);
 const context=Float32Array.from([...raw.map((x,i)=>Math.fround(Math.fround(Math.fround(missing[i]?s.static_median[i]:x!)-Math.fround(s.static_mean[i]))/Math.fround(s.static_scale[i]))),...missing.map(Number)]);
 const offset=affine(model,'static_initial',context);
 for(let layer=0;layer<2;layer++)for(let i=0;i<32;i++)states[layer][i]+=offset[layer*32+i];
 const result:number[]=[];
 for(let step=0;step<16;step++){
  let input:ArrayLike<number>=normalized(future[step],s.future_mean,s.future_scale);
  for(let layer=0;layer<2;layer++){states[layer]=gates(model,'decoder',layer,input,states[layer]);input=states[layer];}
  const horizon=([0,1,3,15]).indexOf(step);
  if(horizon>=0){const hidden=affine(model,'head.0',states[1]),activated=Float32Array.from(hidden,gelu);result.push(affine(model,'head.2',activated)[0]*s.target_scale[horizon]+s.target_mean[horizon]+history[23][0]);}
 }
 if(!result.every(Number.isFinite))throw Error('Decoder returned a nonfinite prediction.');
 return result;
}
