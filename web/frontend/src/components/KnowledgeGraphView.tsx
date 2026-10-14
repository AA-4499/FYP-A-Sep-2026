import React, { useEffect, useRef, useState } from 'react';
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
import type { Patient } from '../types';

interface GraphPayload {
  patient_id: string;
  elements: { nodes: ElementDefinition[]; edges: ElementDefinition[] };
  stats?: { total_nodes?: number; total_edges?: number; condition_count?: number };
}
interface Props { patient: Patient; }

const API_BASE_URL = (import.meta as ImportMeta & { env: { VITE_API_BASE_URL?: string } }).env.VITE_API_BASE_URL ?? '';

export const KnowledgeGraphView: React.FC<Props> = ({ patient }) => {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const [graph, setGraph] = useState<GraphPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setGraph(null);

    // Send only condition-related properties. The backend prefers its
    // server-side patient record and uses this restricted payload only when
    // the selected record ID is absent from the installed patient service.
    const source = patient as unknown as Record<string, unknown>;
    const patientData: Record<string, unknown> = { id: patient.id };
    const allowedKeys = [
      'condition', 'diabetes_type', 'diabetesType', 'type_of_diabetes', 'typeOfDiabetes',
      'comorbidities', 'comorbidity', 'other_conditions', 'otherConditions',
      'acute_diabetic_complications', 'acute_complications', 'acute_complication',
      'macrovascular_complications', 'diabetic_macrovascular_complications',
      'microvascular_complications', 'diabetic_microvascular_complications',
      'hypertension', 'hypoglycemia_status', 'hypoglycemia', 'had_hypoglycemia',
    ];
    for (const key of allowedKeys) {
      if (source[key] !== undefined && source[key] !== null) patientData[key] = source[key];
    }

    fetch(`${API_BASE_URL}/api/patients/${encodeURIComponent(patient.id)}/knowledge-graph`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient: patientData }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Knowledge graph request failed (${response.status}).`);
        return data as GraphPayload;
      })
      .then(setGraph)
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Unable to load the patient knowledge graph.');
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [patient]);

  useEffect(() => {
    if (!canvasRef.current || !graph) return;
    cyRef.current?.destroy();
    cyRef.current = cytoscape({
      container: canvasRef.current,
      elements: [...graph.elements.nodes, ...graph.elements.edges],
      layout: { name: 'cose', animate: false, padding: 42, nodeRepulsion: () => 9000, idealEdgeLength: () => 120 },
      minZoom: 0.45,
      maxZoom: 2.2,
      style: [
        { selector: 'node', style: {
          label: 'data(label)', 'font-size': 12, color: '#0f172a',
          'text-wrap': 'wrap', 'text-max-width': 140, 'text-valign': 'center',
          'text-halign': 'center', 'background-color': '#e0f2fe',
          'border-width': 2, 'border-color': '#0284c7',
          width: 128, height: 54, shape: 'round-rectangle', padding: 7,
        }},
        { selector: 'node[kind = "Patient"]', style: {
          label: 'Patient', shape: 'ellipse', 'background-color': '#2563eb',
          'border-color': '#1d4ed8', color: '#ffffff', width: 92, height: 92,
          'font-size': 15, 'font-weight': 700,
        }},
        { selector: 'edge', style: {
          width: 2, 'line-color': '#94a3b8', 'target-arrow-color': '#64748b',
          'target-arrow-shape': 'triangle', 'curve-style': 'bezier',
          label: 'data(label)', 'font-size': 9, color: '#475569',
          'text-background-color': '#ffffff', 'text-background-opacity': 1,
          'text-background-padding': 3,
        }},
      ],
    });
    return () => { cyRef.current?.destroy(); cyRef.current = null; };
  }, [graph]);

  return (
    <section className="space-y-5 pb-12" aria-labelledby="patient-kg-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Patient relationships</p>
          <h2 id="patient-kg-title" className="mt-1 text-2xl font-bold text-slate-900">Patient Knowledge Graph</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">Explore this patient's recorded diabetes diagnosis, comorbidities, and complications.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
          {graph ? `${graph.stats?.total_nodes ?? graph.elements.nodes.length} nodes · ${graph.stats?.total_edges ?? graph.elements.edges.length} relationships` : 'Condition-only graph'}
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-100 px-5 py-3 text-xs text-slate-600">
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-blue-600" /> Patient</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded bg-sky-100 ring-1 ring-sky-600" /> Condition</span>
          <span className="text-slate-400">Relationships indicate recorded conditions, not causation.</span>
        </div>
        {loading && <div className="p-12 text-center text-sm text-slate-500">Loading patient conditions…</div>}
        {!loading && error && <div role="alert" className="m-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">The knowledge graph could not be loaded.</p>
          <p className="mt-1">{error}</p>
          <p className="mt-2 text-xs">Check the Flask API and the separate patient-neo4j container.</p>
        </div>}
        {!loading && !error && graph && <div ref={canvasRef} className="h-[520px] w-full bg-slate-50" aria-label="Interactive patient condition graph" />}
        {!loading && !error && graph && graph.elements.edges.length === 0 && <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">No additional conditions were returned. The Patient node remains visible.</p>}
      </div>
      <p className="text-xs leading-5 text-slate-400">Only the Patient node and diabetes/condition nodes are represented. Demographics, biomarkers, medications, model predictions, and recommendations remain outside this graph.</p>
    </section>
  );
};

export default KnowledgeGraphView;
