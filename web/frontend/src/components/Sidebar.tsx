/**
 * Left Sidebar Navigation for DiabetesTwin
 * Matches the user mockup layout and icons exactly
 */
import React from 'react';
import type { NavigationModule } from '../types';

interface SidebarProps {
  activeModule: NavigationModule;
  onSelectModule: (module: NavigationModule) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeModule, onSelectModule }) => {
  const menuItems: { id: NavigationModule; label: string }[] = [
    { id: 'patients', label: 'Patients' },
    { id: 'monitoring', label: 'Monitoring' },
    { id: 'risk', label: 'Risk' },
    { id: 'explain_ai', label: 'Explain AI' },
    { id: 'knowledge_graph', label: 'Knowledge graph' },
    { id: 'digital_twin', label: 'Digital twin' },
    { id: 'what_if', label: 'What-if' },
    { id: 'reports', label: 'Reports' },
  ];

  return (
    <aside className="w-56 shrink-0 bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-6 flex flex-col justify-between min-h-[640px]">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="px-1">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            DiabetesTwin
          </h1>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectModule(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-left ${
                  isActive
                    ? 'bg-blue-100/80 text-blue-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {/* Clean box icon matching the mockup */}
                <span
                  className={`w-4 h-4 rounded-sm border flex items-center justify-center text-[10px] shrink-0 ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-slate-400 text-slate-400'
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

      {/* Footer / System note */}
      <div className="pt-6 border-t border-slate-100 px-1 text-[11px] text-slate-400">
        <p className="font-semibold text-slate-500">v2.4 Prototype</p>
        <p>ShanghaiT2DM Study</p>
      </div>
    </aside>
  );
};
