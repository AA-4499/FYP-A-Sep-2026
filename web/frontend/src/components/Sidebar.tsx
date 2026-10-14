/**
 * Upgraded Navigation Sidebar
 * Supports both:
 * 1. Clinic Mode (Figma Image 1: Borneo Center Kuching with Clinical & Operations sections and Weekly review capacity)
 * 2. Patient Digital Twin Mode (Figma Image 3: DiabetesTwin modules)
 */
import React from 'react';
import {
  LayoutDashboard,
  Users,
  Activity,
  BarChart3,
  Bell,
  UserCheck,
  Smartphone,
  FileText,
  Settings,
  HelpCircle,
  TrendingUp,
  ShieldAlert,
  Sparkles,
  Share2,
  Sliders,
  ChevronDown,
  ArrowLeft,
} from 'lucide-react';
import type { NavigationModule } from '../types';

interface SidebarProps {
  mode: 'clinic' | 'patient';
  activeModule: NavigationModule;
  onSelectModule: (module: NavigationModule) => void;
  onSwitchToClinic?: () => void;
  currentPatientName?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  mode,
  activeModule,
  onSelectModule,
  onSwitchToClinic,
  currentPatientName,
}) => {
  if (mode === 'clinic') {
    return (
      <aside className="w-64 shrink-0 bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-5 flex flex-col justify-between min-h-[780px]">
        <div className="space-y-6">
          {/* 1. Brand Logo & Title */}
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-2xs">
              ⚡
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900 leading-tight">
                Smart Diabetes Digital Twin
              </h2>
              <p className="text-[10px] text-slate-400">
                and Personalised Health Management Platform
              </p>
            </div>
          </div>

          {/* 2. Clinic Location Switcher */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-[#0f172a] text-white flex items-center justify-center font-bold text-[11px]">
                E
              </div>
              <div>
                <strong className="block text-slate-900 text-xs leading-none">
                  Borneo Center
                </strong>
                <span className="text-[10px] text-slate-400">
                  Kuching · Malaysia
                </span>
              </div>
            </div>
            <div className="text-slate-400 text-[10px]">⇅</div>
          </div>

          {/* 3. CLINICAL Section */}
          <div className="space-y-1">
            <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              CLINICAL
            </span>

            {/* Overview */}
            <button
              onClick={() => onSelectModule('overview')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeModule === 'overview'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className="w-4 h-4" />
                <span>Overview</span>
              </div>
            </button>

            {/* Patients */}
            <button
              onClick={() => onSelectModule('patients')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeModule === 'patients'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4" />
                <span>Patients</span>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-bold">
                
              </span>
            </button>

            {/* Glucose review */}
            <button
              onClick={() => onSelectModule('glucose_review')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeModule === 'glucose_review'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4" />
                <span>Glucose review</span>
              </div>
              <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-md font-bold">
                
              </span>
            </button>

            {/* Clinical analytics */}
            <button
              onClick={() => onSelectModule('clinical_analytics')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeModule === 'clinical_analytics'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <BarChart3 className="w-4 h-4" />
                <span>Clinical analytics</span>
              </div>
            </button>
          </div>

          {/* 4. OPERATIONS Section */}
          <div className="space-y-1">
            <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              OPERATIONS
            </span>

            {/* Alerts & tasks */}
            <button
              onClick={() => onSelectModule('alerts_tasks')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeModule === 'alerts_tasks'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Bell className="w-4 h-4" />
                <span>Alerts & tasks</span>
              </div>
              <span className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded-md font-bold">
                
              </span>
            </button>

            {/* Care team */}
            <button
              onClick={() => onSelectModule('care_team')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeModule === 'care_team'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-4 h-4" />
                <span>Care team</span>
              </div>
            </button>

            {/* Devices */}
            <button
              onClick={() => onSelectModule('devices')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeModule === 'devices'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4" />
                <span>Devices</span>
              </div>
            </button>

            {/* Reports */}
            <button
              onClick={() => onSelectModule('reports')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeModule === 'reports'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4" />
                <span>Reports</span>
              </div>
            </button>
          </div>
        </div>

        {/* 5. Bottom Card: Weekly Review Capacity & Settings */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="space-y-1 text-xs">
            <button
              onClick={() => onSelectModule('settings')}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium transition"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span>Settings</span>
            </button>

            <button
              onClick={() => onSelectModule('clinical_support')}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium transition"
            >
              <HelpCircle className="w-4 h-4 text-slate-400" />
              <span>Clinical support</span>
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // PATIENT DIGITAL TWIN MODE (Figma Image 3)
  return (
    <aside className="w-60 shrink-0 bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-5 flex flex-col justify-between min-h-[720px]">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="px-1">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            DiabetesTwin
          </h1>
          {currentPatientName && (
            <p className="text-[11px] text-blue-600 font-semibold truncate mt-0.5">
              Twin: {currentPatientName}
            </p>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1">
          {[
            { id: 'patient_dashboard', label: 'Patients' },
            { id: 'monitoring', label: 'Longitudinal monitoring' },
            { id: 'risk', label: 'Risk assessment' },
            { id: 'explain_ai', label: 'Explainable AI' },
            { id: 'knowledge_graph', label: 'Knowledge graph' },
            { id: 'digital_twin', label: 'Digital twin' },
            { id: 'reports', label: 'Reports' },
          ].map((item) => {
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectModule(item.id as NavigationModule)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left ${
                  isActive
                    ? 'bg-blue-100/80 text-blue-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-xs border flex items-center justify-center text-[8px] shrink-0 ${
                    isActive
                      ? 'border-blue-600 text-blue-600 bg-white font-bold'
                      : 'border-slate-300 text-slate-300'
                  }`}
                >
                  {isActive ? '▪' : ''}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Return to Clinic Overview Action */}
      <div className="pt-4 border-t border-slate-100 space-y-3">
        {onSwitchToClinic && (
          <button
            onClick={onSwitchToClinic}
            className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Clinic Overview</span>
          </button>
        )}

        <div className="px-1 text-[11px] text-slate-400">
          <p className="font-semibold text-slate-500">v2.4 Prototype</p>
          <p>ShanghaiT2DM Cohort</p>
        </div>
      </div>
    </aside>
  );
};
