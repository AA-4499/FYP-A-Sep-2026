import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {act,create} from 'react-test-renderer';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function module(relative,mocks={}){const source=readFileSync(new URL(relative,import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;const m={exports:{}};new Function('require','module','exports',js)(id=>Object.hasOwn(mocks,id)?mocks[id]:require(id),m,m.exports);return m.exports;}
const {EventCatalogPicker}=module('../src/components/EventCatalogPicker.tsx');
const scenario=module('../src/lib/scenario.ts');
const reference={id:'400',name:'Cooked rice',chinese_name:'Rice',category:'Grains',available_per_100g:25.9,fiber_per_100g:.3,protein_per_100g:2.6,fat_per_100g:.3,basis:'available_carbohydrate_per_100g_edible_portion',reference_sha256:'b'.repeat(64)};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('shared search opens a small results window, supports keyboard selection and Escape, and closes after selection',()=>{
 let tree,selected;
 const render=query=>React.createElement(EventCatalogPicker,{label:'Choose item',searchLabel:'Search items',placeholder:'Search',quick:[{id:'a',name:'A',detail:'Quick'}],options:[{id:'b',name:'B',detail:'Result'}],query,onQuery:q=>tree.update(render(q)),onSelect:id=>selected=id});
 act(()=>{tree=create(render(''));});
 const input=()=>tree.root.findByProps({role:'combobox'});
 act(()=>input().props.onFocus());assert.equal(tree.root.findAllByProps({role:'listbox'}).length,1);
 act(()=>input().props.onKeyDown({key:'ArrowDown',preventDefault(){}}));
 act(()=>input().props.onKeyDown({key:'Enter',preventDefault(){}}));assert.equal(selected,'b');assert.equal(input().props['aria-expanded'],false);
 act(()=>input().props.onChange({target:{value:'test'}}));assert.equal(input().props['aria-expanded'],true);
 act(()=>input().props.onKeyDown({key:'Escape',preventDefault(){}}));assert.equal(tree.root.findAllByProps({role:'listbox'}).length,0);
 act(()=>input().props.onClick());assert.equal(input().props['aria-expanded'],true);
 act(()=>tree.unmount());
});

test('food popup uses authenticated catalog results, count and paging, preserves the reference and recalculates total carbs',async()=>{
 const calls=[];let chosen,portion;
 const {FoodCompositionPicker}=module('../src/components/FoodCompositionPicker.tsx',{
  './EventCatalogPicker':{EventCatalogPicker},'../lib/scenario':scenario,
  '../lib/foodCatalog':{searchFoodCatalog:async(q,offset)=>{calls.push([q,offset]);return {foods:[{...reference,id:String(400+offset)}],offset,total:q?47:1677,has_more:offset===0,source:'supabase.food_composition'};}},
 });
 let tree;const props={portion:'200',carbohydrate:'52.4',engine:'conditional',onSelectFood:(...args)=>chosen=args,onUpdatePortion:(...args)=>portion=args};
 act(()=>{tree=create(React.createElement(FoodCompositionPicker,props));});
 act(()=>tree.root.findByProps({'aria-label':'Search food catalog'}).props.onFocus());
 await act(async()=>{await pause(240);});assert.deepEqual(calls,[['',0]]);assert.ok(JSON.stringify(tree.toJSON()).includes('1,677 foods in Supabase'));
 act(()=>tree.root.findByProps({'aria-label':'Search food catalog'}).props.onChange({target:{value:'rice'}}));
 await act(async()=>{await pause(240);});assert.deepEqual(calls.at(-1),['rice',0]);
 act(()=>tree.root.findByProps({role:'option'}).props.onClick());
 assert.equal(chosen[2],52.4);assert.deepEqual(chosen[3],reference);
 act(()=>tree.update(React.createElement(FoodCompositionPicker,{...props,foodReference:reference,description:reference.name})));
 act(()=>tree.root.findByProps({'aria-label':'Food portion grams'}).props.onChange({target:{value:'300'}}));assert.equal(portion[1],78.6);assert.deepEqual(portion[2],reference);
 act(()=>tree.root.findByProps({'aria-label':'Search food catalog'}).props.onFocus());
 await act(async()=>tree.root.findAllByType('button').find(b=>b.children.includes('Load more foods')).props.onClick());
 await act(async()=>{await pause(240);});assert.deepEqual(calls.at(-1),['rice',30]);assert.equal(tree.root.findAllByProps({role:'option'}).length,2);
 act(()=>tree.unmount());
});

test('older food responses cannot replace a new query and network failure is visible',async()=>{
 let resolveOld,fail=true;const old=new Promise(resolve=>resolveOld=resolve);
 const {FoodCompositionPicker}=module('../src/components/FoodCompositionPicker.tsx',{
  './EventCatalogPicker':{EventCatalogPicker},'../lib/scenario':scenario,
  '../lib/foodCatalog':{searchFoodCatalog:q=>q==='old'?old:q==='error'&&fail?Promise.reject(Error('Food service offline')):Promise.resolve({foods:[{...reference,name:'Fresh result'}],has_more:false,total:1,offset:0,source:'supabase.food_composition'})},
 });
 let tree;act(()=>{tree=create(React.createElement(FoodCompositionPicker,{portion:'100',carbohydrate:'26.2'}));});
 const search=q=>tree.root.findByProps({'aria-label':'Search food catalog'}).props.onChange({target:{value:q}});
 act(()=>search('old'));await act(async()=>{await pause(240);});act(()=>search('fresh'));await act(async()=>{await pause(240);});
 await act(async()=>resolveOld({foods:[{...reference,name:'Stale result'}],has_more:false,total:1,offset:0}));
 assert.ok(JSON.stringify(tree.toJSON()).includes('Fresh result'));assert.ok(!JSON.stringify(tree.toJSON()).includes('Stale result'));
 act(()=>search('error'));await act(async()=>{await pause(240);});assert.ok(JSON.stringify(tree.toJSON()).includes('Food service offline'));
 fail=false;act(()=>tree.root.findAllByType('button').find(b=>b.children.includes('Retry search')).props.onClick());await act(async()=>{await pause(240);});assert.ok(JSON.stringify(tree.toJSON()).includes('Fresh result'));
 act(()=>tree.unmount());
});

test('insulin uses the same popup and quick selection while limiting choices to modeled formulations',()=>{
 const {InsulinPicker}=module('../src/components/InsulinPicker.tsx',{'./EventCatalogPicker':{EventCatalogPicker}});
 let chosen,tree;act(()=>{tree=create(React.createElement(InsulinPicker,{index:2,disabled:false,onSelect:(...args)=>chosen=args}));});
 act(()=>tree.root.findByProps({'aria-label':'Event 2 insulin search'}).props.onChange({target:{value:'regular'}}));
 assert.equal(tree.root.findAllByProps({role:'option'}).length,1);
 act(()=>tree.root.findByProps({role:'option'}).props.onClick());assert.equal(chosen[1],'regular');
 act(()=>tree.unmount());
});

test('food API sends the session token to the configured food endpoint and reports HTTP and schema failures',async()=>{
 const originalFetch=globalThis.fetch;let request;
 const {searchFoodCatalog}=module('../src/lib/foodCatalog.ts',{'./supabase':{getSupabaseClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'synthetic-token'}}})}})},'./forecast':{getForecastApiUrl:()=> 'https://food.example.test'}});
 try{
  globalThis.fetch=async(url,init)=>{request={url,init};return new Response(JSON.stringify({foods:[reference],has_more:false,total:1,offset:0,source:'supabase.food_composition'}),{headers:{'content-type':'application/json'}});};
  await searchFoodCatalog('rice',30);assert.equal(request.init.headers.Authorization,'Bearer synthetic-token');assert.match(request.url,/food-composition\?q=rice&offset=30/);
  globalThis.fetch=async()=>new Response(JSON.stringify({error:'Catalog unavailable'}),{status:503,headers:{'content-type':'application/json'}});
  await assert.rejects(searchFoodCatalog('rice'),/Catalog unavailable/);
  globalThis.fetch=async()=>new Response('<html>Fallback</html>',{headers:{'content-type':'text/html'}});
  await assert.rejects(searchFoodCatalog('rice'),/unavailable/);
 }finally{globalThis.fetch=originalFetch;}
});

