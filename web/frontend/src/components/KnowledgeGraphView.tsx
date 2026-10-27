import React, { useEffect, useMemo, useRef, useState } from 'react';
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  Info,
  Network,
  RotateCcw,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  Workflow,
  XCircle,
} from 'lucide-react';
import type { Patient } from '../types';
import { getSupabaseClient } from '../lib/supabase';
import { getForecastApiUrl } from '../lib/forecast';
import type { ClinicalRecommendation, RecommendationStatus } from '../data/knowledgeGraphDemoData';

interface Props {
  patient: Patient;
  patientId: string;
  recommendations: ClinicalRecommendation[];
  onRecommendationStatusChange: (recommendationId: string, status: RecommendationStatus) => void;
  onPublishRecommendations: (recommendationIds: string[]) => void;
  onPreviewPatientView: () => void;
}

type GraphGroup = 'patient' | 'patient-data' | 'condition' | 'concept' | 'monitoring' | 'care';
type GraphFilter = 'all' | 'conditions' | 'monitoring' | 'management';
type ViewTab = 'graph' | 'recommendations';

interface ClinicalKnowledgeGraphNodeRecord {
  id: string;
  name: string;
  category: string;
  description: string;
  sourceRefs: string[];
  scope: string;
  schemaVersion: string;
}
interface ClinicalKnowledgeGraphEdgeRecord {
  id: string;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  predicate: string;
  label: string;
  sourceRefs: string[];
  evidenceNote: string;
  evidenceStatus: string;
  evidenceType: string;
  scope: string;
  schemaVersion: string;
}
interface ClinicalKnowledgeGraphResponse {
  source: string;
  readOnly: boolean;
  scope: string;
  stats: {
    totalNodes: number;
    totalEdges: number;
    reviewedEdges: number;
    candidateEdges: number;
  };
  nodes: ClinicalKnowledgeGraphNodeRecord[];
  edges: ClinicalKnowledgeGraphEdgeRecord[];
  error?: string;
}
interface GraphNode {
  id: string;
  label: string;
  group: GraphGroup;
  value: string;
  description: string;
  details: Array<{ label: string; value: string }>;
}
interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  status: string;
  sourceRefs: string[];
  evidenceNote: string;
}
interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
  elements: ElementDefinition[];
}

function groupForCategory(category: string): GraphGroup {
  const value = category.toLowerCase();
  if (/disease|clinical state|glycaemic event|glycemic event|crisis|complication/.test(value)) return 'condition';
  if (/indicator|metric|monitoring|measurement/.test(value)) return 'monitoring';
  if (/treatment|lifestyle|behaviour|behavior|pathophysiology|risk factor/.test(value)) return 'care';
  return 'concept';
}

function buildGraphModel(response: ClinicalKnowledgeGraphResponse | null): GraphModel {
  if (!response || !Array.isArray(response.nodes) || response.nodes.length === 0) {
    const placeholder: GraphNode = {
      id: 'kg-no-data',
      label: 'No live graph data',
      group: 'concept',
      value: 'Neo4j Aura',
      description: 'No clinical concept nodes have been loaded. Check the connection status above and retry the request.',
      details: [
        { label: 'Data source', value: 'Neo4j Aura through the Flask backend' },
        { label: 'Graph scope', value: 'MedicalConcept nodes and their relationships only' },
      ],
    };
    const elements: ElementDefinition[] = [{
      data: { id: placeholder.id, label: placeholder.label, group: placeholder.group, value: placeholder.value },
    }];
    return { nodes: [placeholder], edges: [], elements };
  }

  const nodes: GraphNode[] = response.nodes.map((node) => ({
    id: node.id,
    label: node.name,
    group: groupForCategory(node.category || ''),
    value: node.category || 'Clinical concept',
    description: node.description || 'No description is stored for this concept.',
    details: [
      { label: 'Category', value: node.category || 'Uncategorised' },
      { label: 'Source references', value: node.sourceRefs?.join(', ') || 'Not recorded' },
      { label: 'Scope', value: node.scope || 'Not specified' },
      { label: 'Schema version', value: node.schemaVersion || 'Not specified' },
    ],
  }));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: GraphEdge[] = response.edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label || edge.predicate.toLowerCase().replace(/_/g, ' '),
      status: edge.evidenceStatus || 'candidate_for_review',
      sourceRefs: edge.sourceRefs || [],
      evidenceNote: edge.evidenceNote || '',
    }));
  const elements: ElementDefinition[] = [
    ...nodes.map((node) => ({
      data: { id: node.id, label: node.label, group: node.group, value: node.value },
    })),
    ...edges.map((edge) => ({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        evidenceStatus: edge.status,
      },
    })),
  ];
  return { nodes, edges, elements };
}

