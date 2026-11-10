import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import test from 'node:test';import ts from 'typescript';
const source=readFileSync(new URL('../src/lib/scenario.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;
const {foodCarbohydrate,compileScenario}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const reference={id:'1',name:'Reference food',available_per_100g:25.9,fiber_per_100g:0.3,basis:'available_carbohydrate_per_100g_edible_portion',reference_sha256:'a'.repeat(64)};
test('available CHO is used directly; total carbohydrate adds fibre once',()=>{
 assert.equal(foodCarbohydrate(reference,200,'physiology'),51.8);
 assert.equal(foodCarbohydrate(reference,200,'conditional'),52.4);
});
test('unknown fibre cannot silently become a total-carbohydrate estimate',()=>{
 assert.equal(foodCarbohydrate({...reference,fiber_per_100g:null},200,'conditional'),null);
 assert.equal(foodCarbohydrate({...reference,fiber_per_100g:null},200,'physiology'),51.8);
 for(const grams of [0,-1,NaN,2001])assert.equal(foodCarbohydrate(reference,grams,'physiology'),null);
});
test('changing portion or engine invalidates a stale food estimate',()=>{
 const draft={id:'1',kind:'meal',at:'2026-01-01T01:00',description:'Food',amount:'200',carbohydrate:'51.8',carbohydrateSource:'food-composition',foodReference:reference,absorption:'45',intensity:'moderate'};
 assert.doesNotThrow(()=>compileScenario([draft],'2026-01-01T00:00:00Z',6));
 assert.throws(()=>compileScenario([{...draft,amount:'300'}],'2026-01-01T00:00:00Z',6),/reference/);
 assert.throws(()=>compileScenario([draft],'2026-01-01T00:00:00Z',4,'conditional'),/reference/);
 assert.doesNotThrow(()=>compileScenario([{...draft,carbohydrate:'52.4'}],'2026-01-01T00:00:00Z',4,'conditional'));
});
