/**
 * Core Patient Dashboard View.
 * Matches the user mockup layout and elements with pixel-precision:
 * - 4 Key Metrics: HbA1c, Fasting glucose, BMI, Current risk
 * - 2x2 Grid:
 *    1. Longitudinal timeline, HbA1c
 *    2. Why this risk? Key factors
 *    3. What-if simulation with working sliders
 *    4. Patient-friendly health summary
 * - Bottom action buttons: Digital twin view ↗, Report page ↗
 */
import React, { useState } from 'react';
import { Activity, Radio, AlertCircle, ArrowRight, Gauge, CheckCircle2 } from 'lucide-react';
import type { Patient, NavigationModule } from '../types';
import type { ClinicalRecommendation } from '../data/knowledgeGraphDemoData';

export type DashboardPatient = Pick<Patient, 'hba1c' | 'fastingGlucose' | 'bmi' | 'currentRiskPct' | 'timeInRangePct' | 'hasContinuousCGM' | 'cgmReadings' | 'cgmSummary' | 'keyFactors'>;
interface DashboardViewProps {
  patient: DashboardPatient;
  onNavigate: (module: NavigationModule) => void;
  sharedRecommendations?: ClinicalRecommendation[];
  selfService?: boolean;
  canViewPredictions?: boolean;
}


type AgpBin = {
  minuteOfDay: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
};

const CompactAgpChart: React.FC<{ bins: AgpBin[] }> = ({ bins }) => {
  const width = 320;
  const height = 100;

  const left = 28;
  const right = 306;
  const top = 6;
  const bottom = 76;

  const minG = 40;
  const maxG = 340;

  const x = (minute: number) =>
    left + (minute / 1440) * (right - left);

  const y = (glucose: number) =>
    bottom - ((Math.max(minG, Math.min(maxG, glucose)) - minG) /
      (maxG - minG)) * (bottom - top);

  const makeBand = (
    lower: 'p10' | 'p25',
    upper: 'p90' | 'p75'
  ) => {
    if (bins.length < 2) return '';

    const upperPoints = bins.map(
      (b) => `${x(b.minuteOfDay)},${y(b[upper])}`
    );

    const lowerPoints = [...bins].reverse().map(
      (b) => `${x(b.minuteOfDay)},${y(b[lower])}`
    );

    return `M ${upperPoints.join(' L ')} L ${lowerPoints.join(' L ')} Z`;
  };

  const medianPath = bins
    .map((b, i) =>
      `${i === 0 ? 'M' : 'L'} ${x(b.minuteOfDay)} ${y(b.median)}`
    )
    .join(' ');

  const outer = makeBand('p10', 'p90');
  const inner = makeBand('p25', 'p75');

  return (
    <div className="mt-4 w-full h-36 flex flex-col justify-center">
      {bins.length === 0 ? (
        <div className="h-28 flex items-center justify-center text-xs text-slate-400">
          No CGM data available
        </div>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-28 overflow-visible"
            role="img"
            aria-label="Compact ambulatory glucose profile with percentile bands and median glucose"
          >
            <defs>
              <clipPath id="dashboard-agp-clip">
                <rect
                  x={left}
                  y={top}
                  width={right - left}
                  height={bottom - top}
                />
              </clipPath>
              <clipPath id="dashboard-agp-below">
                <rect
                  x={left}
                  y={y(70)}
                  width={right - left}
                  height={bottom - y(70)}
                />
              </clipPath>

              <clipPath id="dashboard-agp-above">
                <rect
                  x={left}
                  y={top}
                  width={right - left}
                  height={y(180) - top}
                />
              </clipPath>
            </defs>

            {/* Target range */}
            <rect
              x={left}
              y={y(180)}
              width={right - left}
              height={y(70) - y(180)}
              fill="#D1FAE5"
              opacity="0.55"
            />

            {[70, 180].map((g) => (
              <line
                key={g}
                x1={left}
                x2={right}
                y1={y(g)}
                y2={y(g)}
                stroke="#10b981"
                strokeWidth="1"
                strokeDasharray="4 3"
              />
            ))}

            <g clipPath="url(#dashboard-agp-clip)">
              {/* P10–P90: light green */}
              <path d={outer} fill="#86EFAC" fillOpacity="0.65" />

              {/* Below target: orange */}
              <path
                d={outer}
                fill="#F97316"
                fillOpacity="0.9"
                clipPath="url(#dashboard-agp-below)"
              />

              {/* Above target: red */}
              <path
                d={outer}
                fill="#DC2626"
                fillOpacity="0.85"
                clipPath="url(#dashboard-agp-above)"
              />

              {/* P25–P75: dark green */}
              <path d={inner} fill="#15803D" fillOpacity="0.45" />

              <path
                d={inner}
                fill="#F97316"
                clipPath="url(#dashboard-agp-below)"
              />

              <path
                d={inner}
                fill="#DC2626"
                clipPath="url(#dashboard-agp-above)"
              />

              {/* Median glucose */}
              <path
                d={medianPath}
                fill="none"
                stroke="#1D4ED8"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>

            {/* X-axis */}
            {[0, 6, 12, 18, 24].map((hour) => {
              const xpos = x(hour * 60);

              return (
                <g key={hour}>
                  <line
                    x1={xpos}
                    x2={xpos}
                    y1={bottom}
                    y2={bottom + 3}
                    stroke="#94a3b8"
                  />
                  <text
                    x={xpos}
                    y={bottom + 13}
                    fontSize="8"
                    fill="#64748b"
                    textAnchor={
                      hour === 0 ? 'start' :
                      hour === 24 ? 'end' : 'middle'
                    }
                  >
                    {String(hour).padStart(2, '0')}:00
                  </text>
                </g>
              );
            })}

            {/* Compact Y-axis labels */}
            {[70, 180].map((g) => (
              <text
                key={g}
                x={left - 5}
                y={y(g) + 3}
                textAnchor="end"
                fontSize="8"
                fill="#059669"
              >
                {g}
              </text>
            ))}
          </svg>

          <div className="flex justify-between items-center text-[9px] text-slate-500 pt-1 px-1">
            <span>Time of day</span>
            <span>Glucose (mg/dL)</span>
          </div>
        </>
      )}
    </div>
  );
};

