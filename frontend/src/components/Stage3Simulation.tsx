import React, { useState, useEffect } from 'react';
import { Sliders, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import type { SimulationResponse } from '../types';

interface Stage3SimulationProps {
  patientNumber: number;
  baselineValues: Record<string, number>;
  onRunSimulation: (scenario: Record<string, number>) => void;
  simulationResult: SimulationResponse | null;
  isLoading: boolean;
}

export const Stage3Simulation: React.FC<Stage3SimulationProps> = ({
  patientNumber,
  baselineValues,
  onRunSimulation,
  simulationResult,
  isLoading,
}) => {
  const [scenarioValues, setScenarioValues] = useState<Record<string, number>>({});

  useEffect(() => {
    if (baselineValues && Object.keys(baselineValues).length > 0) {
      setScenarioValues({ ...baselineValues });
    }
  }, [baselineValues]);

  const handleInputChange = (field: string, value: number) => {
    setScenarioValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRunSimulation(scenarioValues);
  };

  const handleReset = () => {
    setScenarioValues({ ...baselineValues });
  };

  const hasChanges = Object.keys(scenarioValues).some(
    (key) => scenarioValues[key] !== baselineValues[key]
  );

  return (
    <div className="rounded-xl bg-white border border-slate-200 p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-blue-600" />
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Stage 3 · Manual What-If Scenario Simulation
            </span>
            <h2 className="text-base font-bold text-slate-900">
              Counterfactual Exploration for Patient #{patientNumber}
            </h2>
          </div>
        </div>
        {hasChanges && (
          <button
            onClick={handleReset}
            type="button"
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            Reset to Baseline
          </button>
        )}
      </div>

      <p className="text-xs text-slate-600 leading-relaxed">
        Modify lifestyle and clinical factors to observe how the multi-class model recalculates probability estimates.
      </p>

      {/* Interactive Scenario Controls Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
          {/* BMI */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <label htmlFor="sim-bmi" className="font-semibold text-slate-700">Body Mass Index (BMI)</label>
              <span className="font-bold text-blue-700">{(scenarioValues.BMI ?? 25).toFixed(1)}</span>
            </div>
            <input
              id="sim-bmi"
              type="range"
              min="12"
              max="70"
              step="0.5"
              value={scenarioValues.BMI ?? 25}
              onChange={(e) => handleInputChange('BMI', parseFloat(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>

          {/* GenHlth */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <label htmlFor="sim-genhlth" className="font-semibold text-slate-700">General Health (1=Best, 5=Poor)</label>
              <span className="font-bold text-blue-700">{scenarioValues.GenHlth ?? 3}</span>
            </div>
            <input
              id="sim-genhlth"
              type="range"
              min="1"
              max="5"
              step="1"
              value={scenarioValues.GenHlth ?? 3}
              onChange={(e) => handleInputChange('GenHlth', parseInt(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>

          {/* Physical Activity */}
          <div className="space-y-1 text-xs">
            <label htmlFor="sim-physactivity" className="font-semibold text-slate-700 block">Leisure Physical Activity</label>
            <select
              id="sim-physactivity"
              value={scenarioValues.PhysActivity ?? 1}
              onChange={(e) => handleInputChange('PhysActivity', parseInt(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
            >
              <option value="1">Yes (Active in past 30 days)</option>
              <option value="0">No (Sedentary)</option>
            </select>
          </div>

          {/* High Blood Pressure */}
          <div className="space-y-1 text-xs">
            <label htmlFor="sim-highbp" className="font-semibold text-slate-700 block">High Blood Pressure</label>
            <select
              id="sim-highbp"
              value={scenarioValues.HighBP ?? 0}
              onChange={(e) => handleInputChange('HighBP', parseInt(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
            >
              <option value="0">No (Normal)</option>
              <option value="1">Yes (Diagnosed High BP)</option>
            </select>
          </div>

          {/* High Cholesterol */}
          <div className="space-y-1 text-xs">
            <label htmlFor="sim-highchol" className="font-semibold text-slate-700 block">High Cholesterol</label>
            <select
              id="sim-highchol"
              value={scenarioValues.HighChol ?? 0}
              onChange={(e) => handleInputChange('HighChol', parseInt(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
            >
              <option value="0">No (Normal)</option>
              <option value="1">Yes (Diagnosed High Chol)</option>
            </select>
          </div>

          {/* Fruits */}
          <div className="space-y-1 text-xs">
            <label htmlFor="sim-fruits" className="font-semibold text-slate-700 block">Daily Fruit Intake</label>
            <select
              id="sim-fruits"
              value={scenarioValues.Fruits ?? 1}
              onChange={(e) => handleInputChange('Fruits', parseInt(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
            >
              <option value="1">Yes (At least 1 fruit/day)</option>
              <option value="0">No</option>
            </select>
          </div>

          {/* Veggies */}
          <div className="space-y-1 text-xs">
            <label htmlFor="sim-veggies" className="font-semibold text-slate-700 block">Daily Vegetable Intake</label>
            <select
              id="sim-veggies"
              value={scenarioValues.Veggies ?? 1}
              onChange={(e) => handleInputChange('Veggies', parseInt(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
            >
              <option value="1">Yes (At least 1 vegetable/day)</option>
              <option value="0">No</option>
            </select>
          </div>

          {/* Heavy Alcohol */}
          <div className="space-y-1 text-xs">
            <label htmlFor="sim-hvyalcohol" className="font-semibold text-slate-700 block">Heavy Alcohol Consumption</label>
            <select
              id="sim-hvyalcohol"
              value={scenarioValues.HvyAlcoholConsump ?? 0}
              onChange={(e) => handleInputChange('HvyAlcoholConsump', parseInt(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
            >
              <option value="0">No</option>
              <option value="1">Yes</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-sm"
        >
          <ArrowRight className="w-4 h-4" />
          {isLoading ? 'Simulating Scenario...' : 'Run What-If Comparison'}
        </button>
      </form>

      {/* Simulation Results Breakdown */}
      {simulationResult && (
        <div className="space-y-4 pt-2 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Baseline Column */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Current Baseline State</span>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-extrabold text-slate-900">
                  {simulationResult.baseline.label}
                </span>
                <span className="text-sm font-bold text-slate-700">
                  {(simulationResult.baseline.high_risk_probability * 100).toFixed(1)}% High Risk
                </span>
              </div>
            </div>

            {/* Scenario Column */}
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2">
              <span className="text-[11px] font-bold text-blue-600 uppercase">Simulated Scenario State</span>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-extrabold text-blue-950">
                  {simulationResult.scenario.label}
                </span>
                <span className="text-sm font-bold text-blue-900">
                  {(simulationResult.scenario.high_risk_probability * 100).toFixed(1)}% High Risk
                </span>
              </div>
            </div>
          </div>

          {/* Delta Highlight */}
          <div
            className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-between ${
              simulationResult.high_risk_change < 0
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : simulationResult.high_risk_change > 0
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {simulationResult.high_risk_change < 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>
                Simulated High-Diabetes Probability Shift:{' '}
                <strong>
                  {simulationResult.high_risk_change >= 0 ? '+' : ''}
                  {(simulationResult.high_risk_change * 100).toFixed(1)} percentage points
                </strong>
              </span>
            </div>
            <span>
              {simulationResult.changes.length} variable
              {simulationResult.changes.length === 1 ? '' : 's'} altered
            </span>
          </div>

          {/* List of Modified Variables */}
          {simulationResult.changes.length > 0 && (
            <div className="space-y-1.5 text-xs">
              <span className="font-semibold text-slate-700 block">Modified Variables:</span>
              <div className="flex flex-wrap gap-2">
                {simulationResult.changes.map((c) => (
                  <span
                    key={c.feature}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-medium"
                  >
                    <span>{c.feature}:</span>
                    <span className="text-slate-400">{c.from}</span>
                    <span>→</span>
                    <strong className="text-slate-900">{c.to}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-500 italic bg-amber-50/60 p-2.5 rounded border border-amber-100">
            <strong>Non-causal note:</strong> These changes demonstrate how the Random Forest reacts to different input vectors; they are not medical proof that changing these behaviors causes or prevents diabetes.
          </p>
        </div>
      )}
    </div>
  );
};
