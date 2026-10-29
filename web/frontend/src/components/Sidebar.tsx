import React, { useEffect, useRef, useState } from "react";
import { LayoutDashboard, Users, Activity, FileText, Settings, Sparkles, Share2, ArrowLeft, Menu, X, PanelLeftClose, User, Heart, Lightbulb } from "lucide-react";
import type { NavigationModule } from "../types";

interface SidebarProps {
  mode: "patient" | "doctor";
  activeModule: NavigationModule;
  onSelectModule: (module: NavigationModule) => void;
  onReturnToCareTeam?: () => void;
  currentPatientName?: string;
  selfService?: boolean;
  canViewPredictions?: boolean;
  canViewKnowledgeGraph?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ mode, activeModule, onSelectModule, onReturnToCareTeam, currentPatientName, selfService = false, canViewPredictions = false, canViewKnowledgeGraph = false }) => {
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const doctor = mode === "doctor";
  const closeMobile = () => { setMobileOpen(false); toggle.current?.focus(); };

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const reset = () => setMobileOpen(false);
    media.addEventListener("change", reset);
    return () => media.removeEventListener("change", reset);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeMobile(); }
      if (event.key !== "Tab") return;
      const buttons = panel.current?.querySelectorAll<HTMLButtonElement>("button");
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", handleKey); };
  }, [mobileOpen]);

  const items: { id: NavigationModule; label: string; icon: typeof Menu }[] = doctor ? [
    { id: "doctor_overview", label: "Overview", icon: LayoutDashboard },
    { id: "doctor_patients", label: "Patient management", icon: Users },
    ...(canViewPredictions ? [{ id: "doctor_predictions" as const, label: "Digital twin", icon: Sparkles }] : []),
    { id: "doctor_reports", label: "Reports", icon: FileText },
    { id: "doctor_settings", label: "Settings", icon: Settings },
  ] : [
    { id: "patient_home", label: "Home", icon: LayoutDashboard },
    { id: "patient_profile", label: "My profile", icon: User },
    { id: "patient_monitoring", label: "My health", icon: Activity },
    { id: "patient_digital_twin", label: "My digital twin", icon: Heart },
    ...(canViewKnowledgeGraph && !selfService ? [{ id: "patient_knowledge_graph" as const, label: "Knowledge graph", icon: Share2 }] : []),
        { id: "patient_lab_results", label: "Lab results", icon: FileText },
    { id: "patient_reports", label: "Reports", icon: FileText },
    { id: "patient_recommendations", label: "My recommendations", icon: Lightbulb },
    { id: "patient_settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className={`workspace-navigation ${desktopOpen ? "is-expanded" : "is-collapsed"} ${mobileOpen ? "is-mobile-open" : ""}`}>
      <button ref={toggle} type="button" className="navigation-toggle" aria-label="Toggle sidebar" aria-controls="workspace-navigation-panel" aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}>
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      <button type="button" className="desktop-navigation-toggle navigation-toggle" aria-label="Toggle desktop sidebar" aria-controls="workspace-navigation-panel" aria-expanded={desktopOpen} onClick={() => setDesktopOpen(!desktopOpen)}>
        <Menu size={20} />
      </button>
      {mobileOpen && <div className="navigation-backdrop" onClick={closeMobile} aria-hidden="true" />}
      <aside ref={panel} id="workspace-navigation-panel" data-testid="workspace-sidebar" className="navigation-panel" aria-label={doctor ? "Doctor navigation" : "Patient navigation"} role={mobileOpen ? "dialog" : undefined} aria-modal={mobileOpen || undefined}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white ${doctor ? "bg-teal-600" : "bg-purple-600"}`}>+</span>
            <span className="text-base font-bold tracking-tight">DiaTwin</span>
          </div>
          <button type="button" aria-label="Hide sidebar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => { if (window.matchMedia("(min-width: 1024px)").matches) setDesktopOpen(false); else closeMobile(); }}>
            <PanelLeftClose size={18} />
          </button>
        </div>
        {!doctor && currentPatientName && <p className="mt-5 truncate text-sm font-medium text-slate-500">{currentPatientName}</p>}
        <nav className="sidebar-menu mt-7 flex flex-col gap-1.5">
          {items.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={activeModule === id ? "page" : undefined} onClick={() => { onSelectModule(id); if (mobileOpen) closeMobile(); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] leading-6 font-medium transition ${activeModule === id ? doctor ? "bg-teal-50 text-teal-700" : "bg-purple-50 text-purple-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}><Icon size={18} className="shrink-0" /><span>{label}</span></button>)}
        </nav>
        {!doctor && onReturnToCareTeam && !selfService && <button type="button" onClick={() => { onReturnToCareTeam(); if (mobileOpen) closeMobile(); }} className="mt-7 flex w-full items-center gap-2 border-t border-slate-100 px-3 pt-5 text-sm font-medium text-slate-600"><ArrowLeft size={16} />Doctor dashboard</button>}
      </aside>
    </div>
  );
};
