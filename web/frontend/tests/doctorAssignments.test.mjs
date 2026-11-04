import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
async function load(name){const code=ts.transpileModule(readFileSync(new URL(`../src/lib/${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);}
const {fetchDoctorAssignedPatientIds}=await load('doctorAssignments');
const {readClinicalRows}=await load('supabaseRows');
const {requestModelService}=await load('modelServiceRequest');
function fixture(){
 const state={user:{id:'doctor-a'},role:'doctor',status:'active',rows:[{clinician_id:'doctor-a',patient_id:'record-a'},{clinician_id:'doctor-a',patient_id:'record-b'},{clinician_id:'doctor-a',patient_id:'record-c'}],count:true,fail:null,calls:[]};
 const client={auth:{getUser:async()=>({data:{user:state.user},error:null})},rpc:async name=>{assert.equal(name,'get_my_access_state');return{data:{role:state.role,status:state.status},error:null}},from:table=>{
  assert.equal(table,'clinician_patient_assignments');const query={select:()=>query,eq:(column,value)=>{state.calls.push({column,value});assert.equal(column,'clinician_id');assert.equal(value,'doctor-a');return query},order:()=>query,range:async(offset,end)=>({data:state.rows.slice(offset,Math.min(end+1,offset+2)),count:state.count?state.rows.length:null,error:state.fail})};return query;
 }};return{state,client};
}
test('Doctor list follows Admin assignments for the verified signed-in user, with pagination',async()=>{
 const {state,client}=fixture();assert.deepEqual(await fetchDoctorAssignedPatientIds(client),['record-a','record-b','record-c']);assert.equal(state.calls.length,2);
 state.rows=[{clinician_id:'doctor-a',patient_id:'record-b'}];
 assert.deepEqual(await fetchDoctorAssignedPatientIds(client),['record-b']);
 state.rows=[];assert.deepEqual(await fetchDoctorAssignedPatientIds(client),[]);
});
test('inactive/non-Doctor accounts, invalid identity and foreign assignment rows fail closed',async()=>{
 const {state,client}=fixture();state.role='patient';await assert.rejects(fetchDoctorAssignedPatientIds(client),/Doctor account/);assert.equal(state.calls.length,0);
 state.role='doctor';state.status='suspended';await assert.rejects(fetchDoctorAssignedPatientIds(client),/Doctor account/);
 state.status='active';state.user=null;await assert.rejects(fetchDoctorAssignedPatientIds(client),/identity/);
 state.user={id:'doctor-a'};state.rows=[{clinician_id:'doctor-b',patient_id:'record-z'}];await assert.rejects(fetchDoctorAssignedPatientIds(client),/signed-in Doctor/);
 state.fail={message:'permission denied'};await assert.rejects(fetchDoctorAssignedPatientIds(client),/Admin patient assignments/);
});
test('assignment requests with no count still read every page; malformed responses never show all patients',async()=>{
 const {state,client}=fixture();state.count=false;assert.equal((await fetchDoctorAssignedPatientIds(client)).length,3);
 state.rows=[{clinician_id:'doctor-a',patient_id:'record-a'},{clinician_id:'doctor-a',patient_id:'record-a'}];await assert.rejects(fetchDoctorAssignedPatientIds(client),/changed while loading/);
});
test('clinical queries are restricted before download and reject rows outside Admin assignments',async()=>{
 const allowed=new Set(['record-a']);let reads=0,filter;
 const client={from:()=>{reads++;const q={select:()=>q,in:(column,ids)=>{assert.equal(column,'Patient Number');filter=ids;return q},order:()=>q,range:async()=>({data:[{'Patient Number':'record-b'}],error:null,count:1})};return q}};
 assert.deepEqual(await readClinicalRows(client,'patient_summary',undefined,new Set()),[]);assert.equal(reads,0);
 await assert.rejects(readClinicalRows(client,'patient_summary',undefined,allowed),/outside the Admin assignment/);assert.deepEqual(filter,['record-a']);
});
test('legacy GRU network errors identify the Python connection without hiding HTTP permission errors',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>{throw new TypeError('Failed to fetch')};
  await assert.rejects(requestModelService('https://service.test',{method:'POST'}),/Python prediction service.*Render.*CORS/);
  const denied=new Response(JSON.stringify({error:'This patient is not assigned to your care team.'}),{status:403});
  globalThis.fetch=async()=>denied;assert.equal(await requestModelService('https://service.test',{}),denied);
  globalThis.fetch=async()=>{throw new DOMException('Cancelled','AbortError')};await assert.rejects(requestModelService('https://service.test',{}),{name:'AbortError'});
 }finally{globalThis.fetch=original;}
});
