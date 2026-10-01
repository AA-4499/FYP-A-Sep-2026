import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { WorkflowTabs, ActiveTab } from './components/WorkflowTabs';
import { PatientSelector } from './components/PatientSelector';
import { LongitudinalTimeline } from './components/LongitudinalTimeline';
import { RiskAndXaiView } from './components/RiskAndXaiView';
import { PersonalisedInsights } from './components/PersonalisedInsights';
import { DigitalTwinSimulationView } from './components/DigitalTwinSimulationView';
import { PersonalHealthGraph } from './components/PersonalHealthGraph';
import { PatientReportModal } from './components/PatientReportModal';
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
  PatientProfile,
  PatientListResponse,
  TimelineResponse,
  RiskAssessmentResponse,
  XAIResponse,
  InsightsResponse,
  DigitalTwinResponse,
  KnowledgeGraphResponse,
} from './types';
import { AlertCircle, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
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
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

  // Initialize application
  useEffect(() => {
    async function init() {
      try {
        const health = await fetchHealth();
        setIsBackendHealthy(health.status === 'healthy');
        setDatasetName(health.dataset);

        const meta = await fetchMeta();
        const initialId = meta.default_patient_id || '1001';
        setPatientId(initialId);

        const list = await fetchPatients('', 1, 12);
        setPatientList(list);

        await loadPatientData(initialId);
      } catch (err: any) {
        console.error('Initialization error:', err);
        setIsBackendHealthy(false);
        setErrorMessage('Unable to connect to Flask API backend. Please ensure the server is running on http://localhost:5000');
      }
    }
    init();
  }, []);

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

      // 3. Fetch risk evaluation and SHAP explanations in parallel
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
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Header
          isBackendHealthy={isBackendHealthy}
          datasetName={datasetName}
          onOpenReport={() => setIsReportModalOpen(true)}
        />

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

        {/* 6-Tab Workflow Navigation */}
        <div className="mb-6">
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
        </div>

        {/* Loading Overlay / Indicator */}
        {isLoading && (
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-3.5 py-2 rounded-lg">
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

        {/* MODAL / TAB 6: Consolidated Patient Health Report */}
        <PatientReportModal
          patientId={patientId}
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
        />
      </div>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-t border-slate-200 mt-12 text-center text-xs text-slate-500">
        <p className="font-semibold text-slate-700">
          Smart Diabetes Digital Twin and Personalised Health Management Platform
        </p>
        <p className="mt-1">
          Swinburne University of Technology Sarawak · Ts. Dr. Vong Wan Tze · ShanghaiT2DM Cohort
        </p>
      </footer>
    </div>
  );
};

export default App;
