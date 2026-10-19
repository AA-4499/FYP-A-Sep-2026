import React, { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, Activity, AlertCircle } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts';
import type { Patient, NavigationModule } from '../types';
import { fetchGlucoseForecast, type ForecastPoint, type ForecastEvent, type GlucoseForecast } from '../lib/forecast';

type Props = { patient: Patient; onNavigate: (module: NavigationModule) => void };
const card = 'bg-white rounded-2xl border border-slate-200 p-5 shadow-sm';
const input = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800';
const formatTime = (value: number) => new Date(value).toISOString().slice(5, 16).replace('T', ' ');

function chartRows(series: Record<string, ForecastPoint[]>) {
  const rows = new Map<number, Record<string, number>>();
  Object.entries(series).forEach(([key, points]) => points.forEach(point => {
    // Model timestamps represent the workbook clock, without a timezone conversion.
    const timestamp = Date.parse(/[zZ]$|[+-]\d\d:\d\d$/.test(point.timestamp) ? point.timestamp : `${point.timestamp}Z`);
    const row = rows.get(timestamp) || { timestamp };
    row[key] = point.value;
    rows.set(timestamp, row);
  }));
  return [...rows.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function GlucoseChart({ series }: { series: { key: string; label: string; color: string; points: ForecastPoint[] }[] }) {
  const rows = chartRows(Object.fromEntries(series.map(s => [s.key, s.points])));
  return <div className="h-80 w-full mt-4" role="img" aria-label={series.map(s => s.label).join(', ') + ' CGM chart in mg/dL'}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="timestamp" type="number" domain={['dataMin', 'dataMax']} scale="time" tickFormatter={formatTime} minTickGap={60} tick={{ fontSize: 10 }} />
        <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} unit=" mg/dL" width={85} />
        <Tooltip labelFormatter={value => formatTime(Number(value))} formatter={(value: unknown) => `${Number(value).toFixed(1)} mg/dL`} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {[{ value: 70, color: '#c2410c' }, { value: 140, color: '#16a34a' }, { value: 180, color: '#ca8a04' }, { value: 250, color: '#dc2626' }].map(line =>
          <ReferenceLine key={line.value} y={line.value} stroke={line.color} strokeDasharray="3 3" label={{ value: String(line.value), position: 'insideTopLeft', fontSize: 10, fill: line.color }} />)}
        {series.map(s => <Line key={s.key} type="linear" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />)}
      </LineChart>
    </ResponsiveContainer>
  </div>;
}

function ForecastPanel({ patient, onNavigate }: Props) {
  const [source, setSource] = useState<'local' | 'supabase'>('supabase');
  const [horizon, setHorizon] = useState(3);
  const [mealEnabled, setMealEnabled] = useState(false);
  const [insulinEnabled, setInsulinEnabled] = useState(false);
  const [mealAmount, setMealAmount] = useState(60);
  const [insulinAmount, setInsulinAmount] = useState(2);
  const [mealMinutes, setMealMinutes] = useState(60);
  const [insulinMinutes, setInsulinMinutes] = useState(120);
  const [request, setRequest] = useState<{ revision: number; events: ForecastEvent[]; runId: string }>(() => ({ revision: 0, events: [], runId: crypto.randomUUID() }));
  const [result, setResult] = useState<GlucoseForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setResult(null);
    fetchGlucoseForecast(patient.id, { source, horizon_hours: horizon, events: request.events, run_id: request.runId }, controller.signal)
      .then(data => { if (!controller.signal.aborted) setResult(data); })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Forecast unavailable.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [patient.id, source, horizon, request]);

  function run(event: React.FormEvent) {
    event.preventDefault();
    const events: ForecastEvent[] = [];
    if (mealEnabled) events.push({ kind: 'meal', amount: mealAmount, minutes_ahead: mealMinutes });
    if (insulinEnabled) events.push({ kind: 'insulin', amount: insulinAmount, minutes_ahead: insulinMinutes });
    setRequest(previous => ({ revision: previous.revision + 1, events, runId: crypto.randomUUID() }));
  }

  return <div className="space-y-5 pb-10 animate-fadeIn">
    <div>
      <button onClick={() => onNavigate('patient_dashboard')} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-blue-600 mb-2"><ArrowLeft size={14} />Back to Patient Dashboard</button>
      <h1 className="text-2xl font-bold text-slate-900">Risk Prediction and What-if Simulation</h1>
      <p className="text-sm text-slate-500 mt-1">Shanghai T2DM CGM forecasting · Patient record {patient.id}</p>
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)] gap-5 items-start">
      <form onSubmit={run} className={`${card} space-y-5`}>
        <div className="flex items-center gap-2 font-semibold text-sm"><Activity size={17} className="text-blue-600" />Forecast settings</div>
        <label className="block text-xs font-medium text-slate-600">Data source
          <select className={input} value={source} onChange={event => { setSource(event.target.value as typeof source); setRequest({ revision: 0, events: [], runId: crypto.randomUUID() }); }}>
            <option value="local">Local Excel workbooks</option><option value="supabase">Supabase Cloud (Live DB)</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600">Forecast horizon
          <select className={input} value={horizon} onChange={event => { setHorizon(Number(event.target.value)); setRequest({ revision: 0, events: [], runId: crypto.randomUUID() }); }}>
            {[3, 6, 12].map(hours => <option key={hours} value={hours}>{hours} hours</option>)}
          </select>
        </label>
        <div className="border-t border-slate-100 pt-4 space-y-4">
          <h2 className="text-sm font-semibold">What-if events</h2>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={mealEnabled} onChange={e => setMealEnabled(e.target.checked)} />Include a meal event</label>
          {mealEnabled && <div className="space-y-3">
            <label className="block text-xs text-slate-500">Food mass (g)<input className={input} type="number" min="0.1" step="0.1" required value={mealAmount} onChange={e => setMealAmount(e.target.valueAsNumber)} /></label>
            <label className="block text-xs text-slate-500">Minutes after latest reading<input className={input} type="number" min="15" max={horizon * 60 - 15} step="15" required value={mealMinutes} onChange={e => setMealMinutes(e.target.valueAsNumber)} /></label>
          </div>}
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={insulinEnabled} onChange={e => setInsulinEnabled(e.target.checked)} />Include an insulin event</label>
          {insulinEnabled && <div className="space-y-3">
            <label className="block text-xs text-slate-500">Insulin amount (units)<input className={input} type="number" min="0.1" step="0.1" required value={insulinAmount} onChange={e => setInsulinAmount(e.target.valueAsNumber)} /></label>
            <label className="block text-xs text-slate-500">Minutes after latest reading<input className={input} type="number" min="15" max={horizon * 60 - 15} step="15" required value={insulinMinutes} onChange={e => setInsulinMinutes(e.target.valueAsNumber)} /></label>
          </div>}
          <p className="text-xs text-slate-400">Each completed forecast is saved to Supabase. Apply changes to compare the baseline with your selected events. Times follow the dataset clock.</p>
        </div>
        <button type="submit" disabled={loading} className="w-full flex justify-center items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />{loading ? 'Running model…' : 'Run forecast'}</button>
        <button type="button" className="w-full text-xs text-slate-500 hover:text-blue-600" onClick={() => { setMealEnabled(false); setInsulinEnabled(false); setRequest(previous => ({ revision: previous.revision + 1, events: [], runId: crypto.randomUUID() })); }}>Reset to baseline</button>
      </form>
      <div className="space-y-5 min-w-0" aria-live="polite" aria-busy={loading}>
        {loading && <div className={`${card} text-sm text-slate-500 flex gap-2 items-center`}><RefreshCw size={16} className="animate-spin" />Loading CGM history and running the GRU model…</div>}
        {error && <div role="alert" className={`${card} border-amber-200 bg-amber-50 text-sm text-amber-900 flex gap-2 items-start`}><AlertCircle size={18} className="shrink-0" /><div><p>{error}</p><button type="button" className="mt-2 underline font-semibold" onClick={() => setRequest(previous => ({ ...previous, revision: previous.revision + 1 }))}>Retry same forecast</button></div></div>}
        {result && <>
          <p className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-xs text-emerald-800">Saved to Supabase ? {result.storage.test_predictions_saved} held-out predictions, metrics and full forecast curves</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ['Latest observed CGM', `${result.latest_glucose.toFixed(1)} mg/dL`],
              ['Held-out test MAE', result.metrics ? `${result.metrics.mae_mg_dl.toFixed(1)} mg/dL` : 'Unavailable'],
              [`After ${result.horizon_hours} hours`, `${result.scenario_end.toFixed(1)} mg/dL`],
              ['What-if change', result.scenario_enabled ? `${(result.scenario_end - result.baseline_end) >= 0 ? '+' : ''}${(result.scenario_end - result.baseline_end).toFixed(1)} mg/dL` : 'No event'],
            ].map(([label, value]) => <div key={label} className={`${card} !p-4`}><p className="text-xs text-slate-500">{label}</p><p className="text-lg font-bold text-slate-900 mt-2">{value}</p></div>)}
          </div>
          <section className={card}>
            <h2 className="text-sm font-bold">{result.horizon_hours}-hour simulation comparison</h2>
            <p className="text-xs text-slate-400 mt-1">Forecast begins at {result.forecast_start.replace('T', ' ')} · 15-minute steps</p>
            <GlucoseChart series={[
              { key: 'baseline', label: 'Without what-if simulation', color: '#2563eb', points: result.baseline },
              ...(result.scenario_enabled ? [{ key: 'scenario', label: 'With what-if simulation', color: '#e07a36', points: result.scenario }] : []),
            ]} />
          </section>
          <section className={card}>
            <h2 className="text-sm font-bold">Training and held-out testing CGM</h2>
            <p className="text-xs text-slate-400 mt-1">Chronological timeline · Patient record {result.record_id}</p>
            <GlucoseChart series={[
              { key: 'observed', label: 'Observed CGM', color: '#cbd5e1', points: result.observed },
              { key: 'training', label: 'Training prediction', color: '#53b5a8', points: result.training },
              { key: 'validation', label: 'Validation prediction', color: '#f59e0b', points: result.validation },
              { key: 'testing', label: 'Testing prediction (held-out)', color: '#596caa', points: result.testing },
              { key: 'actual', label: 'Real testing CGM', color: '#8b5cf6', points: result.testing_actual },
            ]} />
            {!result.metrics && <p className="text-xs text-amber-700 mt-2">This record has no eligible held-out test windows.</p>}
          </section>
          <details className={`${card} text-xs text-slate-500`}><summary className="cursor-pointer font-semibold text-slate-700">Model and data details</summary>
            <div className="mt-3 space-y-2"><p className="break-all">Supabase run: {result.storage.run_id}</p><p>Model: chronological GRU · Lookback: {result.sequence_length} readings ({result.sequence_length * 15} minutes) · Source: {result.source}</p>
              {result.metrics && <p>Selected record evaluation: MAE {result.metrics.mae_mg_dl.toFixed(2)} mg/dL · RMSE {result.metrics.rmse_mg_dl.toFixed(2)} mg/dL · {result.metrics.test_windows} held-out windows</p>}
              <p>Training and validation curves are in-sample diagnostics. Testing shows rolling one-step predictions; the future simulation uses recursive forecasts.</p>
            </div>
          </details>
        </>}
        <p className="text-xs text-slate-400 leading-relaxed">Research and education only; not for diagnosis, treatment, or insulin dosing. Meal and insulin effects are learned from sparse historical events. The reference lines reproduce the original dashboard at 70, 140, 180 and 250 mg/dL.</p>
      </div>
    </div>
  </div>;
}

export const RiskSimulationView: React.FC<Props> = props => <ForecastPanel key={props.patient.id} {...props} />;
