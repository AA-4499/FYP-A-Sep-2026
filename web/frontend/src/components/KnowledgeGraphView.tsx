import React, { useEffect, useRef, useState } from 'react';
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';

interface DemoNodeDetail {
  id: string;
  label: string;
  kind: 'Patient' | 'Condition';
  category: string;
  shortDescription: string;
  sourceField?: string;
  recordedValue?: string;
  relationship?: string;
  note: string;
}

const DEMO_RECORD = {
  patientId: '2000',
  displayName: 'Patient 2000',
  sourceRecordId: '2000_0_20201230',
  sourceTable: 'patient_summary',
  dataset: 'ShanghaiT2DM',
};

const DEMO_NODES: DemoNodeDetail[] = [
  {
    id: 'patient-2000',
    label: 'Patient',
    kind: 'Patient',
    category: 'patient',
    shortDescription: 'Central patient node for this demonstration.',
    note: 'This is a hardcoded demonstration profile. The graph is intentionally limited to one patient and one source record; it is not connected to login or the shared patient selector yet.',
  },
  {
    id: 'condition-type-2-diabetes',
    label: 'Type 2 Diabetes',
    kind: 'Condition',
    category: 'diabetes_type',
    shortDescription: 'Recorded diabetes diagnosis.',
    sourceField: 'Type of Diabetes',
    recordedValue: 'Type 2 diabetes',
    relationship: 'has diabetes',
    note: 'The condition label is normalised for display. The recorded source value is shown alongside it.',
  },
  {
    id: 'condition-hypertension',
    label: 'Hypertension',
    kind: 'Condition',
    category: 'comorbidity',
    shortDescription: 'Recorded comorbidity.',
    sourceField: 'Comorbidities',
    recordedValue: 'hypertension',
    relationship: 'has comorbidity',
    note: 'This relationship represents a comorbidity recorded in the source row; it does not claim that diabetes caused the condition.',
  },
  {
    id: 'condition-nephropathy',
    label: 'Diabetic Nephropathy',
    kind: 'Condition',
    category: 'microvascular_complication',
    shortDescription: 'Recorded microvascular complication.',
    sourceField: 'Diabetic Microvascular Complications',
    recordedValue: 'nephropathy',
    relationship: 'has microvascular complication',
    note: 'The display label is normalised to Diabetic Nephropathy. The source entry itself is nephropathy.',
  },
  {
    id: 'condition-hypoglycemia',
    label: 'Hypoglycemia',
    kind: 'Condition',
    category: 'acute_complication',
    shortDescription: 'Hypoglycemia recorded as present.',
    sourceField: 'Hypoglycemia (yes/no)',
    recordedValue: 'yes',
    relationship: 'has acute complication',
    note: 'This represents the source field value yes. It does not indicate severity, timing, or current status.',
  },
];

const DEMO_RELATIONSHIPS = [
  { id: 'edge-diabetes', source: 'patient-2000', target: 'condition-type-2-diabetes', label: 'has diabetes' },
  { id: 'edge-comorbidity', source: 'patient-2000', target: 'condition-hypertension', label: 'has comorbidity' },
  { id: 'edge-microvascular', source: 'patient-2000', target: 'condition-nephropathy', label: 'has microvascular complication' },
  { id: 'edge-acute', source: 'patient-2000', target: 'condition-hypoglycemia', label: 'has acute complication' },
];

const GRAPH_ELEMENTS: ElementDefinition[] = [
  ...DEMO_NODES.map((node) => ({
    data: {
      id: node.id,
      label: node.label,
      kind: node.kind,
      category: node.category,
    },
  })),
  ...DEMO_RELATIONSHIPS.map((relationship) => ({ data: relationship })),
];

const CATEGORY_LABELS: Record<string, string> = {
  patient: 'Patient',
  diabetes_type: 'Diabetes diagnosis',
  comorbidity: 'Comorbidity',
  acute_complication: 'Acute complication',
  microvascular_complication: 'Microvascular complication',
};

