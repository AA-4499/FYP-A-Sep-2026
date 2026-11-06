import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/serviceOrigins.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;
const {resolveKnowledgeGraphApiUrl, resolveModelApiUrl} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('KG keeps the existing API variable while the model uses its own origin', () => {
  const graph = 'https://graph.onrender.com/';
  assert.equal(resolveKnowledgeGraphApiUrl(graph), 'https://graph.onrender.com');
  assert.equal(resolveModelApiUrl('https://model.onrender.com/', null), 'https://model.onrender.com');
  assert.equal(resolveModelApiUrl('https://model.onrender.com', 'https://saved-model.onrender.com/'), 'https://saved-model.onrender.com');
  assert.equal(resolveKnowledgeGraphApiUrl(graph), 'https://graph.onrender.com');
});
test('missing model configuration cannot silently use the KG server', () => {
  for (const value of [undefined, '', '  ']) assert.equal(resolveModelApiUrl(value, null), '');
  assert.equal(resolveModelApiUrl('', null, 'http://localhost:5000'), 'http://localhost:5000');
  assert.equal(resolveKnowledgeGraphApiUrl('', 'http://localhost:5000/'), 'http://localhost:5000');
  assert.equal(resolveKnowledgeGraphApiUrl('', ''), '');
});
test('invalid dedicated KG origins fail instead of routing to another server', () => {
  for (const value of ['graph.onrender.com', 'ftp://graph.test', 'https://user:secret@graph.test', 'https://graph.test/api', 'https://graph.test?key=secret', 'https://graph.test/#token']) {
    assert.throws(() => resolveKnowledgeGraphApiUrl(value), /VITE_API_BASE_URL/);
  }
});
