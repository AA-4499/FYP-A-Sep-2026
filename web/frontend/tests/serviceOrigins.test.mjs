import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/serviceOrigins.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;
const {resolveKnowledgeGraphApiUrl} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('explicit KG service remains independent of model service and saved model URL', () => {
  assert.equal(resolveKnowledgeGraphApiUrl('https://graph.onrender.com/', 'https://model.onrender.com'), 'https://graph.onrender.com');
  assert.equal(resolveKnowledgeGraphApiUrl('https://graph.onrender.com', 'https://another-model.onrender.com'), 'https://graph.onrender.com');
});
test('a shared backend remains supported when no separate KG origin is supplied', () => {
  for (const value of [undefined, '', '  ']) assert.equal(resolveKnowledgeGraphApiUrl(value, 'https://shared.onrender.com/'), 'https://shared.onrender.com');
  assert.equal(resolveKnowledgeGraphApiUrl('', ''), '');
});
test('invalid dedicated KG origins fail instead of routing to another server', () => {
  for (const value of ['graph.onrender.com', 'ftp://graph.test', 'https://user:secret@graph.test', 'https://graph.test/api', 'https://graph.test?key=secret', 'https://graph.test/#token']) {
    assert.throws(() => resolveKnowledgeGraphApiUrl(value, 'https://model.test'), /VITE_KG_API_BASE_URL/);
  }
});
