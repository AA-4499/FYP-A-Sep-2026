import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { Network, ZoomIn, ZoomOut, RotateCcw, Info, Tag } from 'lucide-react';
import type { KnowledgeGraphResponse } from '../types';

interface PersonalHealthGraphProps {
  patientId: string;
  graphData: KnowledgeGraphResponse | null;
  isLoading: boolean;
}

export const PersonalHealthGraph: React.FC<PersonalHealthGraphProps> = ({
  patientId,
  graphData,
  isLoading,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [selectedNodeData, setSelectedNodeData] = useState<any | null>(null);

  useEffect(() => {
    if (!containerRef.current || !graphData?.elements?.nodes?.length) return;

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const elements = [
      ...graphData.elements.nodes.map((n) => ({
        data: {
          id: n.data.id,
          label: n.data.label,
          type: n.data.type,
          category: n.data.category,
          color: n.data.color,
          size: n.data.size || 50,
        },
      })),
      ...graphData.elements.edges.map((e) => ({
        data: {
          id: e.data.id,
          source: e.data.source,
          target: e.data.target,
          label: e.data.label,
        },
      })),
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            label: 'data(label)',
            color: '#0f172a',
            'font-family': 'system-ui, sans-serif',
            'font-size': '9px',
            'font-weight': 600,
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': '85px',
            width: 'data(size)',
            height: 'data(size)',
            'border-width': 2,
            'border-color': '#ffffff',
            'overlay-opacity': 0,
          },
        },
        {
          selector: 'node[type = "Patient"]',
          style: {
            color: '#ffffff',
            'font-size': '10px',
            'font-weight': 700,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': '#cbd5e1',
            'target-arrow-color': '#94a3b8',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': '8px',
            color: '#64748b',
            'text-rotation': 'autorotate',
            'text-margin-y': -8,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#2563eb',
            'underlay-color': '#2563eb',
            'underlay-padding': 6,
            'underlay-opacity': 0.3,
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: false,
        padding: 40,
        componentSpacing: 60,
        nodeRepulsion: () => 450000,
        idealEdgeLength: () => 90,
      } as any,
    });

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      setSelectedNodeData(node.data());
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNodeData(null);
      }
    });

    cyRef.current = cy;

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [graphData]);

  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.25);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  const handleFit = () => cyRef.current?.fit(undefined, 30);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Network className="w-5 h-5 text-blue-600" />
            Personal Health Knowledge Graph &amp; Clinical Ontology
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Interconnecting patient biomarkers, clinical risk drivers, and pharmacological therapies
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={handleZoomIn}
            className="p-1.5 hover:bg-white text-slate-700 rounded transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 hover:bg-white text-slate-700 rounded transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleFit}
            className="p-1.5 hover:bg-white text-slate-700 rounded transition"
            title="Reset View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-96 flex items-center justify-center text-xs text-slate-400">
          Constructing ontological health relationships...
        </div>
      ) : (
        <div className="relative">
          {/* Cytoscape Container */}
          <div
            ref={containerRef}
            className="w-full h-96 rounded-xl bg-slate-50/50 border border-slate-200 overflow-hidden"
          />

          {/* Legend / Category Tags */}
          <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-xs p-2.5 rounded-lg border border-slate-200 text-[10px] space-y-1 shadow-sm">
            <span className="font-bold text-slate-700 block">Ontology Categories</span>
            <div className="flex flex-wrap gap-2">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Patient
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Biomarkers
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span> Complication Risk
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Pharmacotherapy
              </span>
            </div>
          </div>

          {/* Selected Node Drawer */}
          {selectedNodeData && (
            <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm p-4 rounded-xl border border-slate-200 shadow-md text-xs w-64 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-blue-600" />
                  {selectedNodeData.type}
                </span>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                  {selectedNodeData.category}
                </span>
              </div>
              <div className="mt-2.5">
                <h4 className="font-semibold text-slate-900 whitespace-pre-line">
                  {selectedNodeData.label}
                </h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Node Identifier: <span className="font-mono text-slate-700">{selectedNodeData.id}</span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
