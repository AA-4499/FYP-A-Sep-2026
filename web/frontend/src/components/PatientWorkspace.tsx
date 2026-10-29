import React, { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ChevronDown, LogOut, RefreshCw } from "lucide-react";
import { getSupabaseClient } from "../lib/supabase";
import { loadPatientDashboard } from "../lib/patientDashboard";
import type { PatientDashboardData } from "../lib/patientDashboard";
import type { NavigationModule } from "../types";
import { LabResultsView } from "./LabResultsView";
import { FontSizeSettings } from "./FontSizeSettings";
import { Sidebar } from "./Sidebar";
import {
  RecordedMonitoring,
  RecordedReport,
} from "./ClinicalWorkspace";
import { RiskSimulationView } from "./RiskSimulationView";
import { mapClinicalRecord } from "../lib/clinicalData";
import { readClinicalRows } from "../lib/supabaseRows";
import { PatientRecommendationsView } from "./PatientRecommendationsView";
import { PatientHomeView } from "./PatientHomeView";

const card =
  "rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs sm:p-6";
const pages = new Set<NavigationModule>([
  "patient_home",
  "patient_profile",
  "patient_monitoring",
  "patient_digital_twin",
  "patient_recommendations",
  "patient_reports",
  "patient_settings",
  "patient_lab_results",
]);

export function PatientWorkspace({
  user,
  error: authError,
  onExit,
}: {
  user: User;
  error: string;
  onExit: () => void;
}) {
  const [page, setPage] = useState<NavigationModule>("patient_home");
  const [data, setData] = useState<PatientDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    setError("");
    const client = getSupabaseClient();
    if (!client) {
      setError("Unable to connect to your account. Please try again.");
      setLoading(false);
      return;
    }
    void loadPatientDashboard(client, user.id)
      .then(async (result) => {
        if (result.profile.patient_id) {
          result = {
            ...result,
            readings: await readClinicalRows(
              client,
              "patient_detail",
              result.profile.patient_id,
            ),
          };
        }
        if (!cancelled) setData(result);
      })
      .catch((failure) => {
        if (!cancelled)
          setError(
            failure instanceof Error
              ? failure.message
              : "Unable to load your dashboard.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user.id, retry]);
  const name =
    data?.profile.full_name?.trim() ||
    (typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "") ||
    "Patient";
  const recordId = data?.profile.patient_id;
  const patient = useMemo(
    () =>
      data
        ? {
            ...mapClinicalRecord(
              { ...data.summary, "Patient Number": recordId ?? "" },
              data.readings,
            ),
            name,
          }
        : null,
    [data, recordId, name],
  );
  const navigate = (module: NavigationModule) => {
    const aliases: Partial<Record<NavigationModule, NavigationModule>> = {
      monitoring: "patient_monitoring",
      digital_twin: "patient_digital_twin",
      reports: "patient_reports",
      patient_dashboard: "patient_home",
    };
    const next = aliases[module] ?? module;
    if (pages.has(next)) setPage(next);
  };
  const condition =
    typeof data?.summary?.["Type of Diabetes"] === "string"
      ? data.summary["Type of Diabetes"]
      : "";
  return (
    <div className="min-h-screen bg-[#f8fafc] p-3 font-sans text-slate-900 sm:p-5 lg:p-7">
      <div className="mx-auto flex max-w-[1400px] flex-col items-start gap-5 lg:flex-row lg:gap-6">
        <Sidebar
          mode="patient"
          activeModule={page}
          onSelectModule={navigate}
          currentPatientName={name}
          selfService
        />
        <main className="w-full min-w-0 flex-1 space-y-5">
          <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                {name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-sm font-bold leading-tight sm:text-base">
                    {name}
                  </h1>
                  {patient?.hasContinuousCGM && (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      CGM readings available
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {condition || "Your personal health dashboard"}
                  {patient && Number.isFinite(patient.bmi)
                    ? ` · BMI ${patient.bmi}`
                    : ""}
                </p>
                {recordId && (
                  <p className="mt-1 break-all text-[11px] font-semibold text-purple-600">
                    Patient No. {recordId}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <button
                disabled={loading}
                onClick={() => setRetry((value) => value + 1)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
              <details className="relative">
                <summary
                  aria-label="Patient account menu"
                  className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-2 py-1 hover:bg-slate-50"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
                    P
                  </span>
                  <span>
                    <span className="block text-xs font-bold">Patient</span>
                    <span className="block text-[10px] text-slate-400">
                      Personal workspace
                    </span>
                  </span>
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </summary>
                <div className="absolute right-0 top-10 z-50 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                  <p className="break-all border-b border-slate-100 pb-3 text-xs text-slate-500">
                    {user.email}
                  </p>
                  <button
                    onClick={onExit}
                    className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-700"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out
                  </button>
                </div>
              </details>
            </div>
          </header>
          {page === "patient_settings" && <FontSizeSettings />}
          {authError && (
            <p
              role="alert"
              className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
            >
              {authError}
            </p>
          )}
          {loading ? (
            <section className={card} role="status">
              Loading your dashboard…
            </section>
          ) : error ? (
            <section role="alert" className={`${card} border-rose-200`}>
              <h2 className="font-semibold">Your dashboard is unavailable</h2>
              <p className="mt-2 text-sm text-slate-600">{error}</p>
            </section>
          ) : (
            data &&
            patient && (
              <>
                {!recordId && (
                  <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                    <h2 className="text-sm font-semibold text-blue-900">
                      Your dashboard is ready
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-blue-800">
                      Your Patient Number is being set up. Refresh shortly; if
                      it is still missing, contact your administrator.
                    </p>
                  </section>
                )}
                {recordId && !data.summary && (
                  <section
                    role="status"
                    className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900"
                  >
                    Your linked health summary is not available. Please contact
                    your care team.
                  </section>
                )}
                {page === "patient_home" && (
                  <PatientHomeView patient={patient} onNavigate={navigate} />
                )}
                {page === "patient_profile" && (
                  <section className={card}>
                    <h2 className="text-lg font-bold">My profile</h2>
                    <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
                      {[
                        ["Full name", name],
                        ["Email", user.email || "Not provided"],
                        ["Role", "Patient"],
                        ["Email status", "Confirmed"],
                        ["Patient Number", recordId || "Being set up"],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-slate-500">{label}</dt>
                          <dd className="mt-1 break-words font-semibold">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}
                {page === "patient_monitoring" && (
                  <RecordedMonitoring
                    patient={patient}
                    onNavigate={navigate}
                    allowPatientSelection={false}
                  />
                )}
                {page === "patient_lab_results" && <LabResultsView key={patient.id} patientId={patient.id} />}
                {page === "patient_reports" && (
                  <RecordedReport patient={patient} />
                )}
                {page === "patient_recommendations" && (
                  <PatientRecommendationsView recommendations={[]} />
                )}
                {page === "patient_digital_twin" && (
                  <RiskSimulationView
                    key={patient.id}
                    patient={patient}
                    onNavigate={navigate}
                  />
                )}
              </>
            )
          )}
        </main>
      </div>
    </div>
  );
}
