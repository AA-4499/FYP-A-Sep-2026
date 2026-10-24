import React, { useState } from 'react';
import {
  Sliders,
  CheckCircle2,
  Database,
  Layers,
  Save,
  RotateCcw,
  Sparkles,
  Info,
  HelpCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { TWIN_INDICATOR_RULES } from '../../data/adminData';
import type { TwinIndicatorRule } from '../../types';

export const AdminTwinConfigView: React.FC = () => {
  const [rules, setRules] = useState<TwinIndicatorRule[]>(TWIN_INDICATOR_RULES);
  const [isSaved, setIsSaved] = useState(false);

  // Simulation algorithm parameters
  const [insulinSensitivity, setInsulinSensitivity] = useState(1.8);
  const [bmiProgressionFactor, setBmiProgressionFactor] = useState(0.42);
  const [decayHalfLifeDays, setDecayHalfLifeDays] = useState(28);
  const [aggregationWindow, setAggregationWindow] = useState<'Rolling 14-day' | 'Rolling 30-day' | 'Full Cohort History'>('Rolling 14-day');

  const toggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const updateWeight = (id: string, newWeight: number) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, weight: newWeight } : r))
    );
  };

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleReset = () => {
    setRules(TWIN_INDICATOR_RULES);
    setInsulinSensitivity(1.8);
    setBmiProgressionFactor(0.42);
    setDecayHalfLifeDays(28);
  };

  const totalWeight = rules
    .filter((r) => r.enabled)
    .reduce((sum, r) => sum + r.weight, 0);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
              Model Calibration & Indicators
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            Digital Twin Model Configuration
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Configure biomarker weighting, source dataset schema mappings, and mathematical simulation parameters for patient twins.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/90 text-slate-600 font-semibold text-xs flex items-center gap-2 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>

      {isSaved && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Digital Twin algorithm parameters and indicator weights updated successfully across all inference pipelines.</span>
        </div>
      )}

      {/* 2. Indicator Mapping Checklist */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Biomarker Indicator Weights & Source Mapping</h3>
            <p className="text-[11px] text-slate-400">
              Tune how much each observation stream influences the multi-organ digital twin simulation
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Total Active Weight:</span>
            <span
              className={`px-2.5 py-1 rounded-md text-xs font-bold font-mono ${
                Math.abs(totalWeight - 1.0) < 0.05
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {(totalWeight * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {rules.map((rule) => (
            <div key={rule.id} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleRule(rule.id)}
                  className="mt-0.5 text-blue-600 hover:text-blue-700 transition"
                >
                  {rule.enabled ? (
                    <ToggleRight className="w-6 h-6 text-blue-600" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-slate-300" />
                  )}
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <strong className={`font-semibold ${rule.enabled ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                      {rule.indicator}
                    </strong>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px]">
                      {rule.timeWindow}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>Source: <strong className="text-slate-600">{rule.sourceDataset}</strong></span>
                    <span>·</span>
                    <span>Algorithm: <span className="font-mono text-slate-500">{rule.algorithm}</span></span>
                  </div>
                </div>
              </div>

              {/* Slider for Weight */}
              <div className="flex items-center gap-3 w-full md:w-64">
                <input
                  type="range"
                  min="0"
                  max="0.6"
                  step="0.01"
                  disabled={!rule.enabled}
                  value={rule.weight}
                  onChange={(e) => updateWeight(rule.id, parseFloat(e.target.value))}
                  className="w-full accent-blue-600 disabled:opacity-30 cursor-pointer"
                />
                <span className="font-mono font-bold text-slate-700 w-12 text-right">
                  {(rule.weight * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Simulation Parameters & Rule Bounds */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">What-If Simulation Mathematical Constants</h3>
            <p className="text-[11px] text-slate-400">Baseline coefficients for predictive glucose response curves</p>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <label className="font-semibold text-slate-700">Insulin Sensitivity Factor (ISF)</label>
                <span className="font-mono text-blue-600 font-bold">{insulinSensitivity} mmol/L per U</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="4.0"
                step="0.1"
                value={insulinSensitivity}
                onChange={(e) => setInsulinSensitivity(parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
              <span className="text-[10px] text-slate-400">Controls predicted glucose reduction per unit of rapid-acting insulin.</span>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="font-semibold text-slate-700">BMI Weight Reduction Coefficient</label>
                <span className="font-mono text-blue-600 font-bold">{bmiProgressionFactor} ΔHbA1c / kg</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.02"
                value={bmiProgressionFactor}
                onChange={(e) => setBmiProgressionFactor(parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
              <span className="text-[10px] text-slate-400">Calculates predicted HbA1c drop per kilogram of weight loss.</span>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="font-semibold text-slate-700">Historical Biomarker Exponential Half-Life</label>
                <span className="font-mono text-blue-600 font-bold">{decayHalfLifeDays} days</span>
              </div>
              <input
                type="range"
                min="7"
                max="90"
                step="1"
                value={decayHalfLifeDays}
                onChange={(e) => setDecayHalfLifeDays(parseInt(e.target.value))}
                className="w-full accent-blue-600"
              />
              <span className="text-[10px] text-slate-400">Exponential weight decay applied to older patient lab visits.</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Digital Twin Pipeline Environment</h3>
            <p className="text-[11px] text-slate-400">Deployment target and data synchronization cadence</p>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Aggregation Time Horizon</label>
              <select
                value={aggregationWindow}
                onChange={(e) => setAggregationWindow(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-hidden font-medium text-slate-700"
              >
                <option value="Rolling 14-day">Rolling 14-day (Continuous Ambulatory Standard)</option>
                <option value="Rolling 30-day">Rolling 30-day (Extended Glycemic Stability)</option>
                <option value="Full Cohort History">Full Longitudinal History (All recorded visits)</option>
              </select>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-blue-950 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-xs text-blue-700">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Risk Factor Attribution (heuristic)</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Factor attributions are recomputed from fixed indicator weights whenever those weights change.
                They are hand-set linear weights, not Shapley values, and are not calibrated against outcomes.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between text-slate-500 text-[11px]">
              <span>Active Environment: <strong className="text-slate-800">Cluster Prod-East-01</strong></span>
              <span className="text-emerald-600 font-semibold">● Live Synced</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
