import React, { useEffect, useState } from 'react';
import {
  Printer,
  X,
  FileCheck,
  Building2,
  Calendar,
  AlertCircle,
  Activity,
  Heart,
  ShieldAlert,
} from 'lucide-react';
import { fetchPatientReport } from '../api/client';
import type { PatientReportResponse } from '../types';

interface PatientReportModalProps {
  patientId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const PatientReportModal: React.FC<PatientReportModalProps> = ({
  patientId,
  isOpen,
  onClose,
}) => {
  const [report, setReport] = useState<PatientReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    fetchPatientReport(patientId)
      .then((data) => setReport(data))
      .catch((err) => setError(err.message || 'Failed to generate report.'))
      .finally(() => setLoading(false));
  }, [isOpen, patientId]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Controls Header (Hidden on print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-800">
              Consolidated Patient Health Summary Report
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading || !report}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Printable Document */}
        <div className="p-8 overflow-y-auto space-y-6 print:p-0">
          {loading && (
            <div className="py-12 text-center text-slate-500 text-sm">
              Compiling multi-module clinical data and risk metrics...
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 text-rose-700 text-sm rounded-lg border border-rose-200">
              {error}
            </div>
          )}

          {report && (
            <div className="space-y-6 text-slate-800 print:text-black">
              {/* Report Letterhead */}
              <div className="border-b-2 border-blue-600 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-extrabold text-blue-900 tracking-tight">
                    SWINBURNE UNIVERSITY OF TECHNOLOGY SARAWAK
                  </h1>
                  <h2 className="text-sm font-semibold text-slate-700">
                    Smart Diabetes Digital Twin &amp; Personalised Health Management Platform
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Supervised by: <span className="font-medium text-slate-700">{report.supervision}</span>
                  </p>
                </div>
                <div className="text-left sm:text-right text-xs text-slate-600 space-y-0.5">
                  <div className="font-bold text-slate-900">{report.report_id}</div>
                  <div>Generated: {report.generated_at}</div>
                  <div className="text-emerald-700 font-semibold">ShanghaiT2DM Cohort</div>
                </div>
              </div>

              {/* Patient Demographics Banner */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Patient Identifier:</span>
                  <span className="font-bold text-slate-900 text-sm">Patient #{report.patient_profile.id}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Age / Gender:</span>
                  <span className="font-semibold text-slate-800">
                    {report.patient_profile.age} yrs / {report.patient_profile.gender}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">BMI / Duration:</span>
                  <span className="font-semibold text-slate-800">
                    {report.patient_profile.bmi} kg/m² ({report.patient_profile.diabetes_duration_years} yrs T2D)
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Blood Pressure / eGFR:</span>
                  <span className="font-semibold text-slate-800">
                    {report.patient_profile.systolic_bp}/{report.patient_profile.diastolic_bp} mmHg ({report.patient_profile.egfr} mL/min)
                  </span>
                </div>
              </div>

              {/* Longitudinal CGM Summary */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1.5 mb-3 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-blue-600" />
                  1. Longitudinal Glycemic Dynamics (14-Day CGM)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">Mean Sensor Glucose:</span>
                    <span className="text-base font-bold text-blue-600">
                      {report.longitudinal_summary.average_glucose} mmol/L
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">Time in Range (TIR):</span>
                    <span className="text-base font-bold text-emerald-600">
                      {report.longitudinal_summary.time_in_range_pct}%
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">Time Below Range (TBR):</span>
                    <span className="text-base font-bold text-rose-600">
                      {report.longitudinal_summary.time_below_range_pct}%
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">Glucose Management Ind.:</span>
                    <span className="text-base font-bold text-slate-800">
                      {report.longitudinal_summary.glucose_management_indicator}% HbA1c
                    </span>
                  </div>
                </div>
              </div>

              {/* Multi-Dimensional Risk Evaluation */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1.5 mb-3 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  2. Multi-Dimensional Complication Risk Evaluation
                </h3>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 block">Overall Complication Risk Score:</span>
                    <span className="text-lg font-extrabold text-slate-900">
                      {report.risk_evaluation.composite_risk_pct}%
                    </span>
                  </div>
                  <span className="px-3 py-1 bg-slate-200 rounded-md font-bold text-slate-800 text-xs">
                    {report.risk_evaluation.risk_category}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {Object.entries(report.risk_evaluation.sub_risks).map(([key, item]) => (
                    <div key={key} className="p-2.5 rounded border border-slate-200 flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-slate-800 block">{item.name}</span>
                        <span className="text-[11px] text-slate-500">{item.key_driver}</span>
                      </div>
                      <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {item.level} ({Math.round(item.score * 100)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Explainable AI Top Driving Factors */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1.5 mb-2 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-purple-600" />
                  3. Key Risk Factors &amp; XAI Attribution (SHAP)
                </h3>
                <p className="text-xs text-slate-600 mb-3">{report.explainable_ai.summary}</p>
                <div className="space-y-1.5 text-xs">
                  {report.explainable_ai.top_factors.map((f, i) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                      <div>
                        <span className="font-medium text-slate-800">{f.label}</span>
                        <span className="text-slate-500 ml-2">({f.value})</span>
                      </div>
                      <span
                        className={`font-semibold ${
                          f.shap_value > 0 ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {f.shap_value > 0 ? `+${f.shap_value}` : f.shap_value} SHAP ({f.impact})
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Multi-Organ Digital Twin State */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1.5 mb-2 flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-rose-600" />
                  4. Digital Twin Multi-Organ Stress Status
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {Object.entries(report.digital_twin.organs).map(([k, organ]) => (
                    <div key={k} className="p-2.5 rounded border border-slate-200 bg-slate-50">
                      <span className="font-semibold block text-slate-800">{organ.name}</span>
                      <span className="text-[11px] text-slate-500 block">{organ.status}</span>
                      <span className="font-bold text-slate-900 mt-1 block">Stress: {organ.stress_score}/100</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Targeted Clinical Recommendations */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1.5 mb-2">
                  5. Actionable Personalised Interventions
                </h3>
                <div className="space-y-2 text-xs">
                  {report.clinical_insights.recommendations.map((rec, i) => (
                    <div key={i} className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                      <div className="flex justify-between font-semibold text-slate-900">
                        <span>{rec.title}</span>
                        <span className="text-blue-700">Target: {rec.target}</span>
                      </div>
                      <p className="text-slate-600 mt-1 leading-relaxed">{rec.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sign-off */}
              <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
                <span>Verification: {report.clinical_sign_off.status}</span>
                <span>{report.institution}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
