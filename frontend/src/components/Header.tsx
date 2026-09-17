import React, { useState } from 'react';
import { ShieldAlert, HelpCircle, Activity, ChevronDown, ChevronUp } from 'lucide-react';

interface HeaderProps {
  isBackendHealthy: boolean | null;
  datasetName: string;
}

export const Header: React.FC<HeaderProps> = ({ isBackendHealthy, datasetName }) => {
  const [showGuide, setShowGuide] = useState(false);

  return (
    <header className="mb-8 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
              Research Prototype · Stages 1–4
            </span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${
                isBackendHealthy === true
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : isBackendHealthy === false
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <Activity className="w-3 h-3 animate-pulse" />
              {isBackendHealthy === true
                ? 'Backend API Connected'
                : isBackendHealthy === false
                ? 'Backend Offline'
                : 'Connecting API...'}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-2">
            Explainable Diabetes Risk Digital Twin
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Multi-stage clinical machine learning, exact SHAP interpretability, counterfactual what-if simulation, Neo4j knowledge graph, and 3D avatar representation.
          </p>
        </div>

        <button
          onClick={() => setShowGuide(!showGuide)}
          className="self-start md:self-auto inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition shadow-sm"
        >
          <HelpCircle className="w-4 h-4 text-blue-600" />
          <span>{showGuide ? 'Hide User Guide' : 'How to Use This System'}</span>
          {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Strict Ethical & Medical Research Notice */}
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-900 text-xs flex items-start gap-3 shadow-sm">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold uppercase tracking-wide text-amber-800">
            Strict Medical Research Boundary & Disclaimer
          </p>
          <p className="leading-relaxed">
            This project is for research and demonstration only. It is <strong>not</strong> a medical device, clinical diagnostic tool, or treatment recommendation system. 
            CDC BRFSS data is cross-sectional; predictions and SHAP values describe statistical model associations, not clinical causes or intervention outcomes.
          </p>
        </div>
      </div>

      {/* Collapsible How-to-Use Guide */}
      {showGuide && (
        <div className="rounded-xl bg-white border border-slate-200 p-6 shadow-sm space-y-4 animate-fadeIn">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm tracking-wide uppercase">
              System Workflow & Step-by-Step Instructions
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Active dataset: <strong>{datasetName}</strong>
            </p>
          </div>
          <ol className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700">
            <li className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <strong className="text-slate-900 block font-semibold mb-1">1. Select a Patient</strong>
              Enter a patient number or click "Use" in the dataset table to load all 21 BRFSS features.
            </li>
            <li className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <strong className="text-slate-900 block font-semibold mb-1">2. Review Stage 1 (Prediction)</strong>
              Examine the estimated probabilities for Low, Medium (prediabetes), and High (diabetes) risk categories.
            </li>
            <li className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <strong className="text-slate-900 block font-semibold mb-1">3. Inspect Stage 2 (Explanation)</strong>
              Study patient-specific exact SHAP values that pushed the model towards its predicted class.
            </li>
            <li className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <strong className="text-slate-900 block font-semibold mb-1">4. Simulate Stage 3 (What-If)</strong>
              Modify lifestyle or clinical variables (e.g. BMI, physical activity) to compare simulated risk deltas side-by-side.
            </li>
            <li className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <strong className="text-slate-900 block font-semibold mb-1">5. Inspect 3D Digital Twin</strong>
              Rotate and zoom the SMPL-derived body avatar colored according to the patient's predicted high-risk probability.
            </li>
            <li className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <strong className="text-slate-900 block font-semibold mb-1">6. Explore Stage 4 (Knowledge Graph)</strong>
              Interact with the multi-domain ontology graph connecting observations, states, SHAP directions, and model evaluations.
            </li>
          </ol>
        </div>
      )}
    </header>
  );
};
