import React, { useState } from 'react';
import {
  Server,
  Database,
  Cpu,
  Network,
  Users,
  UserCheck,
  FolderGit2,
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sliders,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  ADMIN_SERVICES,
  ROC_CURVE_DATA,
  SYSTEM_ACTIVITY_LOGS,
} from '../../data/adminData';
import type { ServiceHealthItem } from '../../types';

interface AdminOverviewViewProps {
  onNavigateToUsers: () => void;
  onNavigateToDataQuality: () => void;
  onNavigateToTwinConfig: () => void;
}

export const AdminOverviewView: React.FC<AdminOverviewViewProps> = ({
  onNavigateToUsers,
  onNavigateToDataQuality,
  onNavigateToTwinConfig,
}) => {
  const [services, setServices] = useState<ServiceHealthItem[]>(ADMIN_SERVICES);
  const [isRetraining, setIsRetraining] = useState(false);
  const [retrainSuccess, setRetrainSuccess] = useState(false);

  const handleRetrainModel = () => {
    setIsRetraining(true);
    setRetrainSuccess(false);
    setTimeout(() => {
      setIsRetraining(false);
      setRetrainSuccess(true);
      setTimeout(() => setRetrainSuccess(false), 4000);
    }, 1800);
  };

  const getServiceIcon = (id: string) => {
    switch (id) {
      case 'srv-api':
        return <Server className="w-4 h-4 text-blue-400" />;
      case 'srv-db':
        return <Database className="w-4 h-4 text-emerald-400" />;
      case 'srv-ai':
        return <Cpu className="w-4 h-4 text-purple-400" />;
      case 'srv-kg':
        return <Network className="w-4 h-4 text-cyan-400" />;
      default:
        return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Hero Banner: Platform & Governance */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-6 sm:p-7 text-white shadow-lg border border-blue-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Platform & Governance View · System Administrator</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              DiaTwin Core Operating System
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl">
              System health monitoring, AI digital twin pipeline orchestration,
              cohort data integrity verification, and access governance across all clinical sites.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleRetrainModel}
              disabled={isRetraining}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-2 shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetraining ? 'animate-spin' : ''}`} />
              <span>{isRetraining ? 'Retraining Model...' : 'Retrain Twin Model'}</span>
            </button>
            <button
              onClick={onNavigateToTwinConfig}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 font-medium text-xs flex items-center gap-2 transition"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Model Config</span>
            </button>
          </div>
        </div>

        {retrainSuccess && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>AI Risk Model v3.45 successfully compiled & deployed. Verified inference latency: 138ms.</span>
          </div>
        )}
      </div>

      {/* 2. Top Metric KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div
          onClick={onNavigateToUsers}
          className="cursor-pointer bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs hover:border-blue-400 hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
              Total Platform Users
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">1,482</span>
            <span className="text-[11px] font-semibold text-emerald-600">+14% MoM</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Registered in RBAC directory</span>
        </div>

        {/* Total Patients */}
        <div
          onClick={onNavigateToUsers}
          className="cursor-pointer bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs hover:border-blue-400 hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
              Total Patients
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">1,258</span>
            <span className="text-[11px] font-semibold text-emerald-600">Active Twins</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Shanghai (1,020) + Borneo (238)</span>
        </div>

        {/* Healthcare Professionals */}
        <div
          onClick={onNavigateToUsers}
          className="cursor-pointer bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs hover:border-blue-400 hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
              Clinical Staff (HCPs)
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-110 transition">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">24</span>
            <span className="text-[11px] font-semibold text-slate-600">Doctors & Coaches</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Assigned across 3 care clinics</span>
        </div>

        {/* Datasets Connected */}
        <div
          onClick={onNavigateToDataQuality}
          className="cursor-pointer bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs hover:border-blue-400 hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
              Connected Datasets
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition">
              <FolderGit2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">3</span>
            <span className="text-[11px] font-semibold text-emerald-600">All Healthy</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">ShanghaiT2DM, Borneo, LabSync</span>
        </div>
      </div>

      {/* 3. Middle Row: Service Health & AI Model ROC Curvex */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Service Health Grid */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">System Service Health</h3>
                <p className="text-[11px] text-slate-400">Real-time status of microservices & data pipelines</p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                All Systems Operational
              </span>
            </div>

            <div className="divide-y divide-slate-100 mt-3">
              {services.map((srv) => (
                <div key={srv.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-center">
                      {getServiceIcon(srv.id)}
                    </div>
                    <div>
                      <strong className="block text-slate-900 font-semibold">{srv.name}</strong>
                      <span className="text-[10px] text-slate-400 font-mono">{srv.endpoint}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-mono text-slate-600">{srv.latencyMs} ms</span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                        {srv.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">{srv.uptimePct}% uptime (30d)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Next automatic cluster health check in 45s</span>
            <button
              onClick={() => {
                setServices([...services.map((s) => ({ ...s, latencyMs: Math.max(12, s.latencyMs + Math.floor(Math.random() * 10 - 5)) }))]);
              }}
              className="text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Refresh Ping
            </button>
          </div>
        </div>

        {/* Right: AI Model Summary & ROC Curve */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">AI Model Evaluation</h3>
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold">
                  v3.4 Production
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Receiver Operating Characteristic (ROC) & AUC Performance</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block font-medium">ROC AUC Score</span>
              <strong className="text-base font-extrabold text-blue-600">0.912</strong>
            </div>
          </div>

          {/* ROC Chart */}
          <div className="h-56 w-full mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ROC_CURVE_DATA} margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="fpr"
                  label={{ value: 'False Positive Rate (1 - Specificity)', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#94a3b8' }}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  domain={[0, 1]}
                />
                <YAxis
                  label={{ value: 'True Positive Rate (Sensitivity)', angle: -90, position: 'insideLeft', offset: 25, fontSize: 10, fill: '#94a3b8' }}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  domain={[0, 1]}
                />
                <Tooltip
                  formatter={(val: any) => [Number(val).toFixed(3), 'Rate']}
                  labelFormatter={(lbl) => `FPR: ${Number(lbl).toFixed(2)}`}
                  contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                {/* 45 degree chance diagonal */}
                <ReferenceLine
                  segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
                  stroke="#cbd5e1"
                  strokeDasharray="4 4"
                />
                <Line
                  type="monotone"
                  dataKey="tpr"
                  name="DiaTwin Classifier"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#2563eb' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-100 text-center text-xs">
            <div className="p-2 rounded-lg bg-slate-50">
              <span className="text-[10px] text-slate-400 block font-medium">Sensitivity</span>
              <strong className="text-slate-900 font-bold text-xs">89.4%</strong>
            </div>
            <div className="p-2 rounded-lg bg-slate-50">
              <span className="text-[10px] text-slate-400 block font-medium">Specificity</span>
              <strong className="text-slate-900 font-bold text-xs">86.2%</strong>
            </div>
            <div className="p-2 rounded-lg bg-slate-50">
              <span className="text-[10px] text-slate-400 block font-medium">F1 Score</span>
              <strong className="text-slate-900 font-bold text-xs">0.881</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bottom Row: System Activity & Alerts Log */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">System Activity & Governance Alerts</h3>
            <p className="text-[11px] text-slate-400">Automated audit trail and model event logging</p>
          </div>
          <span className="text-xs text-slate-400">Showing last 4 system events</span>
        </div>

        <div className="divide-y divide-slate-100 mt-2">
          {SYSTEM_ACTIVITY_LOGS.map((log) => (
            <div key={log.id} className="py-3 flex items-start gap-3 text-xs">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  log.level === 'WARN'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {log.level === 'WARN' ? (
                  <AlertTriangle className="w-3.5 h-3.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-slate-900 text-xs">{log.category}</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 font-mono text-[10px]">
                    {log.time}
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      log.level === 'WARN'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}
                  >
                    {log.level}
                  </span>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed">{log.message}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
