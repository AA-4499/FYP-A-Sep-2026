import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// Compile the pure state module with the project's TypeScript version; no browser or network.
const source = readFileSync(new URL('../src/lib/adminDemo.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } });
const { createAdminDemo, applyAdminCommand, parseAdminState, adminCsv } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const now = '2026-10-22T04:00:00.000Z';
const apply = (state, command) => applyAdminCommand(state, command, now, `test-${state.events.length}`);

test('doctor approval updates the directory, assignment options, and activity together', () => {
  const initial = createAdminDemo();
  const approved = apply(initial, { type: 'review', id: 'doctor-03', decision: 'approved', note: 'Sample details reviewed' });
  const assigned = apply(approved, { type: 'assign', patientId: 'patient-04', doctorId: 'doctor-03' });
  assert.equal(initial.accounts.find((item) => item.id === 'doctor-03').status, 'pending');
  assert.equal(assigned.accounts.find((item) => item.id === 'doctor-03').status, 'active');
  assert.ok(assigned.assignments.some((item) => item.patientId === 'patient-04' && item.doctorId === 'doctor-03'));
  assert.equal(assigned.events[0].action, 'Patient assigned');
  assert.equal(assigned.events[1].action, 'Doctor approved');
});

test('new doctors require registration and enter the review queue', () => {
  const account = { name: '  Dr. New  ', email: ' NEW@EXAMPLE.COM ', role: 'doctor', department: 'Care' };
  assert.throws(() => apply(createAdminDemo(), { type: 'add', account }), /registration/);
  const next = apply(createAdminDemo(), { type: 'add', account: { ...account, registrationId: 'DEMO-10' } });
  assert.equal(next.accounts[0].name, 'Dr. New');
  assert.equal(next.accounts[0].email, 'new@example.com');
  assert.equal(next.accounts[0].status, 'pending');
});

test('duplicate emails are rejected regardless of case and whitespace', () => {
  assert.throws(() => apply(createAdminDemo(), { type: 'add', account: { name: 'Duplicate', email: ' PATIENT-01@EXAMPLE.COM ', role: 'patient', department: 'Care' } }), /already exists/);
});

test('a decline needs a reason and cannot be bypassed using account activation', () => {
  const initial = createAdminDemo();
  assert.throws(() => apply(initial, { type: 'review', id: 'doctor-03', decision: 'rejected', note: ' ' }), /reason/);
  const rejected = apply(initial, { type: 'review', id: 'doctor-03', decision: 'rejected', note: 'Incomplete application' });
  assert.equal(rejected.accounts.find((item) => item.id === 'doctor-03').reviewNote, 'Incomplete application');
  assert.throws(() => apply(rejected, { type: 'status', id: 'doctor-03', status: 'active' }), /review process/);
  assert.throws(() => apply(rejected, { type: 'review', id: 'doctor-03', decision: 'approved', note: '' }), /already been reviewed/);
});

test('assignments reject pending doctors, suspended doctors, and suspended patients', () => {
  const initial = createAdminDemo();
  for (const doctorId of ['doctor-03', 'doctor-05', 'admin-01', 'missing']) {
    assert.throws(() => apply(initial, { type: 'assign', patientId: 'patient-04', doctorId }), /approved doctor/);
  }
  assert.throws(() => apply(initial, { type: 'assign', patientId: 'patient-06', doctorId: 'doctor-01' }), /Activate/);
});

test('reassignment replaces the previous doctor and removal leaves the patient unassigned', () => {
  const next = apply(createAdminDemo(), { type: 'assign', patientId: 'patient-01', doctorId: 'doctor-02' });
  assert.deepEqual(next.assignments.filter((item) => item.patientId === 'patient-01'), [{ patientId: 'patient-01', doctorId: 'doctor-02' }]);
  const removed = apply(next, { type: 'assign', patientId: 'patient-01', doctorId: null });
  assert.equal(removed.assignments.some((item) => item.patientId === 'patient-01'), false);
  assert.throws(() => apply(removed, { type: 'assign', patientId: 'patient-01', doctorId: null }), /not changed/);
});

test('suspending a doctor removes their assignments without affecting other doctors', () => {
  const next = apply(createAdminDemo(), { type: 'status', id: 'doctor-01', status: 'suspended' });
  assert.equal(next.assignments.some((item) => item.doctorId === 'doctor-01'), false);
  assert.equal(next.assignments.filter((item) => item.doctorId === 'doctor-02').length, 1);
  assert.match(next.events[0].detail, /2 care assignment/);
  const active = apply(next, { type: 'status', id: 'doctor-01', status: 'active' });
  assert.equal(active.assignments.some((item) => item.doctorId === 'doctor-01'), false);
});

test('suspending a patient removes only that patient’s assignment', () => {
  const next = apply(createAdminDemo(), { type: 'status', id: 'patient-01', status: 'suspended' });
  assert.equal(next.assignments.length, 2);
  assert.equal(next.assignments.some((item) => item.patientId === 'patient-01'), false);
});

test('the last active administrator cannot be suspended', () => {
  assert.throws(() => apply(createAdminDemo(), { type: 'status', id: 'admin-01', status: 'suspended' }), /at least one active Admin/);
});

test('persisted state round-trips; corrupt, stale, and inconsistent records are rejected', () => {
  const state = createAdminDemo();
  assert.equal(JSON.stringify(parseAdminState(JSON.stringify(state))), JSON.stringify(state));
  for (const raw of ['null', '{}', '{broken', JSON.stringify({ ...state, version: 2 }), JSON.stringify({ ...state, accounts: [null] }), JSON.stringify({ ...state, assignments: [{ patientId: 'patient-01', doctorId: 'doctor-03' }] }), JSON.stringify({ ...state, events: [{ ...state.events[0], at: 'invalid' }] })]) {
    assert.throws(() => parseAdminState(raw));
  }
});

test('CSV export escapes quotes, preserves multiline fields, and neutralizes formulas', () => {
  const csv = adminCsv([['Name', 'Note'], ['A "quoted" name', 'line 1\nline 2'], ['=1+1', ' @SUM(1)']]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"A ""quoted"" name"'));
  assert.ok(csv.includes('"line 1\nline 2"'));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"\' @SUM(1)"'));
});
