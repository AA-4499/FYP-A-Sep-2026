/**
 * Core Patient Dashboard View.
 * Matches the user mockup layout and elements with pixel-precision:
 * - 4 Key Metrics: HbA1c, Fasting glucose, BMI, Current risk
 * - 2x2 Grid:
 *    1. Longitudinal timeline, HbA1c
 *    2. Why this risk? Key factors
 *    3. What-if simulation with working sliders
 *    4. Knowledge graph
 * - Bottom action buttons: Digital twin view ↗, Report page ↗
 */
import React, { useState } from 'react';
import { Activity, Radio, AlertCircle, ArrowRight, Gauge, CheckCircle2 } from 'lucide-react';
import type { Patient, NavigationModule } from '../types';

interface DashboardViewProps {
  patient: Patient;
  onNavigate: (module: NavigationModule) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ patient, onNavigate }) => {
  // What-if sliders state (initialized to simulate 43% as in mockup)
  const [whatIfHbA1c, setWhatIfHbA1c] = useState<number>(7.0);
  const [whatIfFbg, setWhatIfFbg] = useState<number>(7.5);
  const [whatIfBmi, setWhatIfBmi] = useState<number>(24.5);

  // Calculate simulated risk dynamically
  const baselineRisk = patient.currentRiskPct;
  const deltaHbA1c = whatIfHbA1c - patient.hba1c;
  const deltaFbg = whatIfFbg - patient.fastingGlucose;
  const deltaBmi = whatIfBmi - patient.bmi;

  const simulatedRisk = Math.round(
    Math.min(95, Math.max(12, baselineRisk + deltaHbA1c * 12 + deltaFbg * 1.8 + deltaBmi * 1.5))
  );

  // Generate SVG path from patient's actual continuous CGM readings (1,000+ points)
  const renderCGMPath = () => {
    if (!patient.cgmReadings || patient.cgmReadings.length === 0) return '';
    const readings = patient.cgmReadings;
    const step = Math.max(1, Math.floor(readings.length / 100));
    const sampled = readings.filter((_, idx) => idx % step === 0);
    const minG = 40;
    const maxG = 340;
    const width = 300;
    const height = 55;

    const points = sampled.map((r, idx) => {
      const x = 10 + (idx / (sampled.length - 1 || 1)) * width;
      const clamped = Math.max(minG, Math.min(maxG, r.cgm));
      const y = 68 - ((clamped - minG) / (maxG - minG)) * height;
      return `${x.toFixed(1)} ${y.toFixed(1)}`;
    });

    return `M ${points.join(' L ')}`;
  };

  const hasCGM = Boolean(patient.hasContinuousCGM && patient.cgmReadings && patient.cgmReadings.length > 0);
  const cgmSummary = patient.cgmSummary;

  return (
    <div className="space-y-6">
      {/* 1. KEY METRICS STRIP (4 Columns) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-2">
        {/* Metric 1: HbA1c */}
        <div className="space-y-1">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">HbA1c</p>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">
            {patient.hba1c}%
          </p>
        </div>

        {/* Metric 2: Fasting glucose */}
        <div className="space-y-1">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Fasting glucose</p>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">
            {patient.fastingGlucose}
          </p>
        </div>

        {/* Metric 3: BMI */}
        <div className="space-y-1">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">BMI</p>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">
            {patient.bmi}
          </p>
        </div>

        {/* Metric 4: Current risk */}
        <div className="space-y-1">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Current risk</p>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#b91c1c] tracking-tight">
            {patient.currentRiskPct}%
          </p>
        </div>
      </div>

      {/* 2. 2x2 MAIN GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* CARD 1: Longitudinal timeline / Continuous CGM waveform */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 flex flex-col justify-between min-h-[290px]">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                {hasCGM ? 'Continuous CGM Waveform (14 Days)' : 'Longitudinal Glycemic Profile'}
              </h3>
              {hasCGM && cgmSummary && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  TIR {cgmSummary.timeInRangePct}% · {cgmSummary.meanGlucose} mg/dL
                </span>
              )}
            </div>

            {hasCGM ? (
              /* Actual 14-Day Continuous Sensor Waveform */
              <div className="mt-4 w-full h-36 flex flex-col justify-center">
                <svg className="w-full h-28 overflow-visible" viewBox="0 0 320 80">
                  {/* Guide lines */}
                  <line x1="10" y1="15" x2="310" y2="15" stroke="#f8fafc" strokeWidth="1" />
                  <line x1="10" y1="40" x2="310" y2="40" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="10" y1="72" x2="310" y2="72" stroke="#e2e8f0" strokeWidth="1" />

                  {/* Target Glycemic Band (70 - 180 mg/dL) */}
                  <rect x="10" y="38" width="300" height="26" fill="#ecfdf5" rx="3" />
                  <line x1="10" y1="38" x2="310" y2="38" stroke="#a7f3d0" strokeWidth="0.8" strokeDasharray="3 2" />
                  <line x1="10" y1="64" x2="310" y2="64" stroke="#a7f3d0" strokeWidth="0.8" strokeDasharray="3 2" />

                  {/* 180 mg/dL label */}
                  <text x="312" y="41" fontSize="7" fill="#10b981" fontStyle="italic">180</text>
                  <text x="312" y="67" fontSize="7" fill="#10b981" fontStyle="italic">70</text>

                  {/* Actual Continuous CGM Waveform */}
                  <path
                    d={renderCGMPath()}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Latest reading pulse marker */}
                  <circle cx="310" cy="42" r="3.5" fill="#2563eb" />
                  <circle cx="310" cy="42" r="6" fill="#2563eb" opacity="0.25" className="animate-ping" />
                </svg>

                {/* X-axis labels */}
                <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1.5 px-1 font-medium">
                  <span>{cgmSummary?.startDate ? new Date(cgmSummary.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Day 1'}</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    {patient.cgmReadings?.length.toLocaleString()} continuous sensor points
                  </span>
                  <span>{cgmSummary?.endDate ? new Date(cgmSummary.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Day 14'}</span>
                </div>
              </div>
            ) : (
              /* Clinical State for Patients Without CGM sensor */
              <div className="mt-3 bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">No Continuous CGM Sensor Telemetry</p>
                  <p className="text-[11px] text-slate-500 max-w-[270px] mt-0.5 leading-relaxed">
                    Continuous subcutaneous sensor not fitted for this admission. Baseline Fasting Glucose is <strong>{patient.fastingGlucose} mmol/L</strong> and HbA1c is <strong>{patient.hba1c}%</strong>.
                  </p>
                </div>
                <button
                  onClick={() => onNavigate('monitoring')}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Open Longitudinal Monitoring</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Subtext legend */}
          <div className="pt-2 text-xs text-slate-500 flex items-center justify-between">
            {hasCGM ? (
              <>
                <div>
                  <span className="text-emerald-700 font-semibold">Green band:</span> Target (70–180 mg/dL) ·{' '}
                  <span className="text-blue-600 font-semibold">Blue wave:</span> 15-min sensor readings
                </div>
                <button
                  onClick={() => onNavigate('monitoring')}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  Full AGP Profile →
                </button>
              </>
            ) : (
              <span className="text-slate-400 text-[11px]">
                Patients 2000, 2001, 2002, 2003 contain 14-day continuous CGM feeds.
              </span>
            )}
          </div>
        </div>

        {/* CARD 2: Why this risk? Key factors */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 flex flex-col justify-between min-h-[290px]">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900">
              Why this risk? Key factors
            </h3>

            {/* Horizontal SHAP Bars matching mockup */}
            <div className="mt-5 space-y-3.5 text-xs sm:text-sm">
              {patient.keyFactors.map((factor) => (
                <div key={factor.name} className="flex items-center justify-between gap-3">
                  <span className="w-32 sm:w-36 text-slate-700 shrink-0 truncate font-normal">
                    {factor.name}
                  </span>
                  <div className="w-full bg-[#fce7e7] rounded-full h-3 overflow-hidden flex">
                    <div
                      className="bg-[#c83232] h-3 rounded-full transition-all duration-300"
                      style={{ width: `${factor.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CARD 3: What-if simulation */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 flex flex-col justify-between min-h-[290px] space-y-4">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900">
              What-if simulation
            </h3>

            {/* Sliders */}
            <div className="mt-3.5 space-y-2.5 text-xs sm:text-sm">
              {/* Slider 1: HbA1c */}
              <div className="flex items-center justify-between gap-3">
                <span className="w-28 text-slate-700 shrink-0 font-normal">HbA1c</span>
                <input
                  type="range"
                  min="5.0"
                  max="11.0"
                  step="0.1"
                  value={whatIfHbA1c}
                  onChange={(e) => setWhatIfHbA1c(parseFloat(e.target.value))}
                  className="w-full accent-slate-400 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
                <span className="w-10 text-right font-bold text-slate-900 shrink-0">
                  {whatIfHbA1c.toFixed(1)}
                </span>
              </div>

              {/* Slider 2: Fasting glucose */}
              <div className="flex items-center justify-between gap-3">
                <span className="w-28 text-slate-700 shrink-0 font-normal">Fasting glucose</span>
                <input
                  type="range"
                  min="4.5"
                  max="14.0"
                  step="0.1"
                  value={whatIfFbg}
                  onChange={(e) => setWhatIfFbg(parseFloat(e.target.value))}
                  className="w-full accent-slate-400 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
                <span className="w-10 text-right font-bold text-slate-900 shrink-0">
                  {whatIfFbg.toFixed(1)}
                </span>
              </div>

              {/* Slider 3: BMI */}
              <div className="flex items-center justify-between gap-3">
                <span className="w-28 text-slate-700 shrink-0 font-normal">BMI</span>
                <input
                  type="range"
                  min="18.5"
                  max="38.0"
                  step="0.1"
                  value={whatIfBmi}
                  onChange={(e) => setWhatIfBmi(parseFloat(e.target.value))}
                  className="w-full accent-slate-400 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
                <span className="w-10 text-right font-bold text-slate-900 shrink-0">
                  {whatIfBmi.toFixed(1)}
                </span>
              </div>
            </div>

            {/* Current vs Simulated Cards */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              {/* Current */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-left">
                <p className="text-xs text-slate-500 font-medium">Current</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {baselineRisk}%
                </p>
              </div>

              {/* Simulated */}
              <div className="bg-[#dbeafe] rounded-xl p-3 text-left">
                <p className="text-xs text-blue-700 font-medium">Simulated</p>
                <p className="text-2xl font-bold text-[#1d4ed8] mt-1">
                  {simulatedRisk}%
                </p>
              </div>
            </div>
          </div>

          {/* Disclaimer at bottom */}
          <p className="text-[11px] text-slate-400">
            Simulated result, not a clinical outcome.
          </p>
        </div>

        {/* CARD 4: Knowledge graph */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 flex flex-col justify-between min-h-[290px]">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900">
              Knowledge graph
            </h3>

            {/* Radial Graph Diagram matching mockup */}
            <div className="mt-2 w-full h-52 flex items-center justify-center">
              <svg className="w-full h-full max-w-[280px]" viewBox="0 0 240 180">
                {/* Connecting Lines from Center P07 to surrounding nodes */}
                {/* To Risk (top) */}
                <line x1="120" y1="100" x2="120" y2="40" stroke="#cbd5e1" strokeWidth="1.5" />
                {/* To HbA1c (top left) */}
                <line x1="120" y1="100" x2="55" y2="50" stroke="#cbd5e1" strokeWidth="1.5" />
                {/* To BMI (top right) */}
                <line x1="120" y1="100" x2="185" y2="50" stroke="#cbd5e1" strokeWidth="1.5" />
                {/* To Age (bottom left) */}
                <line x1="120" y1="100" x2="55" y2="150" stroke="#cbd5e1" strokeWidth="1.5" />
                {/* To Lipids (bottom right) */}
                <line x1="120" y1="100" x2="185" y2="150" stroke="#cbd5e1" strokeWidth="1.5" />

                {/* Center Node: P07 */}
                <circle cx="120" cy="100" r="18" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
                <text x="120" y="104" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#1e293b">
                  {patient.id}
                </text>

                {/* Top Node: Risk */}
                <circle cx="120" cy="40" r="12" fill="#f0fdf4" stroke="#059669" strokeWidth="1.5" />
                <text x="120" y="44" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#065f46">
                  Risk
                </text>

                {/* Top Left Node: HbA1c */}
                <circle cx="55" cy="50" r="13" fill="#fef2f2" stroke="#dc2626" strokeWidth="1.5" />
                <text x="55" y="54" textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="#7f1d1d">
                  HbA1c
                </text>

                {/* Top Right Node: BMI */}
                <circle cx="185" cy="50" r="13" fill="#fffbeb" stroke="#d97706" strokeWidth="1.5" />
                <text x="185" y="54" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#78350f">
                  BMI
                </text>

                {/* Bottom Left Node: Age */}
                <circle cx="55" cy="150" r="13" fill="#f0fdf4" stroke="#10b981" strokeWidth="1.5" />
                <text x="55" y="154" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#065f46">
                  Age
                </text>

                {/* Bottom Right Node: Lipids */}
                <circle cx="185" cy="150" r="13" fill="#f0fdfa" stroke="#0d9488" strokeWidth="1.5" />
                <text x="185" y="154" textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="#134e4a">
                  Lipids
                </text>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM ACTION BUTTONS */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          onClick={() => onNavigate('digital_twin')}
          className="px-5 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm font-medium hover:bg-slate-50 transition shadow-2xs flex items-center gap-1.5"
        >
          <span>Digital twin view</span>
          <span>↗</span>
        </button>

        <button
          onClick={() => onNavigate('reports')}
          className="px-5 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm font-medium hover:bg-slate-50 transition shadow-2xs flex items-center gap-1.5"
        >
          <span>Report page</span>
          <span>↗</span>
        </button>
      </div>
    </div>
  );
};
