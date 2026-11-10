import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const uri = (text) => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const stub = uri('export function getSupabaseClient() { return globalThis.__invitationClient; }');
const compile = (file) => ts.transpileModule(readFileSync(new URL(`../src/lib/${file}.ts`, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
}).outputText.replace(/from (['"])\.\/supabase\1/, `from ${JSON.stringify(stub)}`);
const admin = uri(compile('adminApi'));
const forecast = uri('export function getForecastApiUrl() { return "https://api.example"; }');
const compiled = compile('doctorInvitations')
  .replace(/from (['"])\.\/adminApi\1/, `from ${JSON.stringify(admin)}`)
  .replace(/from (['"])\.\/forecast\1/, `from ${JSON.stringify(forecast)}`);
const { inviteDoctor } = await import(uri(compiled));
const input = { full_name: 'Doctor', email: 'doctor@example.com', organisation: 'Clinic', department: 'Diabetes', registration_id: 'MMC' };

test('invitation transport authenticates the API request and preserves delivery errors', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; delete globalThis.__invitationClient; });
  let session = null;
  globalThis.__invitationClient = { auth: { getSession: async () => ({ data: { session }, error: null }) } };
  const calls = [];
  let status = 201;
  let payload = { message: 'Invitation sent', email: input.email };
  let contentType = 'application/json';
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: status === 201, status, headers: new Headers({ 'content-type': contentType }), json: async () => payload };
  };
  await assert.rejects(inviteDoctor(input), (error) => error.kind === 'session');
  assert.equal(calls.length, 0);
  session = { access_token: 'admin-token' };
  assert.deepEqual(await inviteDoctor(input), payload);
  assert.equal(calls[0].url, 'https://api.example/api/admin/doctors/invite');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer admin-token');
  assert.deepEqual(JSON.parse(calls[0].options.body), input);
  for (const [httpStatus, kind] of [[403, 'forbidden'], [401, 'session'], [409, 'unknown'], [502, 'unknown']]) {
    status = httpStatus;
    payload = { error: 'Delivery failed' };
    await assert.rejects(inviteDoctor(input), (error) => error.kind === kind && error.message === 'Delivery failed');
  }
  contentType = 'text/html';
  await assert.rejects(inviteDoctor(input), (error) => error.kind === 'configuration');
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(inviteDoctor(input), (error) => error.kind === 'network');
});