function isGroupVisible(group: GraphGroup, filter: GraphFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'conditions') return group === 'condition';
  if (filter === 'monitoring') return group === 'monitoring';
  return ['care', 'concept'].includes(group);
}

function statusLabel(status: RecommendationStatus): string {
  if (status === 'approved') return 'Approved to share';
  if (status === 'declined') return 'Not approved';
  if (status === 'published') return 'Shared with patient';
  return 'Needs review';
}

function statusClass(status: RecommendationStatus): string {
  if (status === 'approved') return 'border-teal-200 bg-teal-50 text-teal-800';
  if (status === 'declined') return 'border-slate-200 bg-slate-100 text-slate-600';
  if (status === 'published') return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

export const KnowledgeGraphView: React.FC<Props> = ({
  patient,
  patientId,
  recommendations,
  onRecommendationStatusChange,
  onPublishRecommendations,
  onPreviewPatientView,
}) => {
  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('graph');
  const [graphFilter, setGraphFilter] = useState<GraphFilter>('all');
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [feedback, setFeedback] = useState('');
  const [clinicalGraph, setClinicalGraph] = useState<ClinicalKnowledgeGraphResponse | null>(null);
  const [graphLoading, setGraphLoading] = useState(true);
  const [graphError, setGraphError] = useState('');
  const [graphRefreshCounter, setGraphRefreshCounter] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const loadClinicalGraph = async () => {
      setGraphLoading(true);
      setGraphError('');
      try {
        const client = getSupabaseClient();
        if (!client) {
          throw new Error('Supabase authentication is not configured. Sign in with an authorised Doctor account.');
        }
        const { data, error } = await client.auth.getSession();
        if (error) throw new Error(error.message);
        if (!data.session) {
          throw new Error('Sign in with a Doctor account to load the live clinical graph.');
        }

        const apiBase = getForecastApiUrl();
        if (!apiBase) {
          throw new Error('The Python backend is not configured. Set VITE_API_BASE_URL to the backend origin.');
        }

        const response = await fetch(`${apiBase}/api/doctor/knowledge-graph`, {
          method: 'GET',
          signal: controller.signal,
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        const result = await response.json() as ClinicalKnowledgeGraphResponse;
        if (!response.ok) {
          throw new Error(result.error || `The clinical graph request failed (${response.status}).`);
        }
        if (!Array.isArray(result.nodes) || !Array.isArray(result.edges)) {
          throw new Error('The backend returned an unexpected clinical graph response.');
        }
        if (active) {
          setClinicalGraph(result);
          setSelectedNodeId(result.nodes[0]?.id || '');
        }
      } catch (error) {
        if (active && !controller.signal.aborted) {
          setClinicalGraph(null);
          setGraphError(error instanceof Error ? error.message : 'Could not load the clinical graph.');
        }
      } finally {
        if (active && !controller.signal.aborted) setGraphLoading(false);
      }
    };

    void loadClinicalGraph();
    return () => {
      active = false;
      controller.abort();
    };
  }, [graphRefreshCounter]);

  const graphModel = useMemo(() => buildGraphModel(clinicalGraph), [clinicalGraph]);
  const selectedNode = graphModel.nodes.find((node) => node.id === selectedNodeId) ?? graphModel.nodes[0];
  const selectedEdges = graphModel.edges.filter(
    (edge) => edge.source === selectedNode.id || edge.target === selectedNode.id,
  );
  const candidateEdgeCount = clinicalGraph?.edges.filter((edge) => edge.evidenceStatus === 'candidate_for_review').length ?? 0;
  const reviewedEdgeCount = clinicalGraph?.edges.filter((edge) => edge.evidenceStatus === 'reviewed').length ?? 0;
  const approvedCount = recommendations.filter((item) => item.status === 'approved').length;
  const publishedCount = recommendations.filter((item) => item.status === 'published').length;


  useEffect(() => {
    if (!graphContainerRef.current) return undefined;

    const cy = cytoscape({
      container: graphContainerRef.current,
      elements: graphModel.elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#ffffff',
            'border-color': '#cbd5e1',
            'border-width': 1.5,
            'shape': 'round-rectangle',
            'width': 'label',
            'height': 'label',
            'padding': '12px',
            'label': 'data(label)',
            'color': '#0f172a',
            'font-size': 10,
            'font-weight': 600,
            'text-wrap': 'wrap',
            'text-max-width': '95px',
            'text-valign': 'center',
            'text-halign': 'center',
          },
        },
        {
          selector: 'node[group = "patient"]',
          style: {
            'background-color': '#0f766e',
            'border-color': '#0f766e',
            'color': '#ffffff',
            'font-size': 11,
            'padding': '16px',
          },
        },
        {
          selector: 'node[group = "patient-data"]',
          style: {
            'background-color': '#eff6ff',
            'border-color': '#93c5fd',
            'color': '#1e3a8a',
          },
        },
        {
          selector: 'node[group = "condition"]',
          style: {
            'background-color': '#fff7ed',
            'border-color': '#fdba74',
            'color': '#9a3412',
          },
        },
        {
          selector: 'node[group = "concept"]',
          style: {
            'background-color': '#f5f3ff',
            'border-color': '#c4b5fd',
            'color': '#5b21b6',
          },
        },
        {
          selector: 'node[group = "monitoring"]',
          style: {
            'background-color': '#ecfeff',
            'border-color': '#67e8f9',
            'color': '#155e75',
          },
        },
        {
          selector: 'node[group = "care"]',
          style: {
            'background-color': '#f0fdf4',
            'border-color': '#86efac',
            'color': '#166534',
          },
        },
        {
          selector: 'node.is-selected',
          style: {
            'border-color': '#0f766e',
            'border-width': 4,
            'overlay-color': '#14b8a6',
            'overlay-opacity': 0.12,
            'overlay-padding': 6,
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 1.4,
            'line-color': '#cbd5e1',
            'target-arrow-color': '#94a3b8',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': 7,
            'color': '#64748b',
            'text-rotation': 'autorotate',
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.9,
            'text-background-padding': '2px',
          },
        },
        {
          selector: 'edge[evidenceStatus = "candidate_for_review"]',
          style: {
            'line-style': 'dashed',
            'line-color': '#f59e0b',
            'target-arrow-color': '#f59e0b',
          },
        },
        {
          selector: 'edge[evidenceStatus = "reviewed"]',
          style: {
            'line-color': '#0f766e',
            'target-arrow-color': '#0f766e',
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: false,
        fit: true,
        padding: 28,
        nodeRepulsion: 9000,
        idealEdgeLength: 115,
        edgeElasticity: 100,
        gravity: 0.25,
        numIter: 650,
      },
      minZoom: 0.45,
      maxZoom: 2.2,
      wheelSensitivity: 0.18,
    });

    cyRef.current = cy;
    cy.on('tap', 'node', (event) => setSelectedNodeId(event.target.id()));
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [graphModel]);

  useEffect(() => {
    if (!graphModel.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(graphModel.nodes[0]?.id || '');
    }
  }, [graphModel, selectedNodeId]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const visibleIds = new Set(
      graphModel.nodes.filter((node) => isGroupVisible(node.group, graphFilter)).map((node) => node.id),
    );
    cy.nodes().forEach((node) => {
      node.style('display', visibleIds.has(node.id()) ? 'element' : 'none');
    });
    cy.edges().forEach((edge) => {
      const visible = visibleIds.has(edge.data('source')) && visibleIds.has(edge.data('target'));
      edge.style('display', visible ? 'element' : 'none');
    });
    cy.fit(cy.elements().filter((element) => element.style('display') !== 'none'), 32);
  }, [graphFilter, graphModel]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().removeClass('is-selected');
    const selected = cy.getElementById(selectedNodeId);
    if (selected.length > 0) selected.addClass('is-selected');
  }, [selectedNodeId, graphModel]);

  useEffect(() => {
    if (selectedNode && !isGroupVisible(selectedNode.group, graphFilter)) {
      setSelectedNodeId(graphModel.nodes.find((node) => isGroupVisible(node.group, graphFilter))?.id || graphModel.nodes[0]?.id || '');
    }
  }, [graphFilter, selectedNode]);

  const focusNode = (nodeId: string) => {
    const target = graphModel.nodes.find((node) => node.id === nodeId);
    if (!target) return;
    if (!isGroupVisible(target.group, graphFilter)) setGraphFilter('all');
    setSelectedNodeId(nodeId);
    const cy = cyRef.current;
    const element = cy?.getElementById(nodeId);
    if (cy && element && element.length > 0) {
      cy.center(element);
      cy.zoom(Math.min(1.15, cy.maxZoom()));
    }
  };

  const handlePublish = () => {
    const ids = recommendations.filter((item) => item.status === 'approved').map((item) => item.id);
    if (ids.length === 0) {
      setFeedback('Approve at least one suggestion before sharing it with the patient.');
      return;
    }
    onPublishRecommendations(ids);
    setFeedback(ids.length + ' example recommendation(s) marked as shared in this prototype. No message was sent.');
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-800">
              <Network className="h-3.5 w-3.5" />
              Doctor workspace only
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${graphError ? 'border-rose-200 bg-rose-50 text-rose-800' : graphLoading ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-teal-200 bg-teal-50 text-teal-800'}`}>
              {graphLoading ? 'Connecting to Neo4j Aura…' : graphError ? 'Aura unavailable' : `${clinicalGraph?.stats.totalNodes ?? 0} concepts loaded from Aura`}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Knowledge Graph</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Browse clinical concepts and their literature-linked relationships from Neo4j Aura. Patient records remain in the existing patient-data store.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setGraphRefreshCounter((value) => value + 1)}
            disabled={graphLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-xs font-semibold text-teal-800 shadow-sm transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${graphLoading ? 'animate-spin' : ''}`} />
            Refresh Aura graph
          </button>
          <button
            type="button"
            onClick={onPreviewPatientView}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-teal-300 hover:bg-teal-50"
          >
            <Eye className="h-4 w-4" />
            Preview patient view
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-teal-200 bg-teal-50/80 p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-teal-800" />
          <div>
            <p className="text-sm font-semibold text-teal-950">Read-only clinical graph from Neo4j Aura</p>
            <p className="mt-1 text-xs leading-5 text-teal-900/90">
              This view reads only MedicalConcept nodes and their relationships. Patient information stays in the application data store. Candidate relationships are visible with their evidence status, but are not approved clinical facts and are not supplied to an AI recommendation service.
            </p>
          </div>
        </div>
      </div>
      {graphError && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-rose-900">Could not load the live clinical graph</p>
            <p className="mt-1 text-xs leading-5 text-rose-800">{graphError}</p>
          </div>
          <button
            type="button"
            onClick={() => setGraphRefreshCounter((value) => value + 1)}
            disabled={graphLoading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${graphLoading ? 'animate-spin' : ''}`} />
            Retry connection
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-slate-500">Selected patient</p>
            <UserRound className="h-4 w-4 text-teal-700" />
          </div>
          <p className="mt-2 truncate text-base font-bold text-slate-900">{patient.name}</p>
          <p className="mt-1 text-[11px] text-slate-500">{patient.displayId || patientId} · {patient.condition || 'Diabetes record'}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-slate-500">Aura concepts</p>
            <Network className="h-4 w-4 text-violet-700" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{clinicalGraph?.stats.totalNodes ?? 0}</p>
          <p className="mt-1 text-[11px] text-slate-500">MedicalConcept nodes returned by Neo4j</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-slate-500">Aura relationships</p>
            <Workflow className="h-4 w-4 text-teal-700" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{clinicalGraph?.stats.totalEdges ?? 0}</p>
          <p className="mt-1 text-[11px] text-slate-500">{reviewedEdgeCount} reviewed · {candidateEdgeCount} candidates not supplied to AI</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('graph')}
          className={'inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ' + (activeTab === 'graph' ? 'border-teal-600 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-800')}
        >
          <Network className="h-4 w-4" />
          Knowledge graph
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('recommendations')}
          className={'inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ' + (activeTab === 'recommendations' ? 'border-teal-600 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-800')}
        >
          <Workflow className="h-4 w-4" />
          Recommendation review
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{recommendations.length}</span>
        </button>
      </div>

      {activeTab === 'graph' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.9fr)]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4 sm:p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Clinical concept graph</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Select a node to inspect its metadata and cited relationships from Aura.</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    ['all', 'All concepts'],
                    ['conditions', 'Conditions'],
                    ['monitoring', 'Metrics & monitoring'],
                    ['management', 'Care & management'],
                  ] as Array<[GraphFilter, string]>).map(([filter, label]) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setGraphFilter(filter)}
                      className={'rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition ' + (graphFilter === filter ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="relative">
              <div
                ref={graphContainerRef}
                role="img"
                aria-label="Interactive clinical concept knowledge graph from Neo4j Aura"
                className="h-[430px] w-full bg-slate-50/70 sm:h-[500px]"
              />
              <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 shadow-sm">
                {[
                  ['bg-orange-300', 'Disease / clinical state'],
                  ['bg-violet-300', 'General concept'],
                  ['bg-cyan-300', 'Metric / monitoring'],
                  ['bg-green-300', 'Treatment / lifestyle'],
                ].map(([color, label]) => (
                  <span key={label} className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-600">
                    <span className={'h-2.5 w-2.5 rounded-sm ' + color} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
              <span className="text-[11px] text-slate-500">Tip: select a connected item in the details panel to focus it in the graph.</span>
              <button
                type="button"
                onClick={() => {
                  setGraphFilter('all');
                  const firstNodeId = graphModel.nodes[0]?.id || '';
                  setSelectedNodeId(firstNodeId);
                  const cy = cyRef.current;
                  if (cy) {
                    cy.elements().style('display', 'element');
                    cy.fit(undefined, 32);
                    if (firstNodeId) cy.center(cy.getElementById(firstNodeId));
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset graph
              </button>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Selected node</p>
                  <h2 className="mt-1 text-base font-bold text-slate-900">{selectedNode.label}</h2>
                </div>
                <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">{selectedNode.group.replace('-', ' ')}</span>
              </div>
              {selectedNode.value && <p className="mt-3 text-sm font-semibold text-teal-800">{selectedNode.value}</p>}
              <p className="mt-2 text-xs leading-5 text-slate-600">{selectedNode.description}</p>
              <div className="mt-4 space-y-2">
                {selectedNode.details.map((detail) => (
                  <div key={detail.label} className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <p className="text-[10px] font-medium text-slate-500">{detail.label}</p>
                    <p className="mt-1 break-words text-xs font-semibold text-slate-800">{detail.value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">Connected relationships</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{selectedEdges.length}</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">Choose a relationship to move to the connected node.</p>
              <div className="mt-3 space-y-2">
                {selectedEdges.map((edge) => {
                  const otherId = edge.source === selectedNode.id ? edge.target : edge.source;
                  const other = graphModel.nodes.find((node) => node.id === otherId);
                  return (
                    <button
                      key={edge.id}
                      type="button"
                      onClick={() => focusNode(otherId)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-left transition hover:border-teal-200 hover:bg-teal-50/60"
                    >
                      <span className="min-w-0">
                        <span className="block text-[11px] font-semibold text-slate-800">{edge.label}</span>
                        <span className="mt-1 block truncate text-[11px] text-slate-500">{other?.label || otherId}</span>
                        <span className="mt-1 block text-[10px] font-semibold text-amber-700">{edge.status.replace(/_/g, ' ')}</span>
                        <span className="mt-1 block text-[10px] text-slate-500">Sources: {edge.sourceRefs.join(', ') || 'not recorded'}</span>
                        {edge.evidenceNote && <span className="mt-1 block text-[10px] leading-4 text-slate-500">{edge.evidenceNote}</span>}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    </button>
                  );
                })}
                {selectedEdges.length === 0 && <p className="rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-500">No visible relationships for this node under the current filter.</p>}
              </div>
            </section>
          </aside>
        </div>
      ) : (
        <section className="space-y-4">
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" />
              <div>
                <h2 className="text-sm font-bold text-indigo-950">AI recommendation interface preview</h2>
                <p className="mt-1 text-xs leading-5 text-indigo-900/90">
                  The AI reader is not connected yet. These example suggestions are here to finalize the doctor review flow; they are not generated from the Knowledge Graph and are not clinical advice.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {recommendations.map((recommendation, index) => (
              <article key={recommendation.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600">{recommendation.category}</span>
                  <span className={'rounded-full border px-2.5 py-1 text-[10px] font-bold ' + statusClass(recommendation.status)}>{statusLabel(recommendation.status)}</span>
                </div>
                <div className="mt-4 flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                    {index === 0 ? <Activity className="h-4 w-4" /> : index === 1 ? <Sparkles className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold leading-5 text-slate-900">{recommendation.title}</h3>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{recommendation.priority}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Example rationale for doctor</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{recommendation.rationale}</p>
                  </div>
                  <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-teal-800">Patient-facing wording</p>
                    <p className="mt-1 text-xs leading-5 text-teal-950">{recommendation.patientMessage}</p>
                  </div>
                </div>

                <div className="mt-auto pt-5">
                  {recommendation.status === 'pending_review' && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onRecommendationStatusChange(recommendation.id, 'approved')}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-700 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-teal-800"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => onRecommendationStatusChange(recommendation.id, 'declined')}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Decline
                      </button>
                    </div>
                  )}
                  {recommendation.status === 'approved' && (
                    <div className="space-y-2">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-teal-800"><ShieldCheck className="h-4 w-4" /> Approved by doctor</p>
                      <button type="button" onClick={() => onRecommendationStatusChange(recommendation.id, 'pending_review')} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Return to review</button>
                    </div>
                  )}
                  {recommendation.status === 'declined' && (
                    <button type="button" onClick={() => onRecommendationStatusChange(recommendation.id, 'pending_review')} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Reconsider suggestion</button>
                  )}
                  {recommendation.status === 'published' && (
                    <div className="space-y-2">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700"><CheckCircle2 className="h-4 w-4" /> Visible in patient view</p>
                      <button type="button" onClick={() => onRecommendationStatusChange(recommendation.id, 'approved')} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Unshare from patient view</button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-teal-700" />
                  <h3 className="text-sm font-bold text-slate-900">Share approved suggestions</h3>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Only suggestions with doctor approval can be shown in the patient view. Declined or unreviewed suggestions stay hidden.
                </p>
                {feedback && <p className="mt-2 text-xs font-semibold text-teal-800" role="status">{feedback}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <span className="text-center text-xs font-semibold text-slate-500">{approvedCount} approved · {publishedCount} shared</span>
                <button
                  type="button"
                  disabled={approvedCount === 0}
                  onClick={handlePublish}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-xs font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Send className="h-4 w-4" />
                  Share with patient
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] leading-5 text-slate-500">
          <span className="font-semibold text-slate-700">Scope:</span> the graph is shown only in the doctor workspace. Patient view displays only recommendations the doctor has shared.
        </p>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-400"><Info className="h-3.5 w-3.5" /> Prototype state is not persisted</span>
      </div>
    </section>
  );
};

export default KnowledgeGraphView;
