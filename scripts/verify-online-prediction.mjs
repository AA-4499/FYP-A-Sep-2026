/** Operator-run API checks. Does not replace the documented frontend acceptance steps. */
import {createHash, randomUUID} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const required=['E2E_API_URL','E2E_SUPABASE_URL','E2E_SUPABASE_ANON_KEY','E2E_ACCESS_TOKEN','E2E_PATIENT_ID','E2E_EXPECTED_MODEL_SHA256','E2E_EXPECTED_COMMIT'];
const report={tested_at:new Date().toISOString(),status:'not_run',checks:{},frontend_acceptance:'manual_required'};
const output=resolve(process.argv[2] || 'output/verification/online-prediction.json');
const digest=value=>createHash('sha256').update(value).digest('hex');
function canonical(value){if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;return JSON.stringify(value);}
function ensure(condition,message){if(!condition)throw Error(message);}
async function json(url,options={}) {
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(180000)});
  ensure(response.headers.get('content-type')?.includes('application/json'),`Non-JSON response (HTTP ${response.status}). Check the deployment and service URL.`);
  const body=await response.json();
  ensure(response.ok,`Service request failed (HTTP ${response.status}); no API acceptance is claimed.`);
  return body;
}
try {
  for(const name of required)ensure(process.env[name],`Configure ${name}; credentials must stay in environment variables.`);
  const base=new URL(process.env.E2E_API_URL), cloud=new URL(process.env.E2E_SUPABASE_URL);
  for(const url of [base,cloud])ensure(url.protocol==='https:'&&!url.username&&!url.password,'Use HTTPS service origins without embedded credentials.');
  const model=process.env.E2E_EXPECTED_MODEL_SHA256;
  ensure(/^[a-f0-9]{64}$/.test(model),'The expected model digest must be a full SHA-256.');
  const patient=process.env.E2E_PATIENT_ID, run=randomUUID();
  report.patient_identity_sha256=digest(patient);report.run_id=run;
  report.local_commit=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).stdout?.trim() || 'unknown';
  const auth={Authorization:`Bearer ${process.env.E2E_ACCESS_TOKEN}`};
  const health=await json(new URL('/api/health',base));
  ensure(health.application_commit===process.env.E2E_EXPECTED_COMMIT,'The deployed application commit does not match the expected version.');
  report.deployed_commit=health.application_commit;report.checks.deployed_version=true;
  const cloudHeaders={...auth,apikey:process.env.E2E_SUPABASE_ANON_KEY};
  await json(new URL('/auth/v1/user',cloud),{headers:cloudHeaders});
  report.checks.authorised_account=true;
  const readingsUrl=new URL('/rest/v1/patient_detail',cloud);
  readingsUrl.search=new URLSearchParams({'Patient Number':`eq.${patient}`,select:'Date,"CGM (mg / dl)"',order:'Date.desc,id.desc',limit:'200'});
  const readings=await json(readingsUrl,{headers:cloudHeaders});
  ensure(Array.isArray(readings),'CGM read did not return a list.');
  const latest=readings.find(row=>Number.isFinite(Date.parse(row.Date))&&row['CGM (mg / dl)']!==null&&String(row['CGM (mg / dl)']).trim()&&Number.isFinite(Number(row['CGM (mg / dl)']))&&Number(row['CGM (mg / dl)'])>0);
  ensure(latest,'No authorised valid CGM observation is available.');
  report.checks.authorised_cgm_read=true;
  const endpoint=new URL(`/api/patients/${encodeURIComponent(patient)}/glucose-forecast`,base);
  const denied=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(60000)});
  ensure(denied.status===401,'An unauthenticated prediction was not rejected with HTTP 401.');
  report.checks.anonymous_denied=true;
  const result=await json(endpoint,{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({source:'supabase',horizon_hours:3,events:[],run_id:run})});
  ensure(result.patient_id===patient&&result.source==='supabase'&&result.delivery==='server','The response does not identify the requested online patient/source.');
  ensure(result.model_sha256===model,'The prediction used an unexpected model version.');
  ensure(/^[a-f0-9]{64}$/.test(result.input_sha256),'The prediction has no valid input fingerprint.');
  const parseTime=value=>Date.parse(/Z$|[+-]\d\d:\d\d$/.test(value)?value:value+'Z');
  ensure(parseTime(result.forecast_start)===parseTime(latest.Date)&&Math.abs(result.latest_glucose-Number(latest['CGM (mg / dl)']))<0.001,'The forecast origin differs from the authorised latest CGM observation. Recheck whether data changed during this run.');
  ensure(result.storage?.saved===true&&result.storage.run_id===run,'The service did not confirm persistence.');
  report.checks.patient_source_model_and_save=true;
  const stored=await json(new URL(`/api/patients/${encodeURIComponent(patient)}/glucose-forecasts/${run}`,base),{headers:auth});
  const {storage,...forecast}=result;
  ensure(stored.run_id===run&&stored.patient_id===patient&&stored.model_sha256===model&&canonical(stored.output)===canonical(forecast),'Retrieved output differs from the generated patient/model/curves.');
  report.checks.full_output_readback=true;
  const deniedPatient=process.env.E2E_DENIED_PATIENT_ID;
  if(deniedPatient){
    ensure(deniedPatient!==patient,'Use a different explicitly unauthorised record for the denied-access probe.');
    const forbidden=await fetch(new URL(`/api/patients/${encodeURIComponent(deniedPatient)}/glucose-forecasts/${run}`,base),{headers:auth,signal:AbortSignal.timeout(60000)});
    ensure([403,404].includes(forbidden.status),'The other-record read did not fail closed.');
    report.checks.unassigned_or_other_patient_denied=true;
  }else report.checks.unassigned_or_other_patient_denied='manual_required';
  report.model_sha256=model;report.input_sha256=result.input_sha256;
  report.forecast_points=result.baseline.length;
  report.status='api_checks_passed';
  report.notes='Frontend role switching, visible service-failure messages and historical result access still require the manual checklist. The test intentionally creates one saved prediction.';
}catch(error){report.status='failed';report.error=error instanceof Error?error.message:'Verification failed';process.exitCode=1;}
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,evidence_file:output,checks:report.checks}));
