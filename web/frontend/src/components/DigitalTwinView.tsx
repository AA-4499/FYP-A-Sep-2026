/**
 * Dedicated Digital Twin Page
 * Data-driven physiological twin with 3D body / organ status highlights.
 */
import React, { useState } from 'react';
import { ArrowLeft, Heart, Activity, Dna, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Patient, NavigationModule } from '../types';

interface DigitalTwinViewProps {
  patient: Patient;
  onNavigate: (module: NavigationModule) => void;
}

export const DigitalTwinView: React.FC<DigitalTwinViewProps> = ({ patient, onNavigate }) => {
  const [selectedOrgan, setSelectedOrgan] = useState<'pancreas' | 'kidneys' | 'cardio' | 'liver' | 'retina'>('pancreas');
  const [isSimulatedMode, setIsSimulatedMode] = useState(false);

  const organData = {
    pancreas: {
      name: 'Endocrine Pancreas & Beta-Cell Kinetics',
      stress: isSimulatedMode ? 45 : patient.organs.pancreas.stress,
      status: isSimulatedMode ? 'Moderate Load' : patient.organs.pancreas.status,
      color: isSimulatedMode ? '#f59e0b' : patient.organs.pancreas.color,
      description: 'Models insulin secretion demand and progressive beta-cell secretory exhaustion driven by HbA1c 8.1% and fasting glucose 9.4 mmol/L.',
      recommendation: 'Targeted postprandial glucose damping reduces beta-cell hyperstimulation.',
    },
    kidneys: {
      name: 'Renal Glomerular Microvasculature',
      stress: isSimulatedMode ? 35 : patient.organs.kidneys.stress,
      status: isSimulatedMode ? 'Normal / Preserved' : patient.organs.kidneys.status,
      color: isSimulatedMode ? '#10b981' : patient.organs.kidneys.color,
      description: 'Filtration dynamics and renal hyperfiltration pressure. eGFR preserved at 72 mL/min/1.73m².',
      recommendation: 'Maintain tight systolic blood pressure control below 130 mmHg.',
    },
    cardio: {
      name: 'Cardiovascular Arterial Tree',
      stress: isSimulatedMode ? 42 : patient.organs.cardio.stress,
      status: isSimulatedMode ? 'Optimal Flow' : patient.organs.cardio.status,
      color: isSimulatedMode ? '#10b981' : patient.organs.cardio.color,
      description: 'Hemodynamic systemic vascular resistance and macrovascular endothelial shear stress.',
      recommendation: 'Daily brisk walking stimulates vascular nitric oxide synthesis.',
    },
    liver: {
      name: 'Hepatic Glucose Autoregulation',
      stress: isSimulatedMode ? 38 : patient.organs.liver.stress,
      status: isSimulatedMode ? 'Normal' : patient.organs.liver.status,
      color: isSimulatedMode ? '#10b981' : patient.organs.liver.color,
      description: 'Overnight hepatic gluconeogenesis and glycogen clearance rates.',
      recommendation: 'Limiting late evening simple carbohydrates suppresses dawn phenomenon.',
    },
    retina: {
      name: 'Retinal Microcirculation',
      stress: 25,
      status: 'Normal',
      color: '#10b981',
      description: 'Microvascular retinal capillary integrity and non-proliferative retinopathy assessment.',
      recommendation: 'Annual fundoscopic dilated eye exam recommended.',
    },
  };

  const active = organData[selectedOrgan];

  return (
    <div className="space-y-6 animate-fadeIn pb-8">
      {/* Top Header & Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('patients')}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-blue-600 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>

        {/* State Toggle: Current vs Simulated */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Digital Twin Mode:</span>
          <div className="p-0.5 bg-slate-200/80 rounded-lg flex items-center">
            <button
              onClick={() => setIsSimulatedMode(false)}
              className={`px-3 py-1 rounded-md font-semibold transition ${
                !isSimulatedMode ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Current Baseline
            </button>
            <button
              onClick={() => setIsSimulatedMode(true)}
              className={`px-3 py-1 rounded-md font-semibold transition ${
                isSimulatedMode ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600'
              }`}
            >
              Simulated State
            </button>
          </div>
        </div>
      </div>

      {/* Main 2-Column Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: 3D Body & Hotspot Anatomy */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 flex flex-col justify-between items-center text-center">
          <div className="w-full text-left border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-base">
              Physiological Digital Twin ({patient.id})
            </h3>
            <p className="text-xs text-slate-500">
              Interactive multi-organ metabolic mapping.
            </p>
          </div>

          {/* Interactive Silhouette & Organ Nodes */}
          <div className="relative my-6 w-full max-w-[240px] h-[340px] flex items-center justify-center">
            {/* Ambient Avatar Glow */}
            <div
              className="absolute inset-0 rounded-full blur-2xl opacity-30 transition-all duration-500 pointer-events-none"
              style={{
                backgroundColor: isSimulatedMode ? '#3b82f6' : '#ef4444',
              }}
            />

            {/* Stylized Anatomical Model Silhouette */}
            <svg viewBox="0 0 200 320" className="w-full h-full">
              {/* Head */}
              <circle cx="100" cy="35" r="22" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="2" />
              {/* Neck */}
              <rect x="94" y="57" width="12" height="15" fill="#f1f5f9" />
              {/* Torso */}
              <path d="M 60 72 L 140 72 L 128 190 L 72 190 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
              {/* Arms */}
              <path d="M 60 72 L 35 170 L 45 172 L 68 85 Z" fill="#f1f5f9" />
              <path d="M 140 72 L 165 170 L 155 172 L 132 85 Z" fill="#f1f5f9" />
              {/* Legs */}
              <path d="M 74 190 L 70 300 L 86 300 L 96 190 Z" fill="#f1f5f9" />
              <path d="M 126 190 L 130 300 L 114 300 L 104 190 Z" fill="#f1f5f9" />

              {/* Organ Clickable Hotspots */}
              {/* Retina (Eyes) */}
              <circle
                cx="100"
                cy="32"
                r="6"
                fill={organData.retina.color}
                className="cursor-pointer animate-pulse"
                onClick={() => setSelectedOrgan('retina')}
              />

              {/* Heart / Cardio */}
              <circle
                cx="106"
                cy="105"
                r="8"
                fill={organData.cardio.color}
                className="cursor-pointer hover:scale-125 transition transform"
                onClick={() => setSelectedOrgan('cardio')}
              />

              {/* Pancreas */}
              <circle
                cx="96"
                cy="132"
                r="9"
                fill={organData.pancreas.color}
                className="cursor-pointer hover:scale-125 transition transform"
                onClick={() => setSelectedOrgan('pancreas')}
              />

              {/* Liver */}
              <circle
                cx="115"
                cy="125"
                r="8"
                fill={organData.liver.color}
                className="cursor-pointer hover:scale-125 transition transform"
                onClick={() => setSelectedOrgan('liver')}
              />

              {/* Kidneys */}
              <circle
                cx="88"
                cy="148"
                r="7"
                fill={organData.kidneys.color}
                className="cursor-pointer hover:scale-125 transition transform"
                onClick={() => setSelectedOrgan('kidneys')}
              />
              <circle
                cx="112"
                cy="148"
                r="7"
                fill={organData.kidneys.color}
                className="cursor-pointer hover:scale-125 transition transform"
                onClick={() => setSelectedOrgan('kidneys')}
              />
            </svg>
          </div>

          {/* Quick Organ Selector Pills */}
          <div className="w-full flex flex-wrap gap-1.5 justify-center">
            {(['pancreas', 'cardio', 'kidneys', 'liver', 'retina'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setSelectedOrgan(key)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg capitalize transition ${
                  selectedOrgan === key
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        {/* Right 2 Columns: Detailed Organ Indicators */}
        <div className="lg:col-span-2 space-y-4">
          {/* Active Organ Deep-Dive Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-3.5 h-3.5 rounded-full"
                  style={{ backgroundColor: active.color }}
                />
                <h3 className="font-bold text-slate-900 text-base">{active.name}</h3>
              </div>
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: `${active.color}15`,
                  color: active.color,
                }}
              >
                {active.status}
              </span>
            </div>

            {/* Stress Gauge Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-500 font-medium">
                <span>Physiological Stress Index</span>
                <span className="font-bold text-slate-800">{active.stress}/100</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{ width: `${active.stress}%`, backgroundColor: active.color }}
                />
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pt-1">
              {active.description}
            </p>

            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-blue-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Clinical Intervention Target:</strong> {active.recommendation}
              </span>
            </div>
          </div>

          {/* All Organs Overview Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {Object.entries(organData).map(([key, item]) => (
              <div
                key={key}
                onClick={() => setSelectedOrgan(key as any)}
                className={`p-4 rounded-xl border transition cursor-pointer text-left space-y-2 ${
                  selectedOrgan === key
                    ? 'border-blue-500 bg-blue-50/30'
                    : 'border-slate-200/90 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 capitalize">{key}</span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${item.color}15`, color: item.color }}
                  >
                    {item.status}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-1.5 rounded-full"
                    style={{ width: `${item.stress}%`, backgroundColor: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
