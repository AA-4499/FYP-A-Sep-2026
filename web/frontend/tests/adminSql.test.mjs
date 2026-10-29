import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const sql = (name) => readFileSync(new URL(`../../../docs/${name}.sql`, import.meta.url), 'utf8');
const phase2 = sql('supabase_phase2');
const registration = sql('supabase_patient_registration');
const provisioning = sql('supabase_patient_auto_provision');
const dashboard = sql('supabase_patient_dashboard');
const admin = sql('supabase_admin_workspace');
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// PGlite decodes json/jsonb columns to JS values; be tolerant of string decoding.
const asJson = (value) => (typeof value === 'string' ? JSON.parse(value) : value);

const ACCOUNT_KEYS = [
  'id', 'email', 'full_name', 'role', 'status', 'department', 'registration_id',
  'joined_at', 'last_sign_in_at', 'email_confirmed', 'patient_id',
  'doctor_application_status', 'assignment_count',
];

test('Admin workspace migration and RPC contract hold in an isolated PostgreSQL database', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());

  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    grant usage on schema auth to anon, authenticated;
    create table auth.users (
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb default '{}',
      raw_app_meta_data jsonb default '{}',
      email_confirmed_at timestamptz,
      banned_until timestamptz,
      last_sign_in_at timestamptz
    );
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
    $$;
    create function auth.uid() returns uuid language sql stable as $$
      select (auth.jwt()->>'sub')::uuid
    $$;
    create table public.patient_summary (
      "Patient Number" text primary key,
      "Age (years)" integer,
      "Fasting Plasma Glucose (mg/dl)" numeric default 99,
      "HbA1c (mmol/mol)" numeric,
      "BMI (kg/m²)" numeric,
      "Weight (kg)" numeric,
      "Type of Diabetes" text,
      created_at timestamptz not null default now()
    );
    create table public.patient_detail (
      id bigint generated always as identity primary key,
      "Patient Number" text references patient_summary("Patient Number"),
      "Date" timestamptz, "CGM (mg / dl)" numeric, "CBG (mg / dl)" numeric
    );
    -- Deliberately permissive older policies must not bypass the new boundaries.
    grant all on patient_summary, patient_detail to anon, authenticated;
    create policy old_summary_access on patient_summary for all to anon, authenticated using (true) with check (true);
    create policy old_detail_access on patient_detail for all to anon, authenticated using (true) with check (true);
  `);

  // Apply the deployed migration chain in order, then the admin migration twice.
  await db.exec(phase2);
  await db.exec(registration);
  await db.exec(provisioning);
  await db.exec(dashboard);
  await db.exec(admin);
  await db.exec(admin);

  // Supabase default privileges grant the client roles access to public tables;
  // ACLs still gate execution because RLS policies decide which rows are visible.
  await db.exec('grant all on public.clinician_patient_assignments to anon, authenticated');

  const addUser = (n, metadata = {}, appMetadata = {}, options = {}) => db.query(
    `insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at, last_sign_in_at)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      id(n),
      options.email ?? `user${n}@example.com`,
      JSON.stringify({ full_name: `Test ${n}`, ...metadata }),
      JSON.stringify(appMetadata),
      options.confirmed === false ? null : '2026-01-02T03:04:05Z',
      '2026-02-03T04:05:06Z',
    ],
  );
  const profile = async (n) => (await db.query('select * from profiles where id=$1', [id(n)])).rows[0];

  const asAccount = (n, action, appMetadata = {}) => db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: id(n), role: 'authenticated', app_metadata: appMetadata }),
    ]);
    await tx.exec('set local role authenticated');
    return action(tx);
  });
  const asAdmin = (action) => asAccount(1, action, { role: 'admin' });
  const asAnon = (action) => db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', '{}', true)");
    await tx.exec('set local role anon');
    return action(tx);
  });
  const adminCall = (statement, params = []) => asAdmin(async (tx) => {
    const result = await tx.query(statement, params);
    return asJson(result.rows[0].data);
  });
  const auditCount = async (action, subjectUserId = null) => (await db.query(
    'select count(*)::int as count from admin_audit_logs where action=$1 and ($2::uuid is null or subject_user_id=$2)',
    [action, subjectUserId],
  )).rows[0].count;

  // Seed: one admin, two patients (each automatically provisioned a Patient record).
  await addUser(1, { full_name: 'Ada Admin' }, { role: 'admin' }, { email: 'ada@example.com' });
  await db.query("update profiles set role='admin' where id=$1", [id(1)]);
  await addUser(2, { full_name: 'Grace Patient' }, {}, { email: 'grace@example.com' });
  await addUser(3, { full_name: 'Sam Patient' }, {}, { email: 'sam@example.com' });
  await db.query("update profiles set nric_passport_no='SYNTHETIC-NRIC' where id=$1", [id(2)]);

  await t.test('admin RPCs reject non-admins and are not executable by anonymous clients', async () => {
    await assert.rejects(
      asAccount(2, (tx) => tx.query('select admin_overview()')),
      /Admin access required/,
    );
    await assert.rejects(
      asAccount(2, (tx) => tx.query('select admin_list_accounts()')),
      /Admin access required/,
    );
    await assert.rejects(
      asAnon((tx) => tx.query('select admin_overview()')),
      /permission denied/,
    );
    await assert.rejects(
      asAnon((tx) => tx.query('select get_my_access_state()')),
      /permission denied/,
    );
  });

  await t.test('admin overview and account directory expose the documented shape without NRIC', async () => {
    const overview = await adminCall('select admin_overview() as data');
    assert.equal(overview.accounts, 3);
    assert.equal(overview.activeDoctors, 0);
    assert.equal(overview.patients, 2);
    assert.equal(overview.pendingApplications, 0);
    assert.equal(overview.unassignedPatients, 2);
    assert.equal(overview.suspendedAccounts, 0);
    assert.deepEqual(overview.recentActivity, []);

    const accounts = await adminCall('select admin_list_accounts() as data');
    assert.equal(accounts.total, 3);
    assert.equal(accounts.rows.length, 3);
    for (const row of accounts.rows) {
      assert.deepEqual(Object.keys(row).sort(), [...ACCOUNT_KEYS].sort());
      assert.ok(row.email, 'email is returned');
    }
    const adminRow = accounts.rows.find((row) => row.id === id(1));
    assert.equal(adminRow.email, 'ada@example.com');
    assert.equal(adminRow.role, 'admin');
    assert.equal(adminRow.status, 'active');
    assert.equal(adminRow.email_confirmed, true);
    assert.ok(adminRow.last_sign_in_at);
    assert.ok(!JSON.stringify(accounts).includes('SYNTHETIC-NRIC'), 'NRIC must never be returned');

    const searched = await adminCall('select admin_list_accounts($1) as data', ['Grace']);
    assert.equal(searched.total, 1);
    assert.equal(searched.rows[0].full_name, 'Grace Patient');

    const doctorsOnly = await adminCall('select admin_list_accounts($1, $2) as data', [null, 'admin']);
    assert.equal(doctorsOnly.total, 1);
    assert.equal(doctorsOnly.rows[0].role, 'admin');

    const suspendedOnly = await adminCall('select admin_list_accounts($1, $2, $3) as data', [null, null, 'suspended']);
    assert.equal(suspendedOnly.total, 0);

    const firstPage = await adminCall('select admin_list_accounts(null, null, null, $1, $2) as data', [2, 0]);
    const secondPage = await adminCall('select admin_list_accounts(null, null, null, $1, $2) as data', [2, 2]);
    assert.equal(firstPage.total, 3);
    assert.equal(firstPage.rows.length, 2);
    assert.equal(secondPage.rows.length, 1);
    assert.notDeepEqual(
      firstPage.rows.map((row) => row.id),
      [secondPage.rows[0].id, secondPage.rows[0].id],
    );
  });

  await t.test('doctor applicants get a pending application, no Patient record, and a review contract', async () => {
    await addUser(10, {
      full_name: 'Dr Wendy Applicant',
      requested_role: 'doctor',
      registration_id: 'REG-100',
      organisation: 'Endocrinology',
    }, {}, { email: 'wendy@example.com', confirmed: false });

    const applicantProfile = await profile(10);
    assert.equal(applicantProfile.role, 'patient');
    assert.equal(applicantProfile.patient_id, null, 'applicants must not receive a Patient record');

    const application = (await db.query('select * from doctor_applications where user_id=$1', [id(10)])).rows[0];
    assert.equal(application.status, 'pending');
    assert.equal(application.registration_id, 'REG-100');
    assert.equal(application.organisation, 'Endocrinology');

    const access = await asAccount(10, async (tx) => asJson(
      (await tx.query('select get_my_access_state() as data')).rows[0].data,
    ));
    assert.equal(access.role, 'patient');
    assert.equal(access.full_name, 'Dr Wendy Applicant');
    assert.equal(access.application.status, 'pending');

    const pendingList = await adminCall('select admin_list_doctor_applications() as data');
    assert.equal(pendingList.total, 1);
    assert.deepEqual(Object.keys(pendingList.rows[0]).sort(), [
      'applied_at', 'email', 'email_confirmed', 'full_name', 'organisation',
      'registration_id', 'review_note', 'reviewed_at', 'status', 'user_id',
    ].sort());
    assert.equal(pendingList.rows[0].email_confirmed, false);

    // Approval requires a confirmed email address.
    await assert.rejects(
      adminCall("select admin_review_doctor_application($1, 'approved') as data", [id(10)]),
      /confirm their email/,
    );
    await db.query('update auth.users set email_confirmed_at=now() where id=$1', [id(10)]);

    const approved = await adminCall("select admin_review_doctor_application($1, 'approved') as data", [id(10)]);
    assert.equal(approved.role, 'doctor');
    assert.equal(approved.department, 'Endocrinology');
    assert.equal(approved.registration_id, 'REG-100');
    assert.equal(approved.doctor_application_status, 'approved');

    const approvedProfile = await profile(10);
    assert.equal(approvedProfile.role, 'doctor');
    assert.equal(approvedProfile.patient_id, null);
    const approvedApplication = (await db.query('select * from doctor_applications where user_id=$1', [id(10)])).rows[0];
    assert.equal(approvedApplication.status, 'approved');
    assert.equal(approvedApplication.reviewed_by, id(1));
    assert.ok(approvedApplication.reviewed_at);
    const appMetadata = await db.query('select raw_app_meta_data from auth.users where id=$1', [id(10)]);
    assert.equal(asJson(appMetadata.rows[0].raw_app_meta_data).role, 'doctor');
    assert.equal(await auditCount('Doctor application approved', id(10)), 1);

    // Rejection requires a note of at least three characters and leaves the role alone.
    await addUser(11, {
      full_name: 'Dr Rejected Applicant',
      requested_role: 'doctor',
      registration_id: 'REG-101',
      organisation: 'Clinic B',
    }, {}, { email: 'rejected@example.com' });
    await assert.rejects(
      adminCall("select admin_review_doctor_application($1, 'rejected', $2) as data", [id(11), 'no']),
      /at least 3 characters/,
    );
    const rejected = await adminCall("select admin_review_doctor_application($1, 'rejected', $2) as data", [id(11), 'Documents incomplete']);
    assert.equal(rejected.role, 'patient');
    assert.equal(rejected.doctor_application_status, 'rejected');
    assert.equal((await profile(11)).role, 'patient');
    const rejectedApplication = (await db.query('select * from doctor_applications where user_id=$1', [id(11)])).rows[0];
    assert.equal(rejectedApplication.review_note, 'Documents incomplete');
    assert.equal(rejectedApplication.status, 'rejected');
    assert.equal(await auditCount('Doctor application rejected', id(11)), 1);
    const rejectedAccess = await asAccount(11, async (tx) => asJson(
      (await tx.query('select get_my_access_state() as data')).rows[0].data,
    ));
    assert.equal(rejectedAccess.application.status, 'rejected');
    assert.equal(rejectedAccess.application.review_note, 'Documents incomplete');

    // Approval without a registration number is refused.
    await addUser(12, {
      full_name: 'Dr No Registration',
      requested_role: 'doctor',
      organisation: 'Clinic C',
    }, {}, { email: 'noreg@example.com' });
    await assert.rejects(
      adminCall("select admin_review_doctor_application($1, 'approved') as data", [id(12)]),
      /registration number/,
    );
    // A reviewed application cannot be reviewed twice.
    await assert.rejects(
      adminCall("select admin_review_doctor_application($1, 'approved') as data", [id(10)]),
      /already been reviewed/,
    );
  });

  await t.test('last active admin is protected; suspension bans and removes assignments', async () => {
    await assert.rejects(
      adminCall("select admin_set_account_status($1, 'suspended') as data", [id(1)]),
      /only active admin/,
    );
    await assert.rejects(
      adminCall("select admin_set_account_role($1, 'patient') as data", [id(1)]),
      /only active admin/,
    );

    await adminCall('select admin_set_patient_assignment($1, $2) as data', ['PT-000001', id(10)]);
    assert.equal(
      (await db.query('select count(*)::int as count from clinician_patient_assignments where clinician_id=$1', [id(10)])).rows[0].count,
      1,
    );

    const suspended = await adminCall("select admin_set_account_status($1, 'suspended') as data", [id(10)]);
    assert.equal(suspended.status, 'suspended');
    const banned = (await db.query('select banned_until from auth.users where id=$1', [id(10)])).rows[0].banned_until;
    assert.ok(banned, 'suspended accounts are banned in Auth');
    assert.equal(
      (await db.query('select count(*)::int as count from clinician_patient_assignments where clinician_id=$1', [id(10)])).rows[0].count,
      0,
      'suspension removes clinician assignments',
    );

    const reactivated = await adminCall("select admin_set_account_status($1, 'active') as data", [id(10)]);
    assert.equal(reactivated.status, 'active');
    assert.equal((await db.query('select banned_until from auth.users where id=$1', [id(10)])).rows[0].banned_until, null);
    assert.equal(await auditCount('Account suspended', id(10)), 1);
    assert.equal(await auditCount('Account reactivated', id(10)), 1);
  });

  await t.test('patient assignment validates accounts, replaces atomically, and is unique per patient', async () => {
    await assert.rejects(
      adminCall('select admin_set_patient_assignment($1, $2) as data', ['PT-999999', id(10)]),
      /Patient not found/,
    );
    await assert.rejects(
      adminCall('select admin_set_patient_assignment($1, $2) as data', ['PT-000001', id(2)]),
      /active, approved doctor/,
    );

    // A suspended doctor cannot be assigned.
    await adminCall("select admin_set_account_status($1, 'suspended') as data", [id(10)]);
    await assert.rejects(
      adminCall('select admin_set_patient_assignment($1, $2) as data', ['PT-000001', id(10)]),
      /active, approved doctor/,
    );
    await adminCall("select admin_set_account_status($1, 'active') as data", [id(10)]);

    // Promote a verified applicant through admin_set_account_role.
    await addUser(14, {
      full_name: 'Dr Omar Promoted',
      requested_role: 'doctor',
      registration_id: 'REG-114',
      organisation: 'Primary care',
    }, {}, { email: 'omar@example.com' });
    await db.query('update auth.users set email_confirmed_at=now() where id=$1', [id(14)]);
    const promoted = await adminCall(
      'select admin_set_account_role($1, $2, $3, $4) as data',
      [id(14), 'doctor', 'REG-114', 'Primary care'],
    );
    assert.equal(promoted.role, 'doctor');
    assert.equal(promoted.department, 'Primary care');
    assert.equal(promoted.registration_id, 'REG-114');
    assert.equal(promoted.doctor_application_status, 'approved');
    assert.equal(asJson((await db.query('select raw_app_meta_data from auth.users where id=$1', [id(14)])).rows[0].raw_app_meta_data).role, 'doctor');

    const assigned = await adminCall('select admin_set_patient_assignment($1, $2) as data', ['PT-000001', id(10)]);
    assert.equal(assigned.patient_number, 'PT-000001');
    assert.equal(assigned.assigned_doctor_id, id(10));

    const replaced = await adminCall('select admin_set_patient_assignment($1, $2) as data', ['PT-000001', id(14)]);
    assert.equal(replaced.assigned_doctor_id, id(14));
    const patientRows = (await db.query("select * from clinician_patient_assignments where patient_id='PT-000001'")).rows;
    assert.equal(patientRows.length, 1);
    assert.equal(patientRows[0].clinician_id, id(14));

    // The unique index enforces a single doctor per patient even outside the RPC.
    await db.query('insert into clinician_patient_assignments (clinician_id, patient_id) values ($1, $2)', [id(10), 'PT-000002']);
    await assert.rejects(
      db.query('insert into clinician_patient_assignments (clinician_id, patient_id) values ($1, $2)', [id(14), 'PT-000002']),
      /unique/,
    );
    await db.query("delete from clinician_patient_assignments where patient_id='PT-000002'");

    const cleared = await adminCall('select admin_set_patient_assignment($1, $2) as data', ['PT-000001', null]);
    assert.equal(cleared, null);
    assert.equal(
      (await db.query("select count(*)::int as count from clinician_patient_assignments where patient_id='PT-000001'")).rows[0].count,
      0,
    );
    assert.ok(await auditCount('Patient assigned') >= 2);
    assert.ok(await auditCount('Patient unassigned') >= 1);
  });

  await t.test('RLS scopes clinical reads to the assigned or owned record and to active accounts', async () => {
    await adminCall('select admin_set_patient_assignment($1, $2) as data', ['PT-000001', id(10)]);

    const doctorRows = await asAccount(
      10,
      (tx) => tx.query('select "Patient Number" from patient_summary'),
      { role: 'doctor' },
    ).catch((error) => { throw new Error(`doctor read: ${error.message}`); });
    assert.deepEqual(doctorRows.rows.map((row) => row['Patient Number']), ['PT-000001']);

    const adminRows = await asAccount(1, (tx) => tx.query('select "Patient Number" from patient_summary'), { role: 'admin' })
      .catch((error) => { throw new Error(`admin read: ${error.message}`); });
    assert.equal(adminRows.rows.length, 2);

    const patientRows = await asAccount(2, (tx) => tx.query('select "Patient Number" from patient_summary'))
      .catch((error) => { throw new Error(`patient read: ${error.message}`); });
    assert.deepEqual(patientRows.rows.map((row) => row['Patient Number']), ['PT-000001']);

    // Suspending the patient ends clinical reads and the dashboard.
    await adminCall("select admin_set_account_status($1, 'suspended') as data", [id(3)]);
    const suspendedRows = await asAccount(3, (tx) => tx.query('select "Patient Number" from patient_summary'))
      .catch((error) => { throw new Error(`suspended read: ${error.message}`); });
    assert.equal(suspendedRows.rows.length, 0);
    const dashboardResult = await asAccount(3, async (tx) => asJson(
      (await tx.query('select get_my_patient_dashboard() as data')).rows[0].data,
    )).catch((error) => { throw new Error(`suspended dashboard: ${error.message}`); });
    assert.equal(dashboardResult, null);

    const anonRows = await asAnon((tx) => tx.query('select "Patient Number" from patient_summary'))
      .catch((error) => { throw new Error(`anon read: ${error.message}`); });
    assert.equal(anonRows.rows.length, 0);
  });

  await t.test('suspended patients receive an empty dashboard while active patients keep theirs', async () => {
    const activeDashboard = await asAccount(2, async (tx) => asJson(
      (await tx.query('select get_my_patient_dashboard() as data')).rows[0].data,
    ));
    assert.equal(activeDashboard.profile.id, id(2));
    assert.equal(activeDashboard.summary['Patient Number'], 'PT-000001');
    const suspendedDashboard = await asAccount(3, async (tx) => asJson(
      (await tx.query('select get_my_patient_dashboard() as data')).rows[0].data,
    ));
    assert.equal(suspendedDashboard, null);
  });

  await t.test('the full migration chain reapplies cleanly after the admin migration', async () => {
    await db.exec(registration);
    await db.exec(provisioning);
    await db.exec(dashboard);
    await db.exec(admin);

    const overview = await adminCall('select admin_overview() as data');
    assert.ok(overview.accounts >= 3);
    assert.ok(Array.isArray(overview.recentActivity));

    // The admin migration restored the stricter read policies.
    const stillSuspended = await asAccount(3, (tx) => tx.query('select "Patient Number" from patient_summary'));
    assert.equal(stillSuspended.rows.length, 0);

    // And rerunning the admin migration one more time remains safe.
    await db.exec(admin);
    const afterRerun = await adminCall('select admin_overview() as data');
    assert.equal(typeof afterRerun.accounts, 'number');
  });
});
