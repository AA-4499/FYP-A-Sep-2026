import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const sql = (name) => readFileSync(new URL(`../../../docs/${name}.sql`, import.meta.url), 'utf8');
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('Invitation migration enforces administrator-only doctor onboarding', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    grant usage on schema auth to anon, authenticated;
    create table auth.users (
      id uuid primary key, email text unique, raw_user_meta_data jsonb default '{}',
      raw_app_meta_data jsonb default '{}', email_confirmed_at timestamptz,
      banned_until timestamptz, last_sign_in_at timestamptz
    );
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
    $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    create table public.patient_summary (
      "Patient Number" text primary key, "Age (years)" integer,
      "Fasting Plasma Glucose (mg/dl)" numeric, "HbA1c (mmol/mol)" numeric,
      "BMI (kg/m²)" numeric, "Weight (kg)" numeric, "Type of Diabetes" text,
      created_at timestamptz default now()
    );
    create table public.patient_detail (
      id bigint generated always as identity primary key,
      "Patient Number" text references patient_summary("Patient Number"),
      "Date" timestamptz, "CGM (mg / dl)" numeric, "CBG (mg / dl)" numeric
    );
  `);
  for (const migration of ['supabase_phase2', 'supabase_patient_registration', 'supabase_patient_auto_provision',
    'supabase_patient_dashboard', 'supabase_admin_workspace', 'supabase_doctor_invitations', 'supabase_doctor_invitations']) {
    await db.exec(sql(migration));
  }
  const add = (n, metadata = {}, email = `user${n}@example.com`) => db.query(
    'insert into auth.users(id, email, raw_user_meta_data) values ($1,$2,$3)', [id(n), email, JSON.stringify(metadata)]);
  await add(1);
  await db.query("update profiles set role='admin' where id=$1", [id(1)]);
  await add(2);
  const asUser = (n, callback, role = 'authenticated') => db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: id(n), app_metadata: { role: 'admin' } })]);
    await tx.exec(`set local role ${role}`);
    return callback(tx);
  });
  const prepare = (n = 1, email = 'doctor@example.com', values = ['Dr Test', 'Clinic', 'Diabetes', 'MMC-123']) =>
    asUser(n, async (tx) => (await tx.query('select admin_prepare_doctor_invitation($1,$2,$3,$4,$5) as result', [email, ...values])).rows[0].result.token);

  await t.test('public and suspended or demoted admins cannot reserve invitations', async () => {
    await assert.rejects(prepare(2), /Active admin access required/);
    await assert.rejects(asUser(1, (tx) => tx.query("select admin_prepare_doctor_invitation('d@e.com','D','C','D','R')"), 'anon'), /permission denied/);
    await db.query("update profiles set status='suspended' where id=$1", [id(1)]);
    await assert.rejects(prepare(), /Active admin access required/);
    await db.query("update profiles set status='active' where id=$1", [id(1)]);
    await assert.rejects(asUser(1, (tx) => tx.query('select * from doctor_invitations')), /permission denied/);
  });
  await t.test('validates complete doctor information and duplicate emails', async () => {
    for (const values of [['', 'C', 'D', 'R'], ['D', '', 'D', 'R'], ['D', 'C', '', 'R'], ['D', 'C', 'D', ''], ['D', 'C', 'D', 'A'.repeat(121)]]) {
      await assert.rejects(prepare(1, 'doctor@example.com', values), /Complete all doctor information/);
    }
    await assert.rejects(prepare(1, 'bad-address'), /Complete all doctor information/);
    await assert.rejects(prepare(1, 'USER2@example.com'), /already exists/);
  });
  await t.test('self-registration and generic promotions cannot create doctors', async () => {
    for (const metadata of [{ requested_role: 'doctor' }, { requested_role: 'clinician' }, { doctor_invitation_token: id(99) }]) {
      await assert.rejects(add(3, metadata), /invitation/i);
    }
    await assert.rejects(asUser(1, (tx) => tx.query("select admin_set_account_role($1,'doctor','MMC','Clinic')", [id(2)])), /invitation/i);
    await assert.rejects(asUser(1, (tx) => tx.query("select admin_review_doctor_application($1,'approved')", [id(2)])), /invitation/i);
    await add(4, { role: 'admin' });
    assert.equal((await db.query('select role from profiles where id=$1', [id(4)])).rows[0].role, 'patient');
  });
  await t.test('invitation binds email, rejects stale admins and expires unused reservations', async () => {
    const token = await prepare();
    await assert.rejects(add(3, { doctor_invitation_token: token }, 'wrong@example.com'), /valid administrator invitation/);
    await assert.rejects(add(3, {}, 'doctor@example.com'), /reserved/);
    await db.query("update profiles set status='suspended' where id=$1", [id(1)]);
    await assert.rejects(add(3, { doctor_invitation_token: token }, 'doctor@example.com'), /Active admin access required/);
    await db.query("update profiles set status='active', role='patient' where id=$1", [id(1)]);
    await assert.rejects(add(3, { doctor_invitation_token: token }, 'doctor@example.com'), /Active admin access required/);
    await db.query("update profiles set role='admin' where id=$1", [id(1)]);
    await db.exec("update doctor_invitations set expires_at = now() - interval '1 second'");
    await assert.rejects(add(3, { doctor_invitation_token: token }, 'doctor@example.com'), /valid administrator invitation/);
  });
  await t.test('successful invite creates a doctor without patient data and records the administrator', async () => {
    const before = (await db.query('select count(*)::int as n from patient_summary')).rows[0].n;
    const token = await prepare();
    await add(3, { doctor_invitation_token: token, full_name: 'Tampered name', role: 'admin' }, 'doctor@example.com');
    const profile = (await db.query('select * from profiles where id=$1', [id(3)])).rows[0];
    assert.equal(profile.role, 'doctor');
    assert.equal(profile.status, 'active');
    assert.equal(profile.full_name, 'Dr Test');
    assert.equal(profile.department, 'Diabetes');
    assert.equal(profile.patient_id, null);
    assert.equal((await db.query('select count(*)::int as n from patient_summary')).rows[0].n, before);
    const user = (await db.query('select * from auth.users where id=$1', [id(3)])).rows[0];
    assert.equal(user.raw_app_meta_data.role, 'doctor');
    assert.equal(user.raw_user_meta_data.doctor_invitation_token, undefined);
    const application = (await db.query('select * from doctor_applications where user_id=$1', [id(3)])).rows[0];
    assert.equal(application.registration_id, 'MMC-123');
    assert.equal(application.organisation, 'Clinic');
    assert.equal(application.reviewed_by, id(1));
    const audit = (await db.query("select * from admin_audit_logs where action='Doctor invited'")).rows;
    assert.equal(audit.length, 1);
    assert.equal(audit[0].actor_id, id(1));
    await assert.rejects(add(5, { doctor_invitation_token: token }, 'doctor@example.com'), /valid administrator invitation/);
    await assert.rejects(prepare(), /already exists/);
  });
});
