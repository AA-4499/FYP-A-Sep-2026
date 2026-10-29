import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

/*
 * Compile the real adminApi module with the project's TypeScript version, then
 * replace its `./supabase` import with an in-memory client stub. No network,
 * no browser, no Supabase dependency.
 */
const stubSource = 'export function getSupabaseClient() { return globalThis.__adminTestClient ?? null; }';
const stubUri = 'data:text/javascript;base64,' + Buffer.from(stubSource).toString('base64');
const source = readFileSync(new URL('../src/lib/adminApi.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } });
const compiled = outputText.replace(/from\s+(['"])\.\/supabase\1/, () => `from ${JSON.stringify(stubUri)}`);
const api = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));

const {
  AdminApiError, adminApi, adminCsv, formatAdminDate, normalizeAdminError,
  validateReviewNote, validateRoleChange,
} = api;

function capture(data = null) {
  const calls = [];
  globalThis.__adminTestClient = {
    rpc: async (fn, args) => { calls.push({ fn, args }); return { data, error: null }; },
  };
  return calls;
}

function failWith(errorOrFactory) {
  globalThis.__adminTestClient = {
    rpc: async () => {
      if (typeof errorOrFactory === 'function') throw errorOrFactory();
      return { data: null, error: errorOrFactory };
    },
  };
}

async function expectError(promise, kind, message) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof AdminApiError, `expected AdminApiError, got ${error}`);
    assert.equal(error.kind, kind);
    if (message instanceof RegExp) assert.match(error.message, message);
    else if (message) assert.equal(error.message, message);
    return true;
  });
}

/* ------------------------------------------------------- RPC name/args */

test('getOverview calls admin_overview and returns role counts', async () => {
  const calls = capture({ accounts: 3, activeDoctors: 1, patients: 1, pendingApplications: 0, unassignedPatients: 0, suspendedAccounts: 0, roleCounts: { admin: 1, doctor: 1, patient: 1 }, recentActivity: [] });
  const overview = await adminApi.getOverview();
  assert.equal(overview.accounts, 3);
  assert.deepEqual(overview.roleCounts, { admin: 1, doctor: 1, patient: 1 });
  assert.deepEqual(calls, [{ fn: 'admin_overview', args: {} }]);
});

test('an older overview payload without roleCounts still loads defensively', async () => {
  capture({ accounts: 2, activeDoctors: 1, patients: 1, pendingApplications: 0, unassignedPatients: 0, suspendedAccounts: 0, recentActivity: [] });
  const overview = await adminApi.getOverview();
  assert.equal(overview.roleCounts, undefined);
});

test('listAccounts sends exact p_* filters, limit and offset', async () => {
  const calls = capture({ rows: [], total: 0 });
  await adminApi.listAccounts({ search: '  Wong  ', role: 'doctor', status: 'active', limit: 10, offset: 20 });
  assert.deepEqual(calls[0], {
    fn: 'admin_list_accounts',
    args: { p_search: 'Wong', p_role: 'doctor', p_status: 'active', p_limit: 10, p_offset: 20 },
  });
});

test('listAccounts defaults absent filters to null and pagination to explicit numbers', async () => {
  const calls = capture({ rows: [], total: 0 });
  await adminApi.listAccounts();
  assert.deepEqual(calls[0].args, {
    p_search: null, p_role: null, p_status: null, p_limit: 25, p_offset: 0,
  });
});

test('listApplications sends status or null plus explicit paging', async () => {
  const calls = capture({ rows: [], total: 0 });
  await adminApi.listApplications({ status: 'pending', limit: 50, offset: 100 });
  await adminApi.listApplications({});
  assert.deepEqual(calls[0], {
    fn: 'admin_list_doctor_applications',
    args: { p_status: 'pending', p_limit: 50, p_offset: 100 },
  });
  assert.deepEqual(calls[1].args, { p_status: null, p_limit: 25, p_offset: 0 });
});

test('reviewApplication sends the reviewed decision and a trimmed note', async () => {
  const calls = capture({ id: 'u1' });
  await adminApi.reviewApplication({ userId: 'u1', decision: 'rejected', note: '  Incomplete registration  ' });
  assert.deepEqual(calls[0], {
    fn: 'admin_review_doctor_application',
    args: { p_user_id: 'u1', p_decision: 'rejected', p_note: 'Incomplete registration' },
  });
});

