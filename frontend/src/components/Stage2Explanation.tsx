import React from 'react';
import { BarChart3, Info } from 'lucide-react';
import type { ShapFactor } from '../types';

interface Stage2ExplanationProps {
  patientNumber: number;
  factors: ShapFactor[];
  predictedLabel: string;
}

export const Stage2Explanation: React.FC<Stage2ExplanationProps> = ({
  patientNumber,
  factors,
  predictedLabel,
}) => {
  if (!factors || factors.length === 0) {
    return null;
  }

  // Find max absolute SHAP value for scaling bars
  const maxAbs = Math.max(...factors.map((f) => Math.abs(f.shap_value)), 0.05);

  return (
    <div className="rounded-xl bg-white border border-slate-200 p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-600" />
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Stage 2 · Exact SHAP Interpretability
            </span>
            <h2 className="text-base font-bold text-slate-900">
              Dominant Factors for "{predictedLabel}"
            </h2>
          </div>
        </div>
        <span className="text-xs text-slate-500">Top {factors.length} Contributors</span>
      </div>

      <p className="text-xs text-slate-600 leading-relaxed">
        Calculated using exact tree paths. Positive values increase support for <strong>{predictedLabel}</strong>, while negative values decrease support.
      </p>

      {/* Factor Bars */}
      <div className="space-y-3 pt-1">
        {factors.map((factor) => {
          const isPositive = factor.shap_value >= 0;
          const percentage = Math.min(100, (Math.abs(factor.shap_value) / maxAbs) * 100);

          return (
            <div key={factor.feature} className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-800">
                  {factor.feature}{' '}
                  <span className="font-normal text-slate-500">
                    (value: {Number.isInteger(factor.value) ? factor.value : factor.value.toFixed(1)})
                  </span>
                </span>
                <span
                  className={`font-mono font-bold ${
                    isPositive ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {isPositive ? '+' : ''}
                  {factor.shap_value.toFixed(4)}
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isPositive ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.max(2, percentage)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 flex items-start gap-2 text-xs text-slate-500">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <span>
          SHAP values isolate how much each survey input shifted the model's log-odds output away from the base population rate. They do not demonstrate medical causation or intervention efficacy.
        </span>
      </div>
    </div>
  );
};
