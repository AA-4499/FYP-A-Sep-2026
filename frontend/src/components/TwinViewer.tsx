import React, { useEffect, useRef } from 'react';
import { User, Layers } from 'lucide-react';
import type { SmplTwin, TwinMetadata } from '../types';

interface TwinViewerProps {
  title: string;
  twin: SmplTwin | null;
  metadata: TwinMetadata | null;
  patientNumber: number;
}

export const TwinViewer: React.FC<TwinViewerProps> = ({
  title,
  twin,
  metadata,
  patientNumber,
}) => {
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !twin) return;

    const handleLoad = () => {
      try {
        const hex = twin.color;
        const rgb = [
          parseInt(hex.slice(1, 3), 16) / 255,
          parseInt(hex.slice(3, 5), 16) / 255,
          parseInt(hex.slice(5, 7), 16) / 255,
          1.0,
        ];
        if (viewer.model?.materials) {
          for (const material of viewer.model.materials) {
            if (material.pbrMetallicRoughness) {
              material.pbrMetallicRoughness.setBaseColorFactor(rgb);
            }
          }
        }
      } catch (err) {
        console.warn('Could not apply tint to 3D model:', err);
      }
    };

    viewer.addEventListener('load', handleLoad);
    return () => {
      viewer.removeEventListener('load', handleLoad);
    };
  }, [twin]);

  if (!twin) {
    return (
      <div className="rounded-xl bg-white border border-slate-200 p-6 text-center text-slate-500">
        Digital Twin avatar is waiting for patient data.
      </div>
    );
  }

  const assetUrl = metadata?.asset_url || '/api/digital-twin.glb';

  return (
    <div className="rounded-xl bg-white border border-slate-200 p-6 shadow-sm space-y-4 flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-blue-600" />
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Stage 3 · 3D SMPL Digital Twin
            </span>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
          </div>
        </div>
        <span
          className="px-2.5 py-1 rounded-full text-xs font-bold"
          style={{ backgroundColor: `${twin.color}20`, color: twin.color }}
        >
          {twin.band} Risk Band ({twin.risk_percent.toFixed(1)}%)
        </span>
      </div>

      {/* Biometric Metrics Header */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-slate-500 block">Body Mass Index</span>
          <strong className="text-sm font-bold text-slate-800">
            BMI {twin.bmi.toFixed(1)}
          </strong>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-slate-500 block">SMPL Shape Parameter (β₀)</span>
          <strong className="text-sm font-bold text-slate-800">
            {twin.beta0 >= 0 ? '+' : ''}
            {twin.beta0.toFixed(2)}
          </strong>
        </div>
      </div>

      {/* Interactive 3D Model Viewer Canvas */}
      <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-gradient-to-b from-slate-100 to-slate-200">
        {/* @ts-ignore Web component typing */}
        <model-viewer
          ref={viewerRef}
          src={assetUrl}
          camera-controls
          auto-rotate
          shadow-intensity="1"
          exposure="1"
          alt={`3D Digital Twin Avatar for Patient #${patientNumber}`}
        >
          <div slot="poster" className="w-full h-full flex items-center justify-center text-xs text-slate-500">
            Loading 3D Twin Mesh...
          </div>
        </model-viewer>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
        <span>Click & drag to rotate · Scroll to zoom</span>
        <span className="flex items-center gap-1 font-mono">
          <Layers className="w-3 h-3" />
          Color: {twin.color}
        </span>
      </div>
    </div>
  );
};
