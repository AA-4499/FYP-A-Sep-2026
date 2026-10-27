/** Clinical workspace. Database facts and research simulations have separate views. */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { AuthGateway } from "./components/AuthGateway";
import { AdminWorkspace } from "./components/admin/AdminWorkspace";
import { SupabaseConfigModal } from "./components/SupabaseConfigModal";
import { PatientRecommendationsView } from "./components/PatientRecommendationsView";
import { RiskSimulationView } from "./components/RiskSimulationView";
import { PatientHomeView } from "./components/PatientHomeView";
import {
  createDemoRecommendations,
  type ClinicalRecommendation,
  type RecommendationStatus,
} from "./data/knowledgeGraphDemoData";
import {
  CohortOverview,
  PatientRegistry,
  RecordedMonitoring,
  OrganEvidence,
  RecordedReport,
} from "./components/ClinicalWorkspace";
import { fetchSupabasePatients } from "./lib/supabase";
import type { NavigationModule, Patient, UserRole } from "./types";

const KnowledgeGraphView = React.lazy(async () => ({
  default: (await import("./components/KnowledgeGraphView")).KnowledgeGraphView,
}));

export const App: React.FC = () => (
  <AuthGateway
    renderWorkspace={(role, preview, onExit) => (
      <Workspace
        key={`${role}-${preview}`}
        initialRole={role}
        isPreview={preview}
        onExit={onExit}
      />
    )}
  />
);

