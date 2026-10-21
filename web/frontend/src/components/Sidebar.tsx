/** Navigation for the doctor, administrator and patient workspaces. */
import React from 'react';
import {
  LayoutDashboard,
  Users,
  Activity,
  FileText,
  Settings,
  Sparkles,
  Share2,
  Sliders,
  ArrowLeft,
} from 'lucide-react';
import type { NavigationModule } from '../types';

interface SidebarProps {
  mode: 'patient' | 'admin' | 'doctor';
  activeModule: NavigationModule;
  onSelectModule: (module: NavigationModule) => void;
  onReturnToCareTeam?: () => void;
  currentPatientName?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  mode,
  activeModule,
  onSelectModule,
  onReturnToCareTeam,
  currentPatientName,
}) => {
  if (mode === 'admin' || mode === 'doctor') {
    const isAdmin = mode === 'admin';
    const items = isAdmin
      ? [
          { id: 'admin_overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'admin_users', label: 'User management', icon: Users },
          { id: 'admin_data_quality', label: 'Data quality', icon: Activity },
          { id: 'admin_twin_config', label: 'Twin configuration', icon: Sliders },
          { id: 'admin_logs', label: 'System logs', icon: FileText },
        ]
      : [
          { id: 'doctor_overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'doctor_patients', label: 'Patient management', icon: Users },
          { id: 'doctor_monitoring', label: 'Health monitoring', icon: Activity },
          { id: 'doctor_digital_twin', label: 'Digital twin', icon: Sparkles },
          { id: 'doctor_knowledge_graph', label: 'Knowledge graph', icon: Share2 },
          { id: 'doctor_reports', label: 'Reports', icon: FileText },
          { id: 'doctor_settings', label: 'Settings', icon: Settings },
        ];

    return (
      <aside className={`w-64 shrink-0 rounded-3xl border p-5 flex flex-col justify-between min-h-[720px] shadow-2xs ${
        isAdmin ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200/90'
      }`}>
        <div className="space-y-7">
          <div className="flex items-center gap-2.5 px-1">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-base ${
              isAdmin ? 'bg-blue-600 text-white' : 'bg-teal-600 text-white'
            }`}>+</div>
            <div>
              <h2 className={`text-xs font-bold leading-tight ${isAdmin ? 'text-white' : 'text-slate-900'}`}>DiaTwin</h2>
              <p className={`text-[10px] ${isAdmin ? 'text-slate-400' : 'text-slate-400'}`}>
                {isAdmin ? 'Platform governance' : 'Clinical workspace'}
              </p>
            </div>
          </div>
          <div className={`rounded-2xl p-3 border ${isAdmin ? 'bg-white/5 border-white/10' : 'bg-teal-50/70 border-teal-100'}`}>
            <p className={`text-[10px] uppercase tracking-wider font-bold ${isAdmin ? 'text-blue-300' : 'text-teal-700'}`}>
              {isAdmin ? 'System administrator' : 'Healthcare professional'}
            </p>
            <p className={`text-xs font-semibold mt-1 ${isAdmin ? 'text-white' : 'text-slate-900'}`}>
              {isAdmin ? 'Global Platform' : 'Assigned Care Cohort'}
            </p>
          </div>
          <nav className="space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectModule(item.id as NavigationModule)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition ${
                    active
                      ? isAdmin ? 'bg-blue-600 text-white' : 'bg-teal-50 text-teal-700'
                      : isAdmin ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        <div className={`pt-4 border-t text-[11px] ${isAdmin ? 'border-white/10 text-slate-400' : 'border-slate-100 text-slate-400'}`}>
          <p className="font-semibold">{isAdmin ? 'Governance console' : 'Clinical decision workspace'}</p>
          <p className="mt-1">Demo data environment</p>
        </div>
      </aside>
    );
  }

  // PATIENT SELF-CARE MODE
  return (
    <aside className="w-60 shrink-0 bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-5 flex flex-col justify-between min-h-[720px]">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="px-1">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            DiaTwin
          </h1>
          {currentPatientName && (
            <p className="text-[11px] text-purple-600 font-semibold truncate mt-0.5">
              Personal workspace · {currentPatientName}
            </p>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1">
          {[
            { id: 'patient_home', label: 'Home' },
            { id: 'patient_profile', label: 'My profile' },
            { id: 'patient_monitoring', label: 'My health' },
            { id: 'patient_digital_twin', label: 'My digital twin' },
            { id: 'patient_insights', label: 'Risk prediction & what-if' },
            { id: 'patient_reports', label: 'Reports' },
          ].map((item) => {
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectModule(item.id as NavigationModule)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left ${
                  isActive
                    ? 'bg-purple-100/80 text-purple-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-xs border flex items-center justify-center text-[8px] shrink-0 ${
                    isActive
                      ? 'border-purple-600 text-purple-600 bg-white font-bold'
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

      {/* Return to care team workspace */}
      <div className="pt-4 border-t border-slate-100 space-y-3">
        {onReturnToCareTeam && (
          <button
            onClick={onReturnToCareTeam}
            className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Care team workspace</span>
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
