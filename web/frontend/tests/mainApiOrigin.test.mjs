import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/lib/mainApiOrigin.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;
const {resolveMainApiOrigin,ORIGINAL_API_ORIGIN}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('production without a Vercel API variable uses the original KG backend',()=>{
  for(const value of [undefined,'','  ']) assert.equal(resolveMainApiOrigin(value,null,false),'https://diabetes-digital-twin-kg-api.onrender.com');
});
test('existing main API settings and explicit saved connections retain their priority',()=>{
  assert.equal(resolveMainApiOrigin(' https://configured.test/ ',null,false),'https://configured.test');
  assert.equal(resolveMainApiOrigin('https://configured.test',' https://saved.test/ ',false),'https://saved.test');
  assert.equal(resolveMainApiOrigin('', 'https://diabetes-digital-twin-kg-api.onrender.com/',false),ORIGINAL_API_ORIGIN);
});
test('local development retains localhost instead of silently using production',()=>{
  assert.equal(resolveMainApiOrigin(undefined,null,true),'http://localhost:5000');
  assert.equal(resolveMainApiOrigin('https://configured.test',null,true),'https://configured.test');
});
