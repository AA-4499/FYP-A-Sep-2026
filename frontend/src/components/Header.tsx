import React, { useState } from 'react';
import {
  ShieldAlert,
  HelpCircle,
  Activity,
  ChevronDown,
  ChevronUp,
  FileText,
  GraduationCap,
} from 'lucide-react';

interface HeaderProps {
  isBackendHealthy: boolean | null;
  datasetName: string;
  onOpenReport: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isBackendHealthy,
  datasetName,
  onOpenReport,
}) => {
  const [showGuide, setShowGuide] = useState(false);

  return (
    <header className="mb-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
              <GraduationCap className="w-3.5 h-3.5" />
              Swinburne University of Technology Sarawak · FYP
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
                ? 'Backend Connected (ShanghaiT2DM)'
                : isBackendHealthy === false
                ? 'Backend Offline'
                : 'Connecting API...'}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-2">
            Smart Diabetes Digital Twin Platform
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Personalised health management platform integrating repeated continuous glucose monitoring (CGM), longitudinal complication risk modeling, exact XAI attribution, and multi-organ what-if simulations.
            <br />
            <span className="text-[11px] text-slate-500">
              Supervised by: <strong className="text-slate-700">Ts. Dr. Vong Wan Tze</strong>
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={onOpenReport}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm"
          >
            <FileText className="w-4 h-4" />
            <span>Generate Patient Report</span>
          </button>

          <button
            onClick={() => setShowGuide(!showGuide)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <HelpCircle className="w-4 h-4 text-blue-600" />
            <span>{showGuide ? 'Hide Workflow' : 'Clinical Workflow'}</span>
            {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Clinical Research Disclaimer */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-amber-900 text-xs flex items-start gap-3 shadow-xs">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold text-amber-800">
            Clinical Research Prototype Disclaimer (ShanghaiT2DM Cohort)
          </p>
          <p className="leading-relaxed text-[11px] opacity-90">
            This digital twin platform is an academic research demonstration for diabetes management. Longitudinal CGM measurements, risk projections, and counterfactual simulations are generated for clinical decision support study and do not constitute an autonomous medical device.
          </p>
        </div>
      </div>

      {/* 9-Step Clinical Workflow Guide */}
      {showGuide && (
        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm space-y-3 animate-fadeIn text-xs">
          <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
            <h3 className="font-bold text-slate-900 tracking-wide">
              9-Step End-to-End Clinical Digital Twin Workflow
            </h3>
            <span className="text-[11px] text-slate-500">Cohort: {datasetName}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="font-bold text-blue-700 block mb-0.5">1. Select Patient</span>
              Browse and select from 105 longitudinal ShanghaiT2DM patient profiles.
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="font-bold text-blue-700 block mb-0.5">2. View Health History</span>
              Analyze 14-day CGM glucose trends, Time-in-Range (TIR), and historical checkups.
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="font-bold text-blue-700 block mb-0.5">3. Assess Current Risk</span>
              Evaluate multi-system risk (glycemic instability, cardiovascular, nephropathy, hypoglycemia).
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="font-bold text-blue-700 block mb-0.5">4. Understand Key Factors</span>
              Inspect patient-specific SHAP attribution bars quantifying what drives their risk.
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="font-bold text-blue-700 block mb-0.5">5. Explore Insights</span>
              Review actionable clinical advice, lifestyle goals, and patient safety alerts.
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="font-bold text-blue-700 block mb-0.5">6. View Digital Twin</span>
              Examine multi-organ physiological status (pancreas, heart, kidneys, liver).
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="font-bold text-blue-700 block mb-0.5">7. Create What-If Scenario</span>
              Perturb lifestyle, diet, exercise, and clinical targets in the counterfactual simulator.
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="font-bold text-blue-700 block mb-0.5">8. Compare Outcomes</span>
              Evaluate projected risk reduction and organ stress improvement side-by-side.
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="font-bold text-blue-700 block mb-0.5">9. Generate Report</span>
              Export and print a consolidated, comprehensive medical summary for clinical review.
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
