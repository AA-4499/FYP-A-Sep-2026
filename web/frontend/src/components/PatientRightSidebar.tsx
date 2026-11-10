import React, { useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ExternalLink,
  Filter,
  Info,
  Lightbulb,
  Maximize2,
  Minimize2,
  PanelRightClose,
  RotateCcw,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Patient, NavigationModule } from "../types";
import type { ClinicalRecommendation } from "../data/knowledgeGraphDemoData";

export type SidebarTab = "recommendations" | "knowledge_graph";

interface PatientRightSidebarProps {
  patient: Patient | null;
  patientId?: string;
  recommendations?: ClinicalRecommendation[];
  canViewKnowledgeGraph?: boolean;
  onNavigate?: (module: NavigationModule) => void;
  isOpen?: boolean;
  onClose?: () => void;
  defaultTab?: SidebarTab;
}

interface GraphNodeData {
  id: string;
  label: string;
  category: "patient" | "condition" | "monitoring" | "care" | "hub";
  kind: string;
  description: string;
  details: Array<{ label: string; value: string }>;
}

interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
  label: string;
}

/** A view of recorded facts only; this does not infer diagnoses or care plans. */
export function generatePatientGraph(patient: Patient | null, patientId?: string): { nodes: GraphNodeData[]; edges: GraphEdgeData[] } {
  if (!patient || (patientId && patientId !== patient.id)) return { nodes: [], edges: [] };
  const nodes: GraphNodeData[] = [{ id: "patient_core", label: patient.name?.trim() || "Patient record", category: "patient", kind: "Patient record", description: "Recorded patient information.", details: [{ label: "Patient ID", value: patient.id }] }];
  const edges: GraphEdgeData[] = [];
  const add = (id: string, label: string, value: string, category: GraphNodeData['category'] = "monitoring") => {
    nodes.push({ id, label: label + ": " + value, category, kind: "Recorded information", description: "From this patient's recorded profile or measurements.", details: [{ label, value }] });
    edges.push({ id: "edge_" + id, source: "patient_core", target: id, label: "has recorded information" });
  };
  const condition = patient.condition?.trim();
  if (condition && !/^(not recorded|unknown|unspecified)$/i.test(condition)) add("node_diabetes", "Condition", condition, "condition");
  const measurement = (id: string, label: string, value: number | undefined, unit: string) => {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) add(id, label, String(value) + " " + unit);
  };
  measurement("node_hba1c", "HbA1c", patient.hba1c, "%");
  measurement("node_fasting", "Fasting", patient.fastingGlucose, "mmol/L");
  measurement("node_bmi", "BMI", patient.bmi, "kg/m²");
  const readings = (patient.cgmReadings ?? []).filter(row => Number.isFinite(row.cgm) && row.cgm > 0 && Number.isFinite(row.timestamp));
  if (readings.length) {
    add("node_cgm", "CGM history", String(readings.length) + " recorded readings");
    if (Number.isFinite(patient.timeInRangePct) && patient.timeInRangePct >= 0 && patient.timeInRangePct <= 100) add("node_glycemic", "Time in range", String(patient.timeInRangePct) + "%");
  }
  return { nodes, edges };
}

