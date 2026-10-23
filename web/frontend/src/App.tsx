/** Application shell for the Admin, Doctor, and Patient workspaces. */
import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DashboardView } from './components/DashboardView';
import { PatientRecommendationsView } from './components/PatientRecommendationsView';
import { LongitudinalMonitoringView } from './components/LongitudinalMonitoringView';
import { RiskSimulationView } from './components/RiskSimulationView';
import { AIChatView } from './components/AIChatView';
import { KnowledgeGraphView } from './components/KnowledgeGraphView';
import { DigitalTwinView } from './components/DigitalTwinView';
import { ReportView } from './components/ReportView';
import { AuthGateway } from './components/AuthGateway';
import { SupabaseConfigModal } from './components/SupabaseConfigModal';
import { ClinicalDataView } from './components/ClinicalDataView';
import { AdminWorkspace } from './components/admin/AdminWorkspace';
import { DoctorOverviewView } from './components/doctor/DoctorOverviewView';
import { DoctorPatientListView } from './components/doctor/DoctorPatientListView';
import type { NavigationModule, Patient, UserRole } from './types';
import { PATIENTS, getPatientById } from './data/patientsData';
import { createDemoRecommendations } from './data/knowledgeGraphDemoData';
import type { ClinicalRecommendation, RecommendationStatus } from './data/knowledgeGraphDemoData';
import {
  getSupabaseClient,
  fetchSupabasePatients,
  fetchSupabasePatientDetail,
  testSupabaseConnection,
} from './lib/supabase';

export const App: React.FC = () => (
  <AuthGateway renderWorkspace={(role, demo, onExit) => <Workspace key={`${role}-${demo}`} initialRole={role} isDemo={demo} onExit={onExit} />} />
);

