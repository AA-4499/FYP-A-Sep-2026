import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/patientDashboard.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } });
const { loadPatientDashboard, measurement } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const unlinked = { profile: { id: 'user-a', full_name: 'Patient A', patient_id: null }, summary: null, readings: [] };
const linked = { ...unlinked, profile: { ...unlinked.profile, patient_id: 'record-a' }, summary: { 'Patient Number': 'record-a' }, readings: [{ 'Patient Number': 'record-a', 'CGM (mg / dl)': 111 }] };
const clientFor = (data, error = null) => ({ rpc: async () => ({ data, error }) });

test('dashboard requests the authenticated account without accepting a clinical record ID', async () => {
  let args;
  const client = { rpc: async (...values) => { args = values; return { data: linked, error: null }; } };
  assert.deepEqual(await loadPatientDashboard(client, 'user-a'), linked);
  assert.deepEqual(args, ['get_my_patient_dashboard']);
});

test('new accounts receive an empty dashboard, with no sample record', async () => {
  assert.deepEqual(await loadPatientDashboard(clientFor(unlinked), 'user-a'), unlinked);
});

test('another account profile or clinical record fails closed', async () => {
  for (const data of [
    { ...linked, profile: { ...linked.profile, id: 'user-b' } },
    { ...linked, summary: { 'Patient Number': 'record-b' } },
    { ...linked, readings: [{ 'Patient Number': 'record-b' }] },
    { ...unlinked, summary: linked.summary },
    { ...unlinked, readings: linked.readings },
  ]) await assert.rejects(loadPatientDashboard(clientFor(data), 'user-a'));
});

test('missing profiles and malformed responses fail closed', async () => {
  for (const data of [null, {}, { ...linked, readings: null }, { ...linked, readings: [null] }, { ...linked, profile: { ...linked.profile, patient_id: '' } }]) {
    await assert.rejects(loadPatientDashboard(clientFor(data), 'user-a'));
  }
});

test('failed queries never fall back to sample data', async () => {
  await assert.rejects(loadPatientDashboard(clientFor(null, { code: 'PGRST202' }), 'user-a'), /database setup/);
  await assert.rejects(loadPatientDashboard(clientFor(null, { code: '42501' }), 'user-a'), /could not be loaded/);
  await assert.rejects(loadPatientDashboard({ rpc: async () => { throw new Error('offline'); } }, 'user-a'), /offline/);
});

test('missing measurements stay missing and real zero readings are preserved', () => {
  for (const value of [null, undefined, '', ' ', 'invalid', NaN, Infinity, true, {}]) assert.equal(measurement(value), 'Not recorded');
  assert.equal(measurement(0), '0');
  assert.equal(measurement('6.4'), '6.4');
  assert.equal(measurement(125), '125');
});
