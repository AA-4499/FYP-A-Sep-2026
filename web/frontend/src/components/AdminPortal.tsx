/**
 * Admin & Clinical Command Center Component.
 * Enables population-level risk triage, AI model diagnostics, cohort search, and live audit telemetry.
 * Swinburne University of Technology Sarawak · Ts. Dr. Vong Wan Tze
 */
import React, { useState } from 'react';
import {
  ShieldCheck,
  Users,
  AlertTriangle,
  Activity,
  Search,
  Filter,
  ArrowUpRight,
  TrendingDown,
  Cpu,
  Database,
  Clock,
  Download,
  Stethoscope,
  ChevronRight,
  User,
  HeartPulse,
  Eye,
  CheckCircle,
  BarChart2,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { PatientProfile, PlatformPage } from '../types';
import {
  MOCK_PATIENTS,
  MOCK_COHORT_STATS,
  MOCK_AUDIT_LOGS,
} from '../api/mockData';

interface AdminPortalProps {
  onSelectPatient: (patientId: string) => void;
  onNavigate: (page: PlatformPage) => void;
  onOpenReport: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  onSelectPatient,
  onNavigate,
  onOpenReport,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<'all' | 'high' | 'moderate' | 'low'>('all');
  const [sortBy, setSortBy] = useState<'hba1c' | 'risk' | 'age'>('risk');

  // Filter patients
  const filteredPatients = MOCK_PATIENTS.filter((p) => {
    const matchesSearch =
      p.id.includes(searchQuery) ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.medications.some((m) => m.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRisk =
      selectedRiskFilter === 'all' ||
      (selectedRiskFilter === 'high' && p.risk_category.toLowerCase().includes('high')) ||
      (selectedRiskFilter === 'moderate' && p.risk_category.toLowerCase().includes('moderate')) ||
      (selectedRiskFilter === 'low' && (p.risk_category.toLowerCase().includes('low') || p.risk_category.toLowerCase().includes('controlled')));

    return matchesSearch && matchesRisk;
  }).sort((a, b) => {
    if (sortBy === 'hba1c') return b.hba1c - a.hba1c;
    if (sortBy === 'age') return b.age - a.age;
    // Risk sort
    const riskScore = (p: PatientProfile) =>
      p.risk_category.toLowerCase().includes('high') ? 3 : p.risk_category.toLowerCase().includes('moderate') ? 2 : 1;
    return riskScore(b) - riskScore(a);
  });

  // Chart data
  const riskPieData = [
    { name: 'Low / Controlled', value: MOCK_COHORT_STATS.lowRiskCount, color: '#10b981' },
    { name: 'Moderate Risk', value: MOCK_COHORT_STATS.moderateRiskCount, color: '#f59e0b' },
    { name: 'High Risk Alert', value: MOCK_COHORT_STATS.highRiskCount, color: '#ef4444' },
  ];

  const hba1cDistributionData = [
    { range: '< 6.5%', count: 18, fill: '#10b981' },
    { range: '6.5 - 7.5%', count: 42, fill: '#3b82f6' },
    { range: '7.6 - 8.5%', count: 34, fill: '#f59e0b' },
    { range: '> 8.5%', count: 18, fill: '#ef4444' },
  ];

  const handleLaunchPatient = (id: string, destination: PlatformPage = 'workspace') => {
    onSelectPatient(id);
    onNavigate(destination);
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* 1. ADMIN HEADER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white border border-slate-800 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                Clinical Oversight & Administration
              </span>
              <span className="text-xs text-slate-400">
                ShanghaiT2DM Cohort (112 Patients)
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Admin & Clinical Command Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Real-time cohort stratification, automated patient safety alerts, AI model telemetry, and direct clinical workspace orchestration.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate('workspace')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition"
            >
              <Stethoscope className="w-4 h-4" />
              <span>Launch Clinical Workspace</span>
            </button>
            <button
              onClick={onOpenReport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs backdrop-blur-sm transition"
            >
              <Download className="w-4 h-4" />
              <span>Export Cohort Summary</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. COHORT KEY PERFORMANCE INDICATORS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-600" />
              Enrolled Patients
            </span>
            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
              100% Synced
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-slate-900">{MOCK_COHORT_STATS.totalPatients}</span>
            <span className="text-xs text-slate-500 font-medium">Cohort records</span>
          </div>
          <p className="text-[11px] text-slate-500">ShanghaiT2DM baseline verified</p>
        </div>

        {/* KPI 2 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              High-Risk Triage Queue
            </span>
            <span className="text-[10px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full font-bold">
              Requires Review
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-rose-600">{MOCK_COHORT_STATS.highRiskCount}</span>
            <span className="text-xs text-slate-500 font-medium">Patients (25%)</span>
          </div>
          <p className="text-[11px] text-slate-500">Composite complication score &gt; 65%</p>
        </div>

        {/* KPI 3 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-indigo-600" />
              Mean Cohort HbA1c
            </span>
            <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full font-bold">
              ADA Guideline
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-slate-900">{MOCK_COHORT_STATS.averageHbA1c}%</span>
            <span className="text-xs text-slate-500 font-medium">Target &lt; 7.0%</span>
          </div>
          <p className="text-[11px] text-slate-500">Average BMI: {MOCK_COHORT_STATS.averageBMI} kg/m²</p>
        </div>

        {/* KPI 4 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span className="flex items-center gap-1.5">
              <HeartPulse className="w-4 h-4 text-teal-600" />
              Active CGM Sensors
            </span>
            <span className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full font-bold">
              87.5% Active
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-teal-700">{MOCK_COHORT_STATS.activeSensors}</span>
            <span className="text-xs text-slate-500 font-medium">Live wearable units</span>
          </div>
          <p className="text-[11px] text-slate-500">Hypoglycemia alert rate: {MOCK_COHORT_STATS.hypoAlertRate}%</p>
        </div>
      </div>

      {/* 3. COHORT ANALYTICS CHARTS (Risk & Glycemic Distribution) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Tier Donut */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Cohort Risk Stratification
              </h2>
              <p className="text-xs text-slate-500">
                Breakdown of 112 patients by multi-system complication vulnerability.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-400">XGBoost Ensemble</span>
          </div>

          <div className="h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {riskPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0];
                      return (
                        <div className="bg-slate-900 text-white p-2 rounded-lg text-xs shadow-md">
                          <p className="font-bold">{d.name}</p>
                          <p>{d.value} Patients ({Math.round(((d.value as number) / 112) * 100)}%)</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* HbA1c Glycemic Spectrum Bar Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Glycemic Control Spectrum (HbA1c)
              </h2>
              <p className="text-xs text-slate-500">
                Patient population grouped by glycated hemoglobin tiers.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-400">Lab Assays</span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hba1cDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-2 rounded-lg text-xs shadow-md">
                          <p className="font-bold">HbA1c {d.range}</p>
                          <p>{d.count} Patients</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {hba1cDistributionData.map((entry, idx) => (
                    <Cell key={`bar-${idx}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4. PATIENT TRIAGE & DIRECTORY TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Patient Cohort Triage Directory
            </h2>
            <p className="text-xs text-slate-500">
              Browse, filter, and inspect ShanghaiT2DM longitudinal patient records.
            </p>
          </div>

          {/* Controls: Search, Risk Filter & Sort */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search patient, ID, med..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 w-48 sm:w-56"
              />
            </div>

            <select
              value={selectedRiskFilter}
              onChange={(e) => setSelectedRiskFilter(e.target.value as any)}
              className="py-1.5 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden"
              aria-label="Filter by risk tier"
            >
              <option value="all">All Risk Tiers</option>
              <option value="high">High Risk Only</option>
              <option value="moderate">Moderate Risk</option>
              <option value="low">Controlled / Low</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="py-1.5 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden"
              aria-label="Sort patients"
            >
              <option value="risk">Sort: Risk Score</option>
              <option value="hba1c">Sort: HbA1c</option>
              <option value="age">Sort: Age</option>
            </select>
          </div>
        </div>

        {/* Directory Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="pb-3 pl-2">Patient</th>
                <th className="pb-3">Demographics</th>
                <th className="pb-3">Glycemic Status</th>
                <th className="pb-3">Blood Pressure / BMI</th>
                <th className="pb-3">Risk Assessment</th>
                <th className="pb-3">Medications</th>
                <th className="pb-3 text-right pr-2">Clinical Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPatients.map((p) => {
                const isHigh = p.risk_category.toLowerCase().includes('high');
                const isModerate = p.risk_category.toLowerCase().includes('moderate');

                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition group">
                    <td className="py-3 pl-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 group-hover:text-blue-600 transition">
                            {p.name}
                          </p>
                          <span className="text-[10px] text-slate-400">ID #{p.id}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 text-slate-600">
                      <span>{p.age} yrs</span> · <span>{p.gender}</span>
                      <p className="text-[10px] text-slate-400">{p.diabetes_duration_years} yrs diabetes</p>
                    </td>

                    <td className="py-3">
                      <p className="font-bold text-slate-800">HbA1c: {p.hba1c}%</p>
                      <span className="text-[10px] text-slate-500">FBG: {p.fasting_glucose} mmol/L</span>
                    </td>

                    <td className="py-3 text-slate-600">
                      <span>{p.systolic_bp}/{p.diastolic_bp} mmHg</span>
                      <p className="text-[10px] text-slate-400">BMI: {p.bmi} kg/m²</p>
                    </td>

                    <td className="py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
                          isHigh
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : isModerate
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {p.risk_category}
                      </span>
                    </td>

                    <td className="py-3 max-w-[200px] truncate text-slate-600" title={p.medications.join(', ')}>
                      {p.medications[0]}
                      {p.medications.length > 1 && (
                        <span className="text-[10px] text-blue-600 font-semibold ml-1">
                          +{p.medications.length - 1} more
                        </span>
                      )}
                    </td>

                    <td className="py-3 text-right pr-2 space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => handleLaunchPatient(p.id, 'workspace')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white font-semibold transition"
                        title="Open in deep-dive clinical workspace"
                      >
                        <Stethoscope className="w-3 h-3" />
                        <span>Workspace</span>
                      </button>

                      <button
                        onClick={() => handleLaunchPatient(p.id, 'patient_portal')}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium transition"
                        title="View Patient Portal"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Patient View</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. AI ENGINE DIAGNOSTICS & SYSTEM TELEMETRY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 columns: AI Model Stack Status */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-600" />
              AI Inference Engines & Biomedical Models
            </h2>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> All Models Operational
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
              <div className="flex items-center justify-between">
                <strong className="text-slate-900">XGBoost Complication Ensemble</strong>
                <span className="font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded text-[10px]">AUROC 0.892</span>
              </div>
              <p className="text-slate-500 text-[11px]">
                Platt-calibrated risk probability over longitudinal multi-system organ indices.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
              <div className="flex items-center justify-between">
                <strong className="text-slate-900">TreeSHAP Explainability</strong>
                <span className="font-bold text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded text-[10px]">Latency 38ms</span>
              </div>
              <p className="text-slate-500 text-[11px]">
                Exact Shapley additive attributions for patient-specific clinical transparency.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
              <div className="flex items-center justify-between">
                <strong className="text-slate-900">Digital Twin ODE Simulator</strong>
                <span className="font-bold text-teal-700 bg-teal-100 px-1.5 py-0.2 rounded text-[10px]">4 Organs</span>
              </div>
              <p className="text-slate-500 text-[11px]">
                Differential equations modeling beta-cell dynamics, vascular tone, and renal load.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
              <div className="flex items-center justify-between">
                <strong className="text-slate-900">Biomedical Knowledge Graph</strong>
                <span className="font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded text-[10px]">1,420 Triples</span>
              </div>
              <p className="text-slate-500 text-[11px]">
                SNOMED-CT / MeSH ontology connecting biomarkers, comorbidities, and ADA guidelines.
              </p>
            </div>
          </div>
        </div>

        {/* Right column: Live Audit & Activity Log */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-600" />
              Clinical Audit Log
            </h2>
            <span className="text-[10px] text-slate-400">Live Stream</span>
          </div>

          <div className="space-y-3">
            {MOCK_AUDIT_LOGS.map((item) => (
              <div key={item.id} className="text-xs space-y-0.5 border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">{item.action}</span>
                  <span className="text-[10px] text-slate-400">{item.timestamp}</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">{item.details}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-0.5">
                  <span>by {item.user}</span>
                  <span>•</span>
                  <span className="font-medium text-slate-500">{item.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