export function PatientRightSidebar({
  patient,
  patientId,
  recommendations: suppliedRecommendations = [],
  canViewKnowledgeGraph = false,
  onNavigate,
  isOpen = true,
  onClose,
  defaultTab = "recommendations",
}: PatientRightSidebarProps) {
  // If canViewKnowledgeGraph is false, active tab is strictly "recommendations"
  const [activeTab, setActiveTab] = useState<SidebarTab>(
    canViewKnowledgeGraph && defaultTab === "knowledge_graph"
      ? "knowledge_graph"
      : "recommendations",
  );
  const [isExtended, setIsExtended] = useState<boolean>(false);
  const recommendations = suppliedRecommendations.filter(rec => rec.status === "published" && rec.patientId === patient?.id && (!patientId || rec.patientId === patientId));
  const [expandedRecs, setExpandedRecs] = useState<Record<string, boolean>>({});
  const [recCategoryFilter, setRecCategoryFilter] = useState<string>("all");
  const [recSearch, setRecSearch] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedNodeId, setSelectedNodeId] = useState<string>("patient_core");

  const cyContainerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);

  // If canViewKnowledgeGraph changes to false, force back to recommendations
  useEffect(() => {
    if (!canViewKnowledgeGraph && activeTab === "knowledge_graph") {
      setActiveTab("recommendations");
    }
  }, [canViewKnowledgeGraph, activeTab]);

  const graphData = useMemo(() => {
    return generatePatientGraph(patient, patientId);
  }, [patient, patientId]);

  const filteredNodes = useMemo(() => {
    if (selectedCategory === "all") return graphData.nodes;
    if (selectedCategory === "condition") {
      return graphData.nodes.filter(
        (n) => n.category === "condition" || n.id === "patient_core" || n.id === "cat_conditions",
      );
    }
    if (selectedCategory === "monitoring") {
      return graphData.nodes.filter(
        (n) => n.category === "monitoring" || n.id === "patient_core" || n.id === "cat_clinical",
      );
    }
    if (selectedCategory === "care") {
      return graphData.nodes.filter(
        (n) => n.category === "care" || n.id === "patient_core" || n.id === "cat_lifestyle" || n.id === "cat_medical",
      );
    }
    return graphData.nodes;
  }, [graphData.nodes, selectedCategory]);

  const visibleNodeIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes],
  );

  const visibleEdges = useMemo(
    () =>
      graphData.edges.filter(
        (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target),
      ),
    [graphData.edges, visibleNodeIds],
  );

  const selectedNode = useMemo(() => {
    return (
      graphData.nodes.find((n) => n.id === selectedNodeId) ||
      graphData.nodes[0]
    );
  }, [graphData.nodes, selectedNodeId]);

  // Filter recommendations by search and category
  const filteredRecommendations = useMemo(() => {
    return recommendations.filter((item) => {
      const matchesCategory =
        recCategoryFilter === "all" ||
        item.category.toLowerCase().includes(recCategoryFilter.toLowerCase());
      const query = recSearch.trim().toLowerCase();
      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.patientMessage.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [recommendations, recCategoryFilter, recSearch]);

  const recCategories = useMemo(() => {
    const set = new Set<string>();
    recommendations.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set);
  }, [recommendations]);

  // Initialize and update Cytoscape canvas when Knowledge Graph tab is active
  useEffect(() => {
    if (activeTab !== "knowledge_graph" || !canViewKnowledgeGraph || !cyContainerRef.current) {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
      return undefined;
    }

    const elements: ElementDefinition[] = [
      ...filteredNodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label,
          category: node.category,
          kind: node.kind,
        },
      })),
      ...visibleEdges.map((edge) => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label,
        },
      })),
    ];

    const cy = cytoscape({
      container: cyContainerRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#f8fafc",
            "border-color": "#cbd5e1",
            "border-width": 1.5,
            shape: "round-rectangle",
            width: "label",
            height: "label",
            padding: "8px 10px",
            label: "data(label)",
            color: "#0f172a",
            "font-size": 9,
            "font-weight": 600,
            "text-wrap": "wrap",
            "text-max-width": "90px",
            "text-valign": "center",
            "text-halign": "center",
          },
        },
        {
          selector: 'node[category = "patient"]',
          style: {
            "background-color": "#0f766e",
            "border-color": "#0f766e",
            color: "#ffffff",
            "font-size": 10,
            "font-weight": 700,
            padding: "10px 14px",
          },
        },
        {
          selector: 'node[category = "hub"]',
          style: {
            "background-color": "#f5f3ff",
            "border-color": "#c4b5fd",
            color: "#6b21a8",
            "font-weight": 700,
          },
        },
        {
          selector: 'node[category = "condition"]',
          style: {
            "background-color": "#fff7ed",
            "border-color": "#fdba74",
            color: "#9a3412",
          },
        },
        {
          selector: 'node[category = "monitoring"]',
          style: {
            "background-color": "#ecfeff",
            "border-color": "#67e8f9",
            color: "#155e75",
          },
        },
        {
          selector: 'node[category = "care"]',
          style: {
            "background-color": "#f0fdf4",
            "border-color": "#86efac",
            color: "#166534",
          },
        },
        {
          selector: "node.is-selected",
          style: {
            "border-color": "#0d9488",
            "border-width": 3,
            "overlay-color": "#14b8a6",
            "overlay-opacity": 0.15,
            "overlay-padding": 5,
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.2,
            "line-color": "#cbd5e1",
            "target-arrow-color": "#94a3b8",
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.8,
            "curve-style": "bezier",
            label: "data(label)",
            "font-size": 7,
            color: "#64748b",
            "text-rotation": "autorotate",
            "text-background-color": "#ffffff",
            "text-background-opacity": 0.85,
            "text-background-padding": "2px",
          },
        },
      ],
      layout: {
        name: "cose",
        animate: false,
        fit: true,
        padding: 24,
        nodeRepulsion: 6500,
        idealEdgeLength: 85,
        gravity: 0.35,
        numIter: 400,
      },
      minZoom: 0.35,
      maxZoom: 2.5,
      wheelSensitivity: 0.2,
    });

    cyRef.current = cy;

    cy.on("tap", "node", (event) => {
      const id = event.target.id();
      setSelectedNodeId(id);
    });

    if (selectedNodeId && cy.getElementById(selectedNodeId).length) {
      cy.getElementById(selectedNodeId).addClass("is-selected");
    }

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [activeTab, canViewKnowledgeGraph, filteredNodes, visibleEdges]);

  // When sidebar width extends or restores, resize cytoscape
  useEffect(() => {
    if (cyRef.current && activeTab === "knowledge_graph") {
      const timer = setTimeout(() => {
        cyRef.current?.resize();
        cyRef.current?.fit(undefined, 24);
      }, 320);
      return () => clearTimeout(timer);
    }
  }, [isExtended, activeTab]);

  // Synchronize selected node class
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().removeClass("is-selected");
    if (selectedNodeId && cy.getElementById(selectedNodeId).length) {
      cy.getElementById(selectedNodeId).addClass("is-selected");
    }
  }, [selectedNodeId]);

  const handleZoomIn = () => {
    const cy = cyRef.current;
    if (cy) cy.zoom(cy.zoom() * 1.25);
  };

  const handleZoomOut = () => {
    const cy = cyRef.current;
    if (cy) cy.zoom(cy.zoom() * 0.8);
  };

  const handleFit = () => {
    const cy = cyRef.current;
    if (cy) cy.fit(undefined, 20);
  };

  const handleReset = () => {
    setSelectedCategory("all");
    setSelectedNodeId("patient_core");
    const cy = cyRef.current;
    if (cy) cy.fit(undefined, 24);
  };

  const toggleRecExpand = (id: string) => {
    setExpandedRecs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!isOpen) return null;

  return (
    <aside
      data-testid="patient-right-sidebar"
      aria-label="Care recommendations and clinical sidebar"
      className="w-full shrink-0 transition-all duration-300 ease-in-out lg:sticky lg:top-5 lg:w-[350px] xl:w-[380px]"
    >
      <div className="flex flex-col rounded-3xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700 shrink-0">
              {activeTab === "knowledge_graph" ? (
                <Share2 className="h-4 w-4 text-purple-700" />
              ) : (
                <Lightbulb className="h-4 w-4 text-teal-700" />
              )}
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 truncate">
                {!canViewKnowledgeGraph
                  ? "My Recommendations"
                  : activeTab === "knowledge_graph"
                  ? "Clinical Knowledge Graph"
                  : "Patient Recommendations"}
              </h2>
              <p className="text-[10px] font-medium text-slate-500 truncate">
                {!canViewKnowledgeGraph
                  ? "Doctor-Approved Guidance"
                  : "Clinician & Patient Workspace"}
              </p>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Hide sidebar"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 transition"
            >
              <PanelRightClose size={18} />
            </button>
          )}
        </div>

        {/* Tab Switcher: Only displayed when doctor has permission to view knowledge graph */}
        {canViewKnowledgeGraph && (
          <div className="mt-3.5 flex rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setActiveTab("recommendations")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition ${
                activeTab === "recommendations"
                  ? "bg-white text-teal-800 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Lightbulb className="h-3.5 w-3.5 text-teal-600" />
              <span>Recommendations</span>
              {recommendations.length > 0 && (
                <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[9px] font-bold text-teal-800">
                  {recommendations.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("knowledge_graph")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition ${
                activeTab === "knowledge_graph"
                  ? "bg-white text-purple-800 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Share2 className="h-3.5 w-3.5 text-purple-600" />
              <span>Knowledge Graph</span>
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 1: RECOMMENDATIONS (DEFAULT & ONLY VIEW FOR PATIENT) */}
        {/* ============================================================== */}
        {activeTab === "recommendations" && (
          <div className="mt-4 space-y-3.5">
            {/* Header / Filter bar */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                  <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
                  Approved by Care Team
                </span>
                <span className="text-[11px] font-medium text-slate-400">
                  {filteredRecommendations.length} of {recommendations.length} {recommendations.length === 1 ? "item" : "items"}
                </span>
              </div>

              {/* Search input if multiple recommendations */}
              {recommendations.length > 2 && (
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={recSearch}
                    onChange={(e) => setRecSearch(e.target.value)}
                    placeholder="Search recommendations…"
                    aria-label="Search recommendations"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl placeholder-slate-400 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white transition"
                  />
                </div>
              )}

              {/* Category Filter Chips */}
              {recCategories.length > 1 && (
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setRecCategoryFilter("all")}
                    className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold transition ${
                      recCategoryFilter === "all"
                        ? "bg-teal-700 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    All
                  </button>
                  {recCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setRecCategoryFilter(cat)}
                      className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold transition ${
                        recCategoryFilter === cat
                          ? "bg-teal-700 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Recommendations List */}
            {filteredRecommendations.length > 0 ? (
              <div
                className={`space-y-3 overflow-y-auto pr-1 ${
                  isExtended
                    ? "max-h-[640px] grid grid-cols-1 md:grid-cols-2 gap-3 space-y-0"
                    : "max-h-[520px]"
                }`}
              >
                {filteredRecommendations.map((rec) => {
                  const isExpanded = !!expandedRecs[rec.id];
                  return (
                    <article
                      key={rec.id}
                      className="rounded-2xl border border-teal-100/90 bg-teal-50/20 p-3.5 transition hover:border-teal-300 hover:bg-teal-50/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="rounded-full bg-teal-100/70 px-2 py-0.5 text-[10px] font-bold text-teal-800">
                          {rec.category || "Clinical"}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          Approved
                        </span>
                      </div>

                      <h3 className="mt-2 text-xs font-bold text-slate-900 leading-snug">
                        {rec.title}
                      </h3>
                      <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                        {rec.patientMessage}
                      </p>

                      {isExpanded && rec.rationale && (
                        <div className="mt-2.5 rounded-xl border border-slate-200/80 bg-white p-2.5 text-[11px] leading-relaxed text-slate-600">
                          <p className="font-semibold text-slate-700">Clinical rationale:</p>
                          <p className="mt-0.5 text-slate-500">{rec.rationale}</p>
                          {rec.priority && (
                            <p className="mt-1 text-[10px] font-medium text-teal-700">
                              Priority: {rec.priority}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-between border-t border-teal-100/60 pt-2 text-[10px] text-slate-400">
                        <span>Shared by your care team</span>
                        <button
                          type="button"
                          onClick={() => toggleRecExpand(rec.id)}
                          className="inline-flex items-center gap-0.5 font-semibold text-teal-700 hover:text-teal-900"
                        >
                          {isExpanded ? "Less" : "Details"}
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-10 px-4 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                  <Lightbulb className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-xs font-bold text-slate-800">
                  No recommendations yet
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  When your clinician reviews your glucose levels and publishes advice, it will appear here.
                </p>
              </div>
            )}

            <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5 text-[10px] leading-relaxed text-slate-500 flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-teal-600 shrink-0 mt-0.5" />
              <span>
                These items are agreed upon with your clinician to support daily lifestyle and glucose monitoring.
              </span>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: KNOWLEDGE GRAPH (DOCTOR-ONLY) */}
        {/* ============================================================== */}
        {activeTab === "knowledge_graph" && canViewKnowledgeGraph && (
          <div className="mt-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900">Personal Health Graph</span>
                <p className="text-[10px] text-slate-500">Recorded conditions and measurements</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleZoomIn}
                  aria-label="Zoom in"
                  className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50 transition"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleZoomOut}
                  aria-label="Zoom out"
                  className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50 transition"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleFit}
                  aria-label="Fit graph"
                  className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50 transition"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  aria-label="Reset graph"
                  className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50 transition"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="flex flex-wrap gap-1">
              {[
                { id: "all", label: "All" },
                { id: "condition", label: "Conditions" },
                { id: "monitoring", label: "Biomarkers" },
                { id: "care", label: "Care & Lifestyle" },
              ].map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setSelectedCategory(chip.id)}
                  className={`rounded-lg px-2 py-1 text-[10px] font-semibold transition ${
                    selectedCategory === chip.id
                      ? "bg-purple-100 text-purple-900 font-bold"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Cytoscape Canvas Container */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70">
              <div
                ref={cyContainerRef}
                className={`w-full cursor-grab active:cursor-grabbing transition-all duration-300 ${
                  isExtended ? "h-[420px]" : "h-[280px]"
                }`}
                role="img"
                aria-label="Interactive patient knowledge graph"
              />
              <div className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-white/80 px-2 py-0.5 text-[9px] font-medium text-slate-500 backdrop-blur-xs">
                Tap node to inspect
              </div>
            </div>

            {/* Selected Node Details Card */}
            {selectedNode && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                        selectedNode.category === "patient"
                          ? "bg-teal-600"
                          : selectedNode.category === "condition"
                          ? "bg-amber-500"
                          : selectedNode.category === "monitoring"
                          ? "bg-cyan-500"
                          : selectedNode.category === "care"
                          ? "bg-emerald-500"
                          : "bg-purple-500"
                      }`}
                    />
                    <h4 className="font-bold text-slate-900 truncate">
                      {selectedNode.label}
                    </h4>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200 shrink-0">
                    {selectedNode.kind}
                  </span>
                </div>

                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">
                  {selectedNode.description}
                </p>

                {selectedNode.details.length > 0 && (
                  <dl className="mt-2.5 grid grid-cols-2 gap-1.5 border-t border-slate-200/70 pt-2 text-[10px]">
                    {selectedNode.details.map((detail) => (
                      <div key={detail.label} className="min-w-0">
                        <dt className="text-slate-400 truncate">{detail.label}</dt>
                        <dd className="font-semibold text-slate-700 truncate">
                          {detail.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] text-slate-500 pt-1">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-teal-600" /> Patient
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Condition
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-cyan-500" /> Biomarker
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Care
              </span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export default PatientRightSidebar;
