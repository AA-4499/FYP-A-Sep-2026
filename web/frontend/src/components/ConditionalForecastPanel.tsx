import React, { useEffect, useRef, useState } from 'react';
import type { Patient } from '../types';
import type { GlucoseForecast } from '../lib/forecast';
import type { Plan } from '../lib/conditionalFeatures';
import type { ConditionalResult } from '../lib/conditionalPrediction';
import { loadConditionalSession, forecastConditionalSession } from '../lib/conditionalSession';
import { predictionHighlights } from '../lib/resultHighlights';
import { savePrediction } from '../lib/predictionResults';
import { PredictionChart } from './PredictionChart';

const card = 'rounded-3xl border border-slate-200 bg-white p-5 sm:p-6';
const input = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm';
const initial: Plan = { carbs: 0, mealAt: 30, bolus: 0, bolusAt: 30, formulation: 'rapid' };
const times = Array.from({length:16}, (_, i) => (i+1)*15);

function PlanEditor({ title, plan, change, allowInsulin }: { title: string; plan: Plan; change: (plan: Plan) => void; allowInsulin: boolean }) {
  return <fieldset className="space-y-3 rounded-2xl border border-slate-200 p-4"><legend className="px-2 font-semibold">{title}</legend><div className="grid grid-cols-2 gap-3">
    <label className="text-xs text-slate-600">Carbohydrate (g)<input className={input} aria-label={`${title} carbohydrate grams`} type="number" min="0" max="150" step="1" value={plan.carbs} onChange={e => change({...plan, carbs: Number(e.target.value)})} /></label>
    <label className="text-xs text-slate-600">Meal time<select className={input} aria-label={`${title} meal time`} value={plan.mealAt} onChange={e => change({...plan, mealAt: Number(e.target.value)})}>{times.map(t => <option key={t} value={t}>+{t} min</option>)}</select></label>
    {allowInsulin && <><label className="text-xs text-slate-600">Hypothetical bolus (U)<input className={input} aria-label={`${title} bolus units`} type="number" min="0" max="50" step="0.5" value={plan.bolus} onChange={e => change({...plan, bolus: Number(e.target.value)})} /></label><label className="text-xs text-slate-600">Bolus time<select className={input} aria-label={`${title} bolus time`} value={plan.bolusAt} onChange={e => change({...plan, bolusAt: Number(e.target.value)})}>{times.map(t => <option key={t} value={t}>+{t} min</option>)}</select></label><label className="col-span-2 text-xs text-slate-600">Insulin action assumption<select className={input} value={plan.formulation} onChange={e => change({...plan, formulation: e.target.value as Plan['formulation']})}><option value="rapid">Rapid analogue: 6h duration / 75m peak</option><option value="regular">Regular: 8h duration / 180m peak</option></select></label></>}
  </div><p className="text-xs leading-5 text-slate-500">{plan.carbs} g carbohydrate at +{plan.mealAt} min{allowInsulin ? `; ${plan.bolus} U ${plan.formulation} bolus at +${plan.bolusAt} min.` : '.'} These are explicit research assumptions.</p></fieldset>;
}

