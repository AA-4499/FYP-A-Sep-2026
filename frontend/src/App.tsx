import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { PatientSelector } from './components/PatientSelector';
import { Stage1Prediction } from './components/Stage1Prediction';
import { Stage2Explanation } from './components/Stage2Explanation';
import { Stage3Simulation } from './components/Stage3Simulation';
import { TwinViewer } from './components/TwinViewer';
import { Stage4KnowledgeGraph } from './components/Stage4KnowledgeGraph';
import { ResearchGuidance } from './components/ResearchGuidance';
import {
  fetchConfig,
  fetchPatients,
  runPrediction,
  runSimulation,
  fetchKnowledgeGraph,
  fetchGuidance,
  uploadDataset,
} from './api/client';
import type {
  AppConfig,
  GuidanceResponse,
  KnowledgeGraphResponse,
  PatientSummary,
  PredictResponse,
  SimulationResponse,
} from './types';

export const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);
  const [patientNumber, setPatientNumber] = useState<number>(1);
  const [patientCount, setPatientCount] = useState<number>(253680);
  const [datasetName, setDatasetName] = useState<string>('BRFSS 2015');
  const [actualLabel, setActualLabel] = useState<string | null>(null);
  const [patientWindow, setPatientWindow] = useState<PatientSummary[]>([]);
  const [currentValues, setCurrentValues] = useState<Record<string, number>>({});

  const [predictionData, setPredictionData] = useState<PredictResponse | null>(null);
  const [simulationData, setSimulationData] = useState<SimulationResponse | null>(null);
  const [graphData, setGraphData] = useState<KnowledgeGraphResponse | null>(null);
  const [guidanceData, setGuidanceData] = useState<GuidanceResponse | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGraphLoading, setIsGraphLoading] = useState<boolean>(false);
  const [isGuidanceLoading, setIsGuidanceLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initial App Setup
  useEffect(() => {
    async function init() {
      try {
        const cfg = await fetchConfig();
        setConfig(cfg);
        setDatasetName(cfg.dataset_name);
        setPatientCount(cfg.patient_count);
        setIsBackendHealthy(true);

        // Load initial patient 1
        await loadPatient(1);
      } catch (err: any) {
        console.error('Initialization error:', err);
        setIsBackendHealthy(false);
        setErrorMessage('Unable to connect to the backend API service. Please verify it is running.');
      }
    }
    init();
  }, []);

  const loadPatient = async (num: number) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSimulationData(null);
    setGuidanceData(null);

    try {
      // 1. Fetch patient window and current values
      const windowRes = await fetchPatients(num, 9);
      setPatientNumber(windowRes.patient_number);
      setPatientCount(windowRes.patient_count);
      setDatasetName(windowRes.dataset_name);
      setActualLabel(windowRes.actual_label);
      setPatientWindow(windowRes.window);
      setCurrentValues(windowRes.values);

      // 2. Run Stage 1 & 2 Prediction + SHAP
      const predRes = await runPrediction(windowRes.patient_number, windowRes.values);
      setPredictionData(predRes);
      setIsLoading(false);

      // 3. Load Stage 4 Knowledge Graph asynchronously
      setIsGraphLoading(true);
      fetchKnowledgeGraph(windowRes.patient_number, windowRes.values)
        .then((kg) => setGraphData(kg))
        .catch((e) => console.warn('Knowledge graph load failed:', e))
        .finally(() => setIsGraphLoading(false));
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Error running analysis for this patient.');
    }
  };

  const handleRunSimulation = async (scenario: Record<string, number>) => {
    if (!predictionData) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await runSimulation(patientNumber, currentValues, scenario);
      setSimulationData(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to simulate what-if scenario.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateGuidance = async () => {
    setIsGuidanceLoading(true);
    try {
      const res = await fetchGuidance(patientNumber, currentValues);
      setGuidanceData(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to synthesize guidance.');
    } finally {
      setIsGuidanceLoading(false);
    }
  };

  const handleUploadDataset = async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await uploadDataset(file);
      setDatasetName(res.source_name);
      setPatientCount(res.patient_count);
      await loadPatient(1);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload CSV dataset.');
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <Header isBackendHealthy={isBackendHealthy} datasetName={datasetName} />

      {errorMessage && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-rose-800 text-xs flex items-center justify-between shadow-sm animate-shake">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 hover:text-rose-800 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Patient Browser & Selector */}
      <PatientSelector
        currentNumber={patientNumber}
        totalPatients={patientCount}
        datasetName={datasetName}
        actualLabel={actualLabel}
        patientWindow={patientWindow}
        currentValues={currentValues}
        onSelectPatient={loadPatient}
        onUploadDataset={handleUploadDataset}
        isLoading={isLoading}
      />

      {/* Main Analysis Workflow: 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 Cols): Stages 1, 2, 3 Simulation, Guidance */}
        <div className="lg:col-span-2 space-y-8">
          <Stage1Prediction
            patientNumber={patientNumber}
            prediction={predictionData?.current ?? null}
            modelName="Random Forest (400 trees)"
          />

          <Stage2Explanation
            patientNumber={patientNumber}
            factors={predictionData?.explanation ?? []}
            predictedLabel={predictionData?.current.label ?? 'Risk Class'}
          />

          <Stage3Simulation
            patientNumber={patientNumber}
            baselineValues={currentValues}
            onRunSimulation={handleRunSimulation}
            simulationResult={simulationData}
            isLoading={isLoading}
          />

          <ResearchGuidance
            patientNumber={patientNumber}
            guidance={guidanceData}
            onGenerateGuidance={handleGenerateGuidance}
            isLoading={isGuidanceLoading}
            modelName={config?.ollama_model || 'qwen2.5-coder:1.5b (or deterministic summary)'}
          />
        </div>

        {/* Right Column (1 Col): 3D Digital Twins */}
        <div className="space-y-8">
          <TwinViewer
            title={`Current Patient #${patientNumber}`}
            twin={predictionData?.smpl ?? null}
            metadata={predictionData?.twin_metadata ?? null}
            patientNumber={patientNumber}
          />

          {simulationData && (
            <TwinViewer
              title={`Simulated Scenario Twin`}
              twin={simulationData.scenario_smpl}
              metadata={simulationData.scenario_twin_metadata}
              patientNumber={patientNumber}
            />
          )}
        </div>
      </div>

      {/* Full Width: Stage 4 Knowledge Graph */}
      <Stage4KnowledgeGraph
        patientNumber={patientNumber}
        graphData={graphData}
        isLoading={isGraphLoading}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 pt-6 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p>
          Explainable Diabetes Risk Digital Twin · Powered by CDC BRFSS 2015, SHAP, and Neo4j.
        </p>
        <p className="italic">
          Non-causal research demonstrator · Not a clinical device.
        </p>
      </footer>
    </div>
  );
};

export default App;
