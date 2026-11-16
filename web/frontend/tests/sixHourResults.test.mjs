import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {act,create} from 'react-test-renderer';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const source=name=>readFileSync(new URL(`../src/${name}`,import.meta.url),'utf8');
async function load(name){const js=ts.transpileModule(source(`lib/${name}.ts`),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);}
const sampling=await load('forecastSampling'),auxiliary=await load('auxiliaryForecast');
const origin='2021-01-01T12:00:00Z';
const points=Array.from({length:25},(_,i)=>({timestamp:new Date(Date.parse(origin)+i*900000).toISOString(),value:120+i}));
const output={patient_id:'a',record_id:'a',forecast_start:origin,horizon_hours:6,baseline:points,scenario:points,latest_glucose:120,baseline_end:144,scenario_end:144,scenario_enabled:false,model_family:'conditional-v3',model_version:'six-hour',result_label:'Saved breakfast',source:'supabase'};
const saved=id=>({id,patient_id:'a',created_at:'2026-11-16T04:00:00Z',engine:'gru',output:{...output,result_label:id==='one'?'Saved breakfast':'Saved walk'},scenario:null,event_summary:'Preserved event inputs',model_sha256:'a'.repeat(64)});

test('15/30/60-minute views use exact saved values through six hours without interpolation',()=>{
 for(const [interval,count] of [[15,25],[30,13],[60,7]]){
  const subset=sampling.sampleForecast(points,origin,interval);
  assert.equal(subset.length,count);assert.equal(subset.at(-1).timestamp,points[24].timestamp);
  subset.forEach((p,i)=>{assert.equal(p,points[i*interval/15]);assert.equal(p.value,120+i*interval/15);});
 }
 assert.equal(points.length,25);
});

test('saved auxiliary snapshot preserves all 24 outputs, plans and model identity',()=>{
 const history={recordId:'a',origin:Date.parse(origin),features:Array.from({length:24},()=>[120,0,1])};
 const result={baseline:Array(24).fill(130),scenario:Array(24).fill(135)},plan={carbs:40};
 const value=auxiliary.auxiliaryForecast(history,result,plan,{carbs:50},{version:'six-hour-aux',checkpoint_sha256:'b'.repeat(64),evaluation_scope:'research'},'Walk comparison');
 assert.equal(value.baseline.length,25);assert.equal(value.horizon_hours,6);assert.equal(value.baseline_end,130);assert.equal(value.model_family,'cgmacros-auxiliary');assert.equal(value.result_label,'Walk comparison');assert.equal(value.model_sha256,'b'.repeat(64));assert.deepEqual(value.plans.scenario,{carbs:50});
 assert.throws(()=>auxiliary.auxiliaryForecast(history,{...result,scenario:[1]},plan,plan,{},''),/Incomplete/);
});

function component(list){
 const input=source('components/LabResultsView.tsx');
 const js=ts.transpileModule(input,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const mocks={'../lib/predictionResults':{listPredictionResults:list},'../lib/clinicalData':{clinicalValue:()=> 'Unavailable'},'../lib/resultHighlights':{labGroups:[],laboratoryHighlights:()=>['Lab explanation'],predictionHighlights:()=>['Saved explanation']},'./PredictionChart':{PredictionChart:'prediction-chart'},'./ForecastIntervalControl':{ForecastIntervalControl:'interval-control'},'../lib/forecastSampling':sampling};
 const mod={exports:{}};new Function('require','module','exports',js)(id=>Object.hasOwn(mocks,id)?mocks[id]:require(id),mod,mod.exports);return mod.exports.LabResultsView;
}

test('Lab results starts with a selectable list, shows one snapshot and collapses explanations',async()=>{
 const Component=component(async()=>[saved('one'),saved('two')]);let tree;
 await act(async()=>{tree=create(React.createElement(Component,{patient:{id:'a'}}));});
 assert.equal(tree.root.findAllByType('prediction-chart').length,0);
 assert.equal(tree.root.findAllByType('input').length,2);
 assert.ok(tree.root.findAllByType('details').every(d=>!d.props.open));
 act(()=>tree.root.findByProps({'aria-label':'Select result one'}).props.onChange());
 assert.equal(tree.root.findAllByType('prediction-chart').length,1);
 assert.equal(tree.root.findByType('prediction-chart').props.series[0].points.length,25);
 act(()=>tree.root.findByType('interval-control').props.onChange(30));
 assert.equal(tree.root.findByType('prediction-chart').props.series[0].points.length,13);
 act(()=>tree.root.findByType('interval-control').props.onChange(60));
 assert.equal(tree.root.findByType('prediction-chart').props.series[0].points.length,7);
 act(()=>tree.root.findByProps({'aria-label':'Select result two'}).props.onChange());
 assert.equal(tree.root.findAllByType('prediction-chart').length,1);
 assert.ok(JSON.stringify(tree.toJSON()).includes('Saved walk'));
 act(()=>tree.unmount());
});

test('changing patient clears selection and ignores a delayed response for the previous patient',async()=>{
 let resolveA;const pending=new Promise(resolve=>{resolveA=resolve;});
 const Component=component(id=>id==='a'?pending:Promise.resolve([]));let tree;
 await act(async()=>{tree=create(React.createElement(Component,{patient:{id:'a'}}));});
 await act(async()=>{tree.update(React.createElement(Component,{patient:{id:'b'}}));});
 await act(async()=>{resolveA([saved('one')]);});
 assert.equal(tree.root.findAllByType('prediction-chart').length,0);
 assert.equal(tree.root.findAllByType('input').length,0);
 assert.ok(JSON.stringify(tree.toJSON()).includes('No saved predictions'));
 act(()=>tree.unmount());
});
