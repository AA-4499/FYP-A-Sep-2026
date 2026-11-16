import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import React from 'react';
import {act,create} from 'react-test-renderer';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
async function load(name){const source=readFileSync(new URL(`../src/lib/${name}.ts`,import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);}
function component(relative,mocks){const source=readFileSync(new URL(relative,import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;const mod={exports:{}};new Function('require','module','exports',js)(id=>Object.hasOwn(mocks,id)?mocks[id]:require(id),mod,mod.exports);return mod.exports;}
const {EventCatalogPicker}=component('../src/components/EventCatalogPicker.tsx',{});
const features=await load('conditionalFeatures'),decoder=await load('conditionalDecoder'),compiler=await load('scenario'),adapter=await load('conditionalScenario');
const asset='../public/conditional-models/ShanghaiT2DMIntegrated.json';
const model=decoder.validateConditionalModel(read(asset)),fixture=read('./fixtures/integrated-v3-reference.json');
const origin='2021-01-01T12:00:00Z';
const history={recordId:'synthetic',origin:Date.parse(origin),start:Date.parse('2021-01-01T00:00:00Z'),boluses:[],excluded:[],features:fixture.history.map(row=>row.slice(0,14)),staticContext:[55,25],coverage:{describedMeals:0,convertedMeals:0,excludedInsulin:0,warmupIncomplete:false}};
const meal={id:'meal',kind:'meal',at:'2021-01-01T12:30',description:'Lunch',amount:'200',carbohydrate:'40',protein:'20',fat:'15',fiber:'6',carbohydrateSource:'manual',absorption:'',intensity:'moderate'};
const walk={id:'walk',kind:'activity',at:'2021-01-01T14:00',description:'Walking',amount:'30',activityId:'17190',met:'3.8',carbohydrate:'',absorption:'',intensity:'moderate'};
const bolus={id:'bolus',kind:'insulin',at:'2021-01-01T12:45',description:'Research bolus',amount:'2',insulinFormulation:'rapid',carbohydrate:'',absorption:'',intensity:'moderate'};
const plan=rows=>adapter.conditionalPlanFromSchedule(compiler.compileScenario(rows,origin,6,'integrated'));
const predict=p=>decoder.predictConditional(model,history.features,history.staticContext,features.buildFuturePlan(history,p,true));

test('active single v3 artifact matches the trained checkpoint, manifest and PyTorch parity',()=>{
 const manifest=read('../src/lib/conditionalManifest.json').models.ShanghaiT2DM;
 assert.equal(manifest.path,'/conditional-models/ShanghaiT2DMIntegrated.json');
 assert.equal(createHash('sha256').update(readFileSync(new URL(asset,import.meta.url))).digest('hex'),manifest.artifact_sha256);
 const sha=createHash('sha256').update(readFileSync(new URL('../../../models/evaluation/integrated_v3_20261116/checkpoint.pt',import.meta.url))).digest('hex');
 assert.equal(sha,model.checkpoint_sha256);assert.equal(sha,fixture.checkpoint_sha256);
 const result=decoder.predictConditional(model,fixture.history,fixture.static,fixture.future);
 assert.ok(Math.max(...result.map((v,i)=>Math.abs(v-fixture.expected[i])))<.01);
 assert.equal(model.input_dim,15);assert.equal(model.future_features.length,17);
});

test('same decoder responds to food, insulin, activity and composition; later activity cannot rewrite earlier predictions',()=>{
 const combined=plan([meal,bolus,walk]),result=predict(combined);
 for(const kind of ['meal','bolus','activity'])assert.notEqual(result[23],predict(features.withoutPlannedEvents(combined,kind))[23]);
 assert.notEqual(result[23],predict(plan([{...meal,protein:'10'},bolus,walk]))[23]);
 assert.deepEqual(result.slice(0,8),predict(plan([meal,bolus])).slice(0,8));
 assert.deepEqual(predict(combined),predict(combined));assert.ok(result.every(v=>Number.isFinite(v)&&v>0));
 const bins=features.buildFuturePlan(history,combined,true);
 assert.deepEqual(bins[1].slice(10,14),[20,15,6,1]);assert.ok(bins[2][6]>0);assert.ok(Math.abs(bins[8][14]-3.8)<.00001);
});

test('duration maps to timed exercise volume, with overlap-weighted partial bins and no guessed MET-to-glucose factor',()=>{
 const event={kind:'activity',minutesAhead:5,amount:20,activityId:'17190',met:3.8};
 const bins=features.buildFuturePlan(history,{...adapter.emptyConditionalPlan,events:[event]},true);
 assert.ok(Math.abs(bins[0][14]-(1+2.8*10/15))<.00001);assert.ok(Math.abs(bins[1][14]-bins[0][14])<.00001);
 assert.deepEqual(bins.slice(2).map(row=>row[15]),Array(22).fill(0));
 assert.ok(Math.abs(bins.reduce((sum,row)=>sum+(row[15]?(row[14]-1)*15:0),0)-56)<.0001);
 assert.deepEqual(features.activityDose(3.8,30),{metMinutes:114,aboveRestMetMinutes:84});
 assert.notEqual(predict(plan([walk]))[23],predict(plan([{...walk,amount:'45'}]))[23]);
 // Different names with the same reference intensity encode the same profile.
 const cycle={...walk,activityId:'01010',met:'4'},stationary={...cycle,activityId:'01214'};
 assert.deepEqual(predict(plan([cycle])),predict(plan([stationary])));
});

test('unsupported activity, tampered intensity, missing macros, overlap and cohort errors fail explicitly',()=>{
 for(const change of [{activityId:'unknown'},{met:'99'},{amount:'0'},{at:'2021-01-01T17:50',amount:'30'}])assert.throws(()=>predict(plan([{...walk,...change}])));
 assert.throws(()=>predict(plan([walk,{...walk,id:'second',at:'2021-01-01T14:15'}])),/overlap/);
 assert.throws(()=>plan([{...meal,fat:''}]),/macros|fiber/);
 assert.throws(()=>features.buildFuturePlan(history,plan([walk])),/supported kind/);
 const missing=plan([{...meal,protein:'',fat:'',fiber:''}]);
 assert.equal(features.buildFuturePlan(history,missing,true)[1][13],0);
 const noCarbs=features.buildFuturePlan(history,plan([{...meal,carbohydrate:'0',protein:'30',fat:'10',fiber:'0'}]),true);
 assert.equal(noCarbs[1][2],0);assert.equal(noCarbs[1][3],1);assert.deepEqual(noCarbs[1].slice(10,14),[30,10,0,1]);
 const unknownMeal={...meal,id:'unknown',protein:'',fat:'',fiber:''};
 for(const rows of [[meal,unknownMeal],[unknownMeal,meal]])assert.deepEqual(features.buildFuturePlan(history,plan(rows),true)[1].slice(10,14),[0,0,0,0]);
 assert.throws(()=>decoder.validateConditionalModel({...model,cohort:'ShanghaiT1DM'}),/Unsupported/);
 const corrupted=structuredClone(model);corrupted.weights['decoder.weight_ih_l0'].values.pop();
 assert.throws(()=>decoder.validateConditionalModel(corrupted),/Invalid decoder tensor/);
});

test('search popup and automatic duration volume use sourced presets within training intensity coverage',()=>{
 const support=read('../src/lib/activitySupport.json');
 assert.equal(support.activity_type_labels_available,false);
 features.ACTIVITY_CATALOG.forEach(row=>{assert.ok(row.met>=support.min_met&&row.met<=support.max_met);assert.match(row.source,/^https:\/\/pacompendium.com\//);});
 const {ActivityPicker}=component('../src/components/ActivityPicker.tsx',{'../lib/conditionalFeatures':features,'./EventCatalogPicker':{EventCatalogPicker}});
 let chosen,tree;act(()=>{tree=create(React.createElement(ActivityPicker,{index:1,minutes:'30',disabled:false,onSelect:(...args)=>chosen=args}));});
 act(()=>tree.root.findByProps({'aria-label':'Event 1 activity search'}).props.onChange({target:{value:'brisk'}}));
 assert.equal(tree.root.findAllByProps({role:'option'}).length,1);
 act(()=>tree.root.findByProps({role:'option'}).props.onClick());assert.equal(chosen[2],4.8);
 act(()=>tree.update(React.createElement(ActivityPicker,{index:1,activityId:'17200',minutes:'30',disabled:false,onSelect(){}})));
 assert.ok(JSON.stringify(tree.toJSON()).includes('144.0 MET-min'));
 act(()=>tree.root.findByProps({'aria-label':'Event 1 activity search'}).props.onChange({target:{value:'cycling'}}));
 assert.ok(tree.root.findAllByProps({role:'option'}).length>0);
 assert.ok(tree.root.findAllByProps({role:'option'}).every(row=>row.findAllByType('span').flatMap(span=>span.children.filter(child=>typeof child==='string')).join(' ').toLowerCase().includes('cycling')));
 act(()=>tree.unmount());
});

const worker={};
{
 const js=ts.transpileModule(readFileSync(new URL('../src/lib/conditionalPrediction.worker.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
 new Function('require','self','exports',js)(id=>id==='./conditionalDecoder'?decoder:features,worker,{});
}
function compare(baseline,scenario){let result;worker.postMessage=value=>{result=value;};worker.onmessage({data:{model,history,baseline,scenario,minutes:360}});if(result.error)throw Error(result.error);return result.result;}

test('shared editor offers food, insulin and searchable physical activity in one plan',async()=>{
 const {ActivityPicker}=component('../src/components/ActivityPicker.tsx',{'../lib/conditionalFeatures':features,'./EventCatalogPicker':{EventCatalogPicker}});
 const {ScenarioBuilder}=component('../src/components/ScenarioBuilder.tsx',{'./InsulinPicker':{InsulinPicker:'insulin-picker'},'./ActivityPicker':{ActivityPicker},'./FoodCompositionPicker':{FoodCompositionPicker:'food-picker'},'../lib/scenario':compiler});
 let tree,submitted;act(()=>{tree=create(React.createElement(ScenarioBuilder,{value:[meal,bolus,walk],onChange(){},start:origin,hours:6,engine:'integrated',allowedKinds:['meal','insulin','activity'],onRun:c=>{submitted=adapter.conditionalPlanFromSchedule(c);}}));});
 assert.deepEqual(tree.root.findByProps({'aria-label':'Add scenario event'}).findAllByType('option').map(v=>v.props.value),['','meal','insulin','activity']);
 assert.equal(tree.root.findByType(ActivityPicker).props.activityId,'17190');
 await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(submitted.events.length,3);
 act(()=>tree.unmount());
});

test('single-model simulator runs the real worker, saves all events and clears edited output, without a model selector',async()=>{
 const {conditionalForecast}=await load('conditionalForecast');const saved=[];
 const session={patientId:'synthetic',source:'supabase',cohort:'ShanghaiT2DM',model,history};
 const forecast=async(_session,baseline,scenario)=>{const comparison=compare(baseline,scenario);return {comparison,forecast:conditionalForecast('synthetic','supabase','ShanghaiT2DM',model.checkpoint_sha256,'integrated-v3',history,comparison,baseline,scenario)};};
 const {ConditionalSimulatorPanel}=component('../src/components/ConditionalSimulatorPanel.tsx',{
  '../lib/forecast':{getForecastApiUrl:()=>'',saveForecastApiUrl(){}},
  '../lib/conditionalSession':{defaultConditionalEngine:()=> 'browser',loadConditionalSession:async()=>session,forecastConditionalSession:forecast},
  '../lib/conditionalScenario':adapter,'../lib/resultHighlights':{predictionHighlights:()=>[]},
  '../lib/predictionResults':{savePrediction:async v=>saved.push(v)},'./ScenarioBuilder':{ScenarioBuilder:'scenario-editor'},
  './PredictionChart':{PredictionChart:'prediction-chart'},'./ForecastIntervalControl':{ForecastIntervalControl:'interval-control'},'../lib/forecastSampling':await load('forecastSampling'),
 });
 let tree;await act(async()=>{tree=create(React.createElement(ConditionalSimulatorPanel,{patient:{id:'synthetic'},allowInsulin:true}));});
 assert.equal(tree.root.findAllByProps({'aria-label':'Scenario prediction model'}).length,0);
 assert.deepEqual(tree.root.findByType('scenario-editor').props.allowedKinds,['meal','insulin','activity']);
 const workspaceTab=name=>tree.root.findAllByProps({role:'tab'}).find(tab=>tab.children.some(child=>typeof child==='string'&&child.startsWith(name)));
 act(()=>workspaceTab('What-if events').props.onClick());
 assert.equal(tree.root.findAllByType('prediction-chart').length,0);
 act(()=>tree.root.findByType('scenario-editor').props.onChange([meal,bolus,walk]));
 act(()=>workspaceTab('Prediction').props.onClick());assert.equal(tree.root.findByType('prediction-chart').props.series.length,1);
 act(()=>workspaceTab('What-if events').props.onClick());assert.equal(tree.root.findByType('scenario-editor').props.value.length,3);
 await act(async()=>{assert.equal(await tree.root.findByType('scenario-editor').props.onRun(compiler.compileScenario([meal,bolus,walk],origin,6,'integrated')),true);});
 assert.equal(workspaceTab('Prediction').props['aria-selected'],true);
 let chart=tree.root.findByType('prediction-chart');assert.equal(chart.props.series.length,2);assert.equal(chart.props.series[1].points.length,25);
 assert.notEqual(chart.props.series[1].points[24].value,chart.props.series[0].points[24].value);
 act(()=>tree.root.findByType('interval-control').props.onChange(30));assert.equal(tree.root.findByType('prediction-chart').props.series[1].points.length,13);
 const save=()=>tree.root.findAllByType('button').find(b=>b.children.includes('Save to lab results'));
 await act(async()=>{await save().props.onClick();});
 assert.equal(saved[0].output.model_sha256,model.checkpoint_sha256);assert.equal(saved[0].output.model_family,'conditional-v3');
 assert.equal(saved[0].output.plans.scenario.events.length,3);assert.match(saved[0].event_summary,/114.0 MET-min/);assert.match(saved[0].event_summary,/2 U rapid bolus/);
 act(()=>tree.root.findByType('scenario-editor').props.onChange([{...walk,amount:'45'}]));
 assert.equal(tree.root.findByType('prediction-chart').props.series.length,1);assert.equal(save().props.disabled,true);
 act(()=>tree.unmount());
});
