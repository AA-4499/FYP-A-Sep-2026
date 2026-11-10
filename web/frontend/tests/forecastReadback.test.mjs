import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/forecastReadback.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {verifyForecastReadback} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const result={patient_id:'record-a',model_sha256:'model-a',baseline:[{timestamp:'2026-01-01',value:100}],storage:{saved:true,run_id:'run-a'}};
const saved={run_id:'run-a',patient_id:'record-a',model_sha256:'model-a',output:{baseline:[{value:100,timestamp:'2026-01-01'}],model_sha256:'model-a',patient_id:'record-a'}};
test('a complete matching readback tolerates object key ordering',()=>verifyForecastReadback(result,saved));
test('other patients, model versions, runs and altered curves never pass readback',()=>{
  for(const change of [{patient_id:'other'},{model_sha256:'old'},{run_id:'other'},{output:{...saved.output,baseline:[{timestamp:'2026-01-01',value:200}]}}]) assert.throws(()=>verifyForecastReadback(result,{...saved,...change}),/did not match/);
});
test('a missing storage confirmation or missing result never claims readback success',()=>{
  assert.throws(()=>verifyForecastReadback({...result,storage:{saved:false}},saved));
  assert.throws(()=>verifyForecastReadback(result,null));
});