export const KnowledgeGraphView: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('patient-2000');

  const selectedNode = DEMO_NODES.find((node) => node.id === selectedNodeId) ?? DEMO_NODES[0];
  const selectedRelationships = selectedNode.kind === 'Patient'
    ? DEMO_RELATIONSHIPS
    : DEMO_RELATIONSHIPS.filter((relationship) => relationship.target === selectedNode.id);

  const selectedBadgeClass = selectedNode.kind === 'Patient'
    ? 'bg-blue-50 text-blue-700'
    : selectedNode.category === 'comorbidity'
      ? 'bg-green-50 text-green-700'
      : selectedNode.category === 'acute_complication' || selectedNode.category === 'microvascular_complication'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-sky-50 text-sky-700';

  useEffect(() => {
    if (!canvasRef.current) return;

    const cy = cytoscape({
      container: canvasRef.current,
      elements: GRAPH_ELEMENTS,
      layout: {
        name: 'cose',
        animate: false,
        padding: 38,
        nodeRepulsion: () => 9000,
        idealEdgeLength: () => 145,
        componentSpacing: 80,
      },
      minZoom: 0.45,
      maxZoom: 2.25,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'font-size': 12,
            'font-weight': 600,
            color: '#0f172a',
            'text-wrap': 'wrap',
            'text-max-width': 150,
            'text-valign': 'center',
            'text-halign': 'center',
            'background-color': '#e0f2fe',
            'border-width': 2,
            'border-color': '#0284c7',
            width: 148,
            height: 58,
            shape: 'round-rectangle',
            padding: 7,
          },
        },
        {
          selector: 'node[kind = "Patient"]',
          style: {
            label: 'Patient 2000',
            shape: 'ellipse',
            'background-color': '#1d4ed8',
            'border-color': '#1e40af',
            color: '#ffffff',
            width: 116,
            height: 116,
            'font-size': 15,
            'font-weight': 700,
          },
        },
        {
          selector: 'node[category = "comorbidity"]',
          style: { 'background-color': '#dcfce7', 'border-color': '#16a34a' },
        },
        {
          selector: 'node[category = "microvascular_complication"]',
          style: { 'background-color': '#fef3c7', 'border-color': '#d97706' },
        },
        {
          selector: 'node[category = "acute_complication"]',
          style: { 'background-color': '#fee2e2', 'border-color': '#dc2626' },
        },
        {
          selector: 'node.selected',
          style: { 'border-width': 5, 'border-color': '#7c3aed', 'overlay-opacity': 0.08, 'overlay-color': '#7c3aed' },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#94a3b8',
            'target-arrow-color': '#64748b',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': 9,
            color: '#475569',
            'text-background-color': '#ffffff',
            'text-background-opacity': 1,
            'text-background-padding': 3,
            'text-wrap': 'wrap',
            'text-max-width': 120,
          },
        },
      ],
    });

    cy.nodes().removeClass('selected');
    cy.$id(selectedNodeId).addClass('selected');
    cy.on('tap', 'node', (event) => {
      const nodeId = event.target.id();
      cy.nodes().removeClass('selected');
      event.target.addClass('selected');
      setSelectedNodeId(nodeId);
    });
    cyRef.current = cy;

    return () => {
      cy.off('tap');
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  const selectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().removeClass('selected');
    cy.$id(nodeId).addClass('selected');
    cy.animate({ center: { eles: cy.$id(nodeId) }, duration: 220 });
  };

  const resetGraph = () => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.fit(undefined, 35);
    selectNode('patient-2000');
  };

  return (
    <section className="space-y-5 pb-12" aria-labelledby="patient-kg-title">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-700">
              Demonstration profile
            </span>
            <span className="text-xs text-slate-400">Static sample · No authentication connection</span>
          </div>
          <h2 id="patient-kg-title" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Patient Knowledge Graph
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Explore one patient&apos;s recorded diabetes diagnosis, comorbidity, and complications. Select a node to inspect its source information.
          </p>
        </div>
        <button
          type="button"
          onClick={resetGraph}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <span aria-hidden="true">↺</span> Reset graph
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Selected patient</p>
          <p className="mt-2 text-lg font-bold text-slate-900">{DEMO_RECORD.displayName}</p>
          <p className="mt-1 text-xs text-slate-500">Patient ID: {DEMO_RECORD.patientId}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Graph nodes</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{DEMO_NODES.length}</p>
          <p className="mt-1 text-xs text-slate-500">1 patient + 4 conditions</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Relationships</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{DEMO_RELATIONSHIPS.length}</p>
          <p className="mt-1 text-xs text-slate-500">Recorded associations</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Source record</p>
          <p className="mt-2 break-all text-sm font-bold text-slate-900">{DEMO_RECORD.sourceRecordId}</p>
          <p className="mt-1 text-xs text-slate-500">{DEMO_RECORD.dataset} · {DEMO_RECORD.sourceTable}</p>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Interactive graph">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Condition relationships</h3>
              <p className="mt-0.5 text-xs text-slate-500">Click a node to view its details.</p>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-700" />Patient</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-sky-100 ring-1 ring-sky-600" />Diabetes</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-green-100 ring-1 ring-green-600" />Comorbidity</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-amber-100 ring-1 ring-amber-600" />Complication</span>
            </div>
          </div>
          <div ref={canvasRef} className="h-[440px] w-full bg-slate-50 sm:h-[540px]" aria-label="Graph of Patient 2000 and four recorded conditions" />
          <p className="border-t border-slate-100 px-4 py-3 text-xs leading-5 text-slate-500 sm:px-5">
            Edges represent recorded associations, not medical causation. This graph uses a fixed demonstration record and does not yet follow the signed-in user.
          </p>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-live="polite" aria-labelledby="selected-node-title">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Selected node</p>
                <h3 id="selected-node-title" className="mt-1 break-words text-xl font-bold text-slate-900">{selectedNode.label}</h3>
              </div>
              <span className={'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ' + selectedBadgeClass}>
                {CATEGORY_LABELS[selectedNode.category] ?? selectedNode.category}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{selectedNode.shortDescription}</p>
            <div className="mt-4 space-y-3">
              {selectedNode.kind === 'Patient' ? (
                <>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-500">Patient identifier</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{DEMO_RECORD.patientId}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-500">Source record</p>
                    <p className="mt-1 break-all text-sm font-semibold text-slate-800">{DEMO_RECORD.sourceRecordId}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-500">Connected conditions</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{DEMO_RELATIONSHIPS.length} recorded relationships</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-500">Recorded source value</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{selectedNode.recordedValue}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-500">Source field</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{selectedNode.sourceField}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-500">Patient relationship</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{selectedNode.relationship}</p>
                  </div>
                </>
              )}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">{selectedNode.note}</p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Connected information</h3>
              <span className="text-xs text-slate-400">{selectedRelationships.length} {selectedRelationships.length === 1 ? 'relationship' : 'relationships'}</span>
            </div>
            <div className="mt-3 space-y-2">
              {selectedRelationships.map((relationship) => {
                const relatedId = selectedNode.kind === 'Patient' ? relationship.target : selectedNode.id;
                const target = DEMO_NODES.find((node) => node.id === relatedId);
                return (
                  <button
                    key={relationship.id}
                    type="button"
                    onClick={() => selectNode(target?.id ?? relationship.target)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50/60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-800">{target?.label ?? relationship.label}</span>
                      <span className="mt-1 block text-xs text-slate-500">{relationship.label}</span>
                    </span>
                    <span aria-hidden="true" className="text-slate-400">→</span>
                  </button>
                );
              })}
            </div>
          </section>
        </aside>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm leading-6 text-indigo-950">
        <span className="font-semibold">Demo boundary:</span> the patient and condition details above are hardcoded from one example record for presentation. Authentication, live patient selection, and Supabase fetching are intentionally left for the team&apos;s later integration task.
      </div>
    </section>
  );
};

export default KnowledgeGraphView;
