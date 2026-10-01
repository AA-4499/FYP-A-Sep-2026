import React, { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { HomePage } from './components/HomePage';
import { PatientPortal } from './components/PatientPortal';
import { AdminPortal } from './components/AdminPortal';
import { LoginModal } from './components/LoginModal';
import { FigmaDemoToolbar } from './components/FigmaDemoToolbar';
import { Header } from './components/Header';
import { WorkflowTabs, ActiveTab } from './components/WorkflowTabs';
import { PatientSelector } from './components/PatientSelector';
import { LongitudinalTimeline } from './components/LongitudinalTimeline';
import { RiskAndXaiView } from './components/RiskAndXaiView';
import { PersonalisedInsights } from './components/PersonalisedInsights';
import { DigitalTwinSimulationView } from './components/DigitalTwinSimulationView';
import { PersonalHealthGraph } from './components/PersonalHealthGraph';
import { PatientReportModal } from './components/PatientReportModal';
import { useAuth } from './context/AuthContext';
import {
  fetchHealth,
  fetchMeta,
  fetchPatients,
  fetchPatient,
  fetchTimeline,
  fetchRiskAssessment,
  fetchXAI,
  fetchInsights,
  fetchDigitalTwin,
  fetchKnowledgeGraph,
} from './api/client';
import type {
  PlatformPage,
  PatientProfile,
  PatientListResponse,
  TimelineResponse,
  RiskAssessmentResponse,
  XAIResponse,
  InsightsResponse,
  DigitalTwinResponse,
  KnowledgeGraphResponse,
} from './types';
import { AlertCircle, RefreshCw, GraduationCap, ShieldCheck, HeartPulse } from 'lucide-react';

export const App: React.FC = () => {
  const { currentUser } = useAuth();

  // Multi-Page Routing State
  const [currentPage, setCurrentPage] = useState<PlatformPage>('home');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Deep-dive Clinical Workspace States
  const [activeTab, setActiveTab] = useState<ActiveTab>('patients');
  const [patientId, setPatientId] = useState<string>('1001');
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);
  const [datasetName, setDatasetName] = useState<string>('ShanghaiT2DM Cohort');

  // Multi-module Data States
  const [patientList, setPatientList] = useState<PatientListResponse | null>(null);
  const [currentPatient, setCurrentPatient] = useState<PatientProfile | null>(null);
  const [timelineData, setTimelineData] = useState<TimelineResponse | null>(null);
  const [riskData, setRiskData] = useState<RiskAssessmentResponse | null>(null);
  const [xaiData, setXaiData] = useState<XAIResponse | null>(null);
  const [insightsData, setInsightsData] = useState<InsightsResponse | null>(null);
  const [twinData, setTwinData] = useState<DigitalTwinResponse | null>(null);
  const [graphData, setGraphData] = useState<KnowledgeGraphResponse | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGraphLoading, setIsGraphLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize application
  useEffect(() => {
    async function init() {
      try {
        const health = await fetchHealth();
        setIsBackendHealthy(!health.isFallback && health.status === 'healthy');
        setDatasetName(health.dataset);

        const meta = await fetchMeta();
        const initialId = meta.default_patient_id || '1001';
        setPatientId(initialId);

        const list = await fetchPatients('', 1, 12);
        setPatientList(list);

        await loadPatientData(initialId);
      } catch (err: any) {
        console.warn('Initialization warning:', err);
        setIsBackendHealthy(false);
      }
    }
    init();
  }, []);

  // Sync patientId with currentUser if logged in as patient
  useEffect(() => {
    if (currentUser?.role === 'patient' && currentUser.patientId && currentUser.patientId !== patientId) {
      loadPatientData(currentUser.patientId);
    }
  }, [currentUser]);

  // Load all patient modules
  const loadPatientData = async (id: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setPatientId(id);

    try {
      // 1. Fetch patient demographic & clinical profile
      const patient = await fetchPatient(id);
      setCurrentPatient(patient);

      // 2. Fetch longitudinal timeline & CGM data
      const timeline = await fetchTimeline(id);
      setTimelineData(timeline);

      // 3. Fetch risk evaluation, XAI, insights, and digital twin in parallel
      const [risk, xai, insights, twin] = await Promise.all([
        fetchRiskAssessment(id),
        fetchXAI(id),
        fetchInsights(id),
        fetchDigitalTwin(id),
      ]);

      setRiskData(risk);
      setXaiData(xai);
      setInsightsData(insights);
      setTwinData(twin);
      setIsLoading(false);

      // 4. Fetch Knowledge Graph
      setIsGraphLoading(true);
      fetchKnowledgeGraph(id)
        .then((kg) => setGraphData(kg))
        .catch((e) => console.warn('Knowledge graph load failed:', e))
        .finally(() => setIsGraphLoading(false));
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || `Failed to load data for patient #${id}.`);
    }
  };

  const handleSearch = async (query: string, page: number) => {
    try {
      const list = await fetchPatients(query, page, 12);
      setPatientList(list);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error searching patients');
    }
  };

  const handleSelectPatient = (id: string) => {
    loadPatientData(id);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col justify-between">
      <div>
        {/* Global Navigation Bar */}
        <Navbar
          currentPage={currentPage}
          onNavigate={(page) => setCurrentPage(page)}
          onOpenLogin={() => setIsLoginModalOpen(true)}
          onOpenReport={() => setIsReportModalOpen(true)}
          isBackendHealthy={isBackendHealthy}
          datasetName={datasetName}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Global Error Banner */}
          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                onClick={() => loadPatientData(patientId)}
                className="px-2.5 py-1 bg-rose-600 text-white rounded font-semibold hover:bg-rose-700 transition"
              >
                Retry
              </button>
            </div>
          )}

          {/* PAGE 1: HOME / LANDING PAGE */}
          {currentPage === 'home' && (
            <HomePage
              onNavigate={(page) => setCurrentPage(page)}
              onSelectPatient={(id) => handleSelectPatient(id)}
            />
          )}

          {/* PAGE 2: PERSONAL PATIENT PORTAL */}
          {currentPage === 'patient_portal' && (
            <PatientPortal
              patientId={patientId}
              onSelectPatient={handleSelectPatient}
              onOpenReport={() => setIsReportModalOpen(true)}
              onNavigateToWorkspace={() => {
                setCurrentPage('workspace');
                setActiveTab('twin_simulation');
              }}
            />
          )}

          {/* PAGE 3: ADMIN & CLINICAL COMMAND CENTER */}
          {currentPage === 'admin_portal' && (
            <AdminPortal
              onSelectPatient={handleSelectPatient}
              onNavigate={(page) => setCurrentPage(page)}
              onOpenReport={() => setIsReportModalOpen(true)}
            />
          )}

          {/* PAGE 4: CLINICAL MULTI-MODULE WORKSPACE */}
          {currentPage === 'workspace' && (
            <div className="space-y-6 animate-fadeIn">
              <Header
                isBackendHealthy={isBackendHealthy}
                datasetName={datasetName}
                onOpenReport={() => setIsReportModalOpen(true)}
              />

              {/* 6-Tab Workflow Navigation */}
              <WorkflowTabs
                activeTab={activeTab}
                onTabChange={(tab) => {
                  if (tab === 'report') {
                    setIsReportModalOpen(true);
                  } else {
                    setActiveTab(tab);
                  }
                }}
                patientId={patientId}
              />

              {/* Loading Overlay */}
              {isLoading && (
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-3.5 py-2 rounded-lg">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  <span>Synchronizing multi-module ShanghaiT2DM data for Patient #{patientId}...</span>
                </div>
              )}

              {/* TAB 1: Patient Selection & Profile */}
              {activeTab === 'patients' && (
                <div className="animate-fadeIn">
                  <PatientSelector
                    currentPatient={currentPatient}
                    patientList={patientList}
                    onSelectPatient={handleSelectPatient}
                    onSearch={handleSearch}
                    isLoading={isLoading}
                  />
                </div>
              )}

              {/* TAB 2: Longitudinal Timeline (CGM & HbA1c History) */}
              {activeTab === 'timeline' && timelineData && (
                <div className="animate-fadeIn">
                  <LongitudinalTimeline
                    timeline={timelineData}
                    patientName={currentPatient?.name || `Patient #${patientId}`}
                  />
                </div>
              )}

              {/* TAB 3: Risk Assessment & Explainable AI (SHAP) */}
              {activeTab === 'risk_xai' && (
                <div className="animate-fadeIn">
                  <RiskAndXaiView
                    riskData={riskData}
                    xaiData={xaiData}
                    patientName={currentPatient?.name || `Patient #${patientId}`}
                  />
                </div>
              )}

              {/* TAB 4: Personalised Insights & Knowledge Graph */}
              {activeTab === 'insights' && (
                <div className="space-y-6 animate-fadeIn">
                  {insightsData && (
                    <PersonalisedInsights
                      insights={insightsData}
                      patientName={currentPatient?.name || `Patient #${patientId}`}
                      onApplyScenario={() => setActiveTab('twin_simulation')}
                    />
                  )}
                  <PersonalHealthGraph
                    patientId={patientId}
                    graphData={graphData}
                    isLoading={isGraphLoading}
                  />
                </div>
              )}

              {/* TAB 5: Digital Twin & What-If Counterfactual Simulation */}
              {activeTab === 'twin_simulation' && (
                <div className="animate-fadeIn">
                  <DigitalTwinSimulationView
                    patientId={patientId}
                    patientName={currentPatient?.name || `Patient #${patientId}`}
                    twinData={twinData}
                  />
                </div>
              )}
            </div>
          )}

          {/* Consolidated Patient Health Report Modal */}
          <PatientReportModal
            patientId={patientId}
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
          />

          {/* User Sign-In / Role Switcher Modal */}
          <LoginModal
            isOpen={isLoginModalOpen}
            onClose={() => setIsLoginModalOpen(false)}
            defaultRole={currentUser?.role || 'patient'}
            onSuccess={() => {
              if (currentUser?.role === 'admin') {
                setCurrentPage('admin_portal');
              } else {
                setCurrentPage('patient_portal');
              }
            }}
          />
        </main>
      </div>

      {/* Global Academic & Clinical Footer */}
      <footer className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 border-t border-slate-200 mt-12 text-center text-xs text-slate-500 space-y-2">
        <div className="flex flex-wrap items-center justify-center gap-4 text-slate-600 font-medium">
          <button onClick={() => setCurrentPage('home')} className="hover:text-blue-600 transition">
            Home
          </button>
          <span>•</span>
          <button onClick={() => setCurrentPage('patient_portal')} className="hover:text-blue-600 transition">
            Patient Portal
          </button>
          <span>•</span>
          <button onClick={() => setCurrentPage('admin_portal')} className="hover:text-blue-600 transition">
            Admin & Clinic Center
          </button>
          <span>•</span>
          <button onClick={() => setCurrentPage('workspace')} className="hover:text-blue-600 transition">
            Clinical Workspace
          </button>
        </div>

        <p className="font-semibold text-slate-700">
          Smart Diabetes Digital Twin and Personalised Health Management Platform
        </p>
        <p className="text-[11px] text-slate-500">
          Swinburne University of Technology Sarawak · Faculty of Engineering, Computing and Science · Supervisor: <strong>Ts. Dr. Vong Wan Tze</strong>
        </p>
        <p className="text-[10px] text-slate-400">
          Academic Research Prototype based on the ShanghaiT2DM Longitudinal Cohort (n=112)
        </p>
      </footer>

      {/* Floating Figma Demo Presentation Toolbar */}
      <FigmaDemoToolbar
        currentPage={currentPage}
        onNavigate={(page) => setCurrentPage(page)}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onOpenReport={() => setIsReportModalOpen(true)}
      />
    </div>
  );
};

export default App;
