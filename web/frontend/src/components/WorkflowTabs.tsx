import React from 'react';
import {
  Users,
  Activity,
  ShieldAlert,
  Lightbulb,
  Cpu,
  FileText,
} from 'lucide-react';

export type ActiveTab =
  | 'patients'
  | 'timeline'
  | 'risk_xai'
  | 'insights'
  | 'twin_simulation'
  | 'report';

interface WorkflowTabsProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  patientId: string;
}

export const WorkflowTabs: React.FC<WorkflowTabsProps> = ({
  activeTab,
  onTabChange,
  patientId,
}) => {
  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: 'patients',
      label: '1. Patient Profile',
      icon: <Users className="w-4 h-4" />,
      badge: `#${patientId}`,
    },
    {
      id: 'timeline',
      label: '2. Longitudinal Timeline',
      icon: <Activity className="w-4 h-4" />,
    },
    {
      id: 'risk_xai',
      label: '3. Risk & XAI Factors',
      icon: <ShieldAlert className="w-4 h-4" />,
    },
    {
      id: 'insights',
      label: '4. Personalised Insights',
      icon: <Lightbulb className="w-4 h-4" />,
    },
    {
      id: 'twin_simulation',
      label: '5. Digital Twin & What-If',
      icon: <Cpu className="w-4 h-4" />,
    },
    {
      id: 'report',
      label: '6. Clinical Report',
      icon: <FileText className="w-4 h-4" />,
    },
  ];

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex overflow-x-auto no-scrollbar space-x-1 py-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs md:text-sm font-medium whitespace-nowrap transition-colors duration-150 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      isActive ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
