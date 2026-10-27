import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const source = readFileSync(new URL('../src/lib/patientDashboard.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } });
const { loadPatientDashboard, measurement, toDashboardPatient } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
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

test('existing dashboard adapter converts explicit source units and never invents risk values', () => {
  const patient = toDashboardPatient({ ...linked, summary: { ...linked.summary, 'HbA1c (mmol/mol)': 60, 'Fasting Plasma Glucose (mg/dl)': 83, 'BMI (kg/m²)': 23.6 }, readings: [
    { 'Patient Number': 'record-a', Date: '2026-10-23T11:00:00Z', 'CGM (mg / dl)': 200 },
    { 'Patient Number': 'record-a', Date: '2026-10-23T10:00:00Z', 'CGM (mg / dl)': 100 },
    { 'Patient Number': 'record-a', Date: 'invalid', 'CGM (mg / dl)': 111 },
    { 'Patient Number': 'record-a', Date: '2026-10-23T12:00:00Z', 'CGM (mg / dl)': null },
  ] });
  assert.equal(patient.hba1c, 7.6);
  assert.equal(patient.fastingGlucose, 4.6);
  assert.equal(patient.bmi, 23.6);
  assert.equal(patient.cgmReadings.length, 2);
  assert.equal(patient.cgmReadings[0].cgm, 100);
  assert.equal(patient.cgmSummary.meanGlucose, 150);
  assert.equal(patient.timeInRangePct, 50);
  assert.ok(Number.isNaN(patient.currentRiskPct));
  assert.deepEqual(patient.keyFactors, []);
});

test('new accounts retain empty measurements, predictions, and sensor data', () => {
  const patient = toDashboardPatient(unlinked);
  for (const key of ['hba1c', 'fastingGlucose', 'bmi', 'currentRiskPct', 'timeInRangePct']) assert.ok(Number.isNaN(patient[key]), key);
  assert.equal(patient.hasContinuousCGM, false);
  assert.equal(patient.cgmSummary, undefined);
});

async function componentModule(name) {
  const source = readFileSync(new URL(`../src/components/${name}.tsx`, import.meta.url), 'utf8');
  let { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } });
  outputText = outputText.replace(/from (['"])(react|lucide-react|recharts)\1/g, (_, quote, specifier) => `from ${JSON.stringify(import.meta.resolve(specifier))}`);
  for (const name of ['clinicalData', 'dashboardOverview']) {
    const lib = readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8');
    const compiled = ts.transpileModule(lib, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
    const uri = 'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64');
    outputText = outputText.replaceAll('"../lib/' + name + '"', JSON.stringify(uri));
  }
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

test('Patient Home retains recorded information and hides Doctor-only simulation', async () => {
  const { DashboardView } = await componentModule('DashboardView');
  const html = renderToStaticMarkup(React.createElement(DashboardView, { patient: toDashboardPatient(unlinked), selfService: true, onNavigate() {} }));
  for (const title of ['Glucose trend', 'Glucose range', 'Other health results', 'No CGM readings available']) assert.ok(html.includes(title), title);
  assert.doesNotMatch(html, /NaN|62%|Patient 2000|Patients 2000|Prototype:/);
  assert.doesNotMatch(html, /What-if simulation|Open digital twin|Current risk|Simulated HbA1c/);
});

test('Patient sidebar retains the original navigation without a care-team switch', async () => {
  const { Sidebar } = await componentModule('Sidebar');
  const html = renderToStaticMarkup(React.createElement(Sidebar, { mode: 'patient', activeModule: 'patient_home', selfService: true, onSelectModule() {}, onReturnToCareTeam() {} }));
  for (const label of ['Home', 'My profile', 'My health', 'My digital twin', 'My recommendations', 'Reports']) assert.ok(html.includes(label), label);
  assert.doesNotMatch(html, /Doctor dashboard|ShanghaiT2DM Cohort|Risk prediction/);
});


test('Doctor can retain prediction navigation while viewing a patient record', async () => {
  const { Sidebar } = await componentModule('Sidebar');
  const html = renderToStaticMarkup(React.createElement(Sidebar, {mode:'patient',activeModule:'patient_home',canViewPredictions:true,onSelectModule(){}}));
  assert.match(html, /Risk prediction &amp; what-if/);
});

test('Doctor prediction navigation is denied by default, including anonymous previews', async () => {
  const { Sidebar } = await componentModule('Sidebar');
  const hidden = renderToStaticMarkup(React.createElement(Sidebar, {mode:'doctor',activeModule:'doctor_overview',onSelectModule(){}}));
  const doctor = renderToStaticMarkup(React.createElement(Sidebar, {mode:'doctor',activeModule:'doctor_overview',canViewPredictions:true,onSelectModule(){}}));
  assert.doesNotMatch(hidden, /Digital twin/);
  assert.match(doctor, /Digital twin/);
});
