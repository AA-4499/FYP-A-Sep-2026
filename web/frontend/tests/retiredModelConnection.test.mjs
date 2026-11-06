import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/retiredModelConnection.ts',import.meta.url),'utf8');
const code = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;
const {readForecastApiOverride,isRetiredModelOrigin} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
function storage(value) {
  const data = new Map([['dt_forecast_api_url',value],['dt_supabase_url','https://existing.supabase.co'],['unrelated','keep']]);
  return {data,getItem:key=>data.get(key)??null,removeItem:key=>data.delete(key)};
}
test('a deleted model connection is cleared automatically without changing other settings',()=>{
  const saved=storage('https://fyp-a-sep-2026-2.onrender.com/');
  assert.equal(readForecastApiOverride(saved),null);
  assert.equal(saved.data.has('dt_forecast_api_url'),false);
  assert.equal(readForecastApiOverride(saved),null);
  assert.equal(saved.getItem('dt_supabase_url'),'https://existing.supabase.co');
  assert.equal(saved.getItem('unrelated'),'keep');
});
test('existing main and KG connections are retained',()=>{
  for(const url of ['https://diabetes-digital-twin-kg-api.onrender.com','https://fyp-a-sep-2026.onrender.com','http://localhost:5000']) {
    const saved=storage(url);assert.equal(readForecastApiOverride(saved),url);assert.equal(saved.getItem('dt_forecast_api_url'),url);
  }
});
test('retirement is matched by the exact host rather than URL text fragments',()=>{
  assert.equal(isRetiredModelOrigin('https://FYP-A-SEP-2026-2.ONRENDER.COM/'),true);
  for(const value of [null,'','not a URL','https://fyp-a-sep-2026-2.onrender.com.example.org','https://example.org/fyp-a-sep-2026-2.onrender.com']) assert.equal(isRetiredModelOrigin(value),false);
});