function Workspace({
  initialRole,
  isPreview,
  onExit,
}: {
  initialRole: UserRole;
  isPreview: boolean;
  onExit: () => void;
}) {
  const [mode, setMode] = useState<UserRole>(initialRole);
  // initialRole is verified by AuthGateway; changing the displayed workspace grants no role.
  const canViewPredictions = !isPreview && initialRole === "doctor";
  const canViewKnowledgeGraph = !isPreview && initialRole === "doctor";
  const [doctorPage, setDoctorPage] =
    useState<NavigationModule>("doctor_overview");
  const [patientPage, setPatientPage] =
    useState<NavigationModule>("patient_home");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadedAt, setLoadedAt] = useState("");
  const [connectionOpen, setConnectionOpen] = useState(false);
  // The branch's review/share prototype is scoped to a selected record and this session.
  const [recommendationsByPatient, setRecommendationsByPatient] = useState<
    Record<string, ClinicalRecommendation[]>
  >({});
  const revision = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++revision.current;
    setLoading(true);
    setError("");
    try {
      const records = await fetchSupabasePatients();
      if (request !== revision.current) return;
      setPatients(records);
      setSelectedId((previous) =>
        records.some((p) => p.id === previous)
          ? previous
          : (records[0]?.id ?? ""),
      );
      setLoadedAt(new Date().toLocaleTimeString());
    } catch (failure) {
      if (request !== revision.current) return;
      setPatients([]);
      setSelectedId("");
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to load clinical records.",
      );
    } finally {
      if (request === revision.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    return () => {
      revision.current++;
    };
  }, [refresh]);
  const patient = patients.find((p) => p.id === selectedId);
  const recommendations = patient
    ? (recommendationsByPatient[patient.id] ??
      createDemoRecommendations(patient.id))
    : [];
  const sharedRecommendations = recommendations.filter(
    (item) => item.status === "published",
  );
  const reviewRecommendation = (id: string, status: RecommendationStatus) => {
    if (!patient || status === "published") return;
    const recordId = patient.id;
    setRecommendationsByPatient((previous) => ({
      ...previous,
      [recordId]: (
        previous[recordId] ?? createDemoRecommendations(recordId)
      ).map((item) =>
        item.id === id ? { ...item, status, publishedAt: undefined } : item,
      ),
    }));
  };
  const shareRecommendations = (ids: string[]) => {
    if (!patient) return;
    const recordId = patient.id;
    const selected = new Set(ids);
    setRecommendationsByPatient((previous) => ({
      ...previous,
      [recordId]: (
        previous[recordId] ?? createDemoRecommendations(recordId)
      ).map((item) =>
        item.status === "approved" && selected.has(item.id)
          ? {
              ...item,
              status: "published",
              publishedAt: new Date().toISOString(),
            }
          : item,
      ),
    }));
  };
  const openPatient = (id: string) => {
    setSelectedId(id);
    setMode("patient");
    setPatientPage("patient_home");
  };
  const navigate = (page: NavigationModule) => {
    if (["doctor_monitoring", "doctor_digital_twin", "doctor_knowledge_graph"].includes(page)) return;
    if (page === "patient_knowledge_graph" && !canViewKnowledgeGraph) return;
    if (
      ["doctor_predictions", "patient_insights", "risk"].includes(page) &&
      !canViewPredictions
    )
      return;
    if (page.startsWith("doctor_")) {
      setMode("doctor");
      setDoctorPage(page);
    } else {
      setMode("patient");
      setPatientPage(page);
    }
  };
  const backToDoctor = () => {
    setMode("doctor");
    setDoctorPage("doctor_overview");
  };
  if (mode === "admin") return <AdminWorkspace onExit={onExit} />;
  const page = mode === "doctor" ? doctorPage : patientPage;
  const settings = page === "doctor_settings";
  const overview = page === "doctor_overview";
  return (
    <div className="min-h-screen bg-[#f5f8f8] p-3 font-sans text-slate-900 sm:p-5 lg:p-7">
      <div className="mx-auto flex max-w-[1500px] flex-col items-start gap-5 lg:flex-row lg:gap-6">
        <Sidebar
          mode={mode}
          activeModule={page}
          onSelectModule={navigate}
          currentPatientName={patient?.name}
          onReturnToCareTeam={backToDoctor}
          canViewPredictions={canViewPredictions}
          canViewKnowledgeGraph={canViewKnowledgeGraph}
        />
        <main className="w-full min-w-0 flex-1 space-y-5">
          <TopBar
            mode={mode}
            currentPatient={patient}
            patientsList={patients}
            isSupabaseConnected={!!loadedAt && !error}
            onSelectPatient={openPatient}
            showPatientSearch={!overview && page !== "doctor_patients"}
            onSwitchMode={(next) => {
              setMode(next);
              if (next === "doctor") setDoctorPage("doctor_overview");
              else setPatientPage("patient_home");
            }}
            onOpenAuth={onExit}
            isDemo={isPreview}
            onOpenAdmin={() => setMode("admin")}
            onOpenSupabaseModal={() => setConnectionOpen(true)}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-slate-500">
            <span>
              {loading
                ? "Loading clinical records…"
                : error
                  ? "Database records unavailable"
                  : `${patients.length} accessible records`}
              {isPreview ? " · Preview" : ""}
            </span>
            <button
              disabled={loading}
              onClick={() => refresh()}
              className="font-semibold underline underline-offset-2 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
          {isPreview && !loading && !error && patients.length === 0 && (
            <section
              data-testid="preview-signin-required"
              className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-950"
            >
              <h2 className="text-sm font-bold">
                Patient data requires sign-in
              </h2>
              <p className="mt-2 text-xs leading-relaxed">
                No clinical records are visible in this preview. Sign in with an
                authorized Doctor or Admin account to view the cohort. Patient
                accounts can view only their own linked record. An empty
                response does not mean that the database has no patient data.
              </p>
              <button
                type="button"
                onClick={onExit}
                className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Sign in to view patient data
              </button>
            </section>
          )}
          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
            >
              {error}
            </div>
          )}
          {!patient && !overview && !settings && (
            <section
              role="status"
              className="rounded-3xl border border-slate-200 bg-white p-8"
            >
              <h1 className="text-lg font-bold">
                {loading
                  ? "Loading patient records"
                  : "No patient records available"}
              </h1>
              <p className="mt-3 text-sm text-slate-500">
                {loading
                  ? "Retrieving all available pages from the clinical database."
                  : isPreview
                    ? "This preview cannot display records hidden by database permissions. Use the sign-in button above to access your authorized records."
                    : "No records are visible to this account. Check the account's role and record assignment, then refresh. No sample medical values will be substituted."}
              </p>
            </section>
          )}
          {overview && (
            <CohortOverview
              patients={patients}
              onOpen={openPatient}
            />
          )}
          {settings && (
            <section className="rounded-3xl border border-slate-200 bg-white p-6">
              <h1 className="text-2xl font-bold">Workspace settings</h1>
              <p className="mt-3 text-sm text-slate-500">
                Clinical records are read from patient_summary and
                patient_detail. Your database policies control access; this app
                does not disable row-level security.
              </p>
              <button
                onClick={() => setConnectionOpen(true)}
                className="mt-5 rounded-xl bg-teal-700 px-4 py-3 text-xs font-bold text-white"
              >
                Supabase Database Settings
              </button>
              <dl className="mt-6 grid gap-5 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-slate-400">Last successful refresh</dt>
                  <dd className="mt-2 font-semibold">
                    {loadedAt || "Not connected"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Data provenance</dt>
                  <dd className="mt-2 font-semibold">
                    Measured · calculated · predicted · simulated
                  </dd>
                </div>
              </dl>
            </section>
          )}
          {patient && (
            <>
              {page === "doctor_patients" && (
                <PatientRegistry
                  patients={patients}
                  currentPatient={patient}
                  onSelectPatient={setSelectedId}
                  onOpenDigitalTwin={openPatient}
                />
              )}
              {["patient_dashboard", "patient_home"].includes(page) && (
                <PatientHomeView
                  patient={patient}
                  onNavigate={navigate}
                  sharedRecommendations={sharedRecommendations}
                  canViewPredictions={canViewPredictions}
                />
              )}
              {page === "patient_profile" && (
                <RecordedReport patient={patient} />
              )}
              {[
                "patient_monitoring",
                "monitoring",
              ].includes(page) && (
                <RecordedMonitoring
                  key={patient.id}
                  patient={patient}
                  onNavigate={navigate}
                />
              )}
              {[
                "patient_digital_twin",
                "digital_twin",
              ].includes(page) && <OrganEvidence patient={patient} />}
              {page === "patient_knowledge_graph" && canViewKnowledgeGraph && (
                <React.Suspense
                  fallback={
                    <section
                      role="status"
                      className="rounded-2xl bg-white p-6 text-sm text-slate-500"
                    >
                      Loading knowledge graph...
                    </section>
                  }
                >
                  <KnowledgeGraphView
                    key={patient.id}
                    patient={patient}
                    patientId={patient.id}
                    recommendations={recommendations}
                    onRecommendationStatusChange={reviewRecommendation}
                    onPublishRecommendations={shareRecommendations}
                    onPreviewPatientView={() => openPatient(patient.id)}
                  />
                </React.Suspense>
              )}
              {["doctor_reports", "patient_reports", "reports"].includes(
                page,
              ) && <RecordedReport patient={patient} />}
              {["doctor_predictions", "patient_insights", "risk"].includes(
                page,
              ) &&
                canViewPredictions && (
                  <RiskSimulationView
                    key={patient.id}
                    patient={patient}
                    onNavigate={navigate}
                    patients={mode === "doctor" ? patients : undefined}
                    onSelectPatient={
                      mode === "doctor" ? setSelectedId : undefined
                    }
                  />
                )}
              {page === "patient_recommendations" && (
                <PatientRecommendationsView
                  recommendations={sharedRecommendations}
                />
              )}
            </>
          )}
        </main>
      </div>
      <SupabaseConfigModal
        isOpen={connectionOpen}
        onClose={() => setConnectionOpen(false)}
        onConfigSaved={refresh}
      />
    </div>
  );
}
export default App;
