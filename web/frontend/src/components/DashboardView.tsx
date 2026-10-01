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
import type { Patient, NavigationModule } from '../types';

interface DashboardViewProps {
  patient: Patient;
  onNavigate: (module: NavigationModule) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ patient, onNavigate }) => {
  // What-if sliders state (initialized to simulate 43% as in mockup)
  // When sliders are set to target intervention: HbA1c: 7.0, FBG: 7.5, BMI: 24.5 => gives 43%!
  // We can initialize them to the simulated target (or let patient toggle baseline vs target)
  const [whatIfHbA1c, setWhatIfHbA1c] = useState<number>(7.0);
  const [whatIfFbg, setWhatIfFbg] = useState<number>(7.5);
  const [whatIfBmi, setWhatIfBmi] = useState<number>(24.5);

  // Calculate simulated risk dynamically
  const baselineRisk = patient.currentRiskPct; // 68% for P07
  const deltaHbA1c = whatIfHbA1c - patient.hba1c;
  const deltaFbg = whatIfFbg - patient.fastingGlucose;
  const deltaBmi = whatIfBmi - patient.bmi;

  const simulatedRisk = Math.round(
    Math.min(95, Math.max(12, baselineRisk + deltaHbA1c * 12 + deltaFbg * 1.8 + deltaBmi * 1.5))
  );

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
        {/* CARD 1: Longitudinal timeline, HbA1c */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 flex flex-col justify-between min-h-[290px]">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900">
              Longitudinal timeline, HbA1c
            </h3>

            {/* Custom SVG Line Chart matching mockup */}
            <div className="mt-4 w-full h-36 flex flex-col justify-center">
              <svg className="w-full h-28 overflow-visible" viewBox="0 0 320 80">
                {/* Horizontal guide lines */}
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

                {/* Highlight Point on Visit 14 (end point) */}
                <circle cx="310" cy="24" r="4.5" fill="#2563eb" />
              </svg>

              {/* X-axis labels */}
              <div className="flex justify-between text-[11px] text-slate-500 pt-1 px-1">
                <span>Visit 1</span>
                <span>Visit 14</span>
              </div>
            </div>
          </div>

          {/* Subtext legend */}
          <div className="pt-3 text-xs text-slate-500">
            <span className="text-blue-600 font-semibold">Solid</span> current,{' '}
            <span className="text-amber-700 font-semibold">dashed</span> historical average
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
