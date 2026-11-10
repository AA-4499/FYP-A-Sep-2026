import React, { useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Heart,
  Info,
  Lightbulb,
  Maximize2,
  Minimize2,
  RotateCcw,
  Share2,
  ShieldCheck,
  Sparkles,
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

export function generatePatientGraph(
  patient: Patient | null,
  patientId?: string,
): { nodes: GraphNodeData[]; edges: GraphEdgeData[] } {
  const pid = patientId || patient?.id || "P-001";
  const pName = patient?.name?.trim() || "Patient Record";
  const condition =
    (typeof patient?.condition === "string" && patient.condition) ||
    "Type 2 Diabetes";
  const hba1cStr =
    patient?.hba1c && !Number.isNaN(patient.hba1c)
      ? `${patient.hba1c}%`
      : "Recorded lab";
  const fastingStr =
    patient?.fastingGlucose && !Number.isNaN(patient.fastingGlucose)
      ? `${patient.fastingGlucose} mmol/L`
      : "Baseline lab";
  const bmiStr =
    patient?.bmi && !Number.isNaN(patient.bmi)
      ? `${patient.bmi} kg/m²`
      : "Anthropometry";

  const nodes: GraphNodeData[] = [
    {
      id: "patient_core",
      label: pName,
      category: "patient",
      kind: "Patient Core",
      description: `Central longitudinal patient health profile for ${pName}.`,
      details: [
        { label: "Patient ID", value: pid },
        { label: "Primary Condition", value: condition },
        { label: "Status", value: "Active Monitoring" },
      ],
    },
    {
      id: "cat_conditions",
      label: "Conditions",
      category: "hub",
      kind: "Category Cluster",
      description: "Diagnosed medical conditions and metabolic health state.",
      details: [{ label: "Entities", value: "2 conditions mapped" }],
    },
    {
      id: "cat_clinical",
      label: "Biomarkers",
      category: "hub",
      kind: "Category Cluster",
      description: "Continuous telemetry and laboratory biomarker assays.",
      details: [{ label: "Entities", value: "4 clinical indicators" }],
    },
    {
      id: "cat_lifestyle",
      label: "Lifestyle",
      category: "hub",
      kind: "Category Cluster",
      description: "Nutritional intake, physical activity, and daily habits.",
      details: [{ label: "Entities", value: "2 lifestyle factors" }],
    },
    {
      id: "cat_medical",
      label: "Medical Care",
      category: "hub",
      kind: "Category Cluster",
      description: "Therapy plans, prescriptions, and clinical follow-ups.",
      details: [{ label: "Entities", value: "2 care pathways" }],
    },

    // Specific entities
    {
      id: "node_diabetes",
      label: condition,
      category: "condition",
      kind: "Primary Diagnosis",
      description:
        "Chronic metabolic disorder characterized by elevated levels of blood glucose.",
      details: [
        { label: "Condition", value: condition },
        { label: "Clinical Focus", value: "Glycemic Stability & Risk Reduction" },
      ],
    },
    {
      id: "node_glycemic",
      label: "Glycemic Control",
      category: "condition",
      kind: "Physiological State",
      description:
        "Real-time glycemic variability, postprandial excursions, and time in range.",
      details: [
        { label: "Target Range", value: "70 - 180 mg/dL" },
        {
          label: "Time In Range",
          value:
            patient?.timeInRangePct && !Number.isNaN(patient.timeInRangePct)
              ? `${patient.timeInRangePct}%`
              : "Calculated from sensor",
        },
      ],
    },
    {
      id: "node_hba1c",
      label: `HbA1c: ${hba1cStr}`,
      category: "monitoring",
      kind: "Laboratory Biomarker",
      description:
        "Glycated hemoglobin reflecting ~3-month average plasma glucose concentration.",
      details: [
        { label: "Measurement", value: hba1cStr },
        { label: "Target", value: "< 7.0% for diabetes management" },
      ],
    },
    {
      id: "node_fasting",
      label: `Fasting: ${fastingStr}`,
      category: "monitoring",
      kind: "Laboratory Biomarker",
      description:
        "Pre-prandial venous blood glucose measured after overnight fasting.",
      details: [
        { label: "Measurement", value: fastingStr },
        { label: "Target Range", value: "4.0 - 7.0 mmol/L" },
      ],
    },
    {
      id: "node_bmi",
      label: `BMI: ${bmiStr}`,
      category: "monitoring",
      kind: "Anthropometry",
      description:
        "Body Mass Index reflecting body weight composition relative to height.",
      details: [
        { label: "Value", value: bmiStr },
        {
          label: "Recorded Weight",
          value: patient?.weight ? `${patient.weight} kg` : "Recorded in record",
        },
      ],
    },
    {
      id: "node_cgm",
      label: patient?.hasContinuousCGM ? "CGM Sensor (Active)" : "Glucose Sensor",
      category: "monitoring",
      kind: "Telemetry Device",
      description:
        "Subcutaneous interstitial glucose sensor streaming frequent readings.",
      details: [
        {
          label: "Status",
          value: patient?.hasContinuousCGM
            ? "Continuous telemetry active"
            : "Periodic capillary readings",
        },
      ],
    },
    {
      id: "node_nutrition",
      label: "Nutrition & Diet",
      category: "care",
      kind: "Behavioral Factor",
      description:
        "Carbohydrate counting, glycemic index distribution, and balanced meal timing.",
      details: [
        { label: "Guidance", value: "Low GI carbohydrates, high dietary fiber" },
      ],
    },
    {
      id: "node_exercise",
      label: "Physical Activity",
      category: "care",
      kind: "Behavioral Factor",
      description:
        "Brisk walking and resistance activity that enhances muscular glucose uptake.",
      details: [
        { label: "Target", value: "150 min/week moderate aerobic activity" },
      ],
    },
    {
      id: "node_meds",
      label: "Antidiabetic Therapy",
      category: "care",
      kind: "Pharmacotherapy",
      description:
        "Prescribed antidiabetic medication regulating insulin sensitivity and hepatic glucose.",
      details: [
        { label: "Regimen", value: "Prescribed oral hypoglycemics / insulin" },
      ],
    },
    {
      id: "node_careplan",
      label: "Care Plan Reviews",
      category: "care",
      kind: "Clinical Follow-up",
      description:
        "Routine appointments and clinical evaluations agreed with your doctor.",
      details: [
        { label: "Frequency", value: "Quarterly glycemic & microvascular review" },
      ],
    },
  ];

  const edges: GraphEdgeData[] = [
    { id: "e1", source: "patient_core", target: "cat_conditions", label: "has clinical status" },
    { id: "e2", source: "patient_core", target: "cat_clinical", label: "measured by" },
    { id: "e3", source: "patient_core", target: "cat_lifestyle", label: "manages routine" },
    { id: "e4", source: "patient_core", target: "cat_medical", label: "receives care" },

    { id: "e5", source: "cat_conditions", target: "node_diabetes", label: "diagnosed with" },
    { id: "e6", source: "cat_conditions", target: "node_glycemic", label: "manifests" },

    { id: "e7", source: "cat_clinical", target: "node_hba1c", label: "tracks" },
    { id: "e8", source: "cat_clinical", target: "node_fasting", label: "monitors" },
    { id: "e9", source: "cat_clinical", target: "node_bmi", label: "evaluates" },
    { id: "e10", source: "cat_clinical", target: "node_cgm", label: "streams" },

    { id: "e11", source: "cat_lifestyle", target: "node_nutrition", label: "incorporates" },
    { id: "e12", source: "cat_lifestyle", target: "node_exercise", label: "incorporates" },

    { id: "e13", source: "cat_medical", target: "node_meds", label: "prescribes" },
    { id: "e14", source: "cat_medical", target: "node_careplan", label: "schedules" },

    { id: "e15", source: "node_diabetes", target: "node_hba1c", label: "assessed by" },
    { id: "e16", source: "node_nutrition", target: "node_glycemic", label: "modulates" },
    { id: "e17", source: "node_exercise", target: "node_glycemic", label: "improves" },
    { id: "e18", source: "node_meds", target: "node_diabetes", label: "controls" },
    { id: "e19", source: "node_careplan", target: "node_hba1c", label: "optimizes" },
  ];

  return { nodes, edges };
}

export function PatientRightSidebar({
  patient,
  patientId,
  recommendations = [],
  onNavigate,
  isOpen = true,
  onClose,
  defaultTab = "recommendations",
}: PatientRightSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>(defaultTab);
  const [expandedRecs, setExpandedRecs] = useState<Record<string, boolean>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedNodeId, setSelectedNodeId] = useState<string>("patient_core");

  const cyContainerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);

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

  // Initialize and update Cytoscape canvas when Knowledge Graph tab is active
  useEffect(() => {
    if (activeTab !== "knowledge_graph" || !cyContainerRef.current) {
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
  }, [activeTab, filteredNodes, visibleEdges]);

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
      aria-label="Care recommendations and knowledge graph sidebar"
      className="w-full shrink-0 lg:w-[350px] xl:w-[380px] lg:sticky lg:top-5"
    >
      <div className="flex flex-col rounded-3xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Health Insights</h2>
              <p className="text-[10px] font-medium text-slate-500">
                Care Team Guidance & Network
              </p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close right sidebar"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Tab Switcher - Recommendations is default */}
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

        {/* TAB 1: RECOMMENDATIONS (DEFAULT) */}
        {activeTab === "recommendations" && (
          <div className="mt-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
                Approved by your care team
              </span>
              <span className="text-[11px] font-medium text-slate-400">
                {recommendations.length} shared
              </span>
            </div>

            {recommendations.length > 0 ? (
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {recommendations.map((rec) => {
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
                        <span>Shared with patient</span>
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

            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate("patient_recommendations")}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                <span>Open full recommendations view</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* TAB 2: KNOWLEDGE GRAPH */}
        {activeTab === "knowledge_graph" && (
          <div className="mt-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900">Personal Health Graph</span>
                <p className="text-[10px] text-slate-500">Interactive condition & biomarker map</p>
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
                className="h-[280px] w-full cursor-grab active:cursor-grabbing"
                role="img"
                aria-label="Interactive patient knowledge graph"
              />
              <div className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-white/80 px-2 py-0.5 text-[9px] font-medium text-slate-500 backdrop-blur-xs">
                Tap a node to inspect
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
