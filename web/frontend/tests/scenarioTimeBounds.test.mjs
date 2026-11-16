import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {act,create} from 'react-test-renderer';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function module(path,mocks={}){const source=readFileSync(new URL(path,import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;const m={exports:{}};new Function('require','module','exports',js)(id=>Object.hasOwn(mocks,id)?mocks[id]:require(id),m,m.exports);return m.exports;}
const scenario=module('../src/lib/scenario.ts');
const origin='2021-01-01T23:45:00Z';
const meal={id:'meal',kind:'meal',at:'2021-01-02T00:15',description:'Meal',amount:'200',carbohydrate:'40',protein:'20',fat:'15',fiber:'6',carbohydrateSource:'manual',absorption:'45',intensity:'moderate'};
const walk={id:'walk',kind:'activity',at:'2021-01-02T00:45',description:'Walking',amount:'30',activityId:'17190',met:'3.8',carbohydrate:'',absorption:'',intensity:'moderate'};

test('chart bounds follow the recorded midnight window, include full activity duration and retain decoder endpoint rules',()=>{
 assert.deepEqual(scenario.eventTimeBounds(origin,6,'meal','200','integrated'),{min:'2021-01-01T23:46',max:'2021-01-02T05:45',end:'2021-01-02T05:45',durationKnown:false});
 assert.equal(scenario.eventTimeBounds(origin,6,'activity','30','integrated').max,'2021-01-02T05:15');
 assert.equal(scenario.eventTimeBounds(origin,6,'activity','60','integrated').max,'2021-01-02T04:45');
 assert.equal(scenario.eventTimeBounds(origin,6,'activity','','integrated').max,'2021-01-02T05:44');
 assert.equal(scenario.eventTimeBounds(origin,6,'meal','200','conditional').max,'2021-01-02T05:44');
 assert.equal(scenario.eventTimeBounds(origin,6,'activity','30','auxiliary').min,'2021-01-02T00:00');
 assert.equal(scenario.eventTimeBounds('',6,'meal','200','integrated').min,'');
 // The exact latest activity start is valid; one minute later is not.
 assert.doesNotThrow(()=>scenario.compileScenario([{...walk,at:'2021-01-02T05:15'}],origin,6,'integrated'));
 assert.throws(()=>scenario.compileScenario([{...walk,at:'2021-01-02T05:16'}],origin,6,'integrated'),/ending within six hours/);
});

test('time checkboxes default to chart bounds, custom mode removes picker bounds but cannot run an invisible event',async()=>{
 const {ScenarioBuilder}=module('../src/components/ScenarioBuilder.tsx',{'./ActivityPicker':{ActivityPicker:'activity-picker'},'./InsulinPicker':{InsulinPicker:'insulin-picker'},'./FoodCompositionPicker':{FoodCompositionPicker:'food-picker'},'../lib/scenario':scenario});
 let drafts=[meal,walk],tree,submitted,start=origin;
 const render=()=>React.createElement(ScenarioBuilder,{value:drafts,onChange:next=>{drafts=next;tree.update(render());},start,hours:6,engine:'integrated',allowedKinds:['meal','activity'],onRun:c=>{submitted=c;return true;},onReset(){}});
 act(()=>{tree=create(render());});
 const time=()=>tree.root.findByProps({'aria-label':'Event 2 time'});
 const checkbox=()=>tree.root.findByProps({'aria-label':'Event 2 limit time to chart'});
 const run=()=>tree.root.findAllByType('button').find(button=>button.props.type==='submit');
 assert.equal(checkbox().props.checked,true);assert.equal(time().props.min,'2021-01-01T23:46');assert.equal(time().props.max,'2021-01-02T05:15');
 act(()=>tree.root.findByProps({'aria-label':'Event 2 amount'}).props.onChange({target:{value:'60'}}));assert.equal(time().props.max,'2021-01-02T04:45');
 act(()=>time().props.onChange({target:{value:'2021-01-02T05:20'}}));assert.equal(time().props['aria-invalid'],true);assert.equal(run().props.disabled,true);
 act(()=>checkbox().props.onChange({target:{checked:false}}));assert.equal(time().props.min,undefined);assert.equal(time().props.max,undefined);
 assert.equal(time().props.value,'2021-01-02T05:20');assert.equal(run().props.disabled,true);assert.ok(JSON.stringify(tree.toJSON()).includes('activity would finish after'));
 act(()=>time().props.onChange({target:{value:'2021-01-02T02:45'}}));assert.equal(time().props['aria-invalid'],undefined);assert.equal(run().props.disabled,false);
 await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(submitted.schedule.length,2);
 act(()=>checkbox().props.onChange({target:{checked:true}}));assert.equal(time().props.max,'2021-01-02T04:45');assert.equal(time().props.value,'2021-01-02T02:45');
 act(()=>{start='2021-01-02T08:00:00Z';tree.update(render());});assert.equal(time().props.min,'2021-01-02T08:01');assert.equal(run().props.disabled,true);
 act(()=>tree.unmount());
});
