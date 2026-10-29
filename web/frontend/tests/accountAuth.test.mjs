import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/accountAuth.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } });
const { trustedRole, registerPatient, confirmationUrl, authErrorMessage, accessErrorMessage, accessStateFromRpc, applyAsDoctor, validateDoctorApplication } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const input = { name: ' Test Patient ', identityNumber: ' 001122-33-4455 ', email: ' test@example.com ', password: 'test-password-123', confirm: 'test-password-123' };

test('signup submits only profile metadata; role and record access are never client-assigned', async () => {
  let request;
  const data = { user: { id: 'new-user' }, session: null };
  const client = { auth: { signUp: async (value) => { request = value; return { data, error: null }; } } };
  assert.equal(await registerPatient(client, input, 'http://localhost:3000'), data);
  assert.deepEqual(request, { email: 'test@example.com', password: input.password, options: { emailRedirectTo: 'http://localhost:3000/', data: { full_name: 'Test Patient', nric_passport_no: '001122-33-4455', requested_role: 'patient' } } });
  assert.equal(data.session, null);
});

test('invalid registration input fails before calling Supabase', async () => {
  let calls = 0;
  const client = { auth: { signUp: async () => { calls++; } } };
  for (const invalid of [{ ...input, name: ' ' }, { ...input, identityNumber: ' ' }, { ...input, identityNumber: 'A'.repeat(65) }, { ...input, identityNumber: 'AB\n123' }, { ...input, confirm: 'different' }, { ...input, password: 'short', confirm: 'short' }]) {
    await assert.rejects(registerPatient(client, invalid, 'http://localhost:3000'));
  }
  assert.equal(calls, 0);
});

test('identity numbers preserve leading zeros and support passport letters without granting record access', async () => {
  for (const identityNumber of ['001122334455', '001122-33-4455', 'A01234567']) {
    let request;
    const client = { auth: { signUp: async (value) => { request = value; return { data: { session: null }, error: null }; } } };
    await registerPatient(client, { ...input, identityNumber }, 'http://localhost:3000');
    assert.equal(request.options.data.nric_passport_no, identityNumber);
    assert.equal(request.options.data.patient_id, undefined);
    assert.equal(request.options.data.role, undefined);
  }
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

test('doctor applications submit professional metadata without granting a role', async () => {
  let request;
  const client = { auth: { signUp: async (value) => { request = value; return { data: { user: { id: 'applicant' }, session: null }, error: null }; } } };
  const input = { name: ' Dr. Applicant ', organisation: ' Borneo Clinic ', registrationNumber: ' MMC-123 ', email: 'doc@example.com', password: 'strong-password', confirm: 'strong-password' };
  for (const missing of [
    { ...input, registrationNumber: ' ' },
    { ...input, organisation: ' ' },
    { ...input, registrationNumber: 'A'.repeat(121) },
    { ...input, organisation: 'A\nB' },
    { ...input, confirm: 'different' },
  ]) await assert.rejects(applyAsDoctor(client, missing, 'https://example.test'));
  assert.equal(request, undefined);
  await applyAsDoctor(client, input, 'https://example.test/auth?code=secret');
  assert.equal(request.email, 'doc@example.com');
  assert.equal(request.options.emailRedirectTo, 'https://example.test/');
  assert.deepEqual(request.options.data, {
    full_name: 'Dr. Applicant',
    requested_role: 'doctor',
    registration_id: 'MMC-123',
    organisation: 'Borneo Clinic',
  });
  assert.equal(request.options.data.role, undefined);
  assert.equal(request.options.data.patient_id, undefined);
  assert.equal(validateDoctorApplication(input), undefined);
});

test('access state payloads grant exactly the database role and fail closed on malformed data', () => {
  assert.deepEqual(accessStateFromRpc({ role: 'admin', full_name: 'Admin', status: 'active', application: null }), { role: 'admin', full_name: 'Admin', status: 'active', application: null });
  assert.deepEqual(accessStateFromRpc({ role: 'patient', full_name: '', status: 'active', application: { status: 'pending', review_note: null } }), { role: 'patient', full_name: '', status: 'active', application: { status: 'pending', review_note: null } });
  for (const invalid of [
    null, {}, { role: 'superuser', status: 'active' }, { role: 'admin', status: 'unknown' },
    { role: 'admin', status: 'active', application: { status: 'bogus' } },
    'admin', 42,
  ]) assert.equal(accessStateFromRpc(invalid), null, JSON.stringify(invalid));
});

test('access errors distinguish missing admin migration from expired sessions', () => {
  assert.match(accessErrorMessage({ code: 'PGRST202', message: 'Could not find the function' }), /migration/);
  assert.match(accessErrorMessage({ code: 'PGRST301', message: 'JWT expired' }), /session has expired/);
  assert.match(accessErrorMessage({ code: '42501', message: 'Admin access required.' }), /Admin access required/);
});
