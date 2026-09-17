import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { Network, AlertTriangle, Eye, RotateCcw, ListFilter } from 'lucide-react';
import type { KnowledgeGraphNode, KnowledgeGraphResponse } from '../types';

interface Stage4KnowledgeGraphProps {
  patientNumber: number;
  graphData: KnowledgeGraphResponse | null;
  isLoading: boolean;
}

export const Stage4KnowledgeGraph: React.FC<Stage4KnowledgeGraphProps> = ({
  patientNumber,
  graphData,
  isLoading,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [selectedNode, setSelectedNode] = useState<KnowledgeGraphNode | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [pickerValue, setPickerValue] = useState<string>('');

  useEffect(() => {
    if (!containerRef.current || !graphData || !graphData.nodes || graphData.nodes.length === 0) {
      return;
    }

    const nodeElements = graphData.nodes.map((node) => {
      const classes = [node.type.toLowerCase()];
      if (node.type === 'ShapContribution') {
        classes.push(node.details?.direction || 'neutral');
      }
      if (node.type === 'RiskProbability' && node.details?.selected) {
        classes.push('selected-probability');
      }
      return { data: node, classes: classes.join(' ') };
    });

    const edgeElements = graphData.edges.map((edge) => ({
      data: edge,
      classes: edge.group,
    }));

    // Destroy prior instance if any
    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: [...nodeElements, ...edgeElements],
      minZoom: 0.2,
      maxZoom: 2.5,
      boxSelectionEnabled: false,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#f8fbfd',
            'border-color': '#9fb2c3',
            'border-width': 1.5,
            color: '#172133',
            'font-family': 'system-ui, sans-serif',
            'font-size': '8px',
            label: 'data(label)',
            'text-wrap': 'wrap',
            'text-max-width': '90px',
            'text-valign': 'center',
            'text-halign': 'center',
            height: 38,
            width: 100,
            padding: '5px',
          },
        },
        {
          selector: 'node.patientsnapshot',
          style: {
            'background-color': '#0f172a',
            'border-color': '#0f172a',
            color: '#ffffff',
            'font-size': '11px',
            'font-weight': 800,
            height: 60,
            width: 130,
          },
        },
        {
          selector: 'node.domain',
          style: {
            'background-color': '#dcebf5',
            'border-color': '#1769aa',
            'font-weight': 700,
            height: 46,
            width: 110,
          },
        },
        { selector: 'node.observation', style: { 'background-color': '#edf7fd', 'border-color': '#1769aa' } },
        { selector: 'node.attributedefinition', style: { 'background-color': '#ffffff', 'border-style': 'dashed', 'border-color': '#6f8292' } },
        { selector: 'node.state', style: { 'background-color': '#fff4de', 'border-color': '#d8894b' } },
        { selector: 'node.shapcontribution.positive', style: { 'background-color': '#fde7ea', 'border-color': '#c92a3a' } },
        { selector: 'node.shapcontribution.negative', style: { 'background-color': '#e0f3eb', 'border-color': '#087f5b' } },
        { selector: 'node.shapcontribution.neutral', style: { 'background-color': '#f1f3f5', 'border-color': '#7b8794' } },
        { selector: 'node.prediction', style: { 'background-color': '#fff0cc', 'border-color': '#c57a00', 'font-size': '10px', 'font-weight': 800, height: 56, width: 130 } },
        { selector: 'node.riskprobability', style: { 'background-color': '#fffaf0', 'border-color': '#d98b00' } },
        { selector: 'node.riskprobability.selected-probability', style: { 'border-width': 4, 'font-weight': 800 } },
        { selector: 'node.modelversion', style: { 'background-color': '#ece7f7', 'border-color': '#6f42c1' } },
        { selector: 'node.modelevaluation', style: { 'background-color': '#fff1db', 'border-color': '#c57a00', shape: 'round-rectangle' } },
        {
          selector: 'edge',
          style: {
            'curve-style': 'bezier',
            'line-color': '#9fb2c3',
            'target-arrow-color': '#9fb2c3',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.65,
            width: 1,
            label: 'data(label)',
            'font-size': '6px',
            color: '#5d6778',
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.85,
            'text-background-padding': '2px',
            'text-rotation': 'autorotate',
          },
        },
        { selector: 'edge.profile', style: { 'line-color': '#7fa9c8', 'target-arrow-color': '#7fa9c8' } },
        { selector: 'edge.positive_shap', style: { 'line-color': '#c92a3a', 'target-arrow-color': '#c92a3a', width: 'mapData(weight, 0, 0.2, 1, 6)' } },
        { selector: 'edge.negative_shap', style: { 'line-color': '#087f5b', 'target-arrow-color': '#087f5b', width: 'mapData(weight, 0, 0.2, 1, 6)' } },
        { selector: 'edge.neutral_shap', style: { 'line-color': '#7b8794', 'target-arrow-color': '#7b8794', 'line-style': 'dotted' } },
        { selector: 'edge.prediction', style: { 'line-color': '#d98b00', 'target-arrow-color': '#d98b00' } },
        { selector: '.faded', style: { opacity: 0.1, 'text-opacity': 0.05 } },
        { selector: 'node.focused', style: { 'overlay-color': '#0f172a', 'overlay-opacity': 0.12, 'overlay-padding': '8px', 'border-width': 4 } },
      ] as any,
      layout: {
        name: 'cose',
        animate: false,
        randomize: false,
        fit: true,
        padding: 40,
        nodeRepulsion: 180000,
        idealEdgeLength: 105,
        numIter: 1000,
      } as any,
    });

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      focusNode(node, cy);
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        cy.elements().removeClass('faded focused');
        setSelectedNode(null);
        setPickerValue('');
        cy.fit(undefined, 40);
      }
    });

    const initialPatient = cy.getElementById('patient-current');
    if (initialPatient.length) {
      focusNode(initialPatient, cy);
    }

    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [graphData]);

  const focusNode = (node: cytoscape.NodeSingular, cy: cytoscape.Core) => {
    cy.elements().removeClass('faded focused');
    const neighborhood = node.closedNeighborhood();
    cy.elements().difference(neighborhood).addClass('faded');
    node.addClass('focused');
    cy.animate({ fit: { eles: neighborhood, padding: 60 }, duration: 300 });

    setSelectedNode(node.data());
    setPickerValue(node.id());
  };

  const handleFilter = (filterKey: string) => {
    setActiveFilter(filterKey);
    const cy = cyRef.current;
    if (!cy) return;

    cy.nodes().forEach((node) => {
      const groups = node.data('groups') || [];
      const visible = filterKey === 'all' || node.id() === 'patient-current' || groups.includes(filterKey);
      node.style('display', visible ? 'element' : 'none');
    });

    cy.edges().forEach((edge) => {
      const visible = edge.source().style('display') !== 'none' && edge.target().style('display') !== 'none';
      edge.style('display', visible ? 'element' : 'none');
    });

    cy.elements().removeClass('faded focused');
    cy.layout({ name: 'cose', animate: false, fit: true, padding: 40, nodeRepulsion: 180000 } as any).run();
  };

  const handleResetFocus = () => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass('faded focused');
    setSelectedNode(null);
    setPickerValue('');
    cy.fit(cy.elements(':visible'), 40);
  };

  const handlePickerChange = (nodeId: string) => {
    setPickerValue(nodeId);
    const cy = cyRef.current;
    if (!cy || !nodeId) return;
    const node = cy.getElementById(nodeId);
    if (node.length) {
      focusNode(node, cy);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-xl bg-white border border-slate-200 p-8 text-center text-slate-500">
        Constructing Patient Knowledge Graph...
      </div>
    );
  }

  if (!graphData) {
    return null;
  }

  return (
    <div className="rounded-xl bg-white border border-slate-200 p-6 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-blue-600" />
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Stage 4 · Patient Knowledge Graph
            </span>
            <h2 className="text-base font-bold text-slate-900">
              Multi-Domain Model Ontology (Patient #{patientNumber})
            </h2>
          </div>
        </div>
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            graphData.connected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {graphData.connected ? 'Neo4j Connected' : 'Embedded Definitions'}
        </span>
      </div>

      {/* Model limitation alert */}
      <div className="p-3 bg-amber-50/80 rounded-lg border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">{graphData.warning}</p>
      </div>

      {/* Interactive Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
        <div className="flex items-center gap-1.5">
          <ListFilter className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-semibold text-slate-600">Filters:</span>
          {['all', 'profile', 'explanation', 'prediction'].map((f) => (
            <button
              key={f}
              onClick={() => handleFilter(f)}
              className={`px-2.5 py-1 rounded-md capitalize font-medium transition ${
                activeFilter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {f}
            </button>
          ))}
          <button
            onClick={handleResetFocus}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
          >
            <RotateCcw className="w-3 h-3" />
            Reset Focus
          </button>
        </div>

        {/* Keyboard Node Picker */}
        <div className="flex items-center gap-2">
          <label htmlFor="kg-select-node" className="text-slate-500 font-medium">
            Jump to Node:
          </label>
          <select
            id="kg-select-node"
            value={pickerValue}
            onChange={(e) => handlePickerChange(e.target.value)}
            className="px-2.5 py-1 text-xs rounded-md border border-slate-300 bg-white"
          >
            <option value="">Select a node...</option>
            {graphData.nodes
              .slice()
              .sort((a, b) => a.label.localeCompare(b.label))
              .map((n) => (
                <option key={n.id} value={n.id}>
                  {n.type}: {n.label}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600 border-t border-slate-100 pt-3">
        {graphData.legend.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>

      {/* Workspace: Graph Canvas + Selected Node Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
          <div ref={containerRef} id="cytoscape-canvas" />
        </div>

        {/* Inspector Aside */}
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-3 overflow-y-auto max-h-[520px]">
          <div className="border-b border-slate-200 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Selected Node Inspector
            </span>
            <h4 className="font-bold text-slate-900 text-sm mt-0.5">
              {selectedNode ? selectedNode.label : 'No node selected'}
            </h4>
          </div>

          {selectedNode ? (
            <div className="space-y-3">
              <div>
                <span className="font-semibold text-slate-700 block">Type:</span>
                <span className="text-slate-600">{selectedNode.type}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-700 block">Summary:</span>
                <p className="text-slate-600 leading-relaxed">{selectedNode.summary}</p>
              </div>

              {selectedNode.details && Object.keys(selectedNode.details).length > 0 && (
                <div className="space-y-1 border-t border-slate-200 pt-2">
                  <span className="font-semibold text-slate-700 block">Attributes & Evidence:</span>
                  <dl className="grid grid-cols-2 gap-1.5 text-[11px]">
                    {Object.entries(selectedNode.details).map(([k, v]) => (
                      <div key={k} className="p-1.5 bg-white rounded border border-slate-100">
                        <dt className="text-slate-400 capitalize">{k.replace(/_/g, ' ')}</dt>
                        <dd className="font-bold text-slate-800 truncate" title={String(v)}>
                          {typeof v === 'number' ? v.toFixed(3) : String(v)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-400 italic">
              Tap any node on the graph canvas or select from the dropdown above to view its connections and definitions.
            </p>
          )}
        </div>
      </div>

      {/* Accessible Table Fallback for Screen Readers & Tabular Inspection */}
      <details className="text-xs border border-slate-200 rounded-lg p-3 bg-slate-50">
        <summary className="font-semibold text-slate-700 cursor-pointer flex items-center gap-1">
          <Eye className="w-3.5 h-3.5 text-slate-500" />
          <span>Accessible Tabular View of All 21 Model Indicators</span>
        </summary>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-3 pt-3 border-t border-slate-200">
          {graphData.attributes.map((attr) => (
            <div key={attr.key} className="p-2.5 bg-white rounded border border-slate-100 text-xs">
              <span className="font-bold text-slate-800 block">{attr.label}</span>
              <div className="flex justify-between text-slate-600 mt-1">
                <span>Value: {attr.value}</span>
                <span
                  className={`font-mono font-bold ${
                    attr.shap_value >= 0 ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  SHAP {attr.shap_value >= 0 ? '+' : ''}
                  {attr.shap_value.toFixed(3)}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block mt-0.5 truncate">{attr.state}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
};
