/**
 * Main Application Shell for Smart Diabetes Digital Twin & Health Management Platform
 * Seamlessly integrates all Figma designs:
 * 1. Clinic Overview Dashboard (Borneo Center Kuching, Malaysia - Image 1)
 * 2. Patient Digital Twin Suite (Patient P07 / Elena Morales - Image 3):
 *    - Patient Overview Dashboard (4 Key Metrics + 2x2 Grid)
 *    - Longitudinal Monitoring (Timeline + Past 7 days distribution)
 *    - Risk Prediction and What-if Simulation
 *    - Explainable AI & Interactive Model Insights Chat
 *    - Knowledge Graph (14 entities, 4 categories, node inspector, clinical chart)
 *    - Physiological Digital Twin (Multi-organ metabolic mapping)
 *    - Clinical Health Dossier / Reports (Printable PDF)
 * 3. Complete Authentication & Onboarding Suite (All 5 screens - Image 2)
 * 4. Supabase Live Integration (public.patient_summary & public.patient_detail)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { ClinicDashboardView } from './components/ClinicDashboardView';
import { DashboardView } from './components/DashboardView';
import { LongitudinalMonitoringView } from './components/LongitudinalMonitoringView';
import { RiskSimulationView } from './components/RiskSimulationView';
import { AIChatView } from './components/AIChatView';
import { KnowledgeGraphView } from './components/KnowledgeGraphView';
import { DigitalTwinView } from './components/DigitalTwinView';
import { ReportView } from './components/ReportView';
import { PatientsView } from './components/PatientsView';
import { AuthView } from './components/AuthView';
import { SupabaseConfigModal } from './components/SupabaseConfigModal';
import { ClinicalDataView } from './components/ClinicalDataView';
import { AdminOverviewView } from './components/admin/AdminOverviewView';
import { AdminPatientManagementView } from './components/admin/AdminPatientManagementView';
import { AdminDataQualityView } from './components/admin/AdminDataQualityView';
import { AdminTwinConfigView } from './components/admin/AdminTwinConfigView';
import { DoctorOverviewView } from './components/doctor/DoctorOverviewView';
import { DoctorPatientListView } from './components/doctor/DoctorPatientListView';
import type { NavigationModule, AuthFlow, Patient, UserRole } from './types';
import { PATIENTS, getPatientById } from './data/patientsData';
import {
  getSupabaseClient,
  fetchSupabasePatients,
  fetchSupabasePatientDetail,
  testSupabaseConnection,
} from './lib/supabase';

function normalizeUserRole(user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null | undefined): UserRole | null {
  const rawRole =
    user?.app_metadata?.role ||
    user?.user_metadata?.role;

  if (rawRole === 'admin') return 'admin';
  if (rawRole === 'patient') return 'patient';
  if (rawRole === 'doctor' || rawRole === 'clinician') return 'doctor';
  return null;
}

export const App: React.FC = () => {
  // Navigation Mode: 'clinic' (Borneo Center) | 'patient' (DiabetesTwin P07) | 'auth' (Sign in / Registration)
  const [appMode, setAppMode] = useState<UserRole | 'clinic' | 'auth'>('auth');
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  // Currently active module in the sidebar
  const [clinicModule, setClinicModule] = useState<NavigationModule>('overview');
  const [patientModule, setPatientModule] = useState<NavigationModule>('patient_home');

  // Patients dataset: initialized with Figma replica, synchronized dynamically with Supabase
  const [patients, setPatients] = useState<Patient[]>(PATIENTS);
  const [currentPatientId, setCurrentPatientId] = useState<string>('2000_0_20201230');
  const [activePatientOverride, setActivePatientOverride] = useState<Patient | null>(null);

  // Supabase connection state
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState<boolean>(false);

  // Auth flow to display when auth mode is opened
  const [authFlow, setAuthFlow] = useState<AuthFlow>('signin');

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;
    client.auth.getSession().then(({ data }) => {
      const role = normalizeUserRole(data.session?.user);
      setUserRole(role || null);
      if (data.session) {
        setAppMode(role || 'doctor');
        setClinicModule(role === 'admin' ? 'admin_overview' : 'doctor_overview');
      }
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      const role = normalizeUserRole(session?.user);
      setUserRole(role || null);
      if (!session) setAppMode('auth');
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Load patients from Supabase or fallback
  const syncSupabaseData = useCallback(async () => {
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
  }, [currentPatientId]);

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

  // Navigate to a specific patient and switch to Patient Twin view
  const handleSelectPatient = async (patientId: string) => {
    setCurrentPatientId(patientId);
    setAppMode('patient');
    setPatientModule('patient_home');

    // Fetch detail observations from Supabase if connected
    if (isSupabaseConnected) {
      try {
        const detailResult = await fetchSupabasePatientDetail(patientId);
        if (detailResult?.patient) {
          setActivePatientOverride(detailResult.patient);
        }
      } catch (err) {
        console.error('Error fetching patient detail:', err);
      }
    }
  };

  // Open Auth Modal / View
  const handleOpenAuth = (flow: AuthFlow = 'signin') => {
    setAuthFlow(flow);
    setAppMode('auth');
  };

  const navigateDoctorView = (module: NavigationModule) => {
    if (module === 'patients') {
      setClinicModule('doctor_patients');
    } else if (module.startsWith('doctor_')) {
      setClinicModule(module);
    } else {
      setAppMode('patient');
      setPatientModule(module);
    }
  };

  // If in Auth mode, render full-screen AuthView
  if (appMode === 'auth') {
    return (
      <AuthView
        initialFlow={authFlow}
        onSuccessLogin={() => {
          const client = getSupabaseClient();
          client?.auth.getUser().then(({ data }) => {
            const role = normalizeUserRole(data.user);
            setUserRole(role || null);
            if (role === 'patient') {
              setAppMode('patient');
              setPatientModule('patient_home');
            } else if (role === 'admin') {
              setAppMode('admin');
              setClinicModule('admin_overview');
            } else {
              setAppMode('doctor');
              setClinicModule('doctor_overview');
            }
          });
        }}
        onClose={() => {
          setUserRole('doctor');
          setAppMode('doctor');
          setClinicModule('doctor_overview');
        }}
      />
    );
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
          mode={appMode === 'clinic' ? 'clinic' : appMode}
          activeModule={appMode === 'patient' ? patientModule : clinicModule}
          onSelectModule={(mod) => {
            if (appMode === 'patient') {
              setPatientModule(mod);
            } else {
              setClinicModule(mod);
            }
          }}
          onSwitchToClinic={() => {
            setAppMode('doctor');
            setClinicModule('doctor_overview');
          }}
          currentPatientName={currentPatient?.name}
        />

        {/* 2. MAIN WORKSPACE */}
        <main className="flex-1 w-full space-y-5 min-w-0">
          {/* Top Bar */}
          <TopBar
            mode={appMode === 'clinic' ? 'clinic' : appMode}
            currentPatient={currentPatient}
            patientsList={patients}
            isSupabaseConnected={isSupabaseConnected}
            onSelectPatient={handleSelectPatient}
            onSwitchMode={(mode) => {
              setAppMode(mode);
              if (mode !== 'patient') setClinicModule(mode === 'admin' ? 'admin_overview' : mode === 'doctor' ? 'doctor_overview' : 'overview');
            }}
            onOpenAuth={() => handleOpenAuth('signin')}
            onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          />

          {/* ========================================================= */}
          {/* A. CLINIC WORKSPACE (Borneo Center Kuching - Figma Image 1) */}
          {/* ========================================================= */}
          {(appMode === 'clinic' || appMode === 'doctor' || appMode === 'admin') && (
            <>
              {appMode === 'admin' && clinicModule === 'admin_overview' && (
                <AdminOverviewView
                  onNavigateToUsers={() => setClinicModule('admin_users')}
                  onNavigateToDataQuality={() => setClinicModule('admin_data_quality')}
                  onNavigateToTwinConfig={() => setClinicModule('admin_twin_config')}
                />
              )}
              {appMode === 'admin' && clinicModule === 'admin_users' && <AdminPatientManagementView />}
              {appMode === 'admin' && clinicModule === 'admin_data_quality' && <AdminDataQualityView />}
              {appMode === 'admin' && clinicModule === 'admin_twin_config' && <AdminTwinConfigView />}
              {appMode === 'admin' && clinicModule === 'admin_logs' && (
                <AdminOverviewView
                  onNavigateToUsers={() => setClinicModule('admin_users')}
                  onNavigateToDataQuality={() => setClinicModule('admin_data_quality')}
                  onNavigateToTwinConfig={() => setClinicModule('admin_twin_config')}
                />
              )}
              {appMode === 'doctor' && clinicModule === 'doctor_overview' && (
                <DoctorOverviewView
                  patients={patients}
                  onSelectPatient={handleSelectPatient}
                  onOpenPatientTwin={handleSelectPatient}
                  onViewAllPatients={() => setClinicModule('doctor_patients')}
                  onViewMonitoring={() => setClinicModule('doctor_monitoring')}
                />
              )}
              {appMode === 'doctor' && clinicModule === 'doctor_patients' && (
                <DoctorPatientListView
                  patients={patients}
                  currentPatient={currentPatient}
                  onSelectPatient={handleSelectPatient}
                  onOpenDigitalTwin={handleSelectPatient}
                />
              )}
              {appMode === 'doctor' && clinicModule === 'doctor_monitoring' && (
                <LongitudinalMonitoringView
                  patient={currentPatient}
                  onNavigate={navigateDoctorView}
                />
              )}
              {appMode === 'doctor' && clinicModule === 'doctor_digital_twin' && (
                <DigitalTwinView
                  patient={currentPatient}
                  onNavigate={navigateDoctorView}
                />
              )}
              {appMode === 'doctor' && clinicModule === 'doctor_reports' && (
                <ReportView
                  patient={currentPatient}
                  onNavigate={navigateDoctorView}
                />
              )}
              {appMode === 'doctor' && clinicModule === 'doctor_settings' && (
                <DoctorOverviewView
                  patients={patients}
                  onSelectPatient={handleSelectPatient}
                  onOpenPatientTwin={handleSelectPatient}
                  onViewAllPatients={() => setClinicModule('doctor_patients')}
                  onViewMonitoring={() => setClinicModule('doctor_monitoring')}
                />
              )}
              {clinicModule === 'overview' && (
                <ClinicDashboardView
                  patients={patients}
                  isSupabaseLive={isSupabaseConnected}
                  onSelectPatient={handleSelectPatient}
                  onViewAllPatients={() => setClinicModule('patients')}
                  onViewAlerts={() => setClinicModule('alerts_tasks')}
                />
              )}

              {clinicModule === 'patients' && (
                <PatientsView
                  currentPatient={currentPatient}
                  patients={patients}
                  onSelectPatient={handleSelectPatient}
                  onNavigate={(mod) => setClinicModule(mod)}
                />
              )}

              {clinicModule === 'glucose_review' && (
                <PatientsView
                  currentPatient={currentPatient}
                  patients={patients}
                  onSelectPatient={handleSelectPatient}
                  onNavigate={(mod) => setClinicModule(mod)}
                />
              )}

              {clinicModule === 'reports' && (
                <ReportView
                  patient={currentPatient}
                  onNavigate={(mod) => setClinicModule(mod)}
                />
              )}

              {appMode === 'clinic' && clinicModule !== 'overview' &&
                clinicModule !== 'patients' &&
                clinicModule !== 'glucose_review' &&
                clinicModule !== 'reports' && (
                  <ClinicDashboardView
                    patients={patients}
                    isSupabaseLive={isSupabaseConnected}
                    onSelectPatient={handleSelectPatient}
                    onViewAllPatients={() => setClinicModule('patients')}
                    onViewAlerts={() => setClinicModule('alerts_tasks')}
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
                  onNavigate={(mod) => {
                    if (mod === 'digital_twin') setPatientModule('digital_twin');
                    else if (mod === 'reports') setPatientModule('reports');
                    else setPatientModule(mod);
                  }}
                />
              )}
              {(patientModule === 'patient_dashboard' || patientModule === 'patient_home') && <ClinicalDataView patientId={currentPatientId} />}
              {patientModule === 'patient_profile' && <ClinicalDataView patientId={currentPatientId} />}

              {/* 2. Longitudinal Monitoring */}
              {(patientModule === 'monitoring' || patientModule === 'patient_monitoring') && (
                <LongitudinalMonitoringView
                  patient={currentPatient}
                  onNavigate={(mod) => setPatientModule(mod)}
                />
              )}

              {/* 3. Risk Assessment & What-if Simulation */}
              {(patientModule === 'risk' || patientModule === 'patient_insights') && (
                <RiskSimulationView
                  patient={currentPatient}
                  onNavigate={(mod) => setPatientModule(mod)}
                />
              )}

              {/* 4. Explainable AI & Model Insights Chat */}
              {patientModule === 'explain_ai' && (
                <AIChatView
                  patient={currentPatient}
                  onNavigate={(mod) => setPatientModule(mod)}
                />
              )}

              {/* 5. Knowledge Graph */}
              {patientModule === 'knowledge_graph' && (
                <KnowledgeGraphView
                  patient={currentPatient}
                  onNavigate={(mod) => setPatientModule(mod)}
                />
              )}

              {/* 6. Physiological Digital Twin */}
              {(patientModule === 'digital_twin' || patientModule === 'patient_digital_twin') && (
                <DigitalTwinView
                  patient={currentPatient}
                  onNavigate={(mod) => setPatientModule(mod)}
                />
              )}

              {/* 7. Clinical Health Dossier & Reports */}
              {(patientModule === 'reports' || patientModule === 'patient_reports') && (
                <ReportView
                  patient={currentPatient}
                  onNavigate={(mod) => setPatientModule(mod)}
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
