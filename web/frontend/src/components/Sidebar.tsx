/** Navigation for the Doctor dashboard and Patient workspace. */
import React from "react";
import {
  LayoutDashboard,
  Users,
  Activity,
  FileText,
  Settings,
  Sparkles,
  Share2,
  ArrowLeft,
} from "lucide-react";
import type { NavigationModule } from "../types";

interface SidebarProps {
  mode: "patient" | "doctor";
  activeModule: NavigationModule;
  onSelectModule: (module: NavigationModule) => void;
  onReturnToCareTeam?: () => void;
  currentPatientName?: string;
  selfService?: boolean;
  canViewPredictions?: boolean;
}

const sidebarShell =
  "w-full shrink-0 rounded-3xl border border-slate-200/90 bg-white p-5 shadow-2xs flex flex-col justify-between gap-6 md:sticky md:top-5 md:w-60 md:self-start md:h-[calc(100dvh-2.5rem)] md:overflow-y-auto md:overscroll-contain lg:top-7 lg:h-[calc(100dvh-3.5rem)]";

export const Sidebar: React.FC<SidebarProps> = ({
  mode,
  activeModule,
  onSelectModule,
  onReturnToCareTeam,
  currentPatientName,
  selfService = false,
  canViewPredictions = false,
}) => {
  if (mode === "doctor") {
    const items = [
      { id: "doctor_overview", label: "Overview", icon: LayoutDashboard },
      { id: "doctor_patients", label: "Patient management", icon: Users },
      { id: "doctor_monitoring", label: "Health monitoring", icon: Activity },
      { id: "doctor_predictions", label: "Prediction lab", icon: Sparkles },
      { id: "doctor_digital_twin", label: "Digital twin", icon: Sparkles },
      { id: "doctor_knowledge_graph", label: "Knowledge graph", icon: Share2 },
      { id: "doctor_reports", label: "Reports", icon: FileText },
      { id: "doctor_settings", label: "Settings", icon: Settings },
    ];

    return (
      <aside
        className={sidebarShell}
        data-testid="workspace-sidebar"
        aria-label="Doctor navigation"
      >
        <div className="space-y-7">
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-base bg-teal-600 text-white">
              +
            </div>
            <div>
              <h2 className="text-xs font-bold leading-tight text-slate-900">
                DiaTwin
              </h2>
              <p className="text-[10px] text-slate-400">Doctor dashboard</p>
            </div>
          </div>
          <div className="rounded-2xl p-3 border bg-teal-50/70 border-teal-100">
            <p className="text-[10px] uppercase tracking-wider font-bold text-teal-700">
              Doctor
            </p>
            <p className="text-xs font-semibold mt-1 text-slate-900">
              Assigned Care Cohort
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-1 md:block md:space-y-1">
            {items
              .filter(
                (item) =>
                  item.id !== "doctor_predictions" || canViewPredictions,
              )
              .map((item) => {
                const Icon = item.icon;
                const active = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectModule(item.id as NavigationModule)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition ${
                      active
                        ? "bg-teal-50 text-teal-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
          </nav>
        </div>
        <div className="pt-4 border-t text-[11px] border-slate-100 text-slate-400">
          <p className="font-semibold">Doctor workspace</p>
          <p className="mt-1">Recorded observations & research tools</p>
        </div>
      </aside>
    );
  }

  // PATIENT SELF-CARE MODE
  return (
    <aside
      className={sidebarShell}
      data-testid="workspace-sidebar"
      aria-label="Patient navigation"
    >
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
        <nav className="grid grid-cols-2 gap-1 md:block md:space-y-1">
          {[
            { id: "patient_home", label: "Home" },
            { id: "patient_profile", label: "My profile" },
            { id: "patient_monitoring", label: "My health" },
            { id: "patient_digital_twin", label: "My digital twin" },
            { id: "patient_insights", label: "Risk prediction & what-if" },
            { id: "patient_recommendations", label: "My recommendations" },
            { id: "patient_reports", label: "Reports" },
          ]
            .filter(
              (item) => item.id !== "patient_insights" || canViewPredictions,
            )
            .map((item) => {
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => onSelectModule(item.id as NavigationModule)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left ${
                    isActive
                      ? "bg-purple-100/80 text-purple-700"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-xs border flex items-center justify-center text-[8px] shrink-0 ${
                      isActive
                        ? "border-purple-600 text-purple-600 bg-white font-bold"
                        : "border-slate-300 text-slate-300"
                    }`}
                  >
                    {isActive ? "▪" : ""}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
        </nav>
      </div>

      {/* Return to care team workspace */}
      <div className="pt-4 border-t border-slate-100 space-y-3">
        {onReturnToCareTeam && !selfService && (
          <button
            onClick={onReturnToCareTeam}
            className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Doctor dashboard</span>
          </button>
        )}

        <div className="px-1 text-[11px] text-slate-400">
          <p className="font-semibold text-slate-500">
            {selfService ? "Patient workspace" : "Patient record view"}
          </p>
          <p>
            {selfService
              ? "Your personal health record"
              : "ShanghaiT2DM Cohort"}
          </p>
        </div>
      </div>
    </aside>
  );
};
