import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {act,create} from 'react-test-renderer';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
async function load(name){const source=readFileSync(new URL(`../src/lib/${name}.ts`,import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);}
const scenario=await load('scenario'),aux=await load('auxiliaryNutrition'),adapter=await load('auxiliaryScenario');
const origin='2021-01-01T12:00:00Z';
const meal={id:'meal-1',kind:'meal',at:'2021-01-01T12:30',description:'Lunch',amount:'200',carbohydrate:'40',protein:'20',fat:'15',fiber:'6',carbohydrateSource:'manual',absorption:'',intensity:'moderate'};
const walk={id:'walk-1',kind:'activity',at:'2021-01-01T13:00',description:'Walking',amount:'30',met:'3',carbohydrate:'',absorption:'',intensity:'moderate'};
const model=aux.validateAuxiliary(read('../public/conditional-models/CGMacrosAuxiliary.json'));
const fixture=read('./fixtures/auxiliary-reference.json');
const history={recordId:'synthetic',origin:Date.parse(origin),features:fixture.history,staticContext:fixture.static,timestamps:Array.from({length:24},(_,i)=>new Date(Date.parse(origin)-(23-i)*900000).toISOString())};

test('multiple meal and activity events reach the real trained decoder with their own timestamps',()=>{
 const compiled=scenario.compileScenario([walk,meal,{...meal,id:'meal-2',at:'2021-01-01T16:30',carbohydrate:'25'}],origin,6,'auxiliary');
 const events=adapter.auxiliaryEventsFromSchedule(compiled);
 assert.deepEqual(events.map(e=>[e.kind,e.minutesAhead]),[['meal',30],['activity',60],['meal',270]]);
 const bins=aux.auxiliaryEventSchedule(Date.parse(origin),events,true);
 assert.deepEqual(bins[1].slice(2,8),[40,20,15,6,1,1]);
 assert.equal(bins[17][2],25);assert.deepEqual(bins[4].slice(8),[3,1]);assert.deepEqual(bins[6].slice(8),[0,0]);
 const result=aux.compareAuxiliaryEvents(model,history,'ShanghaiT2DM',[],events);
 assert.equal(result.scenario.length,24);assert.equal(result.scenario[0],result.baseline[0]);
 assert.notEqual(result.scenario[23],result.baseline[23]);
});

test('same-bin meals sum macros, while overlapping activities and unsupported exposure are rejected',()=>{
 const events=adapter.auxiliaryEventsFromSchedule(scenario.compileScenario([meal,{...meal,id:'meal-2',at:'2021-01-01T12:25'}],origin,6,'auxiliary'));
 assert.deepEqual(aux.auxiliaryEventSchedule(Date.parse(origin),events,true)[1].slice(2,6),[80,40,30,12]);
 assert.throws(()=>aux.auxiliaryEventSchedule(Date.parse(origin),[{kind:'activity',minutesAhead:60,durationMinutes:30,met:3},{kind:'activity',minutesAhead:75,durationMinutes:30,met:4}],true),/overlap/);
 assert.throws(()=>aux.auxiliaryEventSchedule(Date.parse(origin),[{kind:'bolus',minutesAhead:30,amount:2}],true),/supports meals and activity only/);
 assert.throws(()=>scenario.compileScenario([{...walk,kind:'insulin'}],origin,6,'auxiliary'),/Use the main model/);
 assert.throws(()=>scenario.compileScenario([walk],origin,6,'conditional'),/supports meal/);
});

test('missing macros are not fabricated, and activity timing and quantities remain bounded',()=>{
 for(const bad of [{...meal,protein:''},{...meal,fat:undefined},{...meal,fiber:'41'},{...meal,carbohydrate:'3',fiber:'6'},{...walk,met:''},{...walk,at:'2021-01-01T13:05'},{...walk,amount:'35'},{...walk,at:'2021-01-01T17:45',amount:'30'}])assert.throws(()=>scenario.compileScenario([bad],origin,6,'auxiliary'));
 assert.throws(()=>adapter.auxiliaryEventsFromSchedule({schedule:[{...meal,protein:'',minute:30}],unmodelled:[]}),/missing values are not zero/);
 const last=adapter.auxiliaryEventsFromSchedule(scenario.compileScenario([{...meal,at:'2021-01-01T18:00'}],origin,6,'auxiliary'));
 const result=aux.compareAuxiliaryEvents(model,history,'ShanghaiT2DM',[],last);
 assert.deepEqual(result.scenario.slice(0,23),result.baseline.slice(0,23));assert.notEqual(result.scenario[23],result.baseline[23]);
});

function component(relative,mocks){
 const source=readFileSync(new URL(relative,import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;const mod={exports:{}};new Function('require','module','exports',js)(id=>Object.hasOwn(mocks,id)?mocks[id]:require(id),mod,mod.exports);return mod.exports;
}
const {ScenarioBuilder}=component('../src/components/ScenarioBuilder.tsx',{'./InsulinPicker':{InsulinPicker:'insulin-picker'},'./ActivityPicker':{ActivityPicker:'activity-picker'},'./FoodCompositionPicker':{FoodCompositionPicker:'food-picker'},'../lib/scenario':scenario});

test('shared event editor exposes auxiliary meal macros and activity MET inputs and runs a compiled schedule',async()=>{
 let drafts=[meal,walk],submitted;
 const render=()=>React.createElement(ScenarioBuilder,{value:drafts,onChange:next=>{drafts=next;tree.update(render());},start:origin,hours:6,engine:'auxiliary',allowedKinds:['meal','activity'],onRun:compiled=>{submitted=adapter.auxiliaryEventsFromSchedule(compiled);return true;},onReset(){}});
 let tree;act(()=>{tree=create(render());});
 const options=tree.root.findByProps({'aria-label':'Add scenario event'}).findAllByType('option').map(o=>o.props.value);
 assert.deepEqual(options,['','meal','activity']);
 for(const field of ['protein','fat','fiber'])assert.equal(tree.root.findByProps({'aria-label':`Event 1 ${field}`}).props.required,true);
 assert.equal(tree.root.findByProps({'aria-label':'Event 2 MET'}).props.value,'3');
 await act(async()=>{await tree.root.findByType('form').props.onSubmit({preventDefault(){}});});
 assert.equal(submitted.length,2);assert.equal(submitted[1].kind,'activity');
 act(()=>tree.root.findByProps({'aria-label':'Remove event 2'}).props.onClick());assert.equal(drafts.length,1);
 act(()=>tree.unmount());
});
