import React from 'react';
import {
  ShieldAlert,
  TrendingUp,
  Activity,
  Heart,
  AlertCircle,
  CheckCircle2,
  Info,
  Layers,
} from 'lucide-react';
import type { RiskAssessmentResponse, XAIResponse } from '../types';

interface RiskAndXaiViewProps {
  riskData: RiskAssessmentResponse | null;
  xaiData: XAIResponse | null;
  patientName: string;
}

export const RiskAndXaiView: React.FC<RiskAndXaiViewProps> = ({
  riskData,
  xaiData,
  patientName,
}) => {
  if (!riskData) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
        Loading risk assessment...
      </div>
    );
  }

  const { composite_risk_pct, risk_category, risk_color, sub_risks, model_metadata } = riskData;

  return (
    <div className="space-y-6">
      {/* Top Banner: Composite Risk + Sub-Risks */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 pb-6">
          <div className="flex items-center gap-5">
            {/* Risk Gauge Visual */}
            <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  strokeWidth="3.8"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  strokeDasharray={`${composite_risk_pct}, 100`}
                  strokeWidth="3.8"
                  stroke={risk_color}
                  strokeLinecap="round"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-xl font-extrabold text-slate-900">{composite_risk_pct}%</span>
                <span className="text-[9px] uppercase tracking-wider text-slate-500">Risk</span>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Composite Longitudinal Complication Risk
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 mt-0.5">{patientName}</h2>
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className="px-2.5 py-0.5 rounded text-xs font-bold text-white shadow-sm"
                  style={{ backgroundColor: risk_color }}
                >
                  {risk_category}
                </span>
                <span className="text-xs text-slate-500">
                  Calibrated on ShanghaiT2DM repeated monitoring cohort
                </span>
              </div>
            </div>
          </div>

          {/* Model Architecture Metadata */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1 md:w-80">
            <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>{model_metadata.model_name}</span>
            </div>
            <div className="text-slate-500 text-[11px]">
              Architecture: <span className="text-slate-700">{model_metadata.model_architecture}</span>
            </div>
            <div className="text-slate-500 text-[11px]">
              Validation AUROC: <span className="font-semibold text-emerald-600">{model_metadata.validation_auroc}</span>
            </div>
          </div>
        </div>

        {/* 4 Multi-Dimensional Sub-Risk Cards */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Multi-System Complication Projections
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(sub_risks).map(([key, item]) => {
              const levelColor =
                item.level === 'High'
                  ? 'text-rose-600 bg-rose-50 border-rose-200'
                  : item.level === 'Moderate'
                  ? 'text-amber-600 bg-amber-50 border-amber-200'
                  : 'text-emerald-600 bg-emerald-50 border-emerald-200';

              return (
                <div
                  key={key}
                  className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs hover:border-blue-300 transition"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-800">{item.name}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${levelColor}`}>
                      {item.level}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-slate-900">
                      {Math.round(item.score * 100)}%
                    </span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                    Driver: <span className="font-medium text-slate-700">{item.key_driver}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Section: Explainable AI (SHAP Waterfall Attribution) */}
      {xaiData && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-600" />
                Explainable AI (XAI) Feature Attribution &amp; SHAP Decomposition
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Model interpretability via {xaiData.methodology}
              </p>
            </div>
            <div className="text-xs text-slate-500">
              Population Baseline Risk: <span className="font-semibold text-slate-700">{Math.round(xaiData.base_expected_value * 100)}%</span>
            </div>
          </div>

          {/* Clinical summary quote */}
          <div className="bg-purple-50/70 border border-purple-200 p-4 rounded-lg text-xs sm:text-sm text-purple-950 leading-relaxed">
            <span className="font-bold text-purple-900 block mb-1">Attribution Insight:</span>
            {xaiData.explanation_summary}
          </div>

          {/* Horizontal SHAP Contribution Bars */}
          <div className="space-y-3 pt-2">
            <div className="flex justify-between text-xs font-semibold text-slate-500 border-b border-slate-200 pb-2">
              <span>Clinical Biomarker &amp; Observation</span>
              <span>SHAP Value Impact on Risk</span>
            </div>

            {xaiData.contributions.map((item, idx) => {
              const isPositive = item.shap_value > 0;
              const barWidth = Math.min(100, Math.abs(item.shap_value) * 650);

              return (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-50/70 border border-slate-100 hover:border-slate-300 transition text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800">{item.label}</span>
                      <span className="text-slate-500 ml-2 font-medium">({item.value})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono font-bold ${
                          isPositive ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {isPositive ? `+${item.shap_value}` : item.shap_value}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          isPositive
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {item.impact}
                      </span>
                    </div>
                  </div>

                  {/* Visual Impact Bar */}
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden flex">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isPositive ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-slate-500">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