test('setAccountRole sends nulls for absent optional fields', async () => {
  const calls = capture({ id: 'u1' });
  await adminApi.setAccountRole({ userId: 'u1', role: 'patient' });
  assert.deepEqual(calls[0], {
    fn: 'admin_set_account_role',
    args: { p_user_id: 'u1', p_role: 'patient', p_registration_id: null, p_department: null, p_note: null },
  });
});

test('setAccountRole passes doctor registration, department and note', async () => {
  const calls = capture({ id: 'u1' });
  await adminApi.setAccountRole({ userId: 'u1', role: 'doctor', registrationId: ' MMC-1 ', department: ' Endocrinology ', note: ' Approved locally ' });
  assert.deepEqual(calls[0].args, {
    p_user_id: 'u1', p_role: 'doctor', p_registration_id: 'MMC-1', p_department: 'Endocrinology', p_note: 'Approved locally',
  });
});

test('setAccountStatus sends the account and target status', async () => {
  const calls = capture({ id: 'u1' });
  await adminApi.setAccountStatus({ userId: 'u1', status: 'suspended' });
  assert.deepEqual(calls[0], {
    fn: 'admin_set_account_status',
    args: { p_user_id: 'u1', p_status: 'suspended' },
  });
});

test('listPatientDirectory sends search, unassigned flag and paging', async () => {
  const calls = capture({ rows: [], total: 0 });
  await adminApi.listPatientDirectory({ search: ' Mei ', onlyUnassigned: true, limit: 25, offset: 50 });
  assert.deepEqual(calls[0], {
    fn: 'admin_list_patient_directory',
    args: { p_search: 'Mei', p_only_unassigned: true, p_limit: 25, p_offset: 50 },
  });
});

test('listAssignableDoctors takes no arguments', async () => {
  const calls = capture([]);
  await adminApi.listAssignableDoctors();
  assert.deepEqual(calls, [{ fn: 'admin_list_assignable_doctors', args: {} }]);
});

test('setPatientAssignment sends a null doctor when clearing', async () => {
  const calls = capture(null);
  const result = await adminApi.setPatientAssignment({ patientNumber: 'P-01', doctorId: null });
  assert.equal(result, null);
  assert.deepEqual(calls[0], {
    fn: 'admin_set_patient_assignment',
    args: { p_patient_number: 'P-01', p_doctor_id: null },
  });
});

test('listActivity maps the category filter and search', async () => {
  const calls = capture({ rows: [], total: 0 });
  await adminApi.listActivity({ category: 'assignments', search: '  Mei ', limit: 1000, offset: 0 });
  await adminApi.listActivity({});
  assert.deepEqual(calls[0], {
    fn: 'admin_list_activity',
    args: { p_category: 'assignments', p_search: 'Mei', p_limit: 1000, p_offset: 0 },
  });
  assert.deepEqual(calls[1].args, { p_category: null, p_search: null, p_limit: 25, p_offset: 0 });
});

test('the adminApi namespace exposes every documented operation', () => {
  for (const name of [
    'getOverview', 'listAccounts', 'listApplications', 'reviewApplication',
    'setAccountRole', 'setAccountStatus', 'listPatientDirectory',
    'listAssignableDoctors', 'setPatientAssignment', 'listActivity',
  ]) assert.equal(typeof adminApi[name], 'function', name);
});

/* --------------------------------------------------------- error mapping */

test('permission denied maps to a forbidden error', async () => {
  failWith({ code: '42501', message: 'permission denied for function admin_overview' });
  await expectError(adminApi.getOverview(), 'forbidden', 'Your account is not authorized for administration. Sign in with an Admin account.');
  failWith({ message: 'Admin access required' });
  await expectError(adminApi.getOverview(), 'forbidden', 'Your account is not authorized for administration. Sign in with an Admin account.');
});

test('expired or invalid sessions map to a session error', async () => {
  const message = 'Your session has expired. Please sign in again.';
  for (const error of [
    { code: 'PGRST301', message: 'JWT expired' },
    { code: 'PGRST301', message: 'invalid claim: missing sub claim' },
    { message: 'JWT expired', status: 401 },
    { message: 'invalid JWT' },
  ]) {
    failWith(error);
    await expectError(adminApi.getOverview(), 'session', message);
  }
});

