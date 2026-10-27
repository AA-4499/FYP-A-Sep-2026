import React, { useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Info,
  Network,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Workflow,
} from "lucide-react";
import type { Patient } from "../types";
import { getSupabaseClient } from "../lib/supabase";
import { getForecastApiUrl } from "../lib/forecast";

interface Props {
  patients: Patient[];
  patientId: string;
  onSelectPatient: (patientId: string) => void;
  onPreviewPatientView: (patientId: string) => void;
}

type TabId = "patient" | "clinical" | "analysis";
type NodeRecord = {
  id: string;
  label: string;
  kind: string;
  category: string;
  description: string;
  details: Array<{ label: string; value: string }>;
};
type EdgeRecord = {
  id: string;
  source: string;
  target: string;
  label: string;
  status: string;
  sourceRefs: string[];
  evidenceNote: string;
};
type PatientGraphResponse = {
  patient_id: string;
  elements: { nodes: Array<{ data: Record<string, unknown> }>; edges: Array<{ data: Record<string, unknown> }> };
  stats: { total_nodes: number; total_edges: number; condition_count: number; graph_scope: string };
};
type ClinicalNode = {
  id: string;
  name: string;
  category: string;
  description: string;
  sourceRefs: string[];
  scope: string;
  schemaVersion: string;
};
type ClinicalEdge = {
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
};
type ClinicalGraphResponse = {
  source: string;
  scope: string;
  stats: { totalNodes: number; totalEdges: number; reviewedEdges: number; candidateEdges: number };
  nodes: ClinicalNode[];
  edges: ClinicalEdge[];
};
type AnalysisResponse = {
  provider: string;
  model: string | null;
  summary: string;
  observations: string[];
  followUpQuestions: string[];
  contextStats: Record<string, number>;
  safetyNote: string;
  error?: string;
};