test('authenticated direct Supabase search uses real unit-bearing columns, preserves unknown nutrients and sanitizes filters',async()=>{
 let fields,filter;
 const raw={id:42,englishName:'Catalog food',foodName:'Rice',categoryMain:'Grains','CHO (g)':'25.9','dietaryFiber (g)':'Tr','protein (g)':null,'fat (g)':'.3'};
 const query={select:(value)=>{fields=value;return query;},order:()=>query,range:()=>query,or:value=>{filter=value;return query;},abortSignal:()=>query,then:resolve=>resolve({data:[raw],count:1677,error:null})};
 const {searchFoodCatalog}=module('../src/lib/foodCatalog.ts',{'./supabase':{getSupabaseClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'synthetic-token'}}})},from:()=>query})},'./forecast':{getForecastApiUrl:()=> 'https://unused.example.test'}});
 const page=await searchFoodCatalog('rice),id.gt.0');
 assert.match(fields,/"CHO \(g\)"/);assert.match(fields,/"dietaryFiber \(g\)"/);assert.ok(!filter.includes('),'));
 assert.equal(page.total,1677);assert.equal(page.foods[0].available_per_100g,25.9);assert.equal(page.foods[0].fiber_per_100g,null);assert.equal(page.foods[0].protein_per_100g,null);assert.match(page.foods[0].reference_sha256,/^[a-f0-9]{64}$/);
});

test('catalog selection fills consistent meal macros, keeps provenance, and scales them when portion changes',()=>{
 const {ScenarioBuilder}=module('../src/components/ScenarioBuilder.tsx',{'./ActivityPicker':{ActivityPicker:'activity-picker'},'./InsulinPicker':{InsulinPicker:'insulin-picker'},'./FoodCompositionPicker':{FoodCompositionPicker:'food-picker'},'../lib/scenario':scenario});
 let drafts=[{id:'a',kind:'meal',at:'2021-01-01T12:30',description:'Rice',amount:'200',carbohydrate:'40',absorption:'45',intensity:'moderate'}],tree;
 const render=()=>React.createElement(ScenarioBuilder,{value:drafts,onChange:next=>{drafts=next;tree.update(render());},start:'2021-01-01T12:00:00Z',hours:6,engine:'integrated',onRun(){},onReset(){}});
 act(()=>{tree=create(render());});
 act(()=>tree.root.findByType('food-picker').props.onSelectFood(reference.name,200,52.4,reference));
 assert.equal(drafts[0].protein,'5.2');assert.equal(drafts[0].fat,'0.6');assert.equal(drafts[0].fiber,'0.6');assert.equal(drafts[0].carbohydrateSource,'food-composition');
 assert.doesNotThrow(()=>scenario.compileScenario(drafts,'2021-01-01T12:00:00Z',6,'integrated'));
 act(()=>tree.root.findByType('food-picker').props.onUpdatePortion(300,78.6,reference));assert.equal(drafts[0].protein,'7.8');assert.equal(drafts[0].fiber,'0.9');
 act(()=>tree.unmount());
});
