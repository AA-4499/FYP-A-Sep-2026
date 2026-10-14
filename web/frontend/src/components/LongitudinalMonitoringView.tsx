/**
 * Longitudinal Monitoring View matching Figma Image 3
 * Features:
 * - Patient vitals header (HbA1c, Fasting glucose, BMI, Risk)
 * - Key Ambulatory Glucose Profile (AGP) metrics (TIR 70-180 mg/dL, TAR >180, TBR <70, Mean Glucose, CV%)
 * - Longitudinal Continuous CGM Sensor Waveform (14 Days, 1,000+ points)
 * - Actual Daily Glycemic Distribution (Day 1 - Day 14) with real TIR% breakdown
 * - Clean clinical notice for patients without continuous sensor telemetry
 */
import React, { useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Calendar,
  ChevronDown,
  Clock,
  TrendingUp,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import type { Patient } from '../types';

interface LongitudinalMonitoringViewProps {
  patient: Patient;
  onNavigate: (module: any) => void;
}

export const LongitudinalMonitoringView: React.FC<LongitudinalMonitoringViewProps> = ({
  patient,
  onNavigate,
}) => {
  const [selectedDayRange, setSelectedDayRange] = useState('All 14 days');
  const hasCGM = Boolean(patient.hasContinuousCGM && patient.cgmReadings && patient.cgmReadings.length > 0);
  const cgmSummary = patient.cgmSummary;

  // Profiles to display
  const allProfiles = cgmSummary?.dailyProfiles || [];
  const displayProfiles =
    selectedDayRange === 'First 7 days'
      ? allProfiles.slice(0, 7)
      : selectedDayRange === 'Last 7 days'
      ? allProfiles.slice(-7)
      : allProfiles;

  // Generate SVG path for actual continuous CGM readings
  const renderCGMPath = () => {
    if (!patient.cgmReadings || patient.cgmReadings.length === 0) return '';
    const readings = patient.cgmReadings;
    const step = Math.max(1, Math.floor(readings.length / 150));
    const sampled = readings.filter((_, idx) => idx % step === 0);
    const minG = 40;
    const maxG = 340;
    const width = 380;
    const height = 65;

    const points = sampled.map((r, idx) => {
      const x = 10 + (idx / (sampled.length - 1 || 1)) * width;
      const clamped = Math.max(minG, Math.min(maxG, r.cgm));
      const y = 78 - ((clamped - minG) / (maxG - minG)) * height;
      return `${x.toFixed(1)} ${y.toFixed(1)}`;
    });

    return `M ${points.join(' L ')}`;
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Header with Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('patient_dashboard')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Patient Dashboard</span>
        </button>

        <span className="text-xs text-slate-400 font-medium">
          Module: <strong className="text-slate-700">Longitudinal Monitoring</strong>
        </span>
      </div>

      {/* 2. Top Patient Vitals Strip */}
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

      {/* 3. AGP Metrics Strip (If continuous CGM telemetry exists) */}
      {hasCGM && cgmSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4">
          <div className="space-y-0.5 border-r border-slate-100 pr-3">
            <span className="text-[11px] text-slate-500 font-medium">Time In Range (TIR)</span>
            <p className="text-xl font-bold text-emerald-600">{cgmSummary.timeInRangePct}%</p>
            <span className="text-[10px] text-slate-400">70–180 mg/dL target</span>
          </div>

          <div className="space-y-0.5 border-r border-slate-100 pr-3">
            <span className="text-[11px] text-slate-500 font-medium">Time Above Range</span>
            <p className="text-xl font-bold text-rose-600">{cgmSummary.timeAboveRangePct}%</p>
            <span className="text-[10px] text-slate-400">&gt; 180 mg/dL</span>
          </div>

          <div className="space-y-0.5 border-r border-slate-100 pr-3">
            <span className="text-[11px] text-slate-500 font-medium">Time Below Range</span>
            <p className="text-xl font-bold text-amber-600">{cgmSummary.timeBelowRangePct}%</p>
            <span className="text-[10px] text-slate-400">&lt; 70 mg/dL</span>
          </div>

          <div className="space-y-0.5 border-r border-slate-100 pr-3">
            <span className="text-[11px] text-slate-500 font-medium">Mean CGM Glucose</span>
            <p className="text-xl font-bold text-slate-900">{cgmSummary.meanGlucose} <span className="text-xs font-normal text-slate-500">mg/dL</span></p>
            <span className="text-[10px] text-slate-400">{(cgmSummary.meanGlucose / 18.0182).toFixed(1)} mmol/L</span>
          </div>

          <div className="space-y-0.5">
            <span className="text-[11px] text-slate-500 font-medium">Glycemic Variability</span>
            <p className="text-xl font-bold text-slate-800">{cgmSummary.cvPct}% <span className="text-xs font-normal text-slate-500">CV</span></p>
            <span className="text-[10px] text-slate-400">Target &le; 36%</span>
          </div>
        </div>
      )}

      {/* 4. Continuous CGM Waveform Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {hasCGM ? 'Continuous CGM Sensor Telemetry Waveform' : 'Continuous CGM Telemetry'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {hasCGM
                ? `${patient.cgmReadings?.length.toLocaleString()} continuous 15-minute readings over 14 monitoring days`
                : 'Continuous sensor monitoring telemetry status for this patient'}
            </p>
          </div>
          {hasCGM && cgmSummary && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
              Mean: {cgmSummary.meanGlucose} mg/dL ({(cgmSummary.meanGlucose / 18.0182).toFixed(1)} mmol/L)
            </span>
          )}
        </div>

        {hasCGM ? (
          <div className="w-full h-56 flex flex-col justify-center pt-2">
            <svg className="w-full h-44 overflow-visible" viewBox="0 0 400 95">
              {/* Horizontal Reference Lines */}
              <line x1="10" y1="15" x2="390" y2="15" stroke="#f8fafc" strokeWidth="1" />
              <line x1="10" y1="42" x2="390" y2="42" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="10" y1="78" x2="390" y2="78" stroke="#e2e8f0" strokeWidth="1" />

              {/* Shaded Target Band (70 - 180 mg/dL) */}
              <rect x="10" y="40" width="380" height="30" fill="#ecfdf5" rx="4" />
              <line x1="10" y1="40" x2="390" y2="40" stroke="#a7f3d0" strokeWidth="0.8" strokeDasharray="3 2" />
              <line x1="10" y1="70" x2="390" y2="70" stroke="#a7f3d0" strokeWidth="0.8" strokeDasharray="3 2" />

              <text x="392" y="43" fontSize="7" fill="#10b981" fontStyle="italic">180</text>
              <text x="392" y="73" fontSize="7" fill="#10b981" fontStyle="italic">70</text>

              {/* Continuous Telemetry Path */}
              <path
                d={renderCGMPath()}
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* End Point */}
              <circle cx="390" cy="48" r="4" fill="#2563eb" />
            </svg>

            <div className="flex justify-between text-xs text-slate-400 pt-3 px-2 font-medium">
              <span>{cgmSummary?.startDate ? new Date(cgmSummary.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Day 1'}</span>
              <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                14-Day Full Hospital Sensor Feed
              </span>
              <span>{cgmSummary?.endDate ? new Date(cgmSummary.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Day 14'}</span>
            </div>
          </div>
        ) : (
          <div className="py-8 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col items-center justify-center text-center space-y-3 px-4">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">No Continuous CGM Sensor Telemetry</p>
              <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
                This patient record was logged with admission laboratory vitals without continuous subcutaneous CGM sensor wear. Baseline Fasting Plasma Glucose is <strong>{patient.fastingGlucose} mmol/L</strong> and HbA1c is <strong>{patient.hba1c}%</strong>.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <span className="text-xs text-slate-400 font-medium">Showcase patients with full 14-day CGM:</span>
              <button
                onClick={() => onNavigate('patients')}
                className="px-3 py-1 bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-bold transition shadow-2xs"
              >
                Switch to Patient 2000 or 2003 →
              </button>
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
          <div>
            <span className="text-emerald-700 font-semibold">Green zone:</span> Target Range (70–180 mg/dL) ·{' '}
            <span className="text-blue-600 font-semibold">Blue wave:</span> 15-minute interstitial glucose
          </div>
          <span className="text-slate-400 text-[11px]">
            Clinical Standard: ADA/EASD Ambulatory Glucose Profile
          </span>
        </div>
      </div>

      {/* 5. Daily Glycemic Distribution Bar Chart (Day 1 - Day 14) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Daily Glycemic Distribution (Day-by-Day Profiles)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {hasCGM ? 'Daily mean glucose levels and Time-in-Range percentages across each 24-hour cycle' : 'Daily glucose logs'}
            </p>
          </div>

          {hasCGM && (
            <div className="relative">
              <select
                value={selectedDayRange}
                onChange={(e) => setSelectedDayRange(e.target.value)}
                className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 pr-6 appearance-none focus:outline-hidden cursor-pointer"
              >
                <option>All 14 days</option>
                <option>First 7 days</option>
                <option>Last 7 days</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-2 pointer-events-none" />
            </div>
          )}
        </div>

        {hasCGM && displayProfiles.length > 0 ? (
          <div className="h-64 flex items-end justify-between gap-2 pt-6 px-2 overflow-x-auto">
            {displayProfiles.map((item) => {
              // Scale bar based on max 250 mg/dL
              const barHeightPct = Math.min(100, Math.max(15, (item.mean / 260) * 100));
              const isOptimal = item.tir >= 70;
              const isModerate = item.tir >= 50 && item.tir < 70;

              return (
                <div key={item.dayLabel} className="flex-1 min-w-[40px] flex flex-col items-center gap-1.5 h-full justify-end group">
                  <span className="text-[10px] font-bold text-slate-700">
                    {item.mean}
                  </span>
                  <div className="w-full max-w-[34px] bg-slate-100 rounded-t-lg h-full max-h-40 flex items-end overflow-hidden">
                    <div
                      className={`w-full rounded-t-lg transition-all duration-500 cursor-pointer ${
                        isOptimal
                          ? 'bg-emerald-500 hover:bg-emerald-600'
                          : isModerate
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-rose-500 hover:bg-rose-600'
                      }`}
                      style={{ height: `${barHeightPct}%` }}
                      title={`${item.dayLabel}: Mean ${item.mean} mg/dL, TIR ${item.tir}%`}
                    />
                  </div>
                  <span className="text-[9px] text-slate-500 font-semibold truncate max-w-[50px] text-center">
                    D{item.dayNumber}
                  </span>
                  <span className={`text-[9px] font-bold ${isOptimal ? 'text-emerald-600' : isModerate ? 'text-blue-600' : 'text-rose-600'}`}>
                    {item.tir}%
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            No daily continuous CGM profiles recorded for this patient.
          </div>
        )}

        {hasCGM && (
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                <span>TIR &ge; 70% (Optimal)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" />
                <span>TIR 50–70% (Moderate)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" />
                <span>TIR &lt; 50% (High Variance)</span>
              </span>
            </div>
            <span className="text-[11px] text-slate-400">Values on top of bars: Daily Mean Glucose (mg/dL)</span>
          </div>
        )}
      </div>
    </div>
  );
};
