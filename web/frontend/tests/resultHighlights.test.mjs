import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
async function load(name) {
  const source=readFileSync(new URL(`../src/lib/${name}.ts`,import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
const {laboratoryHighlights,predictionHighlights}=await load('resultHighlights');
const {cohortForPatient,conditionalForecast}=await load('conditionalForecast');
test('laboratory highlights keep source units, convert HbA1c and preserve missingness',()=>{
  const lines=laboratoryHighlights({recordedFields:{'HbA1c (mmol/mol)':53,'Creatinine (umol/L)':null,'Fasting Insulin (pmol/L)':false}});
  assert.match(lines[0],/53.0 mmol\/mol.*7.0%/);
  assert.equal(lines.length,2);
  assert.match(lines[1],/reference intervals are unavailable/);
  assert.match(laboratoryHighlights({})[0],/No numerical/);
});
test('model cohort comes from an exact source label or an explicit diagnosis, never age or glucose',()=>{
  assert.equal(cohortForPatient({recordedFields:{source_dataset:'ShanghaiT1DM'},condition:'T2DM'}),'ShanghaiT1DM');
  assert.equal(cohortForPatient({condition:'Type 2 diabetes mellitus'}),'ShanghaiT2DM');
  assert.throws(()=>cohortForPatient({condition:'diabetes'}));
  assert.throws(()=>cohortForPatient({condition:'T2DM',recordedFields:{source_dataset:'external'}}));
});
const plan={carbs:0,mealAt:30,bolus:0,bolusAt:30,formulation:'rapid'};
const history={recordId:'record-a',origin:Date.parse('2021-01-01T12:00:00Z'),features:Array.from({length:24},()=>[120,0,1,0,0,0,0,0,0,0,2]),coverage:{describedMeals:3,convertedMeals:1,excludedInsulin:2,warmupIncomplete:true}};
const result={baseline:[110,100,80,65],scenario:[115,130,185,200]};
test('four trained points keep identity, exposure and event assumptions in saved forecasts',()=>{
  const output=conditionalForecast('record-a','supabase','ShanghaiT2DM','a'.repeat(64),'test-v3',history,result,plan,{...plan,carbs:30});
  assert.equal(output.baseline.length,5);assert.equal(output.horizon_hours,4);
  assert.equal(Date.parse(output.scenario[4].timestamp)-history.origin,240*60000);
  const lines=predictionHighlights(output).join('\n');
  assert.match(lines,/0 displayed future point\(s\) below 70 mg\/dL; 2 above 180/);
  assert.match(lines,/2.00 U/);assert.match(lines,/1\/3 meal descriptions/);
  assert.match(lines,/\+135.0 mg\/dL/);assert.match(lines,/not measured events/);
  output.model_evaluation={scope:'oracle conditional',mae_mg_dl:{'15':4.37,'240':29.42}};
  assert.match(predictionHighlights(output).join('\n'),/15 min: 4.4 mg\/dL; 240 min: 29.4 mg\/dL/);
  assert.match(predictionHighlights(output).join('\n'),/not this patient's error bounds/);
  assert.throws(()=>conditionalForecast('other','supabase','ShanghaiT2DM','a','v3',history,result,plan,plan),/different record/);
  assert.throws(()=>conditionalForecast('record-a','supabase','ShanghaiT2DM','a','v3',history,{...result,scenario:[1,2,3,NaN]},plan,plan),/invalid glucose/);
});
test('clinical lab facts and saved prediction highlights precede optional charts',()=>{
  const page=readFileSync(new URL('../src/components/LabResultsView.tsx',import.meta.url),'utf8');
  assert.ok(page.indexOf('Key recorded findings')<page.indexOf('Saved prediction highlights'));
  assert.ok(page.indexOf('Prediction highlights')<page.indexOf('Show prediction chart'));
  const forecast=readFileSync(new URL('../src/components/ConditionalForecastPanel.tsx',import.meta.url),'utf8');
  assert.ok(forecast.indexOf('What the model estimates')<forecast.indexOf('Show supporting prediction chart'));
});
