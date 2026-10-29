import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/accountAuth.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } });
const { trustedRole, loadAccountAccess, registerPatient, registerDoctor, confirmationUrl, authErrorMessage } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const input = { name: ' Test Patient ', identityNumber: ' 001122-33-4455 ', email: ' test@example.com ', password: 'test-password-123', confirm: 'test-password-123' };

function applicationClient(application, error = null) {
  return { rpc: async (name) => {
    assert.equal(name, 'get_my_doctor_application_status');
    return { data: application, error };
  }, from: (table) => {
    assert.equal(table, 'doctor_applications');
    return { select: (columns) => {
      assert.equal(columns, 'user_id,status');
      return { eq: (column, value) => {
        assert.equal(column, 'user_id');
        assert.equal(value, 'account-1');
        return { maybeSingle: async () => ({ data: application, error }) };
      } };
    } };
  } };
}

test('existing pending application opens approval status even with missing or stale Auth metadata', async () => {
  for (const app_metadata of [{}, { role: 'patient' }, { role: 'doctor' }]) {
    const result = await loadAccountAccess(applicationClient({ user_id: 'account-1', status: 'pending' }), {
      id: 'account-1', app_metadata, user_metadata: {},
    });
    assert.deepEqual(result, { role: null, doctorStatus: 'pending' });
  }
});

test('ordinary Patients and trusted staff without applications retain their workspaces', async () => {
  for (const role of ['patient', 'doctor', 'admin']) {
    assert.deepEqual(await loadAccountAccess(applicationClient(null), {
      id: 'account-1', app_metadata: { role }, user_metadata: {},
    }), { role, doctorStatus: null });
  }
});

test('missing Doctor application is explained instead of opening the Patient dashboard', async () => {
  assert.deepEqual(await loadAccountAccess(applicationClient(null), {
    id: 'account-1', app_metadata: { role: 'patient' }, user_metadata: { requested_role: 'doctor' },
  }), { role: null, doctorStatus: 'missing' });
});

test('approval never grants a Doctor workspace without trusted permissions', async () => {
  const client = applicationClient({ user_id: 'account-1', status: 'approved' });
  const user = { id: 'account-1', app_metadata: { role: 'patient' }, user_metadata: { role: 'doctor', doctor_registration_status: 'approved' } };
  assert.deepEqual(await loadAccountAccess(client, user), { role: null, doctorStatus: 'sync_required' });
  assert.deepEqual(await loadAccountAccess(client, { ...user, app_metadata: { role: 'doctor' } }), { role: 'doctor', doctorStatus: null });
  assert.deepEqual(await loadAccountAccess(client, { ...user, app_metadata: { role: 'doctor', doctor_registration_status: 'pending' } }), { role: null, doctorStatus: 'sync_required' });
});

test('rejected and unknown application states cannot open a workspace', async () => {
  for (const [status, doctorStatus] of [['rejected', 'rejected'], ['unexpected', 'review']]) {
    assert.deepEqual(await loadAccountAccess(applicationClient({ user_id: 'account-1', status }), {
      id: 'account-1', app_metadata: { role: 'doctor' }, user_metadata: {},
    }), { role: null, doctorStatus });
  }
});

test('table-access failures no longer block ordinary Patient and trusted staff logins', async () => {
  for (const role of ['patient', 'doctor', 'admin']) {
    for (const code of ['42501', '42P17', 'PGRST205']) {
      assert.deepEqual(await loadAccountAccess(applicationClient(null, { code }), {
        id: 'account-1', app_metadata: { role }, user_metadata: {},
      }), { role, doctorStatus: null });
    }
  }
});

