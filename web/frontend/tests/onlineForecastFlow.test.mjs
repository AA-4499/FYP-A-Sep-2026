import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const moduleUrl=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const readback=moduleUrl(compile(readFileSync(new URL('../src/lib/forecastReadback.ts',import.meta.url),'utf8')));
const stub=moduleUrl(`
export const getSupabaseClient=()=>({auth:{getSession:async()=>({data:{session:{access_token:'test-token'}}})}});
export const loadForecastPreview=()=>{throw Error('Unexpected preview fallback');};
export const requestModelService=async(url,options)=>globalThis.__onlineFlowMock(url,options);
export const isRetiredModelOrigin=()=>false;
export const readForecastApiOverride=()=>null;
export const resolveMainApiOrigin=()=> 'https://api.example.test';
`);
let code=compile(readFileSync(new URL('../src/lib/forecast.ts',import.meta.url),'utf8').replaceAll('import.meta.env.VITE_API_BASE_URL',JSON.stringify('https://api.example.test')).replaceAll('import.meta.env.DEV','false'));
code=code.replace(/from (["'])\.\/([^"']+)\1/g,(_,quote,name)=>`from ${JSON.stringify(name==='forecastReadback'?readback:stub)}`);
const {fetchGlucoseForecast}=await import(moduleUrl(code));
const options={source:'supabase',horizon_hours:3,events:[],run_id:'run-a'};
const output={patient_id:'record-a',model_sha256:'a'.repeat(64),source:'supabase',baseline:[{timestamp:'2026-01-01',value:100}]};
const generated={...output,storage:{saved:true,run_id:'run-a'}};
const saved={run_id:'run-a',patient_id:'record-a',model_sha256:'a'.repeat(64),output};
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
function requests(steps){const calls=[];globalThis.__onlineFlowMock=async(url,init)=>{calls.push({url,init});const step=steps.shift();if(step instanceof Error)throw step;assert.ok(step,'Unexpected extra network request');return step;};return calls;}

test('online forecast reports retrieved only after the complete saved output matches',async()=>{
 const calls=requests([response(generated),response(saved)]);
 const result=await fetchGlucoseForecast('record-a',options,new AbortController().signal);
 assert.equal(result.storage.retrieved,true);assert.equal(calls.length,2);
 assert.equal(calls[0].init.method,'POST');assert.match(calls[1].url,/\/record-a\/glucose-forecasts\/run-a$/);
 assert.equal(calls[1].init.headers.Authorization,'Bearer test-token');
});
test('unauthorised prediction does not attempt a history read',async()=>{
 const calls=requests([response({error:'Not assigned to your care team'},403)]);
 await assert.rejects(fetchGlucoseForecast('record-a',options,new AbortController().signal),/Not assigned/);assert.equal(calls.length,1);
});
test('missing save receipt never becomes a false saved-success message',async()=>{
 const calls=requests([response({...output,storage:{saved:false,run_id:'run-a'}})]);
 await assert.rejects(fetchGlucoseForecast('record-a',options,new AbortController().signal),/did not confirm/);assert.equal(calls.length,1);
});
test('readback network failure explains that the output was already saved',async()=>{
 requests([response(generated),new Error('offline')]);
 await assert.rejects(fetchGlucoseForecast('record-a',options,new AbortController().signal),/saved \(run run-a\).*retrieval could not be confirmed/);
});
test('altered stored curves never appear as a verified completed forecast',async()=>{
 requests([response(generated),response({...saved,output:{...output,baseline:[]}})]);
 await assert.rejects(fetchGlucoseForecast('record-a',options,new AbortController().signal),/did not match/);
});
