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
import type { NavigationModule, AuthFlow, Patient } from './types';
import { PATIENTS, getPatientById } from './data/patientsData';
import {
  fetchSupabasePatients,
  fetchSupabasePatientDetail,
  testSupabaseConnection,
} from './lib/supabase';

export const App: React.FC = () => {
  // Navigation Mode: 'clinic' (Borneo Center) | 'patient' (DiabetesTwin P07) | 'auth' (Sign in / Registration)
  const [appMode, setAppMode] = useState<'clinic' | 'patient' | 'auth'>('clinic');

  // Currently active module in the sidebar
  const [clinicModule, setClinicModule] = useState<NavigationModule>('overview');
  const [patientModule, setPatientModule] = useState<NavigationModule>('patient_dashboard');

  // Patients dataset: initialized with Figma replica, synchronized dynamically with Supabase
  const [patients, setPatients] = useState<Patient[]>(PATIENTS);
  const [currentPatientId, setCurrentPatientId] = useState<string>('2000_0_20201230');
  const [activePatientOverride, setActivePatientOverride] = useState<Patient | null>(null);

  // Supabase connection state
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState<boolean>(false);

  // Auth flow to display when auth mode is opened
  const [authFlow, setAuthFlow] = useState<AuthFlow>('signin');

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
    setPatientModule('patient_dashboard');

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

  // If in Auth mode, render full-screen AuthView
  if (appMode === 'auth') {
    return (
      <AuthView
        initialFlow={authFlow}
        onSuccessLogin={(role) => {
          if (role === 'patient') {
            setAppMode('patient');
            setPatientModule('patient_dashboard');
          } else {
            setAppMode('clinic');
            setClinicModule('overview');
          }
        }}
        onClose={() => setAppMode('clinic')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans p-3 sm:p-5 lg:p-7 flex justify-center selection:bg-blue-600 selection:text-white">
      <div className="max-w-[1400px] w-full flex flex-col md:flex-row gap-5 lg:gap-6 items-start">
        {/* 1. LEFT SIDEBAR */}
        <Sidebar
          mode={appMode}
          activeModule={appMode === 'clinic' ? clinicModule : patientModule}
          onSelectModule={(mod) => {
            if (appMode === 'clinic') {
              setClinicModule(mod);
            } else {
              setPatientModule(mod);
            }
          }}
          onSwitchToClinic={() => {
            setAppMode('clinic');
            setClinicModule('overview');
          }}
          currentPatientName={currentPatient.name}
        />

        {/* 2. MAIN WORKSPACE */}
        <main className="flex-1 w-full space-y-5 min-w-0">
          {/* Top Bar */}
          <TopBar
            mode={appMode}
            currentPatient={currentPatient}
            patientsList={patients}
            isSupabaseConnected={isSupabaseConnected}
            onSelectPatient={handleSelectPatient}
            onSwitchMode={(mode) => setAppMode(mode)}
            onOpenAuth={() => handleOpenAuth('signin')}
            onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          />

          {/* ========================================================= */}
          {/* A. CLINIC WORKSPACE (Borneo Center Kuching - Figma Image 1) */}
          {/* ========================================================= */}
          {appMode === 'clinic' && (
            <>
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

              {clinicModule !== 'overview' &&
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
              {patientModule === 'patient_dashboard' && (
                <DashboardView
                  patient={currentPatient}
                  onNavigate={(mod) => {
                    if (mod === 'digital_twin') setPatientModule('digital_twin');
                    else if (mod === 'reports') setPatientModule('reports');
                    else setPatientModule(mod);
                  }}
                />
              )}

              {/* 2. Longitudinal Monitoring */}
              {patientModule === 'monitoring' && (
                <LongitudinalMonitoringView
                  patient={currentPatient}
                  onNavigate={(mod) => setPatientModule(mod)}
                />
              )}

              {/* 3. Risk Assessment & What-if Simulation */}
              {patientModule === 'risk' && (
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
              {patientModule === 'digital_twin' && (
                <DigitalTwinView
                  patient={currentPatient}
                  onNavigate={(mod) => setPatientModule(mod)}
                />
              )}

              {/* 7. Clinical Health Dossier & Reports */}
              {patientModule === 'reports' && (
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
