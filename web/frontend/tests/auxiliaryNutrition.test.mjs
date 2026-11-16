import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import React from 'react';
import {act,create} from 'react-test-renderer';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const source=readFileSync(new URL('../src/lib/auxiliaryNutrition.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;
const aux=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const manifest=read('../src/lib/auxiliaryManifest.json');
const model=aux.validateAuxiliary(read('../public/conditional-models/CGMacrosAuxiliary.json'));
const fixture=read('./fixtures/auxiliary-reference.json');
const origin=Date.parse('2021-01-01T12:00:00Z');
const history={recordId:'synthetic',origin,features:fixture.history,staticContext:fixture.static,timestamps:Array.from({length:24},(_,i)=>new Date(origin-(23-i)*900000).toISOString())};
const plan={at:30,carbs:40,protein:20,fat:15,fiber:6,activityAt:60,activityMinutes:30,met:1};

test('all overlapping windows remain in participant-disjoint development and test splits',()=>{
 const split=read('../../../models/evaluation/cgmacros_6h_20261116/split_manifest.json').partitions;
 const all=Object.values(split).flatMap(p=>p.subjects);
 assert.equal(new Set(all).size,all.length);
 assert.equal(split.test.subjects.length,8);
 assert.ok(split.test.windows>0);
 const replay=read('../../../models/evaluation/cgmacros_6h_20261116/checkpoint_replay.json');
 for(const result of Object.values(replay))assert.ok(result.test_metric_replay_max_difference<1e-5);
});

test('auxiliary public weights have the registered trained checkpoint identity',()=>{
 const asset=readFileSync(new URL('../public/conditional-models/CGMacrosAuxiliary.json',import.meta.url));
 assert.equal(createHash('sha256').update(asset).digest('hex'),manifest.artifact_sha256);
 const checkpoint=readFileSync(new URL('../../../models/evaluation/cgmacros_6h_20261116/macros_activity.pt',import.meta.url));
 assert.equal(createHash('sha256').update(checkpoint).digest('hex'),model.checkpoint_sha256);
 assert.equal(model.checkpoint_sha256,manifest.checkpoint_sha256);
 assert.equal(model.shanghai_transfer_validated,false);
 for(const field of ['patient_split','patient_id','history','test_predictions'])assert.equal(field in model,false);
});

test('auxiliary JavaScript inference matches the actual PyTorch checkpoint',()=>{
 const result=aux.predictAuxiliary(model,fixture.history,fixture.static,fixture.future);
 assert.ok(Math.max(...result.map((v,i)=>Math.abs(v-fixture.expected[i])))<.01);
});

test('identical plans are identical and each new trained covariate can change later predictions',()=>{
 const unchanged=aux.compareNutrition(model,history,'ShanghaiT2DM',plan,plan);
 assert.deepEqual(unchanged.baseline,unchanged.scenario);
 for(const key of ['protein','fat','fiber','met']){
  const changed=aux.compareNutrition(model,history,'ShanghaiT2DM',plan,{...plan,[key]:plan[key]+(key==='met'?2:3)});
  assert.notEqual(changed.baseline[23],changed.scenario[23],`${key} must enter the real network`);
  assert.equal(changed.baseline[0],changed.scenario[0]);
 }
});

test('later activity cannot change earlier horizons, and unknown activity stays distinct from resting',()=>{
 const baseline=aux.nutritionSchedule(origin,plan,true);
 const changed=aux.nutritionSchedule(origin,{...plan,met:3},true);
 assert.deepEqual(baseline.slice(0,4),changed.slice(0,4));
 assert.deepEqual(changed[4].slice(8),[3,1]);
 assert.deepEqual(changed[7].slice(8),[0,0]);
 const a=aux.predictAuxiliary(model,fixture.history,fixture.static,baseline);
 const b=aux.predictAuxiliary(model,fixture.history,fixture.static,changed);
 assert.deepEqual(a.slice(0,4),b.slice(0,4));
});

test('invalid data, T1D transfer, bad time alignment and corrupted model tensors fail closed',()=>{
 for(const p of [{...plan,fiber:50},{...plan,met:NaN},{...plan,activityAt:65},{...plan,activityMinutes:200},{...plan,carbs:Infinity}])assert.throws(()=>aux.nutritionSchedule(origin,p,true));
 assert.throws(()=>aux.compareNutrition(model,history,'ShanghaiT1DM',plan,plan),/T1D/);
 assert.throws(()=>aux.compareNutrition(model,{...history,origin:origin+1},'ShanghaiT2DM',plan,plan),/origin/);
 assert.throws(()=>aux.compareNutrition(model,{...history,staticContext:[null,28]},'ShanghaiT2DM',plan,plan),/recorded age/);
 const broken=structuredClone(model);broken.weights['encoder.weight_ih_l0'].values.pop();
 assert.throws(()=>aux.validateAuxiliary(broken),/tensor/);
});

function component(mocks){
 const input=readFileSync(new URL('../src/components/AuxiliaryNutritionPanel.tsx',import.meta.url),'utf8');
 const output=ts.transpileModule(input,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const mod={exports:{}};new Function('require','module','exports',output)(id=>Object.hasOwn(mocks,id)?mocks[id]:require(id),mod,mod.exports);return mod.exports.AuxiliaryNutritionPanel;
}

test('research UI runs real extra-input predictions and clears stale output on edits',async()=>{
 const Component=component({'../lib/auxiliaryNutrition':aux,'../lib/predictionResults':{savePrediction:async()=>{}},'../lib/auxiliaryForecast':{auxiliaryForecast:()=>({})},'../lib/forecastSampling':{sampleForecast:(points,origin,interval)=>points.filter((p,i)=>i===0||i*15%interval===0)},'../lib/auxiliaryModelLoader':{loadAuxiliaryModel:async()=>model},'../lib/auxiliaryManifest.json':manifest,'./PredictionChart':{PredictionChart:'prediction-chart'}});
 let tree;act(()=>{tree=create(React.createElement(Component,{history,cohort:'ShanghaiT2DM'}));});
 act(()=>tree.root.findByProps({'aria-expanded':false}).props.onClick());
 await act(async()=>{await tree.root.findByType('form').props.onSubmit({preventDefault(){}});});
 // Form handler launches an async task; drain its load promise.
 await act(async()=>{await Promise.resolve();});
 let chart=tree.root.findByType('prediction-chart');assert.deepEqual(chart.props.series[0].points,chart.props.series[1].points);
 act(()=>tree.root.findByProps({'aria-label':'scenario Protein (g)'}).props.onChange({target:{value:'30'}}));
 assert.equal(tree.root.findAllByType('prediction-chart').length,0);
 await act(async()=>{tree.root.findByType('form').props.onSubmit({preventDefault(){}});});
 chart=tree.root.findByType('prediction-chart');assert.notDeepEqual(chart.props.series[0].points,chart.props.series[1].points);
 act(()=>tree.unmount());
});

test('research UI does not expose mixed-cohort model for T1D',()=>{
 const Component=component({'../lib/auxiliaryNutrition':aux,'../lib/predictionResults':{savePrediction:async()=>{}},'../lib/auxiliaryForecast':{auxiliaryForecast:()=>({})},'../lib/forecastSampling':{sampleForecast:(points,origin,interval)=>points.filter((p,i)=>i===0||i*15%interval===0)},'../lib/auxiliaryModelLoader':{},'../lib/auxiliaryManifest.json':manifest,'./PredictionChart':{PredictionChart:'prediction-chart'}});
 let tree;act(()=>{tree=create(React.createElement(Component,{history,cohort:'ShanghaiT1DM'}));});assert.equal(tree.toJSON(),null);act(()=>tree.unmount());
});
