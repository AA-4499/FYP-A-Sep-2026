import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
async function load(name){const source=readFileSync(new URL(`../src/lib/${name}.ts`,import.meta.url),'utf8');const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);}
const {compileScenario,cookedRiceCarbohydrate}=await load('scenario');
const {conditionalPlanFromSchedule}=await load('conditionalScenario');
const {buildFuturePlan,withoutPlannedEvents,remainingAction}=await load('conditionalFeatures');
const origin='2021-01-01T12:00:00Z';
const history={origin:Date.parse(origin),start:Date.parse('2021-01-01T00:00:00Z'),boluses:[],excluded:[]};
const meal={id:'a',kind:'meal',at:'2021-01-01T12:20',description:'Cooked rice',amount:'200',carbohydrate:'56.3',carbohydrateSource:'usda-cooked-white-rice',absorption:'',intensity:'moderate'};
const bolus={id:'b',kind:'insulin',at:'2021-01-01T12:05',description:'Explicit research plan',amount:'2',carbohydrate:'',absorption:'',intensity:'moderate',insulinFormulation:'regular'};
test('existing event editor compiles total carbohydrate and typed boluses into the actual v3 schedule',()=>{
 assert.equal(cookedRiceCarbohydrate(200,'total'),56.3);
 assert.equal(cookedRiceCarbohydrate(200),55.5);
 const compiled=compileScenario([meal,bolus],origin,4,'conditional');
 const plan=conditionalPlanFromSchedule(compiled),future=buildFuturePlan(history,plan);
 assert.equal(future[0][2],0);assert.ok(Math.abs(future[1][2]-56.3)<.00001);
 assert.equal(future[0][7],1);assert.ok(Math.abs(future[0][6]-2*remainingAction(10,'regular'))<.00001);
 assert.deepEqual(compiled.schedule.map(row=>row.id),['b','a']);
 assert.deepEqual(buildFuturePlan(history,withoutPlannedEvents(plan,'bolus')).map(row=>row[6]),Array(16).fill(0));
 assert.ok(buildFuturePlan(history,withoutPlannedEvents(plan,'meal')).every(row=>row[2]===0));
});
test('multiple meal events sum by bin; dose action keeps each timestamp and formulation',()=>{
 const secondMeal={...meal,id:'c',at:'2021-01-01T12:25',amount:'100',carbohydrate:'20',carbohydrateSource:'manual'};
 const secondBolus={...bolus,id:'d',at:'2021-01-01T12:45',amount:'1',insulinFormulation:'rapid'};
 const future=buildFuturePlan(history,conditionalPlanFromSchedule(compileScenario([meal,bolus,secondMeal,secondBolus],origin,4,'conditional')));
 assert.ok(Math.abs(future[1][2]-76.3)<.00001);
 assert.ok(Math.abs(future[2][6]-(2*remainingAction(40,'regular')+1))<.00001);
});
test('unsupported medicine/activity, missing formulation, stale units and untrained horizons fail closed',()=>{
 assert.throws(()=>compileScenario([meal],origin,6,'conditional'),/four-hour/);
 for(const kind of ['medication','activity','stress','illness'])assert.throws(()=>compileScenario([{...meal,kind}],origin,4,'conditional'),/supports meal/);
 assert.throws(()=>compileScenario([{...bolus,insulinFormulation:undefined}],origin,4,'conditional'),/rapid or regular/);
 assert.throws(()=>compileScenario([{...meal,carbohydrate:'55.5'}],origin,4,'conditional'),/no longer matches/);
 assert.throws(()=>compileScenario([{...meal,at:'2021-01-01T16:00'}],origin,4,'conditional'),/inside the 4-hour/);
 assert.throws(()=>buildFuturePlan(history,{events:[{kind:'bolus',amount:1,minutesAhead:20,formulation:'unknown'}]}),/rapid\/regular/);
});
