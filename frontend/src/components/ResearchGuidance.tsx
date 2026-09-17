import React from 'react';
import { Bot, Sparkles, AlertCircle } from 'lucide-react';
import type { GuidanceResponse } from '../types';

interface ResearchGuidanceProps {
  patientNumber: number;
  guidance: GuidanceResponse | null;
  onGenerateGuidance: () => void;
  isLoading: boolean;
  modelName: string;
}

export const ResearchGuidance: React.FC<ResearchGuidanceProps> = ({
  patientNumber,
  guidance,
  onGenerateGuidance,
  isLoading,
  modelName,
}) => {
  return (
    <div className="rounded-xl bg-white border border-slate-200 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-indigo-600" />
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              AI Research Guidance · Safety Guardrailed
            </span>
            <h3 className="text-base font-bold text-slate-900">
              Structured Evidence Interpretation (Patient #{patientNumber})
            </h3>
          </div>
        </div>
        <button
          onClick={onGenerateGuidance}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {isLoading ? 'Synthesizing...' : 'Generate Guidance'}
        </button>
      </div>

      <p className="text-xs text-slate-600">
        Configured research model: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">{modelName}</code>.
        The system analyzes temporary SHAP factors and clinical categories, applying deterministic boundary guardrails.
      </p>

      {guidance ? (
        <div className="space-y-3 animate-fadeIn">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-line">
            {guidance.guidance}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>
              Source: <strong className="text-slate-600">{guidance.source}</strong>
            </span>
            {guidance.error && (
              <span className="text-amber-600 font-medium">{guidance.error}</span>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-500 text-center">
          Click "Generate Guidance" above to produce a research-safe interpretation of this patient's SHAP factors and risk indicators.
        </div>
      )}

      <div className="flex items-start gap-2 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 text-xs text-indigo-900">
        <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <p>
          <strong>Clinical Safety Protocol:</strong> Raw, unvalidated LLM output is never shown. All narrative text is constructed using verified statistical contributions and allowlisted clinical topics.
        </p>
      </div>
    </div>
  );
};