async function requestApi<T>(path: string, signal?: AbortSignal, method = "GET"): Promise<T> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase authentication is not configured. Sign in with an authorised Doctor account.");
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error(error.message);
  if (!data.session) throw new Error("Sign in with an authorised Doctor account to load assigned knowledge graphs.");
  const apiBase = getForecastApiUrl();
  if (!apiBase) throw new Error("The Python backend is not configured. Set VITE_API_BASE_URL to the backend origin.");
  const response = await fetch(apiBase + path, {
    method,
    signal,
    headers: {
      Authorization: "Bearer " + data.session.access_token,
      Accept: "application/json",
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    ...(method === "POST" ? { body: "{}" } : {}),
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : {};
  if (!response.ok) {
    const detail = typeof payload.error === "string" ? payload.error : "Request failed (" + response.status + ").";
    throw new Error(detail);
  }
  return payload as T;
}

function textValue(value: unknown, fallback = "Not recorded"): string {
  if (value === null || value === undefined || value === "") return fallback;
  if (Array.isArray(value)) return value.map(String).join(", ") || fallback;
  return String(value);
}

function categoryFor(name: string, category: string, kind: string): string {
  if (kind.toLowerCase() === "patient") return "patient";
  const value = (category + " " + name).toLowerCase();
  if (/disease|condition|complication|diabetes|hypoglyc|hyperglyc|clinical state/.test(value)) return "condition";
  if (/monitor|metric|measurement|hba1c|glucose|cgm|c-peptide|indicator/.test(value)) return "monitoring";
  if (/treatment|medication|insulin|lifestyle|nutrition|exercise|management|therapy|risk factor/.test(value)) return "care";
  return "concept";
}

function getNodeColor(group: string): { background: string; border: string; text: string } {
  if (group === "patient") return { background: "#0f766e", border: "#0f766e", text: "#ffffff" };
  if (group === "condition") return { background: "#fff7ed", border: "#fdba74", text: "#9a3412" };
  if (group === "monitoring") return { background: "#ecfeff", border: "#67e8f9", text: "#155e75" };
  if (group === "care") return { background: "#f0fdf4", border: "#86efac", text: "#166534" };
  return { background: "#f5f3ff", border: "#c4b5fd", text: "#5b21b6" };
}

export const KnowledgeGraphView: React.FC<Props> = ({
  patients,
  patientId,
  onSelectPatient,
  onPreviewPatientView,
}) => {
  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("patient");
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [assignmentsError, setAssignmentsError] = useState("");
  const [patientGraph, setPatientGraph] = useState<PatientGraphResponse | null>(null);
  const [patientGraphLoading, setPatientGraphLoading] = useState(false);
  const [patientGraphError, setPatientGraphError] = useState("");
  const [clinicalGraph, setClinicalGraph] = useState<ClinicalGraphResponse | null>(null);
  const [clinicalGraphLoading, setClinicalGraphLoading] = useState(false);
  const [clinicalGraphError, setClinicalGraphError] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const selectedPatient = patients.find((item) => item.id === patientId);
  const selectablePatients = assignedIds.map((id) => ({
    id,
    patient: patients.find((item) => item.id === id),
  }));

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setAssignmentsLoading(true);
    setAssignmentsError("");
    void requestApi<{ patient_ids: string[] }>("/api/doctor/assigned-patients", controller.signal)
      .then((result) => {
        if (!active) return;
        const ids = Array.isArray(result.patient_ids)
          ? Array.from(new Set(result.patient_ids.map((id) => String(id).trim()).filter(Boolean)))
          : [];
        setAssignedIds(ids);
        if (ids.length === 0) setAssignmentsError("No patients are assigned to this Doctor account. Ask an administrator to configure clinician_patient_assignments.");
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return;
        setAssignedIds([]);
        setAssignmentsError(error instanceof Error ? error.message : "Assigned patient access could not be verified.");
      })
      .finally(() => {
        if (active && !controller.signal.aborted) setAssignmentsLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [refreshKey]);

  useEffect(() => {
    if (assignedIds.length > 0 && !assignedIds.includes(patientId)) {
      onSelectPatient(assignedIds[0]);
    }
  }, [assignedIds, patientId, onSelectPatient]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setClinicalGraphLoading(true);
    setClinicalGraphError("");
    void requestApi<ClinicalGraphResponse>("/api/doctor/knowledge-graph", controller.signal)
      .then((result) => {
        if (!active) return;
        if (!Array.isArray(result.nodes) || !Array.isArray(result.edges)) {
          throw new Error("The clinical graph response has an unexpected structure.");
        }
        setClinicalGraph(result);
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return;
        setClinicalGraph(null);
        setClinicalGraphError(error instanceof Error ? error.message : "The clinical concept graph could not be loaded.");
      })
      .finally(() => {
        if (active && !controller.signal.aborted) setClinicalGraphLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!patientId || !assignedIds.includes(patientId)) {
      setPatientGraph(null);
      setPatientGraphError("");
      setPatientGraphLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    let active = true;
    setPatientGraphLoading(true);
    setPatientGraphError("");
    setAnalysis(null);
    setAnalysisError("");
    void requestApi<PatientGraphResponse>(
      "/api/doctor/patients/" + encodeURIComponent(patientId) + "/knowledge-graph",
      controller.signal,
    )
      .then((result) => {
        if (!active) return;
        if (!result.elements || !Array.isArray(result.elements.nodes) || !Array.isArray(result.elements.edges)) {
          throw new Error("The patient graph response has an unexpected structure.");
        }
        setPatientGraph(result);
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return;
        setPatientGraph(null);
        setPatientGraphError(error instanceof Error ? error.message : "The selected patient's graph could not be loaded.");
      })
      .finally(() => {
        if (active && !controller.signal.aborted) setPatientGraphLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [patientId, assignedIds, refreshKey]);

  const nodes = useMemo<NodeRecord[]>(() => {
    if (activeTab === "patient") {
      return (patientGraph?.elements.nodes || []).map((element) => {
        const data = element.data || {};
        const label = textValue(data.label, "Unnamed node");
        const kind = textValue(data.kind, "Condition");
        const category = textValue(data.category, kind);
        return {
          id: textValue(data.id, label),
          label,
          kind,
          category,
          description: textValue(data.description, kind === "Patient" ? "Patient anchor for recorded conditions." : "Recorded condition from the selected patient summary."),
          details: [
            { label: "Node type", value: kind },
            { label: "Category", value: category },
            { label: "Patient record", value: patientId },
          ],
        };
      });
    }
    if (activeTab === "clinical") {
      return (clinicalGraph?.nodes || []).map((node) => ({
        id: node.id,
        label: node.name,
        kind: "MedicalConcept",
        category: node.category || "Clinical concept",
        description: node.description || "No description is stored for this concept.",
        details: [
          { label: "Category", value: node.category || "Uncategorised" },
          { label: "Source references", value: (node.sourceRefs || []).join(", ") || "Not recorded" },
          { label: "Scope", value: node.scope || "Not specified" },
          { label: "Schema version", value: node.schemaVersion || "Not specified" },
        ],
      }));
    }
    return [];
  }, [activeTab, patientGraph, clinicalGraph, patientId]);

  const edges = useMemo<EdgeRecord[]>(() => {
    if (activeTab === "patient") {
      return (patientGraph?.elements.edges || []).map((element, index) => {
        const data = element.data || {};
        return {
          id: textValue(data.id, "patient-edge-" + index),
          source: textValue(data.source, ""),
          target: textValue(data.target, ""),
          label: textValue(data.label, "related to"),
          status: "recorded",
          sourceRefs: [],
          evidenceNote: "",
        };
      });
    }
    if (activeTab === "clinical") {
      return (clinicalGraph?.edges || []).map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label || edge.predicate.toLowerCase().replace(/_/g, " "),
        status: edge.evidenceStatus || "unspecified",
        sourceRefs: edge.sourceRefs || [],
        evidenceNote: edge.evidenceNote || "",
      }));
    }
    return [];
  }, [activeTab, patientGraph, clinicalGraph]);

  const filteredNodes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? nodes.filter((node) => (node.label + " " + node.category).toLowerCase().includes(query)) : nodes;
  }, [nodes, search]);
  const visibleIds = useMemo(() => new Set(filteredNodes.map((node) => node.id)), [filteredNodes]);
  const visibleEdges = useMemo(() => edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)), [edges, visibleIds]);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || filteredNodes[0] || nodes[0];
  const connectedEdges = selectedNode ? edges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id) : [];

  useEffect(() => {
    if (activeTab === "analysis" || !graphContainerRef.current) return undefined;
    const elements: ElementDefinition[] = [
      ...nodes.map((node) => ({
        data: { id: node.id, label: node.label, kind: node.kind, group: categoryFor(node.label, node.category, node.kind) },
      })),
      ...edges.map((edge) => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label,
          status: edge.status,
        },
      })),
    ];
    const cy = cytoscape({
      container: graphContainerRef.current,
      elements,
      style: [
        { selector: "node", style: {
          "background-color": "#f5f3ff",
          "border-color": "#c4b5fd",
          "border-width": 1.5,
          shape: "round-rectangle",
          width: "label",
          height: "label",
          padding: "12px",
          label: "data(label)",
          color: "#0f172a",
          "font-size": 10,
          "font-weight": 600,
          "text-wrap": "wrap",
          "text-max-width": "105px",
          "text-valign": "center",
          "text-halign": "center",
        }},
        { selector: 'node[group = "patient"]', style: { "background-color": "#0f766e", "border-color": "#0f766e", color: "#ffffff", padding: "16px" }},
        { selector: 'node[group = "condition"]', style: { "background-color": "#fff7ed", "border-color": "#fdba74", color: "#9a3412" }},
        { selector: 'node[group = "monitoring"]', style: { "background-color": "#ecfeff", "border-color": "#67e8f9", color: "#155e75" }},
        { selector: 'node[group = "care"]', style: { "background-color": "#f0fdf4", "border-color": "#86efac", color: "#166534" }},
        { selector: "node.is-selected", style: { "border-color": "#0d9488", "border-width": 4, "overlay-color": "#14b8a6", "overlay-opacity": 0.13, "overlay-padding": 6 }},
        { selector: "edge", style: {
          width: 1.4,
          "line-color": "#cbd5e1",
          "target-arrow-color": "#94a3b8",
          "target-arrow-shape": "triangle",
          "curve-style": "bezier",
          label: "data(label)",
          "font-size": 7,
          color: "#64748b",
          "text-rotation": "autorotate",
          "text-background-color": "#ffffff",
          "text-background-opacity": 0.9,
          "text-background-padding": "2px",
        }},
        { selector: 'edge[status = "candidate_for_review"]', style: { "line-style": "dashed", "line-color": "#f59e0b", "target-arrow-color": "#f59e0b" }},
        { selector: 'edge[status = "reviewed"]', style: { "line-color": "#0f766e", "target-arrow-color": "#0f766e" }},
      ],
      layout: { name: "cose", animate: false, fit: true, padding: 30, nodeRepulsion: 8500, idealEdgeLength: 115, gravity: 0.25, numIter: 500 },
      minZoom: 0.4,
      maxZoom: 2.4,
      wheelSensitivity: 0.18,
    });
    cyRef.current = cy;
    cy.on("tap", "node", (event) => setSelectedNodeId(event.target.id()));
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [activeTab, nodes, edges]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || activeTab === "analysis") return;
    cy.nodes().forEach((node) => {
      const show = visibleIds.has(node.id());
      node.style("display", show ? "element" : "none");
      if (show) node.removeClass("is-selected");
    });
    cy.edges().forEach((edge) => {
      const show = visibleIds.has(edge.data("source")) && visibleIds.has(edge.data("target"));
      edge.style("display", show ? "element" : "none");
    });
    if (selectedNodeId && visibleIds.has(selectedNodeId)) {
      cy.getElementById(selectedNodeId).addClass("is-selected");
    }
    const visible = cy.elements().filter((element) => element.style("display") !== "none");
    if (visible.length) cy.fit(visible, 32);
  }, [activeTab, search, visibleIds, selectedNodeId, nodes, edges]);

  async function runAnalysis() {
    if (!patientId || !assignedIds.includes(patientId)) return;
    setAnalysisLoading(true);
    setAnalysisError("");
    setAnalysis(null);
    try {
      const result = await requestApi<AnalysisResponse>(
        "/api/doctor/patients/" + encodeURIComponent(patientId) + "/knowledge-graph/analysis",
        undefined,
        "POST",
      );
      setAnalysis(result);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "Could not analyse this knowledge graph.");
    } finally {
      setAnalysisLoading(false);
    }
  }

  const currentLoading = activeTab === "patient" ? patientGraphLoading : activeTab === "clinical" ? clinicalGraphLoading : analysisLoading;
  const currentError = activeTab === "patient" ? patientGraphError : activeTab === "clinical" ? clinicalGraphError : analysisError;
  const nodeCount = activeTab === "patient" ? patientGraph?.stats.total_nodes ?? 0 : clinicalGraph?.stats.totalNodes ?? 0;
  const edgeCount = activeTab === "patient" ? patientGraph?.stats.total_edges ?? 0 : clinicalGraph?.stats.totalEdges ?? 0;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-800">
              <Network className="h-3.5 w-3.5" />
              Doctor workspace
            </span>
            <span className={"rounded-full border px-2.5 py-1 text-[11px] font-semibold " + (assignmentsError ? "border-rose-200 bg-rose-50 text-rose-800" : assignmentsLoading ? "border-amber-200 bg-amber-50 text-amber-800" : "border-teal-200 bg-teal-50 text-teal-800")}>
              {assignmentsLoading ? "Loading assigned patients…" : assignmentsError ? "Patient assignments unavailable" : assignedIds.length + " assigned patient" + (assignedIds.length === 1 ? "" : "s")}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Knowledge Graph</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Select an assigned patient to inspect recorded conditions, explore shared clinical concepts, and request a graph-grounded interpretation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={currentLoading || assignmentsLoading} className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-xs font-semibold text-teal-800 hover:bg-teal-100 disabled:opacity-50">
            <RefreshCw className={"h-4 w-4 " + (currentLoading ? "animate-spin" : "")} />
            Refresh
          </button>
          <button type="button" onClick={() => patientId && onPreviewPatientView(patientId)} disabled={!patientId || !assignedIds.includes(patientId)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <UserRound className="h-4 w-4" />
            Open patient workspace
          </button>
        </div>
      </div>

      {assignmentsError && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {assignmentsError}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[minmax(260px,1fr)_minmax(0,2fr)]">
        <label className="block rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Select patient</span>
          <select
            value={assignedIds.includes(patientId) ? patientId : ""}
            onChange={(event) => onSelectPatient(event.target.value)}
            disabled={assignmentsLoading || assignedIds.length === 0}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-teal-500 disabled:opacity-60"
          >
            <option value="">Choose an assigned patient</option>
            {selectablePatients.map(({ id, patient }) => (
              <option key={id} value={id}>{patient?.name || "Patient " + id} · {id}</option>
            ))}
          </select>
          <span className="mt-2 block text-[11px] leading-5 text-slate-500">Only patient IDs assigned to this Doctor account are selectable.</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Patient</span>
            <p className="mt-2 truncate text-base font-bold text-slate-900">{selectedPatient?.name || (patientId ? "Patient " + patientId : "No selection")}</p>
            <p className="mt-1 truncate text-[11px] text-slate-500">{patientId || "Select an assigned record"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Graph nodes</span>
            <p className="mt-2 text-2xl font-bold text-slate-900">{nodeCount}</p>
            <p className="mt-1 text-[11px] text-slate-500">{activeTab === "patient" ? "Patient and recorded conditions" : "Shared medical concepts"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Relationships</span>
            <p className="mt-2 text-2xl font-bold text-slate-900">{edgeCount}</p>
            <p className="mt-1 text-[11px] text-slate-500">{activeTab === "clinical" ? (clinicalGraph?.stats.reviewedEdges ?? 0) + " reviewed · " + (clinicalGraph?.stats.candidateEdges ?? 0) + " candidates" : "Recorded graph relationships"}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200">
        <button type="button" onClick={() => setActiveTab("patient")} className={"inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold " + (activeTab === "patient" ? "border-teal-600 text-teal-800" : "border-transparent text-slate-500 hover:text-slate-800")}>
          <UserRound className="h-4 w-4" />
          Patient graph
        </button>
        <button type="button" onClick={() => setActiveTab("clinical")} className={"inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold " + (activeTab === "clinical" ? "border-teal-600 text-teal-800" : "border-transparent text-slate-500 hover:text-slate-800")}>
          <Network className="h-4 w-4" />
          Clinical concepts
        </button>
        <button type="button" onClick={() => setActiveTab("analysis")} className={"inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold " + (activeTab === "analysis" ? "border-teal-600 text-teal-800" : "border-transparent text-slate-500 hover:text-slate-800")}>
          <BrainCircuit className="h-4 w-4" />
          Graph analysis
        </button>
      </div>

      {currentError && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {currentError}
        </div>
      )}

      {activeTab !== "analysis" ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">{activeTab === "patient" ? "Selected patient's conditions" : "Shared clinical concept graph"}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">{activeTab === "patient" ? "Nodes are built from the selected patient's recorded summary fields." : "Nodes and edges are loaded from MedicalConcept records in Aura."}</p>
              </div>
              <label className="relative block">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter nodes…" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs outline-none focus:border-teal-500 sm:w-52" />
              </label>
            </div>
            <div className="relative">
              <div ref={graphContainerRef} role="img" aria-label={activeTab === "patient" ? "Selected patient's interactive condition knowledge graph" : "Interactive shared clinical concept graph"} className="h-[450px] w-full bg-slate-50/70 sm:h-[520px]" />
              {(currentLoading || nodes.length === 0) && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 p-6 text-center text-sm text-slate-500">
                  {currentLoading ? "Loading graph data…" : activeTab === "clinical" ? "No clinical concepts were returned. Seed the shared clinical concept graph in Neo4j Aura." : "No recorded conditions are available for this patient."}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
              <span className="text-[11px] text-slate-500">{filteredNodes.length} nodes visible · {visibleEdges.length} connecting relationships</span>
              <button type="button" onClick={() => { setSearch(""); setSelectedNodeId(nodes[0]?.id || ""); const cy = cyRef.current; if (cy) { cy.nodes().style("display", "element"); cy.edges().style("display", "element"); cy.fit(cy.elements(), 32); } }} className="text-[11px] font-semibold text-teal-800 hover:underline">Reset view</button>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Selected node</p>
              <h2 className="mt-1 text-base font-bold text-slate-900">{selectedNode?.label || "Select a node"}</h2>
              <p className="mt-2 text-xs leading-5 text-slate-600">{selectedNode?.description || "Select a graph node to inspect its details."}</p>
              <div className="mt-4 space-y-2">
                {(selectedNode?.details || []).map((detail) => (
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
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{connectedEdges.length}</span>
              </div>
              <div className="mt-3 space-y-2">
                {connectedEdges.map((edge) => {
                  const otherId = edge.source === selectedNode?.id ? edge.target : edge.source;
                  const other = nodes.find((node) => node.id === otherId);
                  return (
                    <button key={edge.id} type="button" onClick={() => { setSelectedNodeId(otherId); const cy = cyRef.current; const element = cy?.getElementById(otherId); if (cy && element && element.length > 0) { cy.center(element); cy.zoom(Math.min(1.1, cy.maxZoom())); } }} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-left transition hover:border-teal-200 hover:bg-teal-50/60">
                      <span className="min-w-0">
                        <span className="block text-[11px] font-semibold text-slate-800">{edge.label}</span>
                        <span className="mt-1 block truncate text-[11px] text-slate-500">{other?.label || otherId}</span>
                        <span className="mt-1 block text-[10px] font-semibold text-slate-500">{edge.status.replace(/_/g, " ")}</span>
                        {edge.sourceRefs.length > 0 && <span className="mt-1 block text-[10px] text-slate-500">Sources: {edge.sourceRefs.join(", ")}</span>}
                        {edge.evidenceNote && <span className="mt-1 block text-[10px] leading-4 text-slate-500">{edge.evidenceNote}</span>}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    </button>
                  );
                })}
                {connectedEdges.length === 0 && <p className="rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-500">No relationships connect to this node.</p>}
              </div>
            </section>
          </aside>
        </div>
      ) : (
        <div className="space-y-4">
          <section className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-5">
            <div className="flex items-start gap-3">
              <BrainCircuit className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" />
              <div>
                <h2 className="text-sm font-bold text-indigo-950">Graph-grounded interpretation</h2>
                <p className="mt-1 text-xs leading-5 text-indigo-900/90">
                  The analysis compares the selected patient's recorded condition nodes with the shared clinical graph. Only relationships marked reviewed may be used as evidence; candidate relationships are excluded.
                </p>
              </div>
              <button type="button" onClick={() => void runAnalysis()} disabled={analysisLoading || !assignedIds.includes(patientId)} className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-700 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-800 disabled:opacity-50">
                <Activity className={"h-4 w-4 " + (analysisLoading ? "animate-pulse" : "")} />
                {analysisLoading ? "Analysing…" : analysis ? "Run again" : "Analyse graph"}
              </button>
            </div>
          </section>
          {analysisLoading && <div role="status" className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Reading the selected patient graph and reviewed clinical relationships…</div>}
          {analysis && (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-slate-900">Summary</h2>
                  <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-800">
                    {analysis.provider === "openai" ? "AI model" : "Rules-based graph reader"}
                    {analysis.model ? " · " + analysis.model : ""}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-700">{analysis.summary}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Recorded conditions", analysis.contextStats.recordedConditions ?? 0],
                    ["Matched concepts", analysis.contextStats.matchedConcepts ?? 0],
                    ["Reviewed relationships", analysis.contextStats.reviewedRelationships ?? 0],
                    ["Candidates excluded", analysis.contextStats.candidateRelationshipsExcluded ?? 0],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[10px] font-medium text-slate-500">{label}</p>
                      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>
              </section>
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><CheckCircle2 className="h-4 w-4 text-teal-700" /> Observations</h3>
                  <ul className="mt-3 space-y-2">
                    {(analysis.observations || []).map((item, index) => <li key={index} className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-700">{item}</li>)}
                  </ul>
                </section>
                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><ShieldCheck className="h-4 w-4 text-teal-700" /> Questions for the clinician</h3>
                  <ul className="mt-3 space-y-2">
                    {(analysis.followUpQuestions || []).map((item, index) => <li key={index} className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-700">{item}</li>)}
                  </ul>
                </section>
              </div>
              <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[11px] leading-5 text-slate-500"><Info className="mr-1 inline h-3.5 w-3.5" />{analysis.safetyNote}</p>
            </>
          )}
          {!analysis && !analysisLoading && !analysisError && <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Select “Analyse graph” to produce a summary grounded in the selected patient graph and the shared clinical concept graph.</div>}
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] leading-5 text-slate-500"><span className="font-semibold text-slate-700">Data boundaries:</span> patient graphs are returned only after the backend confirms a doctor assignment. The browser never connects to Aura directly.</p>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-400"><Workflow className="h-3.5 w-3.5" /> Neo4j Aura · Supabase assignments</span>
      </div>
    </section>
  );
};

export default KnowledgeGraphView;
