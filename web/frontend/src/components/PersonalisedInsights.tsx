import React from 'react';
import {
  Lightbulb,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  TrendingDown,
  Heart,
  Activity,
  Flame,
} from 'lucide-react';
import type { InsightsResponse } from '../types';

interface PersonalisedInsightsProps {
  insights: InsightsResponse;
  patientName: string;
  onApplyScenario?: () => void;
}

export const PersonalisedInsights: React.FC<PersonalisedInsightsProps> = ({
  insights,
  patientName,
  onApplyScenario,
}) => {
  const { alert_level, alert_message, longitudinal_summary, recommendations, generated_by } =
    insights;

  const alertStyles = {
    urgent: 'bg-rose-50 border-rose-300 text-rose-900',
    warning: 'bg-amber-50 border-amber-300 text-amber-900',
    normal: 'bg-emerald-50 border-emerald-300 text-emerald-900',
  }[alert_level];

  const alertIcon = {
    urgent: <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
    normal: <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />,
  }[alert_level];

  const getCategoryIcon = (category: string) => {
    if (category.toLowerCase().includes('glycemic')) return <Activity className="w-4 h-4 text-blue-600" />;
    if (category.toLowerCase().includes('safety')) return <AlertTriangle className="w-4 h-4 text-rose-600" />;
    if (category.toLowerCase().includes('cardio')) return <Heart className="w-4 h-4 text-purple-600" />;
    return <Flame className="w-4 h-4 text-amber-600" />;
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'critical':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'high':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'medium':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      <div className={`p-4 rounded-xl border flex items-start gap-3 shadow-sm ${alertStyles}`}>
        {alertIcon}
        <div>
          <h4 className="text-sm font-bold capitalize">{alert_level} Clinical Status</h4>
          <p className="text-xs mt-0.5 opacity-90">{alert_message}</p>
        </div>
      </div>

      {/* Longitudinal Clinical Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm mb-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          <span>Patient-Centric Longitudinal Assessment</span>
        </div>
        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-100">
          {longitudinal_summary}
        </p>
      </div>

      {/* Actionable Recommendations Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Targeted Interventions &amp; Clinical Action Plan ({recommendations.length})
          </h3>
          {onApplyScenario && (
            <button
              onClick={onApplyScenario}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
            >
              Simulate in Digital Twin <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommendations.map((rec, index) => (
            <div
              key={index}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-blue-300 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                    {getCategoryIcon(rec.category)}
                    <span>{rec.category}</span>
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${getPriorityBadge(
                      rec.priority
                    )}`}
                  >
                    {rec.priority}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-slate-900 mb-1.5">{rec.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">{rec.detail}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Goal:</span>
                <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  {rec.target}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[11px] text-slate-400 text-right">
        Engine: <span className="font-medium text-slate-600">{generated_by}</span>
      </div>
    </div>
  );
};
