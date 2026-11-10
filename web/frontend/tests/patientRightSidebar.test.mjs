import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const source = readFileSync(new URL('../src/components/PatientRightSidebar.tsx', import.meta.url), 'utf8');

let { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.React,
  },
});

outputText = outputText.replace(
  /from (['"])(react|lucide-react|cytoscape)\1/g,
  (_, quote, specifier) => `from ${JSON.stringify(import.meta.resolve(specifier))}`
);

const { generatePatientGraph, PatientRightSidebar } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

const mockPatient = {
  id: '2000_0_20201230',
  name: 'Elena Morales',
  condition: 'Type 2 Diabetes',
  hba1c: 7.4,
  fastingGlucose: 5.6,
  bmi: 27.5,
  weight: 74,
  hasContinuousCGM: true,
  timeInRangePct: 68,
  cgmReadings: [],
};

const mockRecommendations = [
  {
    id: 'rec-1',
    patientId: '2000_0_20201230',
    title: 'Review morning glucose patterns',
    patientMessage: 'Your clinician recommends reviewing your dawn glucose rise with your care team.',
    rationale: 'Dawn phenomenon mitigation discussion.',
    category: 'Monitoring',
    priority: 'For review',
    status: 'published',
    publishedAt: new Date().toISOString(),
  },
  {
    id: 'rec-2',
    patientId: '2000_0_20201230',
    title: 'Daily post-meal walk',
    patientMessage: 'A 15-minute walk after lunch or dinner helps lower postprandial glucose peaks.',
    rationale: 'Physical activity enhances insulin sensitivity.',
    category: 'Lifestyle',
    priority: 'Routine',
    status: 'published',
    publishedAt: new Date().toISOString(),
  },
];

test('generatePatientGraph constructs comprehensive nodes and edges from patient data', () => {
  const { nodes, edges } = generatePatientGraph(mockPatient, mockPatient.id);
  assert.ok(nodes.length >= 10, 'Expected at least 10 nodes');
  assert.ok(edges.length >= 10, 'Expected at least 10 edges');

  const core = nodes.find((n) => n.id === 'patient_core');
  assert.ok(core, 'Should have patient core node');
  assert.equal(core.label, 'Elena Morales');
  assert.equal(core.category, 'patient');

  const hba1cNode = nodes.find((n) => n.id === 'node_hba1c');
  assert.ok(hba1cNode, 'Should have HbA1c node');
  assert.ok(hba1cNode.label.includes('7.4%'), 'Should display patient HbA1c');

  const fastingNode = nodes.find((n) => n.id === 'node_fasting');
  assert.ok(fastingNode, 'Should have Fasting Glucose node');
  assert.ok(fastingNode.label.includes('5.6 mmol/L'), 'Should display fasting glucose');

  const bmiNode = nodes.find((n) => n.id === 'node_bmi');
  assert.ok(bmiNode, 'Should have BMI node');
  assert.ok(bmiNode.label.includes('27.5 kg/m²'), 'Should display BMI');

  const cgmNode = nodes.find((n) => n.id === 'node_cgm');
  assert.ok(cgmNode, 'Should have CGM sensor node');
  assert.ok(cgmNode.label.includes('Active'), 'Should indicate active CGM sensor');
});

test('PatientRightSidebar defaults to Recommendations view', () => {
  const html = renderToStaticMarkup(
    React.createElement(PatientRightSidebar, {
      patient: mockPatient,
      patientId: mockPatient.id,
      recommendations: mockRecommendations,
      isOpen: true,
    })
  );

  assert.ok(html.includes('data-testid="patient-right-sidebar"'), 'Should render sidebar');
  assert.ok(html.includes('Health Insights'), 'Should render sidebar title');
  assert.ok(html.includes('Recommendations'), 'Should render Recommendations tab');
  assert.ok(html.includes('Knowledge Graph'), 'Should render Knowledge Graph tab');
  assert.ok(html.includes('Approved by your care team'), 'Should show care team approval header');
  assert.ok(html.includes('Review morning glucose patterns'), 'Should show recommendation 1');
  assert.ok(html.includes('Daily post-meal walk'), 'Should show recommendation 2');
  assert.ok(html.includes('Approved'), 'Should show approval badge');
});

test('PatientRightSidebar renders Knowledge Graph view when active tab is knowledge_graph', () => {
  const html = renderToStaticMarkup(
    React.createElement(PatientRightSidebar, {
      patient: mockPatient,
      patientId: mockPatient.id,
      recommendations: mockRecommendations,
      isOpen: true,
      defaultTab: 'knowledge_graph',
    })
  );

  assert.ok(html.includes('Personal Health Graph'), 'Should show Personal Health Graph heading');
  assert.ok(html.includes('Interactive patient knowledge graph'), 'Should have Cytoscape aria-label');
  assert.ok(html.includes('Biomarkers'), 'Should show Biomarkers category filter');
  assert.ok(html.includes('Care &amp; Lifestyle') || html.includes('Care & Lifestyle'), 'Should show Care filter');
});

test('PatientRightSidebar handles empty recommendations gracefully with empty state', () => {
  const html = renderToStaticMarkup(
    React.createElement(PatientRightSidebar, {
      patient: mockPatient,
      patientId: mockPatient.id,
      recommendations: [],
      isOpen: true,
    })
  );

  assert.ok(html.includes('No recommendations yet'), 'Should render empty state message');
});
