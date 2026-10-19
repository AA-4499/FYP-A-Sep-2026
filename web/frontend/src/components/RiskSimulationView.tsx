import React, { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, Activity, AlertCircle, SlidersHorizontal, Database, Download, Settings2, CheckCircle2 } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts';
import type { Patient, NavigationModule } from '../types';
import { fetchGlucoseForecast, getForecastApiUrl, saveForecastApiUrl, type ForecastPoint, type ForecastEvent, type GlucoseForecast } from '../lib/forecast';

type Props = { patient: Patient; onNavigate: (module: NavigationModule) => void };
type Series = { key: string; label: string; color: string; points: ForecastPoint[] };
const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const input = 'mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100';
const timestamp = (value: string) => Date.parse(/[zZ]$|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
const formatTime = (value: number) => new Date(value).toISOString().slice(5, 16).replace('T', ' ');
const displayTime = (value?: string) => value ? value.replace('T', ' ').slice(0, 16) : 'Awaiting data';
const displayNumber = (value?: number, digits = 1) => value === undefined ? '\u2014' : value.toFixed(digits);

function chartRows(series: Series[]) {
  const rows = new Map<number, Record<string, number>>();
  series.forEach(({ key, points }) => points.forEach(point => {
    const time = timestamp(point.timestamp);
    if (!Number.isFinite(time)) return;
    const row = rows.get(time) || { timestamp: time };
    row[key] = point.value;
    rows.set(time, row);
  }));
  return [...rows.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function GlucoseChart({ series, loading, history = false }: { series: Series[]; loading: boolean; history?: boolean }) {
  const rows = chartRows(series);
  const hasData = rows.length > 0;
  return <div className="relative mt-5 h-[330px] w-full" role="img" aria-label={history ? 'Observed CGM with training, validation, and held-out testing predictions' : 'Baseline and what-if glucose prediction comparison'}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 15, right: 15, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="timestamp" type="number" domain={hasData ? ['dataMin', 'dataMax'] : [0, 1]} scale="time" tickFormatter={hasData ? formatTime : () => ''} minTickGap={50} tick={{ fontSize: 10 }} />
        <YAxis domain={hasData ? ['auto', 'auto'] : [40, 280]} tick={{ fontSize: 11 }} width={48} />
        <Tooltip labelFormatter={value => formatTime(Number(value))} formatter={(value: unknown) => `${Number(value).toFixed(1)} mg/dL`} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
        {[{ value: 70, color: '#c2410c' }, { value: 140, color: '#16a34a' }, { value: 180, color: '#ca8a04' }, { value: 250, color: '#dc2626' }].map(line =>
          <ReferenceLine key={line.value} y={line.value} ifOverflow="extendDomain" stroke={line.color} strokeDasharray="4 4" label={{ value: String(line.value), position: 'insideTopLeft', fontSize: 10, fill: line.color }} />)}
        {series.map(s => <Line key={s.key} type="linear" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={s.key === 'observed' ? 1 : 2} strokeDasharray={s.key === 'scenario' ? '6 3' : undefined} dot={false} connectNulls isAnimationActive={false} />)}
      </LineChart>
    </ResponsiveContainer>
    {!hasData && <div className="absolute inset-x-10 top-20 flex justify-center pointer-events-none">
      <div className="max-w-xs rounded-xl border border-slate-200 bg-white/95 p-4 text-center shadow-sm">
        {loading && <RefreshCw size={18} className="mx-auto mb-2 animate-spin text-blue-500" />}
        <p className="text-sm font-semibold text-slate-700">{loading ? 'Loading model results' : 'Waiting for model results'}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{history ? 'Observed CGM and training, validation and testing curves will appear here.' : 'The baseline forecast and applied what-if scenario will appear here.'}</p>
      </div>
    </div>}
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
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [apiUrl, setApiUrl] = useState(getForecastApiUrl);
  const [connectionError, setConnectionError] = useState('');
  const [showAllRows, setShowAllRows] = useState(false);
  const current = result?.patient_id === patient.id && result.source === source && result.horizon_hours === horizon ? result : null;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetchGlucoseForecast(patient.id, { source, horizon_hours: horizon, events: request.events, run_id: request.runId }, controller.signal)
      .then(data => { if (!controller.signal.aborted) setResult(data); })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Forecast unavailable.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [patient.id, source, horizon, request]);

  function baselineRequest() {
    setRequest(previous => ({ revision: previous.revision + 1, events: [], runId: crypto.randomUUID() }));
  }

  function run(event: React.FormEvent) {
    event.preventDefault();
    const events: ForecastEvent[] = [];
    if (mealEnabled) events.push({ kind: 'meal', amount: mealAmount, minutes_ahead: mealMinutes });
    if (insulinEnabled) events.push({ kind: 'insulin', amount: insulinAmount, minutes_ahead: insulinMinutes });
    setRequest(previous => ({ revision: previous.revision + 1, events, runId: crypto.randomUUID() }));
  }

  function connect(event: React.FormEvent) {
    event.preventDefault();
    try {
      saveForecastApiUrl(apiUrl);
      setConnectionError(''); setConnectionOpen(false);
      setRequest(previous => ({ ...previous, revision: previous.revision + 1 }));
    } catch (err) {
      setConnectionError(err instanceof Error ? err.message : 'Enter a valid model service address.');
    }
  }

  function download() {
    if (!current) return;
    const lines = ['timestamp,baseline_glucose_mg_dl,scenario_glucose_mg_dl', ...current.baseline.map((point, index) =>
      `${point.timestamp},${point.value},${current.scenario[index]?.value ?? ''}`)];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `glucose-forecast-${current.patient_id}-${current.horizon_hours}h.csv`;
    link.click(); URL.revokeObjectURL(url);
  }

  const forecastSeries: Series[] = [
    { key: 'baseline', label: 'Baseline prediction', color: '#2563eb', points: current?.baseline ?? [] },
    ...(current?.scenario_enabled || !current ? [{ key: 'scenario', label: 'What-if prediction', color: '#e07a36', points: current?.scenario ?? [] }] : []),
  ];
  const historySeries: Series[] = [
    { key: 'observed', label: 'Observed CGM', color: '#cbd5e1', points: current?.observed ?? [] },
    { key: 'training', label: 'Training prediction', color: '#53b5a8', points: current?.training ?? [] },
    { key: 'validation', label: 'Validation prediction', color: '#f59e0b', points: current?.validation ?? [] },
    { key: 'testing', label: 'Testing prediction', color: '#596caa', points: current?.testing ?? [] },
    { key: 'actual', label: 'Real testing CGM', color: '#8b5cf6', points: current?.testing_actual ?? [] },
  ];
  const delta = current ? current.scenario_end - current.baseline_end : undefined;
  const forecastRows = current?.baseline.slice(1) ?? [];

  return <div className="space-y-5 pb-10 animate-fadeIn">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <button onClick={() => onNavigate('patient_dashboard')} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-blue-600"><ArrowLeft size={14} />Back to Patient Dashboard</button>
        <h1 className="text-2xl font-bold text-slate-900">Risk Prediction and What-if Simulation</h1>
        <p className="mt-1 text-sm text-slate-500">Shanghai T2DM CGM forecasting &middot; Patient record {patient.id}</p>
      </div>
      <button type="button" onClick={() => setConnectionOpen(open => !open)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"><Settings2 size={14} />Service connection</button>
    </header>

    {connectionOpen && <form onSubmit={connect} className={`${card} space-y-3`}>
      <h2 className="text-sm font-semibold">Connect the prediction service</h2>
      <p className="text-xs leading-relaxed text-slate-500">Enter the public address of the Python service that runs the GRU model. This is separate from your Supabase project and your Vercel webpage.</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-xs font-medium text-slate-600">Model service URL<input className={input} type="url" placeholder="https://your-model-service.onrender.com" value={apiUrl} onChange={event => setApiUrl(event.target.value)} /></label>
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Connect and retry</button>
      </div>
      <p className="text-xs text-slate-400">This address is saved only in this browser. Leave blank to use the deployment configuration.</p>
      {connectionError && <p role="alert" className="text-xs text-red-700">{connectionError}</p>}
    </form>}

    <div className={`${card} flex flex-wrap items-center gap-4 !py-3`}>
      <span className="inline-flex items-center gap-2 text-sm font-semibold"><Activity size={17} className="text-blue-600" />Forecast settings</span>
      <label className="flex items-center gap-2 text-xs font-medium text-slate-500">Data source
        <select aria-label="Data source" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800" value={source} onChange={event => { setSource(event.target.value as typeof source); baselineRequest(); }}>
          <option value="supabase">Supabase Cloud (Live DB)</option><option value="local">Local Excel workbooks</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs font-medium text-slate-500">Forecast horizon
        <select aria-label="Forecast horizon" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800" value={horizon} onChange={event => { const hours = Number(event.target.value); setHorizon(hours); setMealMinutes(value => Math.min(value, hours * 60 - 15)); setInsulinMinutes(value => Math.min(value, hours * 60 - 15)); baselineRequest(); }}>
          {[3, 6, 12].map(hours => <option key={hours} value={hours}>{hours} hours</option>)}
        </select>
      </label>
      <span className="text-xs text-slate-400 sm:ml-auto">15-minute forecast intervals</span>
    </div>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        ['Latest observed CGM', current ? `${displayNumber(current.latest_glucose)} mg/dL` : '\u2014'],
        ['Held-out test MAE', current?.metrics ? `${displayNumber(current.metrics.mae_mg_dl)} mg/dL` : '\u2014'],
        [`Prediction after ${horizon} hours`, current ? `${displayNumber(current.scenario_end)} mg/dL` : '\u2014'],
        ['What-if change', delta !== undefined && current?.scenario_enabled ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} mg/dL` : current ? 'No event applied' : '\u2014'],
      ].map(([label, value]) => <div key={label} className={`${card} !p-4`}><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-lg font-bold text-slate-900">{value}</p></div>)}
    </div>

    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_290px]">
      <div className="min-w-0 space-y-5" aria-busy={loading}>
        <div aria-live="polite">
          {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertCircle size={18} className="mt-0.5 shrink-0" /><div><p className="font-semibold">Prediction results are unavailable</p><p className="mt-1 text-xs leading-relaxed">{error}</p>
              <div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold"><button onClick={() => setRequest(previous => ({ ...previous, revision: previous.revision + 1 }))} className="underline">Retry same forecast</button><button onClick={() => setConnectionOpen(true)} className="underline">Check service connection</button></div>
              {current && <p className="mt-2 text-xs">The charts below show the last completed forecast.</p>}
            </div>
          </div>}
          {loading && <p className="flex items-center gap-2 text-xs text-blue-600"><RefreshCw size={14} className="animate-spin" />{current ? 'Updating forecast; showing the last completed result.' : 'Loading CGM history and running the GRU model...'}</p>}
          {!loading && !error && current && <p className="flex items-center gap-2 text-xs text-emerald-700"><CheckCircle2 size={14} />Saved to Supabase &middot; {current.storage.test_predictions_saved} held-out predictions and full forecast curves</p>}
        </div>

        <section className={card} data-testid="prediction-panel">
          <div className="flex items-start justify-between gap-2"><div><h2 className="text-sm font-bold text-slate-900">Glucose prediction</h2><p className="mt-1 text-xs text-slate-500">{horizon}-hour baseline and what-if comparison</p></div><span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-600">CGM &middot; mg/dL</span></div>
          <GlucoseChart series={forecastSeries} loading={loading} />
          <p className="mt-2 text-xs leading-relaxed text-slate-400">{current ? `Forecast begins ${displayTime(current.forecast_start)}. Future points use recursive 15-minute predictions.` : 'Connect the prediction service to load the selected patient\'s model results.'}</p>
        </section>

        <section className={card} data-testid="history-panel">
          <h2 className="text-sm font-bold text-slate-900">CGM training, validation and testing history</h2>
          <p className="mt-1 text-xs text-slate-500">Observed readings and chronological GRU predictions for the selected patient record</p>
          <GlucoseChart series={historySeries} loading={loading} history />
          <p className="mt-2 text-xs leading-relaxed text-slate-400">Training and validation curves are in-sample diagnostics. Testing shows rolling one-step predictions against actual held-out CGM readings.</p>
        </section>

        <section className={card} data-testid="evaluation-panel">
          <h2 className="text-sm font-bold text-slate-900">Model evaluation and timeline coverage</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Test MAE', current?.metrics ? `${current.metrics.mae_mg_dl.toFixed(2)} mg/dL` : '\u2014'],
              ['Test RMSE', current?.metrics ? `${current.metrics.rmse_mg_dl.toFixed(2)} mg/dL` : '\u2014'],
              ['Test windows', current?.metrics?.test_windows.toLocaleString() ?? '\u2014'],
              ['Model lookback', current ? `${current.sequence_length * 15} min` : '\u2014'],
            ].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-slate-800">{value}</p></div>)}
          </div>
          <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b border-slate-200 text-slate-500"><tr><th className="py-2 font-medium">Timeline</th><th className="py-2 font-medium">Points</th><th className="py-2 font-medium">Start</th><th className="py-2 font-medium">End</th></tr></thead><tbody>
            {historySeries.filter(series => series.key !== 'actual').map(series => <tr key={series.key} className="border-b border-slate-100 last:border-0"><td className="py-3 pr-3"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: series.color }} />{series.label}</td><td className="py-3 pr-3">{current ? series.points.length : '\u2014'}</td><td className="whitespace-nowrap py-3 pr-3">{displayTime(series.points[0]?.timestamp)}</td><td className="whitespace-nowrap py-3">{displayTime(series.points[series.points.length - 1]?.timestamp)}</td></tr>)}
          </tbody></table></div>
        </section>

        <section className={card} data-testid="forecast-values-panel">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-slate-900">Forecast values</h2><p className="mt-1 text-xs text-slate-500">Predicted CGM at each future 15-minute step</p></div><button disabled={!current} onClick={download} className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-blue-600 disabled:opacity-40"><Download size={14} />CSV</button></div>
          {forecastRows.length ? <><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b border-slate-200 text-slate-500"><tr><th className="py-2 font-medium">Timestamp</th><th className="py-2 font-medium">Baseline</th><th className="py-2 font-medium">What-if</th><th className="py-2 font-medium">Change</th></tr></thead><tbody>
            {(showAllRows ? forecastRows : forecastRows.slice(0, 12)).map((point, index) => {
              const scenario = current!.scenario[index + 1]?.value;
              const change = scenario === undefined ? undefined : scenario - point.value;
              return <tr key={point.timestamp} className="border-b border-slate-100 last:border-0"><td className="whitespace-nowrap py-2.5 pr-3">{displayTime(point.timestamp)}</td><td className="py-2.5">{point.value.toFixed(1)} mg/dL</td><td className="py-2.5">{current!.scenario_enabled ? `${displayNumber(scenario)} mg/dL` : '\u2014'}</td><td className="py-2.5">{current!.scenario_enabled && change !== undefined ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}` : '\u2014'}</td></tr>;
            })}
          </tbody></table></div>{forecastRows.length > 12 && <button className="mt-3 text-xs font-semibold text-blue-600" onClick={() => setShowAllRows(show => !show)}>{showAllRows ? 'Show first 12 rows' : `Show all ${forecastRows.length} forecast rows`}</button>}</> : <p className="mt-4 rounded-lg border border-dashed border-slate-200 p-4 text-xs text-slate-500">Forecast values will appear after the model returns a result.</p>}
        </section>

        <section className={card} data-testid="model-details-panel">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><Database size={15} className="text-blue-500" />Model and data details</h2>
          <dl className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            {[
              ['Model', 'Chronological GRU'], ['Patient record', patient.id],
              ['Data source', current?.source ?? source], ['Observed readings', current?.observed.length.toLocaleString() ?? '\u2014'],
              ['Model lookback', current ? `${current.sequence_length} readings / ${current.sequence_length * 15} minutes` : '\u2014'],
              ['Forecast begins', displayTime(current?.forecast_start)],
              ['Supabase run ID', current?.storage.run_id ?? 'No completed run'],
            ].map(([label, value]) => <div key={label}><dt className="text-slate-400">{label}</dt><dd className="mt-1 break-all font-medium text-slate-700">{value}</dd></div>)}
          </dl>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-400">Research and education only; not for diagnosis, treatment, or insulin dosing. Meal and insulin effects are learned from sparse historical events. Reference lines are shown at 70, 140, 180 and 250 mg/dL.</p>
        </section>
      </div>

      <aside className={`${card} xl:sticky xl:top-5`} data-testid="simulator-panel">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><SlidersHorizontal size={17} className="text-blue-600" />What-if simulator</div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">Add hypothetical events to compare their projected effect with the baseline prediction.</p>
        <form onSubmit={run} className="mt-5 space-y-5">
          <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <legend className="px-1 text-xs font-semibold text-slate-700">Meal event</legend>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" checked={mealEnabled} onChange={event => setMealEnabled(event.target.checked)} />Include a meal event</label>
            <label className="block text-xs text-slate-500">Food mass (g)<input className={input} type="number" min="0.1" step="0.1" required disabled={!mealEnabled} value={mealAmount} onChange={event => setMealAmount(event.target.valueAsNumber)} /></label>
            <label className="block text-xs text-slate-500">Minutes after latest CGM<input className={input} type="number" min="15" max={horizon * 60 - 15} step="15" required disabled={!mealEnabled} value={mealMinutes} onChange={event => setMealMinutes(event.target.valueAsNumber)} /></label>
          </fieldset>
          <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <legend className="px-1 text-xs font-semibold text-slate-700">Insulin event</legend>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" checked={insulinEnabled} onChange={event => setInsulinEnabled(event.target.checked)} />Include an insulin event</label>
            <label className="block text-xs text-slate-500">Insulin amount (units)<input className={input} type="number" min="0.1" step="0.1" required disabled={!insulinEnabled} value={insulinAmount} onChange={event => setInsulinAmount(event.target.valueAsNumber)} /></label>
            <label className="block text-xs text-slate-500">Minutes after latest CGM<input className={input} type="number" min="15" max={horizon * 60 - 15} step="15" required disabled={!insulinEnabled} value={insulinMinutes} onChange={event => setInsulinMinutes(event.target.valueAsNumber)} /></label>
          </fieldset>
          <p className="text-[11px] leading-relaxed text-slate-400">Use 15-minute intervals within the selected {horizon}-hour horizon. Changes apply when you run the simulation.</p>
          <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />{loading ? 'Running model...' : 'Run what-if simulation'}</button>
          <button type="button" className="w-full text-xs font-medium text-slate-500 hover:text-blue-600" onClick={() => { setMealEnabled(false); setInsulinEnabled(false); baselineRequest(); }}>Reset to baseline</button>
          <p className="border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-400">Each completed forecast is saved to Supabase. Scenario inputs are for research and do not recommend an insulin dose.</p>
        </form>
      </aside>
    </div>
  </div>;
}

export const RiskSimulationView: React.FC<Props> = props => <ForecastPanel key={props.patient.id} {...props} />;
