import React from "react";
import type { Patient, NavigationModule } from "../types";
import type { ClinicalRecommendation } from "../data/knowledgeGraphDemoData";
import { DashboardView } from "./DashboardView";
import { RecordSource } from "./ClinicalWorkspace";

export function PatientHomeView({ patient, onNavigate, sharedRecommendations = [], canViewPredictions = false }: {
  patient: Patient;
  onNavigate: (module: NavigationModule) => void;
  sharedRecommendations?: ClinicalRecommendation[];
  canViewPredictions?: boolean;
}) {
  return <div className="space-y-6">
    <RecordSource patient={patient} />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Health overview</h1><p className="mt-2 text-sm text-slate-500">Your glucose history and key health results in one place.</p></div>
      <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500">Recorded data</span>
    </div>
    <DashboardView key={patient.id} patient={patient} onNavigate={onNavigate} sharedRecommendations={sharedRecommendations} canViewPredictions={canViewPredictions} />
    {sharedRecommendations.length > 0 && <p className="text-xs text-slate-500">Recommendation preview: items are held in this browser session and have not been sent to a patient account.</p>}
  </div>;
}
