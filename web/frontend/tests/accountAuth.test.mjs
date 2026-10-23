import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/accountAuth.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } });
const { trustedRole, registerPatient, confirmationUrl, authErrorMessage } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const input = { name: ' Test Patient ', email: ' test@example.com ', password: 'test-password-123', confirm: 'test-password-123' };

test('signup submits only profile metadata; role and record access are never client-assigned', async () => {
  let request;
  const data = { user: { id: 'new-user' }, session: null };
  const client = { auth: { signUp: async (value) => { request = value; return { data, error: null }; } } };
  assert.equal(await registerPatient(client, input, 'http://localhost:3000'), data);
  assert.deepEqual(request, { email: 'test@example.com', password: input.password, options: { emailRedirectTo: 'http://localhost:3000/', data: { full_name: 'Test Patient', requested_role: 'patient' } } });
  assert.equal(data.session, null);
});

test('invalid registration input fails before calling Supabase', async () => {
  let calls = 0;
  const client = { auth: { signUp: async () => { calls++; } } };
  for (const invalid of [{ ...input, name: ' ' }, { ...input, confirm: 'different' }, { ...input, password: 'short', confirm: 'short' }]) {
    await assert.rejects(registerPatient(client, invalid, 'http://localhost:3000'));
  }
  assert.equal(calls, 0);
});

test('signup errors propagate instead of reporting an email was sent', async () => {
  const failure = { message: 'Email address not authorized', code: 'email_address_not_authorized' };
  const client = { auth: { signUp: async () => ({ data: null, error: failure }) } };
  await assert.rejects(registerPatient(client, input, 'http://localhost:3000'), (error) => error === failure);
  assert.match(authErrorMessage(failure), /existing team email/);
});

test('editable metadata cannot grant Doctor or Admin access', () => {
  for (const role of ['admin', 'doctor', 'clinician']) {
    assert.equal(trustedRole({ app_metadata: {}, user_metadata: { role } }), 'patient');
    assert.equal(trustedRole({ app_metadata: { role: 'patient' }, user_metadata: { role } }), 'patient');
  }
});

test('trusted roles route correctly and unknown explicit roles fail closed', () => {
  for (const role of ['patient', 'doctor', 'admin']) assert.equal(trustedRole({ app_metadata: { role } }), role);
  assert.equal(trustedRole({ app_metadata: { role: 'clinician' } }), 'doctor');
  assert.equal(trustedRole({ app_metadata: { role: 'unknown' } }), null);
  assert.equal(trustedRole({ app_metadata: { role: '' } }), null);
});

test('confirmation URL uses the app root without retaining callbacks or token fragments', () => {
  assert.equal(confirmationUrl('https://example.com/auth?code=secret#token'), 'https://example.com/');
});

test('rate limits, unconfirmed accounts, and network failures produce usable errors', () => {
  assert.match(authErrorMessage({ code: 'over_email_send_rate_limit' }), /wait/);
  assert.match(authErrorMessage({ code: 'email_not_confirmed' }), /confirm your email/);
  assert.match(authErrorMessage(null), /try again/);
});
