import manifest from './conditionalManifest.json';
import type {Cohort,ConditionalModel} from './conditionalDecoder';
import {validateConditionalModel} from './conditionalDecoder';
import type {ConditionalHistory,Plan} from './conditionalFeatures';
export interface ConditionalResult {baseline:number[];scenario:number[];explanations:{name:string;change:number}[];baselineFuture:number[][];scenarioFuture:number[][]}
export const decoderManifest=manifest.models;
async function loadVerifiedJson(path:string,expected:string,signal:AbortSignal){
 const response=await fetch(path,{signal,cache:'no-cache'});if(!response.ok)throw Error('A conditional model asset could not be loaded.');
 const bytes=await response.arrayBuffer();const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 if(digest!==expected)throw Error('A model asset does not match its saved version. Reload and retry.');
 return JSON.parse(new TextDecoder().decode(bytes));
}
export async function loadConditionalModel(cohort:Cohort,signal:AbortSignal){
 const entry=decoderManifest[cohort];const model=validateConditionalModel(await loadVerifiedJson(entry.path,entry.artifact_sha256,signal) as ConditionalModel);
 if(model.cohort!==cohort||model.checkpoint_sha256!==entry.checkpoint_sha256)throw Error('Decoder cohort/checkpoint identity mismatch.');
 return model;
}
export async function loadFoodReference(signal:AbortSignal):Promise<Record<string,number>>{
 const entry=manifest.food_reference;const value=await loadVerifiedJson(entry.path,entry.artifact_sha256,signal);
 if(value.version!==1||!value.foods||typeof value.foods!=='object'||Array.isArray(value.foods)||!Object.values(value.foods).every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100))throw Error('Unsupported reference-food mapping.');
 return value.foods;
}
export function runConditionalComparison(model:ConditionalModel,history:ConditionalHistory,baseline:Plan,scenario:Plan,minutes:number,signal:AbortSignal):Promise<ConditionalResult>{
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./conditionalPrediction.worker.ts',import.meta.url),{type:'module'});let settled=false;
  const done=(error?:Error,result?:ConditionalResult)=>{if(settled)return;settled=true;clearTimeout(timeout);signal.removeEventListener('abort',abort);worker.terminate();error?reject(error):resolve(result!);};
  const abort=()=>done(new DOMException('Cancelled','AbortError'));const timeout=setTimeout(()=>done(Error('The decoder timed out. Please retry.')),60000);
  if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});
  worker.onmessage=({data})=>data.error?done(Error(data.error)):done(undefined,data.result);worker.onerror=()=>done(Error('The decoder worker could not execute.'));
  worker.postMessage({model,history,baseline,scenario,minutes});
 });
}
