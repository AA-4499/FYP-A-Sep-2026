import React from 'react';
import { Target, Activity } from 'lucide-react';
import type { PredictionResult } from '../types';

interface Stage1PredictionProps {
  patientNumber: number;
  prediction: PredictionResult | null;
  modelName: string;
}

export const Stage1Prediction: React.FC<Stage1PredictionProps> = ({
  patientNumber,
  prediction,
  modelName,
}) => {
  if (!prediction) {
    return (
      <div className="rounded-xl bg-white border border-slate-200 p-6 text-center text-slate-500">
        Load a patient to display Stage 1 model prediction probabilities.
      </div>
    );
  }

  const isHigh = prediction.predicted_class === 2;
  const isMedium = prediction.predicted_class === 1;

  const badgeColor = isHigh
    ? 'bg-rose-100 text-rose-800 border-rose-200'
    : isMedium
    ? 'bg-amber-100 text-amber-800 border-amber-200'
    : 'bg-emerald-100 text-emerald-800 border-emerald-200';

  return (
    <div className="rounded-xl bg-white border border-slate-200 p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-600" />
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Stage 1 · Multi-Class Risk Estimation
            </span>
            <h2 className="text-base font-bold text-slate-900">
              Patient #{patientNumber} Classification
            </h2>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${badgeColor}`}>
          Predicted: {prediction.label}
        </span>
      </div>

      <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 font-medium">Estimated High (Diabetes) Risk</p>
          <p className="text-2xl font-black text-slate-900 mt-0.5">
            {(prediction.high_risk_probability * 100).toFixed(1)}%
          </p>
        </div>
        <div className="text-right">
          <span className="text-[11px] text-slate-500 block">Model Architecture</span>
          <span className="text-xs font-semibold text-slate-700">{modelName}</span>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Estimated Class Probabilities
        </h4>
        {prediction.probabilities.map((prob) => {
          const isSelected = prob.class_id === prediction.predicted_class;
          return (
            <div key={prob.class_id} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className={isSelected ? 'font-bold text-slate-900' : 'text-slate-600'}>
                  {prob.label} {isSelected && '(Predicted Class)'}
                </span>
                <span className="font-bold text-slate-800">
                  {(prob.value * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    prob.class_id === 2
                      ? 'bg-rose-500'
                      : prob.class_id === 1
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.max(1, prob.value * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-400 italic pt-2 border-t border-slate-100">
        Probabilities represent random forest vote shares across 400 trees with balanced subsampling.
      </p>
    </div>
  );
};
