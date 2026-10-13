/**
 * Dedicated Risk Prediction and What-If Simulation View (Figma Image 3)
 * Full interactive simulation sandbox allowing clinicians to manipulate biomarkers
 * and view dynamic risk projections alongside SHAP attributions.
 */
import React, { useState } from 'react';
import {
  Sliders,
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  TrendingDown,
  CheckCircle2,
  Info,
} from 'lucide-react';
import type { Patient } from '../types';

interface RiskSimulationViewProps {
  patient: Patient;
  onNavigate: (module: any) => void;
}

export const RiskSimulationView: React.FC<RiskSimulationViewProps> = ({
  patient,
  onNavigate,
}) => {
  // Simulation sliders initialized to targeted clinical goals
  const [simHbA1c, setSimHbA1c] = useState<number>(7.0);
  const [simFbg, setSimFbg] = useState<number>(7.5);
  const [simBmi, setSimBmi] = useState<number>(24.5);
  const [simPhysicalActivity, setSimPhysicalActivity] = useState<number>(150); // min/week

  // Calculate dynamic simulated risk
  const baselineRisk = patient.currentRiskPct; // 68%
  const deltaHbA1c = simHbA1c - patient.hba1c;
  const deltaFbg = simFbg - patient.fastingGlucose;
  const deltaBmi = simBmi - patient.bmi;
  const deltaActivity = (simPhysicalActivity - 60) / 60; // baseline 60 min

  const simulatedRisk = Math.round(
    Math.min(
      95,
      Math.max(
        12,
        baselineRisk +
          deltaHbA1c * 12 +
          deltaFbg * 1.8 +
          deltaBmi * 1.5 -
          deltaActivity * 3.5
      )
    )
  );

  const riskDelta = simulatedRisk - baselineRisk;

  const handleReset = () => {
    setSimHbA1c(patient.hba1c);
    setSimFbg(patient.fastingGlucose);
    setSimBmi(patient.bmi);
    setSimPhysicalActivity(60);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Header with Back Button */}
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
            Risk Prediction and What-if Simulation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Predict future glucose risks and simulate scenario outcomes based on CGM trends
          </p>
        </div>

        <button
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold transition self-start sm:self-auto"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Reset to Baseline</span>
        </button>
      </div>

      {/* 2. Top Vitals Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-2">
        <div className="space-y-1">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">HbA1c</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {patient.hba1c}%
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Fasting glucose</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {patient.fastingGlucose} <span className="text-xs font-normal text-slate-500">mmol/L</span>
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">BMI</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {patient.bmi}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Current risk</p>
          <p className="text-2xl sm:text-3xl font-bold text-[#b91c1c] tracking-tight">
            {patient.currentRiskPct}%
          </p>
        </div>
      </div>

      {/* 3. 2-Column Main Section: Longitudinal Timeline & What-If Simulation Sandbox */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card A: Longitudinal Timeline */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Longitudinal timeline: HbA1c
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-visit trajectory across 14 clinical appointments
            </p>

            <div className="mt-6 w-full h-44 flex flex-col justify-center">
              <svg className="w-full h-32 overflow-visible" viewBox="0 0 320 80">
                <line x1="10" y1="20" x2="310" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="10" y1="50" x2="310" y2="50" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="10" y1="75" x2="310" y2="75" stroke="#e2e8f0" strokeWidth="1" />

                {/* Dashed Historical Average Line */}
                <path
                  d="M 10 70 Q 70 65 140 60 T 210 52 T 310 46"
                  fill="none"
                  stroke="#b45309"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />

                {/* Solid Current Patient Line */}
                <path
                  d="M 10 60 L 60 52 L 130 42 L 180 50 L 220 34 L 270 28 L 310 24"
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2.5"
                />

                <circle cx="310" cy="24" r="4.5" fill="#2563eb" />
              </svg>

              <div className="flex justify-between text-[11px] text-slate-500 pt-2 px-1">
                <span>Visit 1 (Baseline 6.9%)</span>
                <span>Visit 14 (Latest 8.1%)</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-xs text-slate-500">
            <span className="text-blue-600 font-semibold">Solid</span> current visits,{' '}
            <span className="text-amber-700 font-semibold">dashed</span> historical average
          </div>
        </div>

        {/* Card B: What-If Simulation Sandbox */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              What-if simulation
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Perturb clinical factors to observe predicted risk response
            </p>

            <div className="mt-4 space-y-3.5 text-xs">
              {/* Slider 1: HbA1c */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-700 font-medium">HbA1c Target</span>
                  <strong className="text-blue-600 font-bold">{simHbA1c.toFixed(1)}%</strong>
                </div>
                <input
                  type="range"
                  min="5.0"
                  max="11.0"
                  step="0.1"
                  value={simHbA1c}
                  onChange={(e) => setSimHbA1c(parseFloat(e.target.value))}
                  className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider 2: Fasting glucose */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-700 font-medium">Fasting Glucose Target</span>
                  <strong className="text-blue-600 font-bold">{simFbg.toFixed(1)} mmol/L</strong>
                </div>
                <input
                  type="range"
                  min="4.5"
                  max="14.0"
                  step="0.1"
                  value={simFbg}
                  onChange={(e) => setSimFbg(parseFloat(e.target.value))}
                  className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider 3: BMI */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-700 font-medium">BMI Target</span>
                  <strong className="text-blue-600 font-bold">{simBmi.toFixed(1)} kg/m²</strong>
                </div>
                <input
                  type="range"
                  min="18.5"
                  max="38.0"
                  step="0.1"
                  value={simBmi}
                  onChange={(e) => setSimBmi(parseFloat(e.target.value))}
                  className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider 4: Physical Activity */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-700 font-medium">Physical Activity</span>
                  <strong className="text-blue-600 font-bold">{simPhysicalActivity} min/week</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="300"
                  step="15"
                  value={simPhysicalActivity}
                  onChange={(e) => setSimPhysicalActivity(parseInt(e.target.value))}
                  className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Current vs Simulated Cards */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <span className="text-xs text-slate-500 font-medium block">Current</span>
                <p className="text-2xl font-bold text-slate-900 mt-0.5">
                  {baselineRisk}%
                </p>
                <span className="text-[10px] text-rose-700 font-semibold block mt-0.5">
                  High Risk Tier
                </span>
              </div>

              <div className="bg-[#dbeafe] rounded-xl p-3">
                <span className="text-xs text-blue-700 font-medium block">Simulated</span>
                <p className="text-2xl font-bold text-[#1d4ed8] mt-0.5">
                  {simulatedRisk}%
                </p>
                <span className="text-[10px] text-blue-800 font-semibold block mt-0.5">
                  {riskDelta < 0 ? `↓ ${Math.abs(riskDelta)}% risk reduction` : `↑ ${riskDelta}% increase`}
                </span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            Simulated result, not a clinical outcome.
          </p>
        </div>
      </div>

      {/* 4. Why this risk? Key Factors (SHAP Bar Chart) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Why this risk? Key factors
            </h2>
            <p className="text-xs text-slate-400">
              TreeSHAP feature importance driving complication prediction
            </p>
          </div>
        </div>

        <div className="space-y-3.5 text-xs">
          {patient.keyFactors.map((factor) => (
            <div key={factor.name} className="flex items-center gap-4">
              <span className="w-36 text-slate-700 font-medium shrink-0">
                {factor.name}
              </span>
              <div className="w-full bg-[#fce7e7] rounded-full h-3 overflow-hidden flex">
                <div
                  className="bg-[#c83232] h-3 rounded-full transition-all duration-300"
                  style={{ width: `${factor.value}%` }}
                />
              </div>
              <span className="w-12 text-right font-bold text-slate-800 shrink-0">
                {factor.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
