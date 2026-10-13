/**
 * Longitudinal Monitoring View matching Figma Image 3
 * Features:
 * - Patient vitals header
 * - Longitudinal timeline: HbA1c (14 visits)
 * - Past 7 days: HbA1c / Glucose Distribution bar chart (Day 1 - Day 7)
 * - Ambulatory Glucose Profile (AGP) metrics (TIR, TAR, TBR, Mean Glucose, CV)
 */
import React, { useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Calendar,
  ChevronDown,
  Clock,
  TrendingUp,
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
  const [selectedDayRange, setSelectedDayRange] = useState('Past 7 days');

  // Daily CGM distribution data (Day 1 to Day 7)
  const dailyDistribution = [
    { day: 'Day 1', mean: 8.8, tir: 42, color: '#3b82f6' },
    { day: 'Day 2', mean: 9.2, tir: 36, color: '#2563eb' },
    { day: 'Day 3', mean: 7.9, tir: 55, color: '#60a5fa' },
    { day: 'Day 4', mean: 9.5, tir: 32, color: '#1d4ed8' },
    { day: 'Day 5', mean: 8.4, tir: 48, color: '#3b82f6' },
    { day: 'Day 6', mean: 7.6, tir: 62, color: '#93c5fd' },
    { day: 'Day 7', mean: 8.1, tir: 50, color: '#3b82f6' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Header with Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('patient_dashboard')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition"
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

      {/* 3. Longitudinal Timeline Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Longitudinal timeline: HbA1c
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              14 sequential outpatient appointments tracked over 24 months
            </p>
          </div>
          <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
            Latest: {patient.hba1c}%
          </span>
        </div>

        <div className="w-full h-48 flex flex-col justify-center pt-2">
          <svg className="w-full h-36 overflow-visible" viewBox="0 0 400 90">
            <line x1="10" y1="20" x2="390" y2="20" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="10" y1="50" x2="390" y2="50" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="10" y1="80" x2="390" y2="80" stroke="#e2e8f0" strokeWidth="1" />

            {/* Dashed Historical Average */}
            <path
              d="M 10 75 Q 100 68 200 60 T 300 52 T 390 46"
              fill="none"
              stroke="#b45309"
              strokeWidth="2"
              strokeDasharray="4 3"
            />

            {/* Solid Patient Curve */}
            <path
              d="M 10 65 L 70 56 L 150 44 L 220 52 L 280 36 L 340 28 L 390 22"
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
            />
            <circle cx="390" cy="22" r="4.5" fill="#2563eb" />
          </svg>

          <div className="flex justify-between text-xs text-slate-400 pt-2 px-1">
            <span>Visit 1 (Baseline 6.9%)</span>
            <span>Visit 7 (Midpoint 7.5%)</span>
            <span>Visit 14 (Current 8.1%)</span>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            <span className="text-blue-600 font-semibold">Solid:</span> current visits ·{' '}
            <span className="text-amber-700 font-semibold">Dashed:</span> historical average
          </div>
          <span className="text-slate-400 text-[11px]">
            Cohort standard: ADA/EASD Glycemic Goals
          </span>
        </div>
      </div>

      {/* 4. Past 7 Days: HbA1c / Glucose Distribution Bar Chart */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Past 7 days: HbA1c Distribution
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Daily mean glycemic levels and Time-in-Range breakdown
            </p>
          </div>

          <div className="relative">
            <select
              value={selectedDayRange}
              onChange={(e) => setSelectedDayRange(e.target.value)}
              className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 pr-6 appearance-none focus:outline-hidden cursor-pointer"
            >
              <option>Past 7 days</option>
              <option>Past 14 days</option>
              <option>Past 30 days</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-2 pointer-events-none" />
          </div>
        </div>

        {/* 7-Day Vertical Bar Chart matching mockup */}
        <div className="h-56 flex items-end justify-between gap-3 pt-6 px-4">
          {dailyDistribution.map((item) => {
            const barHeightPct = (item.mean / 12) * 100;
            return (
              <div key={item.day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span className="text-[11px] font-bold text-slate-700">
                  {item.mean.toFixed(1)}
                </span>
                <div className="w-full max-w-[42px] bg-slate-100 rounded-t-lg h-full max-h-36 flex items-end overflow-hidden">
                  <div
                    className="w-full bg-[#2563eb] rounded-t-lg transition-all duration-500 hover:bg-blue-500 cursor-pointer"
                    style={{ height: `${barHeightPct}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  {item.day}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