export const DashboardView: React.FC<DashboardViewProps> = ({ patient, onNavigate, sharedRecommendations = [], selfService = false, canViewPredictions = false }) => {
  const metric = (value: number, suffix = '') => Number.isFinite(value) ? `${value}${suffix}` : '—';
  const canSimulate = [patient.currentRiskPct, patient.hba1c, patient.fastingGlucose, patient.bmi].every(Number.isFinite);
  // What-if sliders state (initialized to simulate 43% as in mockup)
  const [whatIfHbA1c, setWhatIfHbA1c] = useState<number>(selfService && Number.isFinite(patient.hba1c) ? patient.hba1c : 7.0);
  const [whatIfFbg, setWhatIfFbg] = useState<number>(selfService && Number.isFinite(patient.fastingGlucose) ? patient.fastingGlucose : 7.5);
  const [whatIfBmi, setWhatIfBmi] = useState<number>(selfService && Number.isFinite(patient.bmi) ? patient.bmi : 24.5);

  // Calculate simulated risk dynamically
  const baselineRisk = patient.currentRiskPct;
  const deltaHbA1c = whatIfHbA1c - patient.hba1c;
  const deltaFbg = whatIfFbg - patient.fastingGlucose;
  const deltaBmi = whatIfBmi - patient.bmi;

  const simulatedRisk = Math.round(
    Math.min(95, Math.max(12, baselineRisk + deltaHbA1c * 12 + deltaFbg * 1.8 + deltaBmi * 1.5))
  );

  const agpBins = React.useMemo(() => {
    if (!patient.cgmReadings?.length) return [];

    const bins = Array.from({ length: 96 }, (_, i) => ({
      minuteOfDay: i * 15,
      values: [] as number[],
    }));

    patient.cgmReadings.forEach((reading) => {
      const date = new Date(reading.timestamp);
      const glucose = Number(reading.cgm);

      if (!Number.isFinite(date.getTime()) || !Number.isFinite(glucose)) {
        return;
      }

      const minuteOfDay = date.getHours() * 60 + date.getMinutes();
      const binIndex = Math.floor(minuteOfDay / 15);

      if (binIndex >= 0 && binIndex < 96) {
        bins[binIndex].values.push(glucose);
      }
    });

    const percentile = (sorted: number[], p: number) => {
      if (!sorted.length) return null;

      const position = (sorted.length - 1) * p;
      const lower = Math.floor(position);
      const upper = Math.ceil(position);

      return sorted[lower] +
        (sorted[upper] - sorted[lower]) * (position - lower);
    };

    return bins
      .filter((bin) => bin.values.length > 0)
      .map((bin) => {
        const sorted = [...bin.values].sort((a, b) => a - b);

        return {
          minuteOfDay: bin.minuteOfDay,
          p10: percentile(sorted, 0.10)!,
          p25: percentile(sorted, 0.25)!,
          median: percentile(sorted, 0.50)!,
          p75: percentile(sorted, 0.75)!,
          p90: percentile(sorted, 0.90)!,
        };
      });
  }, [patient.cgmReadings]);

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
            {metric(patient.hba1c, '%')}
          </p>
        </div>

        {/* Metric 2: Fasting glucose */}
        <div className="space-y-1">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Fasting glucose</p>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">
            {metric(patient.fastingGlucose)}
          </p>
        </div>

        {/* Metric 3: BMI */}
        <div className="space-y-1">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">BMI</p>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">
            {metric(patient.bmi)}
          </p>
        </div>

        {/* Metric 4: Current risk */}
        <div className="space-y-1">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Current risk</p>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#b91c1c] tracking-tight">
            {metric(patient.currentRiskPct, '%')}
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
                {selfService || hasCGM ? 'Continuous CGM Waveform' : 'Longitudinal Glycemic Profile'}
              </h3>
              {hasCGM && cgmSummary && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  TIR {cgmSummary.timeInRangePct}% · {cgmSummary.meanGlucose} mg/dL
                </span>
              )}
            </div>

            {hasCGM ? (
              <>
                <CompactAgpChart bins={agpBins} />

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-600 mt-1">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-2 rounded-sm bg-green-300" />
                    P10–P90
                  </span>

                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-2 rounded-sm bg-green-700" />
                    P25–P75
                  </span>

                  <span className="inline-flex items-center gap-1">
                    <span className="w-4 h-0.5 bg-blue-700" />
                    Median
                  </span>

                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-2 rounded-sm bg-orange-500" />
                    Below 70
                  </span>

                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-2 rounded-sm bg-red-600" />
                    Above 180
                  </span>
                </div>
              </>
            ) : (
              /* Clinical State for Patients Without CGM sensor */
              <div className="mt-3 bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">No Continuous CGM Sensor Telemetry</p>
                  <p className="text-[11px] text-slate-500 max-w-[270px] mt-0.5 leading-relaxed">
                    {selfService ? 'No sensor readings are available in your linked record yet.' : <>Continuous subcutaneous sensor not fitted for this admission. Baseline Fasting Glucose is <strong>{patient.fastingGlucose} mmol/L</strong> and HbA1c is <strong>{patient.hba1c}%</strong>.</>}
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
                <button
                  onClick={() => onNavigate('monitoring')}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  {selfService ? 'View readings →' : 'Full AGP Profile →'}
                </button>
              </>
            ) : (
              <span className="text-slate-400 text-[11px]">
                {selfService ? 'Only measurements from your own record appear here.' : 'Patients 2000, 2001, 2002, 2003 contain 14-day continuous CGM feeds.'}
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

            {/* Horizontal risk-factor bars (heuristic attribution, not SHAP) */}
            <div className="mt-5 space-y-3.5 text-xs sm:text-sm">
              {patient.keyFactors.length === 0 && <p className="rounded-xl bg-slate-50 p-5 text-sm leading-relaxed text-slate-500">A risk assessment is not available for your record yet.</p>}
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
        {canViewPredictions && <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 flex flex-col justify-between min-h-[290px] space-y-4">
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
                  aria-label="Simulated HbA1c"
                  disabled={!canSimulate}
                  min="5.0"
                  max="11.0"
                  step="0.1"
                  value={whatIfHbA1c}
                  onChange={(e) => setWhatIfHbA1c(parseFloat(e.target.value))}
                  className="w-full accent-slate-400 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
                <span className="w-10 text-right font-bold text-slate-900 shrink-0">
                  {canSimulate ? whatIfHbA1c.toFixed(1) : '—'}
                </span>
              </div>

              {/* Slider 2: Fasting glucose */}
              <div className="flex items-center justify-between gap-3">
                <span className="w-28 text-slate-700 shrink-0 font-normal">Fasting glucose</span>
                <input
                  type="range"
                  aria-label="Simulated fasting glucose"
                  disabled={!canSimulate}
                  min="4.5"
                  max="14.0"
                  step="0.1"
                  value={whatIfFbg}
                  onChange={(e) => setWhatIfFbg(parseFloat(e.target.value))}
                  className="w-full accent-slate-400 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
                <span className="w-10 text-right font-bold text-slate-900 shrink-0">
                  {canSimulate ? whatIfFbg.toFixed(1) : '—'}
                </span>
              </div>

              {/* Slider 3: BMI */}
              <div className="flex items-center justify-between gap-3">
                <span className="w-28 text-slate-700 shrink-0 font-normal">BMI</span>
                <input
                  type="range"
                  aria-label="Simulated BMI"
                  disabled={!canSimulate}
                  min="18.5"
                  max="38.0"
                  step="0.1"
                  value={whatIfBmi}
                  onChange={(e) => setWhatIfBmi(parseFloat(e.target.value))}
                  className="w-full accent-slate-400 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
                <span className="w-10 text-right font-bold text-slate-900 shrink-0">
                  {canSimulate ? whatIfBmi.toFixed(1) : '—'}
                </span>
              </div>
            </div>

            {/* Current vs Simulated Cards */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              {/* Current */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-left">
                <p className="text-xs text-slate-500 font-medium">Current</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {metric(baselineRisk, '%')}
                </p>
              </div>

              {/* Simulated */}
              <div className="bg-[#dbeafe] rounded-xl p-3 text-left">
                <p className="text-xs text-blue-700 font-medium">Simulated</p>
                <p className="text-2xl font-bold text-[#1d4ed8] mt-1">
                  {canSimulate ? metric(simulatedRisk, '%') : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Disclaimer at bottom */}
          {!canSimulate && <button type="button" onClick={() => onNavigate('risk')} className="text-left text-xs font-semibold text-teal-700 hover:underline">Open prediction and what-if lab →</button>}
          <p className="text-[11px] text-slate-400">
            {canSimulate ? 'Simulated result, not a clinical outcome.' : 'Simulation becomes available when your measurements and risk assessment are ready.'}
          </p>
        </div>}

        {/* CARD 4: Patient-friendly health summary (knowledge graph is clinician-only) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 flex flex-col justify-between min-h-[290px]">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-slate-900">Your health at a glance</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  A simple summary of the measurements in your current record.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-semibold text-teal-700">
                Health summary
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] font-medium text-slate-500">HbA1c</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {Number.isFinite(patient.hba1c) ? patient.hba1c.toFixed(1) + '%' : '—'}
                </p>
                <p className="mt-1 text-[10px] leading-4 text-slate-500">Longer-term glucose indicator</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] font-medium text-slate-500">Fasting glucose</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {Number.isFinite(patient.fastingGlucose) ? patient.fastingGlucose.toFixed(1) : '—'}
                  <span className="ml-1 text-xs font-medium text-slate-500">mmol/L</span>
                </p>
                <p className="mt-1 text-[10px] leading-4 text-slate-500">Recorded fasting value</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] font-medium text-slate-500">BMI</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {Number.isFinite(patient.bmi) && patient.bmi > 0 ? patient.bmi.toFixed(1) : '—'}
                </p>
                <p className="mt-1 text-[10px] leading-4 text-slate-500">Body mass index</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] font-medium text-slate-500">Time in range</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {Number.isFinite(patient.timeInRangePct) ? Math.round(patient.timeInRangePct) + '%' : '—'}
                </p>
                <p className="mt-1 text-[10px] leading-4 text-slate-500">When monitoring data is available</p>
              </div>
            </div>
          </div>
          <p className="mt-4 text-[11px] leading-5 text-slate-400">
            These values summarise the selected record and are not a diagnosis. Discuss their meaning with your healthcare professional.
          </p>
        </div>
      </div>

      {/* Recommendations are patient-friendly text only; the KG itself is never rendered in the patient workspace. */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recommendations from your care team</h3>
                <p className="mt-0.5 text-[11px] text-slate-500">Guidance your clinician has chosen to share with you</p>
              </div>
            </div>
          </div>
          {sharedRecommendations.length > 0 && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-800">
              <CheckCircle2 className="h-3 w-3" />
              {sharedRecommendations.length} shared
            </span>
          )}
        </div>

        {sharedRecommendations.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {sharedRecommendations.map((recommendation) => (
              <article key={recommendation.id} className="rounded-xl border border-teal-100 bg-teal-50/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-teal-800">{recommendation.category}</span>
                  <span className="text-[10px] font-semibold text-slate-400">Shared by your care team</span>
                </div>
                <h4 className="mt-3 text-sm font-bold text-slate-900">{recommendation.title}</h4>
                <p className="mt-2 text-xs leading-5 text-slate-700">{recommendation.patientMessage}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-400">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800">No new recommendations have been shared</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">When your clinician shares guidance with you, it will appear here in plain language. Only clinician-approved items are shown.</p>
            </div>
          </div>
        )}
        {!selfService && <p className="mt-4 text-[10px] leading-4 text-slate-400">Prototype: shared items are temporary demo data and are not saved to a medical record or notification service.</p>}
      </section>

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
