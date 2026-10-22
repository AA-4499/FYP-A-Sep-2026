import React from 'react';
import {
  Users,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  FileText,
  Activity,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  Stethoscope,
  Sparkles,
  Search,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import type { Patient } from '../../types';

interface DoctorOverviewViewProps {
  patients: Patient[];
  onSelectPatient: (patientId: string) => void;
  onOpenPatientTwin: (patientId: string) => void;
  onViewAllPatients: () => void;
  onViewMonitoring: () => void;
}

const RISK_DISTRIBUTION_DATA = [
  { category: 'High Risk', count: 28, fill: '#ef4444', pct: '22%' },
  { category: 'Moderate', count: 54, fill: '#f59e0b', pct: '42%' },
  { category: 'Stable', count: 46, fill: '#10b981', pct: '36%' },
];

const COHORT_6MO_TRENDS = [
  { month: 'May', avgHba1c: 7.8, avgFasting: 8.6, avgWeight: 74.2 },
  { month: 'Jun', avgHba1c: 7.7, avgFasting: 8.4, avgWeight: 73.8 },
  { month: 'Jul', avgHba1c: 7.5, avgFasting: 8.1, avgWeight: 73.5 },
  { month: 'Aug', avgHba1c: 7.4, avgFasting: 7.9, avgWeight: 73.1 },
  { month: 'Sep', avgHba1c: 7.2, avgFasting: 7.7, avgWeight: 72.8 },
  { month: 'Oct', avgHba1c: 7.1, avgFasting: 7.5, avgWeight: 72.4 },
];

export const DoctorOverviewView: React.FC<DoctorOverviewViewProps> = ({
  patients,
  onSelectPatient,
  onOpenPatientTwin,
  onViewAllPatients,
  onViewMonitoring,
}) => {
  // Triage: high and moderate risk patients needing attention
  const highRiskPatients = patients.filter((p) => p.riskCategory === 'High');
  const moderateRiskPatients = patients.filter((p) => p.riskCategory === 'Moderate');
  const triageList = [...highRiskPatients, ...moderateRiskPatients].slice(0, 5);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner - Clinical Teal Theme */}
      <div className="rounded-3xl bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-900 p-6 sm:p-7 text-white shadow-lg border border-teal-700/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-400/15 via-transparent to-transparent pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-200 text-xs font-semibold mb-3">
              <Stethoscope className="w-3.5 h-3.5" />
              <span>Doctor dashboard · Clinical & Cohort View</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Clinical Population Health & Triage
            </h1>
            <p className="text-teal-100/80 text-xs sm:text-sm mt-1 max-w-2xl">
              Real-time glycemic surveillance, priority risk stratification, and patient digital twin diagnostic workflows for your assigned cohort.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onViewAllPatients}
              className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-medium text-xs flex items-center gap-2 shadow-sm transition active:scale-95"
            >
              <Users className="w-3.5 h-3.5" />
              <span>View All 128 Patients</span>
            </button>
            <button
              onClick={onViewMonitoring}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 font-medium text-xs flex items-center gap-2 transition"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Cohort Monitoring</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Assigned Patients */}
        <div
          onClick={onViewAllPatients}
          className="cursor-pointer bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs hover:border-teal-500 hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
              Assigned Patients
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center group-hover:scale-110 transition">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">128</span>
            <span className="text-[11px] font-semibold text-slate-500">Active</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Dr. Sarah Wong & Team</span>
        </div>

        {/* Need Clinical Review */}
        <div
          onClick={onViewAllPatients}
          className="cursor-pointer bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs hover:border-amber-500 hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
              Need Review
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-600">18</span>
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Action required</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Exceeded glycemic thresholds</span>
        </div>

        {/* Worsening Trends */}
        <div
          onClick={onViewMonitoring}
          className="cursor-pointer bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs hover:border-red-500 hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
              Worsening Trends
            </span>
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center group-hover:scale-110 transition">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-red-600">12</span>
            <span className="text-[11px] font-semibold text-red-700 bg-red-50 px-1.5 py-0.5 rounded">TIR &lt; 50%</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Consecutive visits deteriorating</span>
        </div>

        {/* Missing Data */}
        <div
          onClick={onViewAllPatients}
          className="cursor-pointer bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs hover:border-slate-400 hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
              Missing Data / Overdue
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center group-hover:scale-110 transition">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-800">9</span>
            <span className="text-[11px] font-semibold text-slate-500">Patients</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">&gt;30 days without lab or CGM sync</span>
        </div>
      </div>

      {/* 3. Middle Visual Charts: Risk Distribution & 6-Month Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Risk Distribution Bar Chart */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Cohort Risk Stratification</h3>
              <p className="text-[11px] text-slate-400">Distribution across 128 assigned patients</p>
            </div>
            <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
              AI Classified
            </span>
          </div>

          <div className="h-56 w-full mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={RISK_DISTRIBUTION_DATA} layout="vertical" margin={{ top: 10, right: 20, left: 15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis dataKey="category" type="category" tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} width={75} />
                <Tooltip
                  formatter={(val: any) => [`${val} Patients`, 'Count']}
                  contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-100 text-center text-xs">
            {RISK_DISTRIBUTION_DATA.map((d) => (
              <div key={d.category} className="p-1.5 rounded-lg bg-slate-50">
                <span className="text-[10px] text-slate-400 block">{d.category}</span>
                <strong className="text-slate-900 font-bold">{d.count} ({d.pct})</strong>
              </div>
            ))}
          </div>
        </div>

        {/* 6-Month Population Health Trends */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">6-Month Population Health Trends</h3>
              <p className="text-[11px] text-slate-400">Mean HbA1c (%), Fasting Glucose (mmol/L) & Weight (kg)</p>
            </div>
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5" /> -0.7% Mean HbA1c
            </span>
          </div>

          <div className="h-56 w-full mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={COHORT_6MO_TRENDS} margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[5, 10]} />
                <Tooltip
                  contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line
                  type="monotone"
                  dataKey="avgHba1c"
                  name="Mean HbA1c (%)"
                  stroke="#0d9488"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="avgFasting"
                  name="Fasting Glucose (mmol/L)"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
            <span>Overall Cohort Target: HbA1c &lt; 7.0%</span>
            <span className="text-teal-700 font-semibold">Current Cohort Average: 7.1%</span>
          </div>
        </div>
      </div>

      {/* 4. "Patients Requiring Attention" Triage List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              <h3 className="text-sm font-bold text-slate-900">Patients Requiring Clinical Attention</h3>
            </div>
            <p className="text-[11px] text-slate-400">
              Immediate triage queue prioritized by glycemic volatility, organ strain, and risk index
            </p>
          </div>

          <button
            onClick={onViewAllPatients}
            className="text-xs text-teal-700 hover:text-teal-800 font-semibold flex items-center gap-1"
          >
            <span>View Full Cohort List</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
              <tr>
                <th className="py-2.5 px-3">Patient</th>
                <th className="py-2.5 px-3">Severity Tag</th>
                <th className="py-2.5 px-3">Latest HbA1c</th>
                <th className="py-2.5 px-3">Time in Range</th>
                <th className="py-2.5 px-3">Primary Clinical Signal</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {triageList.map((p) => (
                <tr key={p.id} className="hover:bg-teal-50/40 transition">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs shrink-0">
                        {p.avatarInitials}
                      </span>
                      <div>
                        <strong className="block text-slate-900 font-semibold">{p.name}</strong>
                        <span className="text-[10px] text-slate-400 font-mono">{p.displayId} · Age {p.age}</span>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        p.riskCategory === 'High'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {p.riskCategory === 'High' ? 'High Severity' : 'Moderate Severity'}
                    </span>
                  </td>

                  <td className="py-3 px-3 font-semibold text-slate-900">
                    {p.hba1c}%
                  </td>

                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            p.timeInRangePct >= 70
                              ? 'bg-emerald-500'
                              : p.timeInRangePct >= 50
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${p.timeInRangePct}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-900 text-xs">{p.timeInRangePct}%</span>
                    </div>
                  </td>

                  <td className="py-3 px-3 text-slate-700 font-medium">
                    {p.latestSignal}
                  </td>

                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => onOpenPatientTwin(p.id)}
                      className="px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition shadow-2xs"
                    >
                      <span>Open Twin</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