test('Doctor applicants remain restricted when the status lookup fails', async () => {
  const client = applicationClient(null, { code: '42501' });
  const user = { id: 'account-1', app_metadata: {}, user_metadata: { requested_role: 'doctor', role: 'doctor' } };
  assert.deepEqual(await loadAccountAccess(client, user), { role: null, doctorStatus: 'unavailable', statusErrorCode: '42501' });
  assert.deepEqual(await loadAccountAccess(client, { ...user, app_metadata: { role: 'patient', doctor_registration_status: 'pending' } }), { role: null, doctorStatus: 'pending' });
  assert.deepEqual(await loadAccountAccess(client, { ...user, app_metadata: { role: 'doctor', doctor_registration_status: 'rejected' } }), { role: null, doctorStatus: 'rejected' });
  assert.deepEqual(await loadAccountAccess(client, { ...user, app_metadata: { role: 'patient', doctor_registration_status: 'approved' } }), { role: null, doctorStatus: 'sync_required' });
  assert.deepEqual(await loadAccountAccess(client, { ...user, app_metadata: { role: 'doctor', doctor_registration_status: 'approved' } }), { role: 'doctor', doctorStatus: null });
});

test('missing RPC uses the existing owner-filtered table lookup', async () => {
  const client = applicationClient({ user_id: 'account-1', status: 'pending' });
  client.rpc = async () => ({ data: null, error: { code: 'PGRST202' } });
  assert.deepEqual(await loadAccountAccess(client, { id: 'account-1', app_metadata: {}, user_metadata: {} }), { role: null, doctorStatus: 'pending' });
});

test('network exceptions preserve Patient access and keep applicants restricted', async () => {
  const client = applicationClient(null);
  client.rpc = async () => { throw new TypeError('Failed to fetch'); };
  const user = { id: 'account-1', app_metadata: { role: 'patient' }, user_metadata: {} };
  assert.deepEqual(await loadAccountAccess(client, user), { role: 'patient', doctorStatus: null });
  assert.deepEqual(await loadAccountAccess(client, { ...user, user_metadata: { requested_role: 'doctor' } }), { role: null, doctorStatus: 'unavailable', statusErrorCode: 'LOOKUP_FAILED' });
});

test('a mismatched application can never grant access', async () => {
  const user = { id: 'account-1', app_metadata: {}, user_metadata: {} };
  await assert.rejects(loadAccountAccess(applicationClient({ user_id: 'someone-else', status: 'approved' }), user), /could not be verified/);
});

test('Doctor signup submits professional details without granting a role or approval', async () => {
  let request;
  const client = { auth: { signUp: async (value) => { request = value; return { data: { session: null }, error: null }; } } };
  await registerDoctor(client, { ...input, clinic: ' Test Clinic ', registrationNumber: ' 00123 ' }, 'http://localhost:3000');
  assert.deepEqual(request, { email: 'test@example.com', password: input.password, options: {
    emailRedirectTo: 'http://localhost:3000/', data: { full_name: 'Test Patient', organisation: 'Test Clinic', registration_id: '00123', requested_role: 'doctor' },
  } });
});

test('Doctor signup validates professional details and propagates provider errors', async () => {
  const doctor = { ...input, clinic: 'Test Clinic', registrationNumber: '00123' };
  let calls = 0;
  const failure = new Error('Signup unavailable');
  const client = { auth: { signUp: async () => { calls++; return { data: null, error: failure }; } } };
  for (const changes of [{ name: ' ' }, { name: 'x'.repeat(121) }, { clinic: ' ' }, { clinic: 'x'.repeat(201) }, { registrationNumber: '' }, { registrationNumber: 'x'.repeat(65) }, { registrationNumber: 'A\n12' }, { password: 'short', confirm: 'short' }, { confirm: 'different' }]) {
    await assert.rejects(registerDoctor(client, { ...doctor, ...changes }, 'http://localhost:3000'));
  }
  assert.equal(calls, 0);
  await assert.rejects(registerDoctor(client, doctor, 'http://localhost:3000'), (error) => error === failure);
});

test('pending Doctor applications cannot enter a workspace; approved trusted Doctors can', () => {
  for (const role of ['patient', 'doctor']) {
    assert.equal(trustedRole({ app_metadata: { role, doctor_registration_status: 'pending' } }), null);
  }
  assert.equal(trustedRole({ app_metadata: { role: 'doctor', doctor_registration_status: 'approved' } }), 'doctor');
  assert.equal(trustedRole({ app_metadata: { role: 'patient' }, user_metadata: { role: 'doctor', doctor_registration_status: 'approved' } }), 'patient');
});

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
