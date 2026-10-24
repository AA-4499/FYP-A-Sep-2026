import React from "react";
import type { Patient, NavigationModule } from "../types";
import type { ClinicalRecommendation } from "../data/knowledgeGraphDemoData";
import { DashboardView } from "./DashboardView";
import { RecordSource } from "./ClinicalWorkspace";

/** Jody's patient dashboard and AGP, supplied with the selected database record. */
export function PatientHomeView({
  patient,
  onNavigate,
  sharedRecommendations = [],
}: {
  patient: Patient;
  onNavigate: (module: NavigationModule) => void;
  sharedRecommendations?: ClinicalRecommendation[];
}) {
  return (
    <div className="space-y-5">
      <RecordSource patient={patient} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="break-words text-2xl font-bold text-slate-900">
            {patient.name}
          </h1>
          <p className="mt-2 text-xs text-slate-500">
            {patient.condition || "Condition not recorded"} ·{" "}
            {patient.cgmReadings?.length ?? 0} recorded CGM observations
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("patient_insights")}
          className="rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-teal-800"
        >
          Explore prediction and what-if
        </button>
      </div>
      <DashboardView
        key={patient.id}
        patient={patient}
        onNavigate={onNavigate}
        sharedRecommendations={sharedRecommendations}
        selfService
      />
      {sharedRecommendations.length > 0 && (
        <p className="text-xs text-slate-500">
          Recommendation preview only: these example items are held in this
          browser session, not saved or sent to a Patient account.
        </p>
      )}
    </div>
  );
}