const Workspace: React.FC<{ initialRole: UserRole; isDemo: boolean; onExit: () => void }> = ({ initialRole, isDemo, onExit }) => {
  const [appMode, setAppMode] = useState<UserRole>(initialRole);

  // Currently active module in the sidebar
  const [workspaceModule, setWorkspaceModule] = useState<NavigationModule>('doctor_overview');
  const [patientModule, setPatientModule] = useState<NavigationModule>('patient_home');

  // Patients dataset: initialized with Figma replica, synchronized dynamically with Supabase
  const [patients, setPatients] = useState<Patient[]>(PATIENTS);
  const [currentPatientId, setCurrentPatientId] = useState<string>('2000_0_20201230');
  const [activePatientOverride, setActivePatientOverride] = useState<Patient | null>(null);

  // Supabase connection state
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState<boolean>(false);

  // Session-only prototype state for doctor-reviewed recommendations shared to the patient view.
  const [recommendationsByPatient, setRecommendationsByPatient] = useState<Record<string, ClinicalRecommendation[]>>({});

  // Load patients from Supabase or fallback
  const syncSupabaseData = useCallback(async () => {
    if (isDemo) return;
    try {
      const conn = await testSupabaseConnection();
      setIsSupabaseConnected(conn.connected);
      if (conn.connected) {
        const remotePatients = await fetchSupabasePatients();
        if (remotePatients.length > 0) {
          setPatients(remotePatients);
          const targetId = remotePatients.some((p) => p.id === currentPatientId)
            ? currentPatientId
            : remotePatients[0].id;
          setCurrentPatientId(targetId);

          // Preload detail observations for this active patient
          try {
            const detailRes = await fetchSupabasePatientDetail(targetId);
            if (detailRes?.patient) {
              setActivePatientOverride(detailRes.patient);
            }
          } catch (detailErr) {
            console.warn('Initial patient detail fetch notice:', detailErr);
          }
        }
      }
    } catch (err) {
      console.error('Error synchronizing Supabase:', err);
    }
  }, [currentPatientId, isDemo]);

  useEffect(() => {
    syncSupabaseData();
  }, [syncSupabaseData]);

  // Determine current active patient object
  const currentPatient: Patient =
    activePatientOverride && activePatientOverride.id === currentPatientId
      ? activePatientOverride
      : patients.find((p) => p.id === currentPatientId || p.displayId === currentPatientId) ||
        getPatientById(currentPatientId) ||
        patients[0];

  // The recommendation review and patient sharing flow use mock data until the AI and database connections are implemented.
  const currentRecommendations = recommendationsByPatient[currentPatientId] ?? createDemoRecommendations(currentPatientId);
  const publishedRecommendations = currentRecommendations.filter((item) => item.status === 'published');

  const handleRecommendationStatusChange = (recommendationId: string, status: RecommendationStatus) => {
    const targetPatientId = currentPatientId;
    setRecommendationsByPatient((previous) => {
      const items = previous[targetPatientId] ?? createDemoRecommendations(targetPatientId);
      return {
        ...previous,
        [targetPatientId]: items.map((item) => item.id === recommendationId
          ? { ...item, status, publishedAt: status === 'published' ? new Date().toISOString() : undefined }
          : item),
      };
    });
  };

  const handlePublishRecommendations = (recommendationIds: string[]) => {
    const targetPatientId = currentPatientId;
    const publishSet = new Set(recommendationIds);
    setRecommendationsByPatient((previous) => {
      const items = previous[targetPatientId] ?? createDemoRecommendations(targetPatientId);
      return {
        ...previous,
        [targetPatientId]: items.map((item) => item.status === 'approved' && publishSet.has(item.id)
          ? { ...item, status: 'published', publishedAt: new Date().toISOString() }
          : item),
      };
    });
  };

  // A patient signing in sees their own Patient Twin workspace.
  const handleSelectPatient = async (patientId: string) => {
    setCurrentPatientId(patientId);
    setActivePatientOverride(null);
    setAppMode('patient');
    setPatientModule('patient_home');

    if (isSupabaseConnected) {
      try {
        const detailResult = await fetchSupabasePatientDetail(patientId);
        if (detailResult?.patient) setActivePatientOverride(detailResult.patient);
      } catch (err) {
        console.error('Error fetching patient detail:', err);
      }
    }
  };

  // Doctors can select a record without leaving their workspace.
  // This is important for reviewing the selected patient's Knowledge Graph.
  const handleWorkspacePatientSelect = async (patientId: string) => {
    setCurrentPatientId(patientId);
    setActivePatientOverride(null);
    if (isSupabaseConnected) {
      try {
        const detailResult = await fetchSupabasePatientDetail(patientId);
        if (detailResult?.patient) setActivePatientOverride(detailResult.patient);
      } catch (err) {
        console.error('Error fetching selected patient detail:', err);
      }
    }
  };

  const navigateWorkspace = (module: NavigationModule) => {
    if (module.startsWith('doctor_')) {
      setAppMode('doctor');
      setWorkspaceModule(module);
    } else if (module.startsWith('admin_')) {
      setAppMode('admin');
      setWorkspaceModule(module);
    } else {
      setAppMode('patient');
      setPatientModule(module);
    }
  };

  if (appMode === 'admin') {
    return <AdminWorkspace onExit={onExit} />;
  }

  if (appMode === 'patient' && !currentPatient) {
    return <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-slate-600">
      <p>Waiting for patient records.</p>
      <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white" onClick={() => syncSupabaseData()}>Retry loading records</button>
    </div>;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans p-3 sm:p-5 lg:p-7 flex justify-center selection:bg-blue-600 selection:text-white">
      <div className="max-w-[1400px] w-full flex flex-col md:flex-row gap-5 lg:gap-6 items-start">
        {/* 1. LEFT SIDEBAR */}
        <Sidebar
          mode={appMode}
          activeModule={appMode === 'patient' ? patientModule : workspaceModule}
          onSelectModule={(mod) => {
            if (appMode === 'patient') {
              setPatientModule(mod);
            } else {
              setWorkspaceModule(mod);
            }
          }}
          onReturnToCareTeam={() => {
            setAppMode('doctor');
            setWorkspaceModule('doctor_overview');
          }}
          currentPatientName={currentPatient?.name}
        />

        {/* 2. MAIN WORKSPACE */}
        <main className="flex-1 w-full space-y-5 min-w-0">
          {/* Top Bar */}
          <TopBar
            mode={appMode}
            currentPatient={currentPatient}
            patientsList={patients}
            isSupabaseConnected={isSupabaseConnected}
            onSelectPatient={appMode === 'patient' ? handleSelectPatient : handleWorkspacePatientSelect}
            onSwitchMode={(mode) => {
              setAppMode(mode);
              if (mode === 'doctor') setWorkspaceModule('doctor_overview');
            }}
            onOpenAuth={onExit}
            isDemo={isDemo}
            onOpenAdmin={() => setAppMode('admin')}
            onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          />

          {/* ========================================================= */}
          {/* A. DOCTOR WORKSPACE */}
          {/* ========================================================= */}
          {appMode === 'doctor' && (
            <>
              {appMode === 'doctor' && workspaceModule === 'doctor_overview' && (
                <DoctorOverviewView
                  patients={patients}
                  onSelectPatient={handleWorkspacePatientSelect}
                  onOpenPatientTwin={handleSelectPatient}
                  onViewAllPatients={() => setWorkspaceModule('doctor_patients')}
                  onViewMonitoring={() => setWorkspaceModule('doctor_monitoring')}
                />
              )}
              {appMode === 'doctor' && workspaceModule === 'doctor_patients' && (
                <DoctorPatientListView
                  patients={patients}
                  currentPatient={currentPatient}
                  onSelectPatient={handleWorkspacePatientSelect}
                  onOpenDigitalTwin={handleSelectPatient}
                />
              )}
              {appMode === 'doctor' && workspaceModule === 'doctor_monitoring' && (
                <LongitudinalMonitoringView
                  patient={currentPatient}
                  onNavigate={navigateWorkspace}
                />
              )}
              {appMode === 'doctor' && workspaceModule === 'doctor_digital_twin' && (
                <DigitalTwinView
                  patient={currentPatient}
                  onNavigate={navigateWorkspace}
                />
              )}
              {appMode === 'doctor' && workspaceModule === 'doctor_knowledge_graph' && (
                <KnowledgeGraphView
                  patient={currentPatient}
                  patientId={currentPatientId}
                  recommendations={currentRecommendations}
                  onRecommendationStatusChange={handleRecommendationStatusChange}
                  onPublishRecommendations={handlePublishRecommendations}
                  onPreviewPatientView={() => {
                    setAppMode('patient');
                    setPatientModule('patient_home');
                  }}
                />
              )}
              {appMode === 'doctor' && workspaceModule === 'doctor_reports' && (
                <ReportView
                  patient={currentPatient}
                  onNavigate={navigateWorkspace}
                />
              )}
              {appMode === 'doctor' && workspaceModule === 'doctor_settings' && (
                <DoctorOverviewView
                  patients={patients}
                  onSelectPatient={handleWorkspacePatientSelect}
                  onOpenPatientTwin={handleSelectPatient}
                  onViewAllPatients={() => setWorkspaceModule('doctor_patients')}
                  onViewMonitoring={() => setWorkspaceModule('doctor_monitoring')}
                />
              )}
            </>
          )}

          {/* ========================================================= */}
          {/* B. PATIENT DIGITAL TWIN WORKSPACE (DiabetesTwin - Figma Image 3) */}
          {/* ========================================================= */}
          {appMode === 'patient' && (
            <>
              {/* 1. Patient Overview Dashboard (4 vitals + 2x2 grid) */}
              {(patientModule === 'patient_dashboard' || patientModule === 'patient_home') && (
                <DashboardView
                  patient={currentPatient}
                  onNavigate={navigateWorkspace}
                  sharedRecommendations={publishedRecommendations}
                />
              )}
              {(patientModule === 'patient_dashboard' || patientModule === 'patient_home') && !isDemo && <ClinicalDataView patientId={currentPatientId} />}
              {patientModule === 'patient_profile' && !isDemo && <ClinicalDataView patientId={currentPatientId} />}
              {patientModule === 'patient_profile' && isDemo && <section className="rounded-2xl border border-slate-200 bg-white p-6"><h1 className="text-xl font-bold">Sample Patient profile</h1><p className="mt-3 text-sm text-slate-600">{currentPatient.name} · {currentPatient.condition}</p><p className="mt-2 text-xs text-slate-400">This preview uses sample records. Sign in to set up your own Patient account.</p></section>}
              {patientModule === 'patient_recommendations' && <PatientRecommendationsView recommendations={publishedRecommendations} />}

              {/* 2. Longitudinal Monitoring */}
              {(patientModule === 'monitoring' || patientModule === 'patient_monitoring') && (
                <LongitudinalMonitoringView
                  patient={currentPatient}
                  onNavigate={navigateWorkspace}
                />
              )}

              {/* 3. Risk Assessment & What-if Simulation */}
              {(patientModule === 'risk' || patientModule === 'patient_insights') && (
                <RiskSimulationView
                  patient={currentPatient}
                  onNavigate={navigateWorkspace}
                />
              )}

              {/* 4. Explainable AI & Model Insights Chat */}
              {patientModule === 'explain_ai' && (
                <AIChatView
                  patient={currentPatient}
                  onNavigate={navigateWorkspace}
                />
              )}

              {/* 6. Physiological Digital Twin */}
              {(patientModule === 'digital_twin' || patientModule === 'patient_digital_twin') && (
                <DigitalTwinView
                  patient={currentPatient}
                  onNavigate={navigateWorkspace}
                />
              )}

              {/* 7. Clinical Health Dossier & Reports */}
              {(patientModule === 'reports' || patientModule === 'patient_reports') && (
                <ReportView
                  patient={currentPatient}
                  onNavigate={navigateWorkspace}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Supabase Connection Modal */}
      <SupabaseConfigModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onConfigSaved={syncSupabaseData}
      />
    </div>
  );
};

export default App;
