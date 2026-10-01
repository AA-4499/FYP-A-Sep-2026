/**
 * Dedicated Report Page
 * Comprehensive clinical report with summary, trends, risk, factors, what-if results, and PDF export.
 */
import React from 'react';
import { ArrowLeft, Printer, FileText, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';
import type { Patient, NavigationModule } from '../types';

interface ReportViewProps {
  patient: Patient;
  onNavigate: (module: NavigationModule) => void;
}

export const ReportView: React.FC<ReportViewProps> = ({ patient, onNavigate }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12 max-w-4xl mx-auto">
      {/* Top Action Bar (hidden when printing) */}
      <div className="flex items-center justify-between print:hidden">
        <button
          onClick={() => onNavigate('patients')}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-blue-600 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>

        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-xs transition"
        >
          <Printer className="w-4 h-4" />
          <span>Export / Print PDF</span>
        </button>
      </div>

      {/* Main Printable Dossier Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-8 sm:p-10 space-y-8 text-slate-900 print:border-none print:shadow-none print:p-0">
        {/* Report Header */}
        <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                ShanghaiT2DM Cohort Report
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-2">
              Clinical Health & Digital Twin Dossier
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated multi-system metabolic evaluation & counterfactual summary.
            </p>
          </div>

          <div className="text-right text-xs text-slate-500">
            <p className="font-semibold text-slate-800">Doc ID: REP-DT-{patient.id}-2026</p>
            <p>Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>

        {/* 1. Patient Profile Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Patient Identifier</span>
            <strong className="text-slate-900 font-bold text-sm">{patient.name} ({patient.id})</strong>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Condition / Age</span>
            <strong className="text-slate-900 font-bold text-sm">{patient.condition}, {patient.age}y</strong>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Longitudinal Visits</span>
            <strong className="text-slate-900 font-bold text-sm">{patient.visitsCount} Recorded Visits</strong>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Current Risk Score</span>
            <strong className="text-[#b91c1c] font-bold text-sm">{patient.currentRiskPct}% (Elevated)</strong>
          </div>
        </div>

        {/* 2. Key Metrics & Trends Across 14 Visits */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            1. Longitudinal Trends & Current Vitals
          </h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-xl border border-slate-100 bg-white">
              <span className="text-xs text-slate-500">Latest HbA1c</span>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{patient.hba1c}%</p>
              <span className="text-[10px] text-amber-700">Baseline was 6.9%</span>
            </div>
            <div className="p-3 rounded-xl border border-slate-100 bg-white">
              <span className="text-xs text-slate-500">Fasting Glucose</span>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{patient.fastingGlucose} mmol/L</p>
              <span className="text-[10px] text-slate-400">Target &lt; 7.0</span>
            </div>
            <div className="p-3 rounded-xl border border-slate-100 bg-white">
              <span className="text-xs text-slate-500">Body Mass Index (BMI)</span>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{patient.bmi} kg/m²</p>
              <span className="text-[10px] text-slate-400">Class I Overweight</span>
            </div>
          </div>
        </div>

        {/* 3. Explainable AI: Key Factor Attributions */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            2. Explainable AI (SHAP) Factor Breakdown
          </h2>
          <div className="space-y-2.5 text-xs">
            {patient.keyFactors.map((factor) => (
              <div key={factor.name} className="flex items-center justify-between gap-4">
                <span className="w-40 text-slate-700 font-medium">{factor.name}</span>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-[#c83232] h-2.5 rounded-full"
                    style={{ width: `${factor.value}%` }}
                  />
                </div>
                <span className="w-16 text-right font-bold text-slate-800">{factor.value}% impact</span>
              </div>
            ))}
          </div>
        </div>

        {/* 4. What-If Counterfactual Results */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
            3. What-If Simulation Findings
          </h2>
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">Indicator</th>
                  <th className="p-2.5">Current Baseline</th>
                  <th className="p-2.5">Simulated Target</th>
                  <th className="p-2.5">Projected Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="p-2.5 font-semibold">HbA1c</td>
                  <td className="p-2.5 text-slate-600">8.1%</td>
                  <td className="p-2.5 text-blue-600 font-semibold">7.0% (-1.1%)</td>
                  <td className="p-2.5 text-emerald-600 font-semibold">Microvascular risk drops 22%</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-semibold">Fasting Glucose</td>
                  <td className="p-2.5 text-slate-600">9.4 mmol/L</td>
                  <td className="p-2.5 text-blue-600 font-semibold">7.5 mmol/L</td>
                  <td className="p-2.5 text-emerald-600 font-semibold">Hepatic strain normalized</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-semibold">Complication Risk</td>
                  <td className="p-2.5 text-[#b91c1c] font-bold">68%</td>
                  <td className="p-2.5 text-[#1d4ed8] font-bold">43% (-25%)</td>
                  <td className="p-2.5 text-emerald-600 font-semibold">Shifted from High to Moderate</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-400 italic">
            * Note: Simulated results are calculated via prototype physiological approximations and are intended for illustration.
          </p>
        </div>

        {/* 5. Doctor Sign-Off Section */}
        <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-end gap-6 text-xs text-slate-500">
          <div>
            <p className="font-semibold text-slate-700">Clinical Attending Physician</p>
            <p>Endocrinology & Metabolic Health Clinic</p>
            <p className="text-[10px] text-slate-400 mt-1">Swinburne Sarawak FYP Study · Ts. Dr. Vong Wan Tze</p>
          </div>
          <div className="text-right">
            <div className="w-48 border-b border-slate-400 pb-1 mb-1 font-serif italic text-slate-800 text-sm">
              Dr. Alex Wong, MD
            </div>
            <p className="text-[10px] text-slate-400">Authorized Clinical Signature</p>
          </div>
        </div>
      </div>
    </div>
  );
};
