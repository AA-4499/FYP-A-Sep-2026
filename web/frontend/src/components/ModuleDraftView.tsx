/**
 * Clean Modular Draft Views for specific sidebar items:
 * - Monitoring
 * - Risk
 * - Explain AI
 * - Knowledge graph
 * - What-if
 */
import React from 'react';
import { ArrowLeft, Activity, ShieldAlert, Sparkles, Share2, Sliders, Dna, Info } from 'lucide-react';
import type { Patient, NavigationModule } from '../types';

interface ModuleDraftViewProps {
  module: NavigationModule;
  patient: Patient;
  onNavigate: (module: NavigationModule) => void;
}

export const ModuleDraftView: React.FC<ModuleDraftViewProps> = ({
  module,
  patient,
  onNavigate,
}) => {
  const meta: Record<string, { title: string; subtitle: string; icon: any; draftNote: string }> = {
    monitoring: {
      title: 'Continuous Glucose Monitoring & Telemetry',
      subtitle: `Longitudinal CGM sensor data for ${patient.name} (${patient.id}).`,
      icon: Activity,
      draftNote: 'Expanded 14-day high-frequency CGM telemetry stream, diurnal modal day, and nocturnal hypoglycemia curves. Modular plug-in ready for Abbott FreeStyle Libre / Dexcom API.',
    },
    risk: {
      title: 'Complication Risk Stratification Engine',
      subtitle: `Multi-system risk evaluation for ${patient.name} (${patient.id}).`,
      icon: ShieldAlert,
      draftNote: 'Composite risk score is 68%. Multi-system breakdown: Glycemic Variability (High), Cardiovascular (Moderate), Nephropathy (Moderate). Calibrated against ShanghaiT2DM longitudinal cohort.',
    },
    explain_ai: {
      title: 'Explainable AI & TreeSHAP Feature Attributions',
      subtitle: `Mathematical Shapley value attributions for ${patient.name} (${patient.id}).`,
      icon: Sparkles,
      draftNote: 'TreeSHAP additive feature contributions explain why current risk is 68%. Top positive contributors: HbA1c (+0.22), Fasting Glucose (+0.14), BMI (+0.08). Negative mitigators: Renal eGFR (-0.04).',
    },
    knowledge_graph: {
      title: 'Biomedical Knowledge Graph & Clinical Ontologies',
      subtitle: `Graph ontology relations for ${patient.name} (${patient.id}).`,
      icon: Share2,
      draftNote: 'Cytoscape.js / Neo4j graph connecting Patient P07 to Biomarkers (HbA1c, FBG), Vital Signs (BP, BMI), Medications, and Clinical Guidelines (ADA/EASD Standards of Care).',
    },
    what_if: {
      title: 'Counterfactual What-If Simulation Sandbox',
      subtitle: `Targeted intervention modeling for ${patient.name} (${patient.id}).`,
      icon: Sliders,
      draftNote: 'Dynamic perturbation sandbox. Adjusting HbA1c from 8.1% to 7.0%, fasting glucose to 7.5 mmol/L, and BMI to 24.5 lowers projected complication risk from 68% to 43%.',
    },
  };

  const currentMeta = meta[module] || {
    title: `${module} Module`,
    subtitle: `Module draft for ${patient.name}.`,
    icon: Info,
    draftNote: 'Modular slot ready for extended models and data pipelines.',
  };

  const Icon = currentMeta.icon;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('patients')}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-blue-600 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Main Dashboard</span>
        </button>

        <span className="text-xs text-slate-400 font-medium">
          Module: <strong className="text-slate-700 capitalize">{module.replace('_', ' ')}</strong>
        </span>
      </div>

      {/* Draft Container Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-8 sm:p-10 space-y-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
            <Icon className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900">{currentMeta.title}</h2>
            <p className="text-xs sm:text-sm text-slate-500">{currentMeta.subtitle}</p>
          </div>
        </div>

        {/* Content Box */}
        <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wide">
            <Info className="w-4 h-4 text-blue-600" />
            <span>Architecture & Module Overview</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {currentMeta.draftNote}
          </p>
        </div>

        {/* Quick Return Action */}
        <div className="pt-4 flex items-center justify-between border-t border-slate-100">
          <span className="text-xs text-slate-400">
            Current Loaded Patient: <strong className="text-slate-700">{patient.name} ({patient.id})</strong>
          </span>
          <button
            onClick={() => onNavigate('patients')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-xs"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