test('a missing migration maps to a configuration error', async () => {
  const message = 'The admin database migration has not been applied. Ask the platform operator to run docs/supabase_admin_workspace.sql.';
  for (const error of [
    { code: 'PGRST202', message: 'Could not find the function public.admin_overview' },
    { message: 'Could not find the function admin_list_accounts in the schema cache' },
    { status: 404, message: 'Not found' },
    { code: '42P01', message: 'relation does not exist' },
  ]) {
    failWith(error);
    await expectError(adminApi.listAccounts(), 'configuration', message);
  }
});

test('network failures map to a retryable network error', async () => {
  failWith(() => new TypeError('Failed to fetch'));
  await assert.rejects(adminApi.getOverview(), (error) => {
    assert.ok(error instanceof AdminApiError);
    assert.equal(error.kind, 'network');
    assert.equal(error.retryable, true);
    return true;
  });
  failWith({ message: 'TypeError: Failed to fetch' });
  assert.equal(normalizeAdminError({ message: 'Failed to fetch' }).kind, 'network');
});

test('unknown failures keep the server message', async () => {
  failWith({ code: 'XX000', message: 'Unable to complete the change.' });
  await expectError(adminApi.setAccountStatus({ userId: 'u1', status: 'active' }), 'unknown', 'Unable to complete the change.');
});

test('an unconfigured client fails with a clear configuration error', async () => {
  globalThis.__adminTestClient = null;
  await expectError(adminApi.getOverview(), 'configuration', /Supabase is not configured/);
});

test('normalizeAdminError passes existing AdminApiError through unchanged', () => {
  const original = new AdminApiError('network', 'offline', true);
  assert.equal(normalizeAdminError(original), original);
});

/* ------------------------------------------------------------ CSV safety */

test('adminCsv escapes quotes and neutralises spreadsheet formulas', () => {
  const csv = adminCsv([
    ['Name', 'Note'],
    ['=cmd()', '+SUM(A1)'],
    ['-1', '@user'],
    ['  =trim', 'quoted "value"'],
    ['\tTab', 'normal'],
  ]);
  assert.ok(csv.startsWith('\uFEFF'), 'BOM for Excel');
  assert.equal(csv.split('\r\n').length, 5);
  assert.ok(csv.includes('"\'=cmd()"'));
  assert.ok(csv.includes('"\'+SUM(A1)"'));
  assert.ok(csv.includes('"\'-1"'));
  assert.ok(csv.includes('"\'@user"'));
  assert.ok(csv.includes('"\'  =trim"'));
  assert.ok(csv.includes('"\'\\tTab"') || csv.includes('"\'\tTab"'));
  assert.ok(csv.includes('quoted ""value""'), 'embedded quotes doubled');
});

/* ------------------------------------------------------------ validation */

test('a decline requires a reason of at least three characters', () => {
  for (const note of ['', '  ', 'no']) assert.ok(validateReviewNote('rejected', note));
  assert.equal(validateReviewNote('rejected', 'Incomplete registration'), null);
  assert.equal(validateReviewNote('approved', ''), null);
  assert.ok(validateReviewNote('approved', 'x'.repeat(601)));
});

test('doctor role changes require a registration number and department', () => {
  assert.ok(validateRoleChange({ role: 'doctor' }));
  assert.ok(validateRoleChange({ role: 'doctor', registrationId: 'MMC-1' }));
  assert.ok(validateRoleChange({ role: 'doctor', department: 'Endocrinology' }));
  assert.equal(validateRoleChange({ role: 'doctor', registrationId: 'MMC-1', department: 'Endocrinology' }), null);
  assert.equal(validateRoleChange({ role: 'admin' }), null);
  assert.ok(validateRoleChange({ role: 'superuser' }));
});

/* --------------------------------------------------------------- display */

test('formatAdminDate renders MYT values and never throws on missing dates', () => {
  assert.equal(formatAdminDate(null), '—');
  assert.equal(formatAdminDate(undefined), '—');
  assert.equal(formatAdminDate('not-a-date'), '—');
  const formatted = formatAdminDate('2026-10-01T00:00:00.000Z', true);
  assert.match(formatted, /Oct/);
  assert.match(formatted, /2026/);
  assert.match(formatted, /08:00|8:00/);
});
