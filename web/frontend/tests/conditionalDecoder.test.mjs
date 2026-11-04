import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const compile=async path=>{
 const source=readFileSync(new URL(path,import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;
 return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
};
const {validateConditionalModel,predictConditional}=await compile('../src/lib/conditionalDecoder.ts');
const features=await compile('../src/lib/conditionalFeatures.ts');
const models=Object.fromEntries(['ShanghaiT1DM','ShanghaiT2DM'].map(c=>[c,validateConditionalModel(read(`../public/conditional-models/${c}.json`))]));
const manifest=read('../src/lib/conditionalManifest.json');
for(const cohort of Object.keys(models))test(`${cohort}: exact saved checkpoint and asset identity; no patient metadata in public weights`,()=>{
 const bytes=readFileSync(new URL(`../public/conditional-models/${cohort}.json`,import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.models[cohort].artifact_sha256);
 const checkpoint=readFileSync(new URL(`../../../models/evaluation/shanghai_v3_20261104/${cohort}/gru_future_event_decoder/checkpoint.pt`,import.meta.url));
 assert.equal(createHash('sha256').update(checkpoint).digest('hex'),models[cohort].checkpoint_sha256);
 for(const key of ['patient_split','patient_id','history','test_predictions'])assert.equal(key in models[cohort],false);
});
for(const fixture of read('./fixtures/conditional-decoder-reference.json').cases)test(`PyTorch decoder parity: ${fixture.cohort} ${fixture.name}`,()=>{
 const output=predictConditional(models[fixture.cohort],fixture.history,fixture.static_context,fixture.future_schedule);
 const error=Math.max(...output.map((v,i)=>Math.abs(v-fixture.expected[i])));
 assert.ok(error<.01,`maximum error ${error} mg/dL`);
});
const foods=read('../public/conditional-models/foods.json').foods;
for(const fixture of read('./fixtures/conditional-feature-reference.json').cases)test(`Source-event preprocessing parity: ${fixture.cohort}`,()=>{
 const history=features.buildConditionalHistory(fixture.rows,fixture.record_id,...fixture.static_context.slice(0,2),foods);
 const error=Math.max(...history.features.flatMap((row,i)=>row.map((v,j)=>Math.abs(v-fixture.expected_history[i][j]))));
 assert.ok(error<.0001,`maximum feature error ${error}`);
});
test('unresolved meals never become full carbohydrate totals; Chinese gram portions work',()=>{
 assert.deepEqual(features.convertMeal({'Dietary intake':'rice 100 g; mystery 50 g'},foods),{carbs:0,described:1,unresolved:1,unavailable:0});
 assert.ok(features.convertMeal({'饮食':'米饭 100 克'},foods).carbs>0);
 assert.equal(features.convertMeal({'Dietary intake':'milk 200 ml'},foods).unresolved,1);
 assert.equal(features.convertMeal({'Dietary intake':'未记录'},foods).unavailable,1);
 assert.equal(features.convertMeal({},foods).described,0);
 assert.equal(features.convertMeal({'Dietary intake':'constructor 100 g'},foods).unresolved,1);
 assert.equal(features.insulinAmount('Novolin R, 5 单位'),5);
 assert.equal(features.insulinAmount('Novolin R 4 IU + 3 IU'),null);
});
test('planned bolus recalculates IOB without editing history or using a future dose early',()=>{
 const h=features.syntheticConditionalHistory('ShanghaiT2DM',foods),copy=structuredClone(h.features);
 const plan={carbs:40,mealAt:30,bolus:0,bolusAt:60,formulation:'regular'};
 const baseline=features.buildFuturePlan(h,plan),changed=features.buildFuturePlan(h,{...plan,bolus:2});
 assert.deepEqual(baseline.slice(0,3),changed.slice(0,3));assert.ok(Math.abs(changed[3][6]-baseline[3][6]-2)<1e-6);
 assert.deepEqual(h.features,copy);assert.equal(changed[1][2],40);
});
test('decoder later plans cannot change earlier horizon outputs',()=>{
 const h=features.syntheticConditionalHistory('ShanghaiT2DM',foods),plan={carbs:0,mealAt:120,bolus:0,bolusAt:120,formulation:'rapid'};
 const baseline=predictConditional(models.ShanghaiT2DM,h.features,h.staticContext,features.buildFuturePlan(h,plan));
 const changed=predictConditional(models.ShanghaiT2DM,h.features,h.staticContext,features.buildFuturePlan(h,{...plan,carbs:60,bolus:2}));
 assert.deepEqual(baseline.slice(0,3),changed.slice(0,3));assert.notEqual(baseline[3],changed[3]);
});
test('patient mismatch, invalid latest CGM and corrupted decoder contracts fail closed',()=>{
 const fixture=read('./fixtures/conditional-feature-reference.json').cases[0];
 assert.throws(()=>features.buildConditionalHistory(fixture.rows,'another',50,25,foods),/24 consecutive/);
 const rows=structuredClone(fixture.rows);rows.at(-1)['CGM (mg / dl)']=null;
 assert.throws(()=>features.buildConditionalHistory(rows,fixture.record_id,50,25,foods),/24 consecutive/);
 const corrupt=structuredClone(models.ShanghaiT2DM);corrupt.weights['decoder.weight_ih_l0'].values.pop();
 assert.throws(()=>validateConditionalModel(corrupt),/Invalid decoder tensor/);
});
