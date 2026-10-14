import React, { useState } from 'react';
import {
  Download,
  AlertTriangle,
  Users,
  Gauge,
  Activity,
  ChevronDown,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  X,
  ShieldAlert,
} from 'lucide-react';
import {
  HBA1C_TREND_6M,
  CGM_TREND_24H,
  CLINICAL_SNAPSHOT,
} from '../data/clinicData';
import { PATIENTS } from '../data/patientsData';
import type { Patient } from '../types';
import { computeCohortStats } from '../lib/supabase';

interface ClinicDashboardViewProps {
  patients?: Patient[];
  isSupabaseLive?: boolean;
  onSelectPatient: (patientId: string) => void;
  onViewAllPatients: () => void;
  onViewAlerts: () => void;
}

export const ClinicDashboardView: React.FC<ClinicDashboardViewProps> = ({
  patients,
  isSupabaseLive,
  onSelectPatient,
  onViewAllPatients,
  onViewAlerts,
}) => {
  const patientList = patients && patients.length > 0 ? patients : PATIENTS;
  const cohort = computeCohortStats(patientList);
  const [clinicFilter, setClinicFilter] = useState('All clinics');
  const [hba1cPeriod, setHba1cPeriod] = useState('Last 6 months');
  const [cgmPeriod, setCgmPeriod] = useState('Last 24 hours');
  const [showAlertModal, setShowAlertModal] = useState(false);

  return (
    <div className="space-y-5 animate-fadeIn pb-12">
      {/* 1. Header with Title & Date */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Diabetes Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            October 4 2026 · 17:00:07 pm
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition shadow-2xs self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export report</span>
        </button>
      </div>

      {/* 2. Clinical Alert Banner */}
      <div className="bg-[#fffbeb] border border-[#fef3c7] rounded-xl px-4 py-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-[#92400e] font-medium">
          <AlertTriangle className="w-4 h-4 text-[#d97706] shrink-0" />
          <span>
            <strong className="font-semibold">{cohort.alertsCount} clinical alerts</strong> need review (10 patients flagged with documented hypoglycemia).
          </span>
        </div>
        <button
          onClick={() => setShowAlertModal(true)}
          className="text-[#b45309] hover:text-[#78350f] font-semibold flex items-center gap-1 transition cursor-pointer"
        >
          <span>View alerts ({cohort.alertsCount})</span>
          <span>→</span>
        </button>
      </div>

      {/* 3. Three Key Summary Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1: Active patients */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs text-slate-500 font-medium">Active patients</span>
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <p className="text-3xl font-bold text-slate-900 tracking-tight">
                {cohort.activePatients.toLocaleString()}
              </p>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                <span>↑</span>
                <span>{cohort.activePatientsGrowth}</span>
              </p>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Avg Age: {cohort.avgAge} yrs · Avg BMI: {cohort.avgBmi}
              </p>
            </div>
            {/* Sparkline bars */}
            <div className="flex items-end gap-1 h-8">
              <span className="w-1.5 h-3 bg-blue-200 rounded-xs" />
              <span className="w-1.5 h-5 bg-blue-300 rounded-xs" />
              <span className="w-1.5 h-4 bg-blue-400 rounded-xs" />
              <span className="w-1.5 h-7 bg-blue-500 rounded-xs" />
              <span className="w-1.5 h-8 bg-blue-600 rounded-xs" />
            </div>
          </div>
        </div>

        {/* Metric 2: Average CGM */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs text-slate-500 font-medium">Average CGM</span>
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Gauge className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <p className="text-3xl font-bold text-slate-900 tracking-tight">
                {cohort.timeInRange ?? "-"} mg/dL
              </p>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                <span>↑</span>
                <span>{cohort.timeInRangeGrowth}</span>
              </p>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Average of patient_detail CGM (mg/dL)
              </p>
            </div>
            {/* Sparkline bars */}
            <div className="flex items-end gap-1 h-8">
              <span className="w-1.5 h-4 bg-blue-200 rounded-xs" />
              <span className="w-1.5 h-4 bg-blue-300 rounded-xs" />
              <span className="w-1.5 h-6 bg-blue-400 rounded-xs" />
              <span className="w-1.5 h-7 bg-blue-500 rounded-xs" />
              <span className="w-1.5 h-8 bg-blue-600 rounded-xs" />
            </div>
          </div>
        </div>

        {/* Metric 3: Mean glucose */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs text-slate-500 font-medium">Mean glucose</span>
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <p className="text-3xl font-bold text-slate-900 tracking-tight">
                {cohort.meanGlucose ?? "-"} <span className="text-base font-medium text-slate-500">mg/dL</span>
              </p>
              <p className="text-[11px] text-blue-600 font-semibold mt-1 flex items-center gap-1">
                <span>{cohort.meanGlucoseDelta}</span>
              </p>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Cohort HbA1c Mean: {cohort.avgHbA1c}% ({cohort.avgHbA1cMmol} mmol/mol)
              </p>
            </div>
            {/* Sparkline bars */}
            <div className="flex items-end gap-1 h-8">
              <span className="w-1.5 h-8 bg-blue-600 rounded-xs" />
              <span className="w-1.5 h-7 bg-blue-500 rounded-xs" />
              <span className="w-1.5 h-6 bg-blue-400 rounded-xs" />
              <span className="w-1.5 h-5 bg-blue-300 rounded-xs" />
              <span className="w-1.5 h-4 bg-blue-200 rounded-xs" />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Patient Distribution Card (Gender, Age, BMI) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Patient distribution</h2>
            <p className="text-xs text-slate-400 mt-0.5">{cohort.activePatients} enrolled cohort patients</p>
          </div>

          <div className="relative">
            <select
              value={clinicFilter}
              onChange={(e) => setClinicFilter(e.target.value)}
              className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 pr-6 appearance-none focus:outline-hidden cursor-pointer"
            >
              <option>All clinics</option>
              <option>Borneo Center Kuching</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-2 pointer-events-none" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {/* 4a. Gender Distribution Donut */}
          <div className="flex flex-col items-center">
            <h3 className="text-xs font-bold text-slate-700 mb-4 self-center">Gender</h3>
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                {/* Donut background circle */}
                <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="18" />
                {/* Female segment */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="#84cc16"
                  strokeWidth="18"
                  strokeDasharray={`${238.76 * (cohort.genderDistribution[0].value / 100)} ${238.76 * (1 - cohort.genderDistribution[0].value / 100)}`}
                  strokeDashoffset="0"
                />
                {/* Male segment */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="18"
                  strokeDasharray={`${238.76 * (cohort.genderDistribution[1].value / 100)} ${238.76 * (1 - cohort.genderDistribution[1].value / 100)}`}
                  strokeDashoffset={`-${238.76 * (cohort.genderDistribution[0].value / 100)}`}
                />
              </svg>
            </div>
            <div className="flex items-center justify-between w-full max-w-[200px] mt-4 text-[11px] text-slate-600">
              <div className="text-center">
                <span className="block font-semibold text-slate-800">Female</span>
                <span className="text-slate-400">({cohort.genderDistribution[0].value}%)</span>
              </div>
              <div className="text-center">
                <span className="block font-semibold text-slate-800">Male</span>
                <span className="text-slate-400">({cohort.genderDistribution[1].value}%)</span>
              </div>
            </div>
          </div>

          {/* 4b. Age Distribution Bar Chart */}
          <div>
            <h3 className="text-xs font-bold text-slate-700 mb-3 text-center">Age (Mean {cohort.avgAge} yrs)</h3>
            <div className="space-y-2 text-xs">
              {cohort.ageDistribution.map((item) => (
                <div key={item.range} className="flex items-center gap-2">
                  <span className="w-12 text-[11px] text-slate-500 shrink-0 font-medium">{item.range}</span>
                  <div className="w-full bg-slate-100 rounded-xs h-3.5 overflow-hidden flex">
                    <div
                      className="bg-[#2563eb] h-full transition-all duration-300 rounded-xs"
                      style={{ width: `${Math.min(100, item.pct * 2.5)}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-[11px] text-slate-600 shrink-0 font-medium">
                    {item.pct.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 4c. BMI Distribution Bar Chart */}
          <div>
            <h3 className="text-xs font-bold text-slate-700 mb-3 text-center">BMI (Mean {cohort.avgBmi})</h3>
            <div className="space-y-3 text-xs pt-1">
              {cohort.bmiDistribution.map((item) => (
                <div key={item.category} className="flex items-center gap-2">
                  <span className="w-20 text-[11px] text-slate-500 shrink-0 font-medium">{item.category}</span>
                  <div className="w-full bg-slate-100 rounded-xs h-3.5 overflow-hidden flex">
                    <div
                      className="bg-[#2563eb] h-full transition-all duration-300 rounded-xs"
                      style={{ width: `${Math.min(100, item.pct * 1.5)}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-[11px] text-slate-600 shrink-0 font-medium">
                    {item.pct.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Second Row: HbA1c Trend & Glycemic Control Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 5a. Average HbA1c Trend (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Cohort HbA1c Glycemic Profile</h2>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-slate-900">{cohort.avgHbA1c}%</span>
                <span className="text-xs font-semibold text-slate-500">
                  {cohort.avgHbA1cMmol} mmol/mol cohort average
                </span>
              </div>
            </div>

            <div className="relative">
              <select
                value={hba1cPeriod}
                onChange={(e) => setHba1cPeriod(e.target.value)}
                className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 pr-6 appearance-none focus:outline-hidden cursor-pointer"
              >
                <option>Last 6 months</option>
                <option>Last 12 months</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-2 pointer-events-none" />
            </div>
          </div>

          {/* SVG Line Chart */}
          <div className="mt-6 w-full h-44 flex flex-col justify-end">
            <svg viewBox="0 0 500 120" className="w-full h-32 overflow-visible">
              {/* Y Grid lines */}
              <line x1="30" y1="20" x2="490" y2="20" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="30" y1="50" x2="490" y2="50" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="30" y1="80" x2="490" y2="80" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="30" y1="110" x2="490" y2="110" stroke="#f1f5f9" strokeWidth="1" />

              {/* Y-axis labels */}
              <text x="20" y="24" fontSize="9" fill="#94a3b8" textAnchor="end">10.0</text>
              <text x="20" y="54" fontSize="9" fill="#94a3b8" textAnchor="end">9.0</text>
              <text x="20" y="84" fontSize="9" fill="#94a3b8" textAnchor="end">8.0</text>
              <text x="20" y="114" fontSize="9" fill="#94a3b8" textAnchor="end">7.0</text>

              {/* Data Path */}
              <path
                d="M 60 54 Q 130 52 200 50 T 340 54 T 470 54"
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.5"
              />

              {/* Points */}
              <circle cx="60" cy="54" r="3.5" fill="#2563eb" />
              <circle cx="150" cy="52" r="3.5" fill="#2563eb" />
              <circle cx="230" cy="50" r="3.5" fill="#2563eb" />
              <circle cx="320" cy="54" r="3.5" fill="#2563eb" />
              <circle cx="410" cy="54" r="3.5" fill="#2563eb" />
              <circle cx="470" cy="54" r="3.5" fill="#2563eb" />
            </svg>

            {/* X-axis labels */}
            <div className="flex justify-between pl-8 pr-3 text-[11px] text-slate-400 font-medium pt-2">
              <span>Apr</span>
              <span>May</span>
              <span>Jun</span>
              <span>Jul</span>
              <span>Aug</span>
              <span>Sep</span>
            </div>
          </div>
        </div>

        {/* 5b. Glycemic Control List */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Glycemic control</h2>
            <p className="text-xs text-slate-400 mt-0.5">Latest HbA1c result per patient</p>

            <div className="mt-5 space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-slate-600">At target &lt; 7.0%</span>
                </div>
                <strong className="text-slate-900">{cohort.glycemicControl.atTarget.toLocaleString()}</strong>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-slate-600">Above target 7.0 - 8.5%</span>
                </div>
                <strong className="text-slate-900">{cohort.glycemicControl.aboveTarget.toLocaleString()}</strong>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-slate-600">High risk &gt; 8.5%</span>
                </div>
                <strong className="text-slate-900">{cohort.glycemicControl.highRisk.toLocaleString()}</strong>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Cohort Median HbA1c</span>
            <span className="text-sm font-bold text-slate-900">{cohort.glycemicControl.medianHbA1c}%</span>
          </div>
        </div>
      </div>

      {/* 6. Third Row: Average CGM Trend & Clinical Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 6a. Average CGM trend (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Average CGM trend</h2>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-slate-900">150 mg/dL</span>
                <span className="text-xs font-semibold text-emerald-600">
                  ↓ 10 mg/dL
                </span>
              </div>
            </div>

            <div className="relative">
              <select
                value={cgmPeriod}
                onChange={(e) => setCgmPeriod(e.target.value)}
                className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 pr-6 appearance-none focus:outline-hidden cursor-pointer"
              >
                <option>Last 24 hours</option>
                <option>Last 7 days</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-2 pointer-events-none" />
            </div>
          </div>

          {/* SVG CGM Line Chart */}
          <div className="mt-6 w-full h-44 flex flex-col justify-end">
            <svg viewBox="0 0 500 120" className="w-full h-32 overflow-visible">
              {/* Y Grid lines */}
              <line x1="30" y1="20" x2="490" y2="20" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="30" y1="50" x2="490" y2="50" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="30" y1="80" x2="490" y2="80" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="30" y1="110" x2="490" y2="110" stroke="#f1f5f9" strokeWidth="1" />

              {/* Y-axis labels */}
              <text x="20" y="24" fontSize="9" fill="#94a3b8" textAnchor="end">170</text>
              <text x="20" y="54" fontSize="9" fill="#94a3b8" textAnchor="end">160</text>
              <text x="20" y="84" fontSize="9" fill="#94a3b8" textAnchor="end">150</text>
              <text x="20" y="114" fontSize="9" fill="#94a3b8" textAnchor="end">140</text>

              {/* Data Path: 165 down to 142 */}
              <path
                d="M 60 35 Q 140 45 220 65 T 380 92 T 470 100"
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.5"
              />

              {/* Points */}
              <circle cx="60" cy="35" r="3.5" fill="#2563eb" />
              <circle cx="140" cy="48" r="3.5" fill="#2563eb" />
              <circle cx="220" cy="68" r="3.5" fill="#2563eb" />
              <circle cx="310" cy="82" r="3.5" fill="#2563eb" />
              <circle cx="390" cy="94" r="3.5" fill="#2563eb" />
              <circle cx="470" cy="100" r="3.5" fill="#2563eb" />
            </svg>

            {/* X-axis labels */}
            <div className="flex justify-between pl-8 pr-3 text-[11px] text-slate-400 font-medium pt-2">
              <span>12:00</span>
              <span>14:00</span>
              <span>16:00</span>
              <span>18:00</span>
              <span>20:00</span>
              <span>22:00</span>
            </div>
          </div>
        </div>

        {/* 6b. Clinical Snapshot */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Clinical snapshot</h2>
            <p className="text-xs text-slate-400 mt-0.5">CGM metrics and risk stratification</p>

            <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Avg glucose</span>
                <strong className="text-base text-slate-900 font-bold">{cohort.meanGlucose ?? "-"} mg/dL</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Average CGM</span>
                <strong className="text-base text-slate-900 font-bold">{cohort.meanGlucose ?? "-"} mg/dL</strong>
              </div>
            </div>

            {/* Risk Distribution Meters */}
            <div className="mt-5 space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="text-slate-600">High risk</span>
                  </div>
                  <strong className="text-slate-900">{/**CLINICAL_SNAPSHOT.highRisk*/}</strong>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: '12%' }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-slate-600">Moderate</span>
                  </div>
                  <strong className="text-slate-900">{/**CLINICAL_SNAPSHOT.moderate*/}</strong>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: '28%' }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-slate-600">Stable</span>
                  </div>
                  <strong className="text-slate-900">{/**CLINICAL_SNAPSHOT.stable.toLocaleString()*/}</strong>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '78%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Fourth Row: Priority Patient Activity Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Priority patient activity</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Patients requiring review based on recent clinical signals
            </p>
          </div>

          <button
            onClick={onViewAllPatients}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition"
          >
            <span>View patients</span>
            <span>→</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] text-slate-400 uppercase font-semibold border-b border-slate-100">
                <th className="py-2.5 px-3">Patient</th>
                <th className="py-2.5 px-3">HbA1c</th>
                <th className="py-2.5 px-3">TIR</th>
                <th className="py-2.5 px-3">Risk</th>
                <th className="py-2.5 px-3">Latest signal</th>
                <th className="py-2.5 px-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {patientList.slice(0, 6).map((p) => {
                const isHigh = p.riskCategory === 'High';
                return (
                  <tr
                    key={p.id}
                    onClick={() => onSelectPatient(p.id)}
                    className="hover:bg-slate-50/80 transition cursor-pointer group"
                  >
                    {/* Patient Name & Avatar */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                          {p.avatarInitials}
                        </div>
                        <div>
                          <strong className="block text-slate-900 font-semibold group-hover:text-blue-600 transition">
                            {p.name}
                          </strong>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {p.id}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* HbA1c */}
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {p.hba1c}%
                    </td>

                    {/* TIR */}
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {p.timeInRangePct}%
                    </td>

                    {/* Risk Badge */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isHigh
                            ? 'text-rose-700 bg-rose-50 border border-rose-200'
                            : 'text-amber-700 bg-amber-50 border border-amber-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isHigh ? 'bg-rose-500' : 'bg-amber-500'
                          }`}
                        />
                        <span>{p.riskCategory}</span>
                      </span>
                    </td>

                    {/* Latest Signal */}
                    <td className="py-3 px-3 text-slate-600 text-[11px]">
                      {p.latestSignal}
                    </td>

                    {/* Action Icon */}
                    <td className="py-3 px-2 text-right">
                      <div className="w-6 h-6 rounded-md hover:bg-blue-50 text-slate-400 group-hover:text-blue-600 flex items-center justify-center transition">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. Clinical Alerts Modal */}
      {showAlertModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Clinical Alerts ({cohort.alertsCount})
                </h3>
              </div>
              <button
                onClick={() => setShowAlertModal(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Patients flagged in hospital records with active nocturnal hypoglycemia episodes or critical glycemic events requiring review.
            </p>
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {cohort.clinicalAlerts.map((al) => (
                <div
                  key={al.id}
                  className="p-3.5 rounded-xl border border-rose-100 bg-rose-50/50 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">{al.patient}</p>
                    <p className="text-rose-700 text-[11px] font-medium">{al.issue}</p>
                    <p className="text-slate-400 text-[10px] mt-0.5">{al.time}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowAlertModal(false);
                      onSelectPatient(al.code);
                    }}
                    className="px-3 py-1.5 bg-white border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer shadow-2xs"
                  >
                    View Twin →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