export function ConditionalForecastPanel({patient, allowInsulin = false}: {patient: Patient; allowInsulin?: boolean}) {
  const [source, setSource] = useState<'supabase' | 'local'>('supabase');
  const [baseline, setBaseline] = useState<Plan>({...initial});
  const [scenario, setScenario] = useState<Plan>({...initial, carbs: 30});
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<GlucoseForecast | null>(null);
  const [explanations, setExplanations] = useState<ConditionalResult['explanations']>([]);
  const [busy, setBusy] = useState(false), [saving, setSaving] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [snapshot, setSnapshot] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  function invalidate() { controller.current?.abort(); setBusy(false); setResult(null); setExplanations([]); setError(''); setNotice(''); setConfirmed(false); }
  async function run() {
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    setBusy(true); setResult(null); setError(''); setNotice('');
    try {
      if (!confirmed) throw Error('Confirm the assumptions for both plans before running.');
      const session = await loadConditionalSession(patient, source, abort.signal, 'browser');
      const {forecast, comparison} = await forecastConditionalSession(session, baseline, scenario, abort.signal);
      if (abort.signal.aborted) return;
      setResult(forecast);
      setExplanations(comparison.explanations); setSnapshot(crypto.randomUUID());
    } catch (failure) { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : 'The comparison could not be calculated.'); }
    finally { if (!abort.signal.aborted) setBusy(false); }
  }
  async function save() {
    if (!result) return; const current = result; const active = controller.current;
    setSaving(true); setError('');
    try {
      const planText = (name: string, p: Plan) => `${name}: ${p.carbs} g carbohydrate at +${p.mealAt}m; ${p.bolus} U ${p.formulation} bolus at +${p.bolusAt}m.`;
      await savePrediction({id: snapshot, patient_id: patient.id, engine: 'gru', model_sha256: current.model_sha256, output: current, scenario: null, event_summary: `${planText('Baseline',baseline)}\n${planText('Changed',scenario)}\nOther future intake/exposure is unknown. Estimated IOB excludes unsupported insulin.`});
      if (controller.current === active && !active?.signal.aborted) setNotice('Saved with written highlights in Lab results.');
    } catch (failure) { if (controller.current === active && !active?.signal.aborted) setError(failure instanceof Error ? failure.message : 'Save failed.'); }
    finally { setSaving(false); }
  }
  return <div className="space-y-5"><section className={`${card} space-y-4`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Retrained conditional GRU · v3</p><h2 className="mt-2 text-xl font-semibold">Glucose outlook & planned events</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Use the same recorded history for both plans. The model includes reference carbohydrate, estimated bolus IOB, clock, age, BMI and missing-data flags. Four trained horizons: 15, 30, 60 and 240 minutes.</p></div>
    <label className="text-xs text-slate-600">History source<select className={input} value={source} onChange={e => {invalidate(); setSource(e.target.value as typeof source);}}><option value="supabase">Authorized Supabase visit</option><option value="local">Exact local workbook · Python service</option></select></label></div>
    <p className="text-xs leading-5 text-slate-500">The recorded dataset label chooses the cohort. For older imports without that label, an explicit recorded type 1/type 2 diagnosis chooses the corresponding Shanghai research model; this does not establish external validation.</p>
    <div className="grid gap-4 lg:grid-cols-2"><PlanEditor title="Baseline plan" plan={baseline} change={p => {invalidate(); setBaseline(p);}} allowInsulin={allowInsulin}/><PlanEditor title="Changed plan" plan={scenario} change={p => {invalidate(); setScenario(p);}} allowInsulin={allowInsulin}/></div>
    <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700"><input type="checkbox" className="mt-1" checked={confirmed} onChange={e => {controller.current?.abort(); setBusy(false); setResult(null); setNotice(''); setConfirmed(e.target.checked);}}/>I confirm both hypothetical plans. Unrecorded meals and insulin are unknown; zero entered events do not confirm fasting or zero insulin. These predictions do not recommend doses.</label>
    <div className="flex flex-wrap gap-3"><button className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40" type="button" disabled={busy || !confirmed} onClick={() => void run()}>{busy ? 'Calculating both plans…' : 'Run comparison'}</button><button className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold disabled:opacity-40" type="button" disabled={!result || saving || !!notice} onClick={() => void save()}>{saving ? 'Saving…' : notice ? 'Saved' : 'Save to lab results'}</button></div>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}{notice && <p role="status" className="text-sm text-teal-700">{notice}</p>}
  </section>
  {result && <><section className={`${card} space-y-4`}><h2 className="text-lg font-semibold">What the model estimates</h2><ul className="list-disc space-y-3 pl-5 text-sm leading-6 text-slate-700">{predictionHighlights(result).map(line => <li key={line}>{line}</li>)}</ul><p className="text-xs leading-5 text-slate-500">Both plans use model version {result.model_version}. Forecasts begin at a historical recording date, not the current time.</p></section>
    <section className={card}><h2 className="text-lg font-semibold">Estimates at each trained horizon</h2><ul className="mt-4 grid gap-3 sm:grid-cols-2">{result.horizons_minutes!.map((h,i) => <li key={h} className="rounded-xl bg-slate-50 p-4 text-sm leading-6"><strong>+{h} minutes</strong><p>Baseline: {result.baseline[i+1].value.toFixed(1)} mg/dL</p><p>Changed: {result.scenario[i+1].value.toFixed(1)} mg/dL</p><p>Difference: {(result.scenario[i+1].value-result.baseline[i+1].value).toFixed(1)} mg/dL</p></li>)}</ul><details className="mt-5"><summary className="cursor-pointer text-sm font-semibold text-teal-700">Show supporting prediction chart</summary><PredictionChart clockLabel="source clock" loading={false} series={[{key:'baseline',label:'Baseline plan',color:'#64748b',points:result.baseline},{key:'scenario',label:'Changed plan',color:'#0f766e',points:result.scenario}]}/><p className="text-xs text-slate-500">Lines connect sampled estimates; no additional forecast points or calibrated uncertainty bands are implied.</p></details></section>
    <details className={card}><summary className="cursor-pointer font-semibold">Model sensitivity & data limitations</summary><ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6">{explanations.map(item => <li key={item.name}>{item.name}: {item.change.toFixed(1)} mg/dL change at 240 minutes when that group is removed or replaced by its training mean.</li>)}</ul><p className="mt-4 text-xs leading-6 text-slate-500">These are grouped ablations, not SHAP, additive contributions or causal effects. IOB uses fixed triangular rapid/regular action assumptions. Basal, premixed, long-acting and IV exposure are excluded. Food mapping is sparse. Exercise and non-insulin medicine effects are not represented.</p><p className="mt-3 break-all text-xs text-slate-400">Checkpoint SHA-256: {result.model_sha256}</p></details>
  </>}
  </div>;
}
