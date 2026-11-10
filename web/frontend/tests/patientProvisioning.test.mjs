import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const sql = (name) => readFileSync(new URL(`../../../docs/${name}.sql`, import.meta.url), 'utf8');
const registration = sql('supabase_patient_registration');
const dashboard = sql('supabase_patient_dashboard');
const provisioning = sql('supabase_patient_auto_provision');
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

for (const existingSchema of [false, true]) {
test(`Patient provisioning and RLS work with ${existingSchema ? 'existing Supabase profiles' : 'basic profiles'}`, async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    grant usage on schema auth to anon, authenticated;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}', email_confirmed_at timestamptz);
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
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
    insert into patient_summary ("Patient Number", "Fasting Plasma Glucose (mg/dl)") values ('LEGACY-1', 123), ('PT-000001', 111);
    -- Deliberately permissive older policies must not bypass the new boundaries.
    grant all on patient_summary, patient_detail to anon, authenticated;
    create policy old_summary_access on patient_summary for all to anon, authenticated using (true) with check (true);
    create policy old_detail_access on patient_detail for all to anon, authenticated using (true) with check (true);
  `);
  if (existingSchema) await db.exec(`
    create type public.account_status as enum ('active');
    create table public.profiles (
      id uuid primary key references auth.users(id), full_name text,
      role text not null default 'patient', patient_id text,
      created_at timestamptz not null default now(), nric_passport_no text,
      status public.account_status not null default 'active', department text
    );
  `);
  await db.exec(registration);
  await db.exec(`
    create table public.doctor_applications (
      user_id uuid primary key references public.profiles(id), registration_id text,
      organisation text, status text not null default 'pending', review_note text,
      reviewed_at timestamptz, reviewed_by uuid references public.profiles(id),
      created_at timestamptz not null default now()
    );
    alter table doctor_applications enable row level security;
    grant all on doctor_applications to anon, authenticated;
    create policy old_application_access on doctor_applications for all
      to anon, authenticated using (true) with check (true);
  `);
  await db.exec(`grant all on profiles to anon, authenticated;
    create policy old_profile_access on profiles for all to anon, authenticated using (true) with check (true);`);
  const addUser = (n, metadata = {}, appMetadata = {}) => db.query('insert into auth.users (id, raw_user_meta_data, raw_app_meta_data) values ($1, $2, $3)', [id(n), JSON.stringify({ full_name: `Test ${n}`, ...metadata }), JSON.stringify(appMetadata)]);
  const profile = async (n) => (await db.query('select * from profiles where id=$1', [id(n)])).rows[0];
  const counts = async () => (await db.query('select (select count(*)::int from patient_summary) as records, (select count(*)::int from profiles) as profiles, (select count(*)::int from auth.users) as users')).rows[0];
  const asAccount = (n, action, appMetadata = {}) => db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: id(n), role: 'authenticated', app_metadata: appMetadata })]);
    await tx.exec('set local role authenticated');
    return action(tx);
  });
  await addUser(1);
  await addUser(2);
  await db.query("update profiles set patient_id='LEGACY-1' where id=$1", [id(2)]);
  await addUser(3, {}, { role: 'doctor' });
  await db.exec(dashboard);

  await t.test('backfill creates an empty linked record, skips existing numbers, and preserves existing links', async () => {
    await db.exec(provisioning);
    const first = await profile(1);
    assert.equal(first.patient_id, 'PT-000002');
    assert.equal((await profile(2)).patient_id, 'LEGACY-1');
    assert.equal((await profile(3)).patient_id, null);
    const row = (await db.query('select * from patient_summary where "Patient Number"=$1', [first.patient_id])).rows[0];
    for (const field of ['Age (years)', 'Fasting Plasma Glucose (mg/dl)', 'HbA1c (mmol/mol)', 'BMI (kg/m²)', 'Weight (kg)', 'Type of Diabetes']) assert.equal(row[field], null, field);
    assert.ok(row.created_at);
    assert.equal((await db.query('select count(*)::int as count from patient_detail')).rows[0].count, 0);
  });

  await t.test('signup assigns a new number and ignores caller-supplied roles and record links', async () => {
    await addUser(4, { patient_id: 'LEGACY-1', role: 'admin', requested_role: 'doctor', nric_passport_no: 'SYNTHETIC-ID' });
    const row = await profile(4);
    assert.equal(row.patient_id, 'PT-000003');
    assert.equal(row.role, 'patient');
    assert.equal(row.nric_passport_no, 'SYNTHETIC-ID');
  });

  await t.test('rerunning migrations does not change numbers or create orphan records', async () => {
    const before = await counts();
    await db.exec(provisioning);
    await db.exec(registration);
    await db.exec(dashboard);
    assert.deepEqual(await counts(), before);
    assert.equal((await profile(1)).patient_id, 'PT-000002');
    assert.equal((await profile(4)).patient_id, 'PT-000003');
    await addUser(5);
    assert.equal((await profile(5)).patient_id, 'PT-000004');
  });

  await t.test('each Patient sees only their own record through the RPC and direct tables', async () => {
    await db.query('insert into patient_detail ("Patient Number", "Date", "CGM (mg / dl)") values ($1, now(), 101), ($2, now(), 202)', [(await profile(1)).patient_id, (await profile(2)).patient_id]);
    for (const n of [1, 2, 4, 5]) {
      const own = await profile(n);
      await asAccount(n, async (tx) => {
        const rows = (await tx.query('select "Patient Number" from patient_summary')).rows;
        assert.deepEqual(rows.map((r) => r['Patient Number']), [own.patient_id]);
        const result = (await tx.query('select get_my_patient_dashboard() as data')).rows[0].data;
        assert.equal(result.profile.id, id(n));
        assert.equal(result.summary['Patient Number'], own.patient_id);
        const details = (await tx.query('select "Patient Number" from patient_detail')).rows;
        assert.equal(details.length, n === 1 || n === 2 ? 1 : 0);
        assert.ok(details.every((r) => r['Patient Number'] === own.patient_id));
        assert.equal(result.readings.length, details.length);
        assert.ok(result.readings.every((r) => r['Patient Number'] === own.patient_id));
      });
    }
  });

  await t.test('Patients cannot change ownership, write clinical values, or allocate numbers directly', async () => {
    await asAccount(1, async (tx) => {
      assert.equal((await tx.query("update profiles set patient_id='LEGACY-1' where id=$1 returning id", [id(1)])).rows.length, 0);
      assert.equal((await tx.query('update patient_summary set "Weight (kg)"=80 returning "Patient Number"')).rows.length, 0);
    });
    await assert.rejects(asAccount(1, (tx) => tx.query("select nextval('patient_number_seq')")), /permission denied/);
    await assert.rejects(asAccount(1, (tx) => tx.query('select provision_patient_record()')), /permission denied/);
    await assert.rejects(asAccount(1, (tx) => tx.query('insert into patient_summary ("Patient Number") values ($1)', ['FORGED'])), /row-level security/);
  });

  await t.test('ownership is unique and cannot point to a missing medical record', async () => {
    await assert.rejects(db.query("update profiles set patient_id='LEGACY-1' where id=$1", [id(1)]), /unique constraint/);
    await assert.rejects(db.query("update profiles set patient_id='MISSING' where id=$1", [id(1)]), /foreign key constraint/);
  });

  await t.test('anonymous reads are denied despite an older allow-all policy', async () => {
    await db.transaction(async (tx) => {
      await tx.exec('set local role anon');
      assert.equal((await tx.query('select * from patient_summary')).rows.length, 0);
    });
  });

  await t.test('trusted Doctors retain clinical read access and do not get Patient records', async () => {
    await addUser(6, {}, { role: 'doctor' });
    assert.equal((await profile(6)).patient_id, null);
    const result = await asAccount(6, (tx) => tx.query('select * from patient_summary'), { role: 'doctor' });
    assert.equal(result.rows.length, (await counts()).records);
  });

  await t.test('failed signup rolls back the Auth user, profile, and medical record together', async () => {
    const before = await counts();
    // Fail after the BEFORE INSERT trigger has provisioned a medical record.
    await db.exec("alter table profiles add constraint test_profile_failure check (full_name <> 'ROLLBACK-TEST')");
    await assert.rejects(addUser(7, { full_name: 'ROLLBACK-TEST' }), /check constraint/);
    assert.deepEqual(await counts(), before);
    await db.exec('alter table profiles drop constraint test_profile_failure');
  });

  await t.test('numbers expand beyond six digits without truncation', async () => {
    await db.query("select setval('patient_number_seq', 999999)");
    await addUser(8);
    assert.equal((await profile(8)).patient_id, 'PT-1000000');
  });

  await t.test('incompatible required clinical columns stop migration rather than fabricate data', async () => {
    await db.exec('alter table patient_summary add column required_measurement numeric not null default 1');
    await assert.rejects(db.exec(provisioning), /nullable clinical columns/);
    await db.exec('rollback');
    await db.exec('alter table patient_summary drop column required_measurement');
  });

  await t.test('Doctor applications stay private and pending until trusted approval', async () => {
    const migration = sql('supabase_doctor_registration');
    const schema = () => db.query("select table_name, column_name, data_type, udt_name, is_nullable, column_default from information_schema.columns where table_schema='public' order by table_name, ordinal_position");
    const schemaBefore = (await schema()).rows;
    let legacyApplication;
    if (existingSchema) {
      await db.query("insert into doctor_applications (user_id, status, review_note, reviewed_by, reviewed_at) values ($1, 'approved', 'Existing review', $1, now())", [id(3)]);
      legacyApplication = (await db.query('select * from doctor_applications where user_id=$1', [id(3)])).rows[0];
    }
    await db.exec(migration);
    assert.deepEqual((await schema()).rows, schemaBefore);
    const applicationColumns = (await db.query("select column_name from information_schema.columns where table_schema='public' and table_name='doctor_applications' order by ordinal_position")).rows.map((row) => row.column_name);
    assert.deepEqual(applicationColumns, ['user_id', 'registration_id', 'organisation', 'status', 'review_note', 'reviewed_at', 'reviewed_by', 'created_at']);
    const before = await counts();
    const details = { requested_role: 'doctor', organisation: 'Test Clinic', registration_id: '00123', role: 'admin', doctor_registration_status: 'approved' };
    await addUser(20, details);
    await addUser(21, details);
    assert.equal((await counts()).records, before.records);
    assert.equal((await profile(20)).patient_id, null);
    assert.equal((await profile(20)).role, 'patient');
    assert.equal((await profile(20)).full_name, 'Test 20');
    if (existingSchema) {
      assert.equal((await profile(20)).status, 'active');
      assert.equal((await profile(20)).department, null);
    }
    assert.deepEqual((await db.query('select registration_id, organisation, review_note, reviewed_by from doctor_applications where user_id=$1', [id(20)])).rows[0], {
      registration_id: '00123', organisation: 'Test Clinic', review_note: null, reviewed_by: null,
    });
    const metadata = async () => (await db.query('select raw_app_meta_data as data from auth.users where id=$1', [id(20)])).rows[0].data;
    assert.deepEqual(await metadata(), { role: 'patient', doctor_registration_status: 'pending' });
    await asAccount(20, async (tx) => {
      assert.deepEqual((await tx.query('select user_id, status from doctor_applications')).rows, [{ user_id: id(20), status: 'pending' }]);
      assert.equal((await tx.query('select * from patient_summary')).rows.length, 0);
      assert.equal((await tx.query('select * from patient_detail')).rows.length, 0);
    }, await metadata());
    const pendingDoctorClaim = { role: 'doctor', doctor_registration_status: 'pending' };
    assert.equal((await asAccount(20, (tx) => tx.query('select * from patient_summary'), pendingDoctorClaim)).rows.length, 0);
    await assert.rejects(asAccount(20, (tx) => tx.query("update doctor_applications set status='approved'")), /permission denied/);
    await assert.rejects(asAccount(20, (tx) => tx.query('select approve_doctor_application($1)', [id(20)])), /permission denied/);
    await assert.rejects(db.query('select approve_doctor_application($1)', [id(20)]), /confirm their email/);
    await db.query("update auth.users set raw_user_meta_data = raw_user_meta_data || '{\"role\":\"doctor\",\"doctor_registration_status\":\"approved\",\"organisation\":\"Changed\"}'::jsonb where id=$1", [id(20)]);
    assert.equal((await metadata()).doctor_registration_status, 'pending');
    assert.equal((await db.query('select organisation from doctor_applications where user_id=$1', [id(20)])).rows[0].organisation, 'Test Clinic');
    await db.query('update auth.users set email_confirmed_at=now() where id=$1', [id(20)]);
    await db.query("update doctor_applications set review_note='Verified credentials', reviewed_by=$1 where user_id=$2", [id(3), id(20)]);
    await db.query('select approve_doctor_application($1)', [id(20)]);
    assert.equal((await profile(20)).role, 'doctor');
    assert.equal((await profile(20)).patient_id, null);
    assert.deepEqual(await metadata(), { role: 'doctor', doctor_registration_status: 'approved' });
    assert.ok((await db.query('select reviewed_at from doctor_applications where user_id=$1', [id(20)])).rows[0].reviewed_at);
    assert.deepEqual((await db.query('select review_note, reviewed_by from doctor_applications where user_id=$1', [id(20)])).rows[0], { review_note: 'Verified credentials', reviewed_by: id(3) });
    assert.equal((await asAccount(20, (tx) => tx.query('select * from patient_summary'), await metadata())).rows.length, before.records);
    await assert.rejects(db.query('select approve_doctor_application($1)', [id(20)]), /No pending/);
    await db.exec(migration);
    if (existingSchema) assert.deepEqual((await db.query('select * from doctor_applications where user_id=$1', [id(3)])).rows[0], legacyApplication);
    await db.exec(provisioning);
    assert.equal((await profile(21)).patient_id, null);
    assert.equal((await counts()).records, before.records);
    const after = await counts();
    for (const invalid of [
      { requested_role: 'doctor' },
      { ...details, full_name: ' ' },
      { ...details, organisation: 'X'.repeat(201) },
      { ...details, registration_id: ' ' },
      { ...details, registration_id: 'X'.repeat(65) },
      { ...details, registration_id: 'AB\n123' },
    ]) await assert.rejects(addUser(22, invalid), /valid Doctor name/);
    assert.deepEqual(await counts(), after);
    await addUser(23, { requested_role: 'patient', nric_passport_no: 'TEST-23' });
    assert.ok((await profile(23)).patient_id);
    assert.equal((await counts()).records, before.records + 1);
    // An already-open form from the previous build can still finish registering.
    await addUser(24, { requested_role: 'doctor', organisation: 'Legacy Form Clinic', professional_registration_number: 'OLD-001' });
    assert.equal((await db.query('select registration_id from doctor_applications where user_id=$1', [id(24)])).rows[0].registration_id, 'OLD-001');
    assert.equal((await profile(24)).patient_id, null);
    // The standalone repair also works where table SELECT is unavailable.
    await db.exec(sql('supabase_doctor_application_status'));
    await db.exec('revoke select on doctor_applications from authenticated');
    await assert.rejects(asAccount(21, (tx) => tx.query('select status from doctor_applications')), /permission denied/);
    for (const n of [21, 24]) {
      const result = await asAccount(n, (tx) => tx.query('select get_my_doctor_application_status() as application'));
      assert.deepEqual(result.rows[0].application, { user_id: id(n), status: 'pending' });
    }
    assert.equal((await asAccount(1, (tx) => tx.query('select get_my_doctor_application_status() as application'))).rows[0].application, null);
    await assert.rejects(db.transaction(async (tx) => {
      await tx.exec('set local role anon');
      await tx.query('select get_my_doctor_application_status()');
    }), /permission denied/);
    await db.exec('grant select on doctor_applications to authenticated');
  });
});
}
