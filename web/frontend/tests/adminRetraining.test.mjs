import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;

const stub = moduleUrl(`
export const getSupabaseClient = () => ({
  auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) }
});
export const getForecastApiUrl = () => 'https://api.example.test';
`);

let code = compile(readFileSync(new URL('../src/lib/modelApi.ts', import.meta.url), 'utf8'));
code = code.replace(/from (['"])\.\/supabase\1/g, `from ${JSON.stringify(stub)}`);
code = code.replace(/from (['"])\.\/forecast\1/g, `from ${JSON.stringify(stub)}`);

const { trainingRequest, retrainingReadiness } = await import(moduleUrl(code));

test('trainingRequest throws clear error if backend returns a generic or non-training payload', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ api_docs: '/api/meta', message: 'Backend running.' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

  try {
    await assert.rejects(
      trainingRequest('GET'),
      /The connected service does not provide the model retraining API/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('retrainingReadiness throws clear error if backend returns a generic or non-readiness payload', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ api_docs: '/api/meta', message: 'Backend running.' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

  try {
    await assert.rejects(
      retrainingReadiness(false),
      /The connected service does not provide retraining readiness data/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
