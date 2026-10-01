/**
 * Comprehensive Landing / Home Page for DiabeTwin Platform.
 * Introduces the platform, highlights core AI & Digital Twin innovations, and provides dual-persona entry points.
 * Swinburne University of Technology Sarawak · Ts. Dr. Vong Wan Tze
 */
import React from 'react';
import {
  Activity,
  User,
  ShieldCheck,
  Stethoscope,
  Sparkles,
  ArrowRight,
  TrendingUp,
  BrainCircuit,
  Sliders,
  Share2,
  FileText,
  CheckCircle2,
  Heart,
  BarChart3,
  Dna,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { PlatformPage } from '../types';

interface HomePageProps {
  onNavigate: (page: PlatformPage) => void;
  onSelectPatient: (patientId: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, onSelectPatient }) => {
  const { loginAsDemo } = useAuth();

  const handleLaunchPatient = (patientId = '1001') => {
    loginAsDemo('patient_1001');
    onSelectPatient(patientId);
    onNavigate('patient_portal');
  };

  const handleLaunchAdmin = () => {
    loginAsDemo('admin_clinician');
    onNavigate('admin_portal');
  };

  const handleLaunchWorkspace = () => {
    loginAsDemo('admin_clinician');
    onNavigate('workspace');
  };

  return (
    <div className="space-y-16 animate-fadeIn pb-12">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white p-8 sm:p-12 lg:p-16 border border-blue-900/50 shadow-2xl">
        {/* Ambient Decorative Blurs */}
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl space-y-6">
          {/* Academic Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-semibold backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            <span>Swinburne Sarawak FYP · ShanghaiT2DM Longitudinal Cohort</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
            Explainable Diabetes <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-teal-300 to-indigo-300">
              Digital Twin Platform
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-3xl leading-relaxed">
            Bridging longitudinal continuous glucose monitoring (CGM), tree-based SHAP explainable AI, and multi-organ physiological simulations to deliver personalized care for patients and population-level decision support for clinicians.
          </p>

          {/* Supervisor attribution */}
          <p className="text-xs text-slate-400 flex items-center gap-2">
            <span>Academic Supervision:</span>
            <strong className="text-slate-200">Ts. Dr. Vong Wan Tze</strong>
            <span>· Faculty of Engineering, Computing & Science</span>
          </p>

          {/* CTA Buttons */}
          <div className="pt-2 flex flex-wrap items-center gap-3 sm:gap-4">
            <button
              onClick={() => handleLaunchPatient('1001')}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <User className="w-4 h-4" />
              <span>Enter Patient Portal</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <button
              onClick={handleLaunchAdmin}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-sm backdrop-blur-sm transition transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Clinician & Admin Center</span>
            </button>

            <button
              onClick={handleLaunchWorkspace}
              className="flex items-center gap-2 px-5 py-3.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 font-semibold text-sm transition"
            >
              <Stethoscope className="w-4 h-4 text-teal-400" />
              <span>Clinical Workspace</span>
            </button>
          </div>

          {/* Key Metrics Strip */}
          <div className="pt-8 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 text-left">
            <div>
              <p className="text-2xl sm:text-3xl font-black text-white">112</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">ShanghaiT2DM Patients</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black text-blue-400">94.2%</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">XGBoost Complication AUC</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black text-teal-400">14 Days</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Continuous CGM Telemetry</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black text-indigo-400">&lt; 50ms</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Sub-second TreeSHAP XAI</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. DUAL PERSONA ARCHITECTURE (Patient vs Admin) */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Tailored User Experiences
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Two Specialized Portals in One Platform
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Designed to meet the unique needs of individuals managing their health and medical professionals overseeing cohort care.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card 1: Patient Persona */}
          <div className="relative rounded-2xl bg-white border border-slate-200 p-8 shadow-sm hover:shadow-md transition space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <User className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-blue-700 bg-blue-100/70 px-3 py-1 rounded-full">
                  For Patients & Families
                </span>
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900">Personal Patient Portal</h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                  A personalized, encouraging wellness hub where patients monitor continuous glucose trends, interact with their digital twin body avatar, complete daily lifestyle goals, and simulate how small habits impact their HbA1c.
                </p>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-700 pt-2">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Live Glucose & Time-In-Range (TIR):</strong> 24h diurnal curve with target zones.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Interactive Organ Status:</strong> Visual feedback on Pancreas, Kidneys, Heart, and Retina health.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Daily Action Checklist:</strong> Check off nutrition, post-meal walks, and medication doses.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Personal What-If Simulator:</strong> See how +30 mins walking drops HbA1c and lowers risk.</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => handleLaunchPatient('1001')}
              className="w-full py-3 px-4 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white font-bold text-xs transition flex items-center justify-center gap-2 group"
            >
              <span>Explore Patient View (Chen Wei #1001)</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </button>
          </div>

          {/* Card 2: Clinician / Admin Persona */}
          <div className="relative rounded-2xl bg-white border border-slate-200 p-8 shadow-sm hover:shadow-md transition space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-100/70 px-3 py-1 rounded-full">
                  For Clinicians & Administrators
                </span>
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900">Admin & Clinical Command Center</h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                  A high-level command center for endocrinologists and clinic administrators to stratify cohort risk, inspect population metrics, audit automated clinical alerts, monitor AI model health, and launch deep patient analyses.
                </p>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-700 pt-2">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <span><strong>Cohort Risk Stratification:</strong> Filter 112 patients into High, Moderate, and Low risk tiers.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <span><strong>AI Model Telemetry:</strong> Live monitoring of XGBoost AUROC, calibration, and inference latencies.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <span><strong>Automated Clinical Alerts:</strong> Immediate notification of nocturnal hypoglycemia or high CV%.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <span><strong>Clinical Workspace Integration:</strong> Jump directly into any patient's 6-module diagnostic suite.</span>
                </li>
              </ul>
            </div>

            <button
              onClick={handleLaunchAdmin}
              className="w-full py-3 px-4 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white font-bold text-xs transition flex items-center justify-center gap-2 group"
            >
              <span>Explore Admin Portal (Dr. Alex Wong)</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </button>
          </div>
        </div>
      </section>

      {/* 3. SIX CORE PLATFORM INNOVATIONS */}
      <section className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
            Technological Architecture
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Six Interconnected Clinical AI Modules
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            A comprehensive pipeline transforming continuous physiological telemetry into actionable, transparent clinical decisions.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Module 1 */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-blue-300 transition space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Dna className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Physiological Digital Twin</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Biomechanical and metabolic ODE models calculating beta-cell exhaustion, systemic vascular resistance, and glomerular filtration strain.
            </p>
          </div>

          {/* Module 2 */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-blue-300 transition space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Longitudinal CGM Telemetry</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Automated 14-day continuous glucose curves, calculating Time in Range (TIR), Glycemic Management Indicator (GMI), and nocturnal nadir dips.
            </p>
          </div>

          {/* Module 3 */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-blue-300 transition space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Explainable AI (TreeSHAP)</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Replaces black-box predictions with rigorous Shapley Additive Explanations, revealing exact risk contributors for every patient.
            </p>
          </div>

          {/* Module 4 */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-blue-300 transition space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">What-If Counterfactual Sandbox</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Simulate dietary carbohydrate reduction, exercise increases, and drug titrations to preview projected HbA1c before altering prescriptions.
            </p>
          </div>

          {/* Module 5 */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-blue-300 transition space-y-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Biomedical Knowledge Graph</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Interactive Cytoscape network mapping patient clinical findings to SNOMED-CT, MeSH, and ADA/EASD evidence-based guidelines.
            </p>
          </div>

          {/* Module 6 */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-blue-300 transition space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Consolidated Clinical Reports</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              One-click compilation of comprehensive clinical dossiers with longitudinal history, risk stratifications, and doctor sign-off.
            </p>
          </div>
        </div>
      </section>

      {/* 4. QUICK TEST-DRIVE COHORT PATIENTS */}
      <section className="bg-slate-100 rounded-3xl p-8 border border-slate-200 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Explore ShanghaiT2DM Cohort Patients
            </h3>
            <p className="text-xs text-slate-600">
              Select any patient profile below to load their complete longitudinal CGM telemetry, digital twin, and risk predictions.
            </p>
          </div>
          <button
            onClick={handleLaunchWorkspace}
            className="self-start sm:self-auto text-xs font-bold text-blue-700 bg-white px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition shadow-2xs"
          >
            Open Full Patient Directory
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { id: '1001', name: 'Chen Wei', age: 62, hba1c: '7.4%', risk: 'Moderate Risk', riskColor: 'bg-amber-100 text-amber-800' },
            { id: '1002', name: 'Lin Na', age: 54, hba1c: '8.6%', risk: 'High Risk', riskColor: 'bg-rose-100 text-rose-800' },
            { id: '1003', name: 'Zhang Yong', age: 48, hba1c: '6.3%', risk: 'Controlled', riskColor: 'bg-emerald-100 text-emerald-800' },
            { id: '1004', name: 'Liu Kang', age: 71, hba1c: '8.1%', risk: 'High Risk', riskColor: 'bg-rose-100 text-rose-800' },
          ].map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-white border border-slate-200 hover:border-blue-400 transition cursor-pointer shadow-2xs space-y-3"
              onClick={() => handleLaunchPatient(item.id)}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Patient #{item.id}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.riskColor}`}>
                  {item.risk}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-800">{item.name}</p>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                <span>Age: {item.age}</span>
                <span>HbA1c: <strong className="text-slate-700">{item.hba1c}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
