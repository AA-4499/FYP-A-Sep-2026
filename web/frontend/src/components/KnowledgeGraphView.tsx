/**
 * Dedicated Knowledge Graph View matching Figma Image 3
 * Features:
 * - 3 top metric cards (Patient ID, Graph entities: 14, Data categories: 4)
 * - Interactive node-link graph with categories: Demographics, Clinical Data, Medical Data, Lifestyle
 * - Interactive Node Information inspector panel
 * - Category filter pills
 * - Longitudinal clinical data (CGM vs CBG) chart
 */
import React, { useState } from 'react';
import {
  Share2,
  Database,
  Layers,
  Info,
  Activity,
  ArrowLeft,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import {
  KG_NODES,
  KG_EDGES,
  KG_LONGITUDINAL_CLINICAL_DATA,
} from '../data/knowledgeGraphData';
import type { Patient, KnowledgeGraphNode } from '../types';

interface KnowledgeGraphViewProps {
  patient: Patient;
  onNavigate: (module: any) => void;
}

export const KnowledgeGraphView: React.FC<KnowledgeGraphViewProps> = ({
  patient,
  onNavigate,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('2000_0_20201230');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('All');

  const selectedNode: KnowledgeGraphNode =
    KG_NODES.find((n) => n.id === selectedNodeId) || KG_NODES[0];

  const categories = [
    'All',
    'Patient',
    'Demographics',
    'Clinical Data',
    'Medical Data',
    'Lifestyle',
  ];

  const categoryColors: Record<string, { bg: string; border: string; text: string; fill: string }> = {
    'Patient': { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-700', fill: '#3b82f6' },
    'Demographics': { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-700', fill: '#10b981' },
    'Clinical Data': { bg: 'bg-sky-50', border: 'border-sky-400', text: 'text-sky-700', fill: '#0284c7' },
    'Medical Data': { bg: 'bg-indigo-50', border: 'border-indigo-400', text: 'text-indigo-700', fill: '#6366f1' },
    'Lifestyle': { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-700', fill: '#f59e0b' },
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Header & Back button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <button
            onClick={() => onNavigate('patient_dashboard')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Patient Dashboard</span>
          </button>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Knowledge graph
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Explore relationships between patient information, clinical measurements and medical data.
          </p>
        </div>
      </div>

      {/* 2. Three Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1: Patient ID */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5">
          <span className="text-xs text-slate-500 font-medium block">
            Your Patient ID
          </span>
          <p className="text-xl font-bold text-slate-900 mt-1 font-mono">
            {patient.id}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {patient.name} · {patient.condition}
          </span>
        </div>

        {/* Metric 2: Graph Entities */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5">
          <span className="text-xs text-slate-500 font-medium block">
            Graph entities
          </span>
          <p className="text-3xl font-bold text-slate-900 mt-1">
            14
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Nodes shown in prototype
          </span>
        </div>

        {/* Metric 3: Data Categories */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5">
          <span className="text-xs text-slate-500 font-medium block">
            Data categories
          </span>
          <p className="text-3xl font-bold text-slate-900 mt-1">
            4
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Demographics, clinical, medical, lifestyle
          </span>
        </div>
      </div>

      {/* 3. Main Graph + Inspector Panel (2 columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Interactive Graph Canvas */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Patient knowledge graph
                </h2>
                <p className="text-xs text-slate-400">
                  Click a node to inspect its information
                </p>
              </div>

              {/* Filter pills */}
              <div className="flex flex-wrap gap-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategoryFilter(cat)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition ${
                      activeCategoryFilter === cat
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* SVG Interactive Knowledge Graph */}
            <div className="w-full h-[420px] bg-[#f8fafc] rounded-xl mt-4 border border-slate-100 relative overflow-hidden flex items-center justify-center select-none">
              <svg viewBox="0 0 800 420" className="w-full h-full">
                {/* Edges */}
                {KG_EDGES.map((edge, idx) => {
                  const sourceNode = KG_NODES.find((n) => n.id === edge.source);
                  const targetNode = KG_NODES.find((n) => n.id === edge.target);
                  if (!sourceNode || !targetNode) return null;

                  const isEdgeActive =
                    sourceNode.id === selectedNodeId ||
                    targetNode.id === selectedNodeId;

                  return (
                    <line
                      key={`edge-${idx}`}
                      x1={sourceNode.x || 0}
                      y1={sourceNode.y || 0}
                      x2={targetNode.x || 0}
                      y2={targetNode.y || 0}
                      stroke={isEdgeActive ? '#2563eb' : '#cbd5e1'}
                      strokeWidth={isEdgeActive ? 2.5 : 1.5}
                      strokeDasharray={edge.source.startsWith('cat_') ? '3 3' : undefined}
                      className="transition-all duration-300"
                    />
                  );
                })}

                {/* Nodes */}
                {KG_NODES.map((node) => {
                  const isSelected = node.id === selectedNodeId;
                  const isFiltered =
                    activeCategoryFilter !== 'All' &&
                    node.category !== activeCategoryFilter;

                  const colors = categoryColors[node.category] || categoryColors['Clinical Data'];

                  // Node layout based on type
                  const isCore = node.id === '2000_0_20201230';
                  const isCategoryHub = node.id.startsWith('cat_');

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x || 0}, ${node.y || 0})`}
                      onClick={() => setSelectedNodeId(node.id)}
                      className={`cursor-pointer transition transform ${
                        isFiltered ? 'opacity-30' : 'opacity-100 hover:scale-105'
                      }`}
                    >
                      {/* Node Circle or Rounded Card */}
                      {isCore ? (
                        <>
                          <rect
                            x="-65"
                            y="-24"
                            width="130"
                            height="48"
                            rx="12"
                            fill="#ffffff"
                            stroke={isSelected ? '#2563eb' : '#94a3b8'}
                            strokeWidth={isSelected ? 3 : 2}
                            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.08))"
                          />
                          <text
                            x="0"
                            y="-4"
                            textAnchor="middle"
                            fontSize="11"
                            fontWeight="bold"
                            fill="#1e293b"
                          >
                            {node.label}
                          </text>
                          <text
                            x="0"
                            y="14"
                            textAnchor="middle"
                            fontSize="9"
                            fill="#64748b"
                          >
                            Patient · Type 2 diabetes
                          </text>
                        </>
                      ) : isCategoryHub ? (
                        <>
                          <rect
                            x="-50"
                            y="-18"
                            width="100"
                            height="36"
                            rx="8"
                            fill="#ffffff"
                            stroke={isSelected ? '#2563eb' : colors.fill}
                            strokeWidth={isSelected ? 2.5 : 1.5}
                          />
                          <text
                            x="0"
                            y="-2"
                            textAnchor="middle"
                            fontSize="10"
                            fontWeight="bold"
                            fill="#1e293b"
                          >
                            {node.label}
                          </text>
                          <text
                            x="0"
                            y="11"
                            textAnchor="middle"
                            fontSize="8"
                            fill="#94a3b8"
                          >
                            {node.value}
                          </text>
                        </>
                      ) : (
                        <>
                          <circle
                            cx="0"
                            cy="0"
                            r="18"
                            fill="#ffffff"
                            stroke={isSelected ? '#2563eb' : colors.fill}
                            strokeWidth={isSelected ? 2.5 : 1.5}
                          />
                          <text
                            x="0"
                            y="3"
                            textAnchor="middle"
                            fontSize="9"
                            fontWeight="semibold"
                            fill="#1e293b"
                          >
                            {node.label}
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>

        {/* Right Col: Node Information Panel */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                Node information
              </span>
              <h2 className="text-base font-bold text-slate-900 mt-2">
                {selectedNode.label}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedNode.description}
              </p>
            </div>

            {/* Property list */}
            <div className="space-y-2.5 text-xs">
              {Object.entries(selectedNode.details).map(([key, val]) => (
                <div key={key} className="flex items-start justify-between gap-2">
                  <span className="text-slate-400 font-medium shrink-0">{key}</span>
                  <strong className="text-slate-800 text-right font-medium">{val}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Category Filter Pills at bottom of inspector */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              Recorded data
            </span>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {['Patient', 'Demographics', 'Clinical', 'Medical', 'Lifestyle'].map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bottom Panel: Longitudinal Clinical Data Chart */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Longitudinal clinical data
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Example glucose measurements associated with the selected patient
          </p>
        </div>

        {/* Line chart with CGM and CBG series */}
        <div className="w-full h-48 flex flex-col justify-end pt-2">
          <svg viewBox="0 0 700 130" className="w-full h-36 overflow-visible">
            {/* Grid lines */}
            <line x1="40" y1="10" x2="680" y2="10" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="40" y1="40" x2="680" y2="40" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="40" y1="70" x2="680" y2="70" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="40" y1="100" x2="680" y2="100" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="40" y1="125" x2="680" y2="125" stroke="#e2e8f0" strokeWidth="1" />

            {/* Y axis numbers: 10, 8, 6, 4, 2 */}
            <text x="30" y="14" fontSize="9" fill="#94a3b8" textAnchor="end">10</text>
            <text x="30" y="44" fontSize="9" fill="#94a3b8" textAnchor="end">8</text>
            <text x="30" y="74" fontSize="9" fill="#94a3b8" textAnchor="end">6</text>
            <text x="30" y="104" fontSize="9" fill="#94a3b8" textAnchor="end">4</text>
            <text x="30" y="128" fontSize="9" fill="#94a3b8" textAnchor="end">2</text>

            {/* Path CGM (Blue): 8.8 -> 7.2 -> 8.4 -> 6.9 -> 7.8 */}
            {/* Y mapping: 10 is y=10, 2 is y=125 => height = 115 => per unit = 115/8 = 14.375. y = 10 + (10 - val)*14.375 */}
            <path
              d="M 100 27 L 240 50 L 380 33 L 520 54 L 660 41"
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
            />
            <circle cx="100" cy="27" r="3.5" fill="#2563eb" />
            <circle cx="240" cy="50" r="3.5" fill="#2563eb" />
            <circle cx="380" cy="33" r="3.5" fill="#2563eb" />
            <circle cx="520" cy="54" r="3.5" fill="#2563eb" />
            <circle cx="660" cy="41" r="3.5" fill="#2563eb" />

            {/* Path CBG (Teal/Green): 9.1 -> 7.6 -> 8.9 -> 7.1 -> 8.0 */}
            <path
              d="M 100 23 L 240 44 L 380 26 L 520 51 L 660 38"
              fill="none"
              stroke="#0d9488"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            <circle cx="100" cy="23" r="3" fill="#0d9488" />
            <circle cx="240" cy="44" r="3" fill="#0d9488" />
            <circle cx="380" cy="26" r="3" fill="#0d9488" />
            <circle cx="520" cy="51" r="3" fill="#0d9488" />
            <circle cx="660" cy="38" r="3" fill="#0d9488" />
          </svg>

          {/* X axis labels & Legend */}
          <div className="flex justify-between pl-16 pr-6 text-xs text-slate-500 pt-2 font-medium">
            <div className="flex items-center gap-1.5">
              <span>30 Dec</span>
              <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded-sm">CGM</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>05 Jan</span>
              <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-1.5 py-0.5 rounded-sm">CBG</span>
            </div>
            <span>12 Jan</span>
            <span>20 Jan</span>
            <span>28 Jan</span>
          </div>
        </div>
      </div>
    </div>
  );
};
