import React, { useState } from 'react';
import {
  Cpu,
  Heart,
  Activity,
  Sliders,
  Sparkles,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { DigitalTwinResponse, SimulationResponse } from '../types';
import { runSimulation } from '../api/client';

interface DigitalTwinSimulationViewProps {
  patientId: string;
  patientName: string;
  twinData: DigitalTwinResponse | null;
}

export const DigitalTwinSimulationView: React.FC<DigitalTwinSimulationViewProps> = ({
  patientId,
  patientName,
  twinData,
}) => {
  // Simulation input states
  const [diet, setDiet] = useState<string>('low_carb');
  const [exercise, setExercise] = useState<string>('regular_aerobic');
  const [hba1cChange, setHba1cChange] = useState<number>(-0.5);
  const [bmiChange, setBmiChange] = useState<number>(-1.0);
  const [bpChange, setBpChange] = useState<number>(-5);
  const [tirChange, setTirChange] = useState<number>(10);

  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSimulate = async () => {
    setIsSimulating(true);
    setError(null);
    try {
      const res = await runSimulation(patientId, {
        diet_intervention: diet,
        exercise_intervention: exercise,
        hba1c_change: hba1cChange,
        bmi_change: bmiChange,
        bp_change: bpChange,
        tir_change: tirChange,
      });
      setSimulationResult(res);
    } catch (err: any) {
      setError(err.message || 'Simulation execution failed.');
    } finally {
      setIsSimulating(false);
    }
  };

  if (!twinData) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
        Loading digital twin physiological representation...
      </div>
    );
  }

  const { twin_status, avatar_glow, avatar_status_color, composite_risk, organs, morphometry } =
    twinData;

  return (
    <div className="space-y-6">
      {/* Upper Grid: 3D Twin Avatar State & Multi-Organ Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Physiological Avatar Visual Box */}
        <div className="bg-slate-900 rounded-xl p-6 text-white shadow-md flex flex-col justify-between relative overflow-hidden">
          <div
            className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full pointer-events-none filter blur-3xl transition-all duration-700"
            style={{ backgroundColor: avatar_glow }}
          />

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold tracking-widest text-slate-400">
                Digital Twin State
              </span>
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                style={{ backgroundColor: avatar_status_color, color: '#ffffff' }}
              >
                {composite_risk}% Risk
              </span>
            </div>
            <h3 className="text-xl font-extrabold mt-1">{patientName}</h3>
            <p className="text-xs text-slate-300 mt-1">{twin_status}</p>
          </div>

          {/* Avatar Graphic representation */}
          <div className="my-8 flex flex-col items-center justify-center">
            <div
              className="w-32 h-32 rounded-full border-4 flex items-center justify-center transition-all duration-500 shadow-2xl relative"
              style={{
                borderColor: avatar_status_color,
                boxShadow: `0 0 35px ${avatar_glow}`,
              }}
            >
              <Cpu className="w-16 h-16 text-slate-200 animate-pulse" />
            </div>
            <span className="text-xs text-slate-400 mt-3 font-medium">
              Multi-Organ Physiological Coupling
            </span>
          </div>

          {/* Morphometric stats */}
          <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-800 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">BMI / Weight</span>
              <span className="font-semibold text-slate-100">
                {morphometry.bmi} kg/m² ({morphometry.weight_kg} kg)
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Est. Body Fat</span>
              <span className="font-semibold text-slate-100">{morphometry.body_fat_est_pct}%</span>
            </div>
          </div>
        </div>

        {/* Multi-Organ Health Breakdown */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-600" />
              Organ-Level Metabolic Stress Analysis
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Derived from repeated ShanghaiT2DM continuous glucose readings and clinical laboratory values
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(organs).map(([key, organ]) => (
              <div
                key={key}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-blue-300 transition space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">{organ.name}</span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded text-white"
                    style={{ backgroundColor: organ.color }}
                  >
                    {organ.status}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${organ.stress_score}%`,
                      backgroundColor: organ.color,
                    }}
                  />
                </div>

                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Stress Load: {organ.stress_score}/100</span>
                </div>
                <p className="text-[11px] text-slate-600 pt-1 border-t border-slate-200/60 leading-relaxed">
                  {organ.details}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lower Box: Counterfactual What-If Scenario Simulation Engine */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-blue-600" />
              Counterfactual What-If Scenario Simulation Engine
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Perturb lifestyle and glycemic parameters to project counterfactual risk reduction
            </p>
          </div>
          <button
            onClick={handleSimulate}
            disabled={isSimulating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
            {isSimulating ? 'Simulating Dynamic Twin...' : 'Simulate Intervention'}
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200">
            {error}
          </div>
        )}

        {/* Simulation Controls Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 text-xs">
          {/* Diet Intervention */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Dietary Regimen</label>
            <select
              value={diet}
              onChange={(e) => setDiet(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500"
            >
              <option value="none">Current Diet (No Change)</option>
              <option value="low_carb">Low-Carbohydrate (&Delta; -0.6% HbA1c, +10% TIR)</option>
              <option value="mediterranean">Mediterranean Diet (&Delta; -0.4% HbA1c, +7% TIR)</option>
            </select>
          </div>

          {/* Exercise Intervention */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Physical Activity</label>
            <select
              value={exercise}
              onChange={(e) => setExercise(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500"
            >
              <option value="none">Current Activity (Sedentary)</option>
              <option value="light_walking">30 min Daily Walking (&Delta; -3 mmHg BP)</option>
              <option value="regular_aerobic">150 min/wk Aerobic (&Delta; -6 mmHg BP, -1.2 BMI)</option>
            </select>
          </div>

          {/* HbA1c Adjustment Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="font-semibold text-slate-700">Manual HbA1c Offset</label>
              <span className="font-bold text-blue-600">{hba1cChange > 0 ? `+${hba1cChange}` : hba1cChange}%</span>
            </div>
            <input
              type="range"
              min="-2.0"
              max="2.0"
              step="0.1"
              value={hba1cChange}
              onChange={(e) => setHba1cChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* BMI Adjustment Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="font-semibold text-slate-700">BMI Change</label>
              <span className="font-bold text-blue-600">{bmiChange > 0 ? `+${bmiChange}` : bmiChange} kg/m²</span>
            </div>
            <input
              type="range"
              min="-5.0"
              max="5.0"
              step="0.5"
              value={bmiChange}
              onChange={(e) => setBmiChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Systolic BP Adjustment Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="font-semibold text-slate-700">Systolic BP Change</label>
              <span className="font-bold text-blue-600">{bpChange > 0 ? `+${bpChange}` : bpChange} mmHg</span>
            </div>
            <input
              type="range"
              min="-30"
              max="30"
              step="1"
              value={bpChange}
              onChange={(e) => setBpChange(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Time in Range Adjustment Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="font-semibold text-slate-700">CGM Time in Range Offset</label>
              <span className="font-bold text-blue-600">{tirChange > 0 ? `+${tirChange}` : tirChange}%</span>
            </div>
            <input
              type="range"
              min="-20"
              max="30"
              step="1"
              value={tirChange}
              onChange={(e) => setTirChange(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Simulation Output Comparison Panel */}
        {simulationResult && (
          <div className="mt-6 pt-6 border-t border-slate-200 space-y-4 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50/60 p-4 rounded-xl border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 text-white rounded-lg">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Simulated Projected Outcome: {simulationResult.risk_outcome.status}
                  </h4>
                  <p className="text-xs text-slate-600">
                    Baseline {simulationResult.risk_outcome.baseline_risk_pct}% &rarr; Simulated{' '}
                    <span className="font-bold text-blue-700">
                      {simulationResult.risk_outcome.simulated_risk_pct}%
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 ${
                    simulationResult.risk_outcome.risk_delta_pct < 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {simulationResult.risk_outcome.risk_delta_pct < 0 ? (
                    <TrendingDown className="w-4 h-4" />
                  ) : (
                    <TrendingUp className="w-4 h-4" />
                  )}
                  {simulationResult.risk_outcome.risk_delta_pct > 0 ? `+` : ''}
                  {simulationResult.risk_outcome.risk_delta_pct}% Risk Delta
                </span>
              </div>
            </div>

            {/* Baseline vs Simulated Comparison Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Biomarker Indicator</th>
                    <th className="py-2.5 px-4">Baseline Recorded</th>
                    <th className="py-2.5 px-4">Simulated Counterfactual</th>
                    <th className="py-2.5 px-4">Projected Shift</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {Object.entries(simulationResult.baseline_comparison).map(([key, item]) => {
                    const diff = roundNumber(item.simulated - item.baseline);
                    return (
                      <tr key={key} className="hover:bg-slate-50/70">
                        <td className="py-2 px-4 font-semibold text-slate-800 capitalize">
                          {key.replace(/_/g, ' ')}
                        </td>
                        <td className="py-2 px-4 text-slate-600">
                          {item.baseline} {item.unit}
                        </td>
                        <td className="py-2 px-4 font-bold text-blue-600">
                          {item.simulated} {item.unit}
                        </td>
                        <td className="py-2 px-4 font-medium">
                          <span
                            className={
                              diff < 0
                                ? 'text-emerald-600'
                                : diff > 0
                                ? 'text-rose-600'
                                : 'text-slate-500'
                            }
                          >
                            {diff > 0 ? `+${diff}` : diff} {item.unit}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function roundNumber(num: number): number {
  return Math.round(num * 10) / 10;
}
