import React, { useEffect, useRef, useState } from 'react';
import { Activity, Download, RefreshCw, Settings2 } from 'lucide-react';
import type { Patient } from '../types';
import type { GlucoseForecast } from '../lib/forecast';
import { getForecastApiUrl, saveForecastApiUrl } from '../lib/forecast';
import { loadConditionalSession, forecastConditionalSession, type ConditionalSession, type ConditionalSource } from '../lib/conditionalSession';
import { conditionalPlanFromSchedule, emptyConditionalPlan } from '../lib/conditionalScenario';
import { predictionHighlights } from '../lib/resultHighlights';
import { savePrediction } from '../lib/predictionResults';
import type { ScenarioDraft, compileScenario } from '../lib/scenario';
import type { ConditionalResult } from '../lib/conditionalPrediction';
import { ScenarioBuilder } from './ScenarioBuilder';
import { PredictionChart } from './PredictionChart';

const card = 'rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6';
const field = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm';
type Compiled = ReturnType<typeof compileScenario>;

/** Keep the chart + existing event editor; run both curves through the v3 model. */
export function ConditionalSimulatorPanel({patient, allowInsulin = false}: {patient: Patient; allowInsulin?: boolean}) {
  const [source, setSource] = useState<ConditionalSource>('supabase');
  const [showHistory, setShowHistory] = useState(false);
  const [revision, setRevision] = useState(0);
  const [session, setSession] = useState<ConditionalSession | null>(null);
  const [baseline, setBaseline] = useState<GlucoseForecast | null>(null);
  const [forecast, setForecast] = useState<GlucoseForecast | null>(null);
  const [drafts, setDrafts] = useState<ScenarioDraft[]>([]);
  const [schedule, setSchedule] = useState<Compiled['schedule']>([]);
  const [applied, setApplied] = useState('');
  const [explanations, setExplanations] = useState<ConditionalResult['explanations']>([]);
  const [busy, setBusy] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState(''), [saveError, setSaveError] = useState(''), [notice, setNotice] = useState('');
  const [snapshot, setSnapshot] = useState('');
  const [connectionOpen, setConnectionOpen] = useState(false), [apiUrl, setApiUrl] = useState(getForecastApiUrl);
  const controller = useRef<AbortController | null>(null);
  const resultRevision = useRef(0);
  const current = session?.patientId === patient.id && session.source === source && forecast?.patient_id === patient.id ? forecast : null;
  const dirty = drafts.length > 0 && applied !== JSON.stringify(drafts);

  useEffect(() => {
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    setSession(null); setForecast(null); setBaseline(null); setDrafts([]); setSchedule([]); setApplied('');
    setBusy(true); setError(''); setNotice(''); setSaveError(''); setExplanations([]); resultRevision.current++;
    (async () => {
      try {
        const loaded = await loadConditionalSession(patient, source, abort.signal);
        const output = await forecastConditionalSession(loaded, emptyConditionalPlan, emptyConditionalPlan, abort.signal);
        if (abort.signal.aborted) return;
        setSession(loaded); setBaseline(output.forecast); setForecast(output.forecast); setSnapshot(crypto.randomUUID());
      } catch (failure) { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : 'Forecast unavailable.'); }
      finally { if (!abort.signal.aborted) setBusy(false); }
    })();
    return () => {abort.abort(); controller.current?.abort();};
  }, [patient.id, source, revision]);

  function edit(next: ScenarioDraft[]) {
    controller.current?.abort(); setBusy(false);
    setDrafts(next); setForecast(baseline); setSchedule([]); setApplied(''); setExplanations([]);
    setError(''); setNotice(''); setSaveError(''); setSnapshot(crypto.randomUUID()); resultRevision.current++;
  }

  async function runScenario(compiled: Compiled) {
    if (!session || !current) return false;
    const plan = conditionalPlanFromSchedule(compiled);
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    const draftKey = JSON.stringify(drafts);
    setBusy(true); setError(''); setNotice(''); setSaveError(''); resultRevision.current++;
    try {
      const output = await forecastConditionalSession(session, emptyConditionalPlan, plan, abort.signal);
      if (abort.signal.aborted) return false;
      setForecast(output.forecast); setSchedule(compiled.schedule); setApplied(draftKey);
      setExplanations(output.comparison.explanations); setSnapshot(crypto.randomUUID());
      return true;
    } catch (failure) {
      if (!abort.signal.aborted) {setForecast(baseline); setSchedule([]); setApplied(''); setError(failure instanceof Error ? failure.message : 'The model comparison could not run.');}
      return false;
    } finally {if (!abort.signal.aborted) setBusy(false);}
  }

  async function save() {
    if (!current || busy || dirty) return;
    const savedRevision = resultRevision.current;
    setSaving(true); setSaveError('');
    try {
      const events = schedule.map(row => `${row.at} source clock | ${row.description} | ${row.kind === 'meal' ? `${row.amount} g food; ${row.carbohydrate} g total carbohydrate` : `${row.amount} U ${row.insulinFormulation} bolus`}`).join('\n');
      await savePrediction({id:snapshot,patient_id:patient.id,engine:'gru',model_sha256:current.model_sha256,output:current,scenario:null,
        event_summary:events ? `Baseline: no added future events.\nChanged plan:\n${events}\nOther future intake/exposure is unknown.` : 'Baseline only: no added future events; unrecorded intake and insulin remain unknown.'});
      if (resultRevision.current === savedRevision) setNotice('Saved to lab results with model version, event times and IOB context.');
    } catch (failure) {if (resultRevision.current === savedRevision) setSaveError(failure instanceof Error ? failure.message : 'Unable to save.');}
    finally {setSaving(false);}
  }

  function download() {
    if (!current) return;
    const csv = ['timestamp,baseline_mg_dl,scenario_mg_dl,model_version,checkpoint_sha256',...current.baseline.map((point,i)=>`${point.timestamp},${point.value},${current.scenario[i].value},${current.model_version},${current.model_sha256}`)].join('\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})), link=document.createElement('a');
    link.href=url; link.download=`glucose-v3-${patient.id}-4h.csv`; link.click(); URL.revokeObjectURL(url);
  }

  return <div className="space-y-5" data-testid="conditional-simulator">
    <section className={`${card} flex flex-wrap items-center justify-between gap-4 !py-4`}>
      <div><p className="flex items-center gap-2 text-sm font-semibold"><Activity size={17} className="text-teal-700"/>CGM forecast & what-if simulator</p><p className="mt-1 text-xs text-slate-500">Conditional GRU v3 · carbohydrate, estimated IOB, clock and recorded context</p></div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex flex-wrap items-center gap-2 text-xs text-slate-600">Data source<select className={`${field} max-w-full`} aria-label="Simulator data source" value={source} onChange={event => setSource(event.target.value as ConditionalSource)}><option value="supabase">Authorized Supabase visit</option><option value="local">Local workbook · Python service</option></select></label>
        <span className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">4-hour window · 15 / 30 / 60 / 240 min outputs</span>
        <button type="button" className="rounded-lg border border-slate-200 p-2 text-slate-600" aria-label="Refresh forecast history" disabled={busy} onClick={()=>setRevision(v=>v+1)}><RefreshCw size={16}/></button>
        {source==='local'&&<button type="button" aria-label="Model service connection" className="rounded-lg border border-slate-200 p-2 text-slate-600" onClick={()=>setConnectionOpen(v=>!v)}><Settings2 size={16}/></button>}
      </div>
    </section>
    {connectionOpen&&source==='local'&&<form className={`${card} flex flex-wrap gap-3`} onSubmit={event=>{event.preventDefault();try{saveForecastApiUrl(apiUrl);setConnectionOpen(false);setRevision(v=>v+1);}catch(failure){setError(failure instanceof Error?failure.message:'Invalid service address.');}}}><label className="grow text-sm">Python model service address<input className={`${field} mt-2 w-full`} value={apiUrl} onChange={event=>setApiUrl(event.target.value)} placeholder="https://your-service.onrender.com"/></label><button className="rounded-xl bg-teal-700 px-4 py-2 text-sm text-white">Connect</button></form>}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[['Latest recorded CGM',current?`${current.latest_glucose.toFixed(1)} mg/dL`:'Awaiting history'],['Estimated bolus IOB',current?.exposure?`${current.exposure.iob_units.toFixed(2)} U`:'Unavailable'],['What-if difference at 4h',current?.scenario_enabled?`${current.scenario_end-current.baseline_end>=0?'+':''}${(current.scenario_end-current.baseline_end).toFixed(1)} mg/dL`:'No events applied']].map(([label,value])=><section key={label} className={`${card} !p-4`}><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold text-slate-900">{value}</p></section>)}
    </div>
    {error&&<div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">Prediction results are unavailable</p><p className="mt-2">{error}</p><button className="mt-3 font-semibold underline" onClick={()=>setRevision(v=>v+1)}>Reload history and model</button></div>}
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        <section className={card} data-testid="prediction-panel" aria-busy={busy}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold tracking-tight text-black sm:text-lg">Glucose prediction</h2><p className="mt-1 text-xs leading-5 text-slate-500">Both curves use the same history and trained decoder. The changed plan recalculates future bolus IOB.</p></div><div className="flex gap-2"><button type="button" disabled={!current||busy} onClick={download} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40" aria-label="Download prediction CSV"><Download size={16}/></button><button type="button" onClick={()=>void save()} disabled={!current||busy||saving||dirty||!!notice} className="rounded-xl bg-teal-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{saving?'Saving…':notice?'Saved':'Save to lab results'}</button></div></div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-black">CGM &middot; mg/dL</span><div className="flex gap-1 rounded-xl bg-slate-50 p-1" role="group" aria-label="Chart time window">{[false,true].map(history=><button key={String(history)} type="button" aria-pressed={showHistory===history} onClick={()=>setShowHistory(history)} className={`rounded-lg px-3 py-2 text-xs font-medium ${showHistory===history?'bg-white text-black shadow-sm':'text-slate-600'}`}>{history?'History + forecast':'Forecast only'}</button>)}</div></div>
          <PredictionChart markSamples clockLabel="source clock" forecastStart={showHistory?current?.forecast_start:undefined} loading={busy} series={[...(showHistory?[{key:'observed',label:'Observed CGM',color:'#64748b',points:current?.observed??[]}]:[]),{key:'baseline',label:'Baseline estimate',color:'#2563eb',points:current?.baseline??[]},...(current?.scenario_enabled?[{key:'scenario',label:'What-if estimate',color:'#7c3aed',points:current.scenario}]:[])]}/>
          <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-xs leading-relaxed text-black" data-testid="range-explanation"><p className="font-medium">Conditional model estimates</p><p className="mt-2">Range unavailable. The original model estimates are shown; v3 has no calibrated uncertainty band.</p><details className="mt-3"><summary className="cursor-pointer font-semibold">How to read this forecast</summary><div className="mt-3 space-y-3 border-t border-slate-200/70 pt-3"><p>Blue shows the baseline. Purple dashes show the applied what-if plan. Both use the same recorded history and trained decoder.</p><p>Four marked future horizons (15, 30, 60 and 240 minutes) are trained outputs. Connecting lines are a visual guide. History + forecast adds the six-hour observed CGM input and marks where prediction begins.</p><p>Hover or tap a recorded or predicted point to inspect its value. Axis controls change the display only. No added events does not confirm fasting or zero insulin.</p></div></details></div>
          {dirty&&<p role="status" className="mt-3 rounded-xl bg-blue-50 p-3 text-xs text-blue-900">Draft events are not applied. The chart shows the baseline until you run the what-if simulation.</p>}
          {busy&&<p role="status" className="mt-3 text-sm text-teal-700">{session?'Running the v3 decoder for both plans…':'Loading authorized history and verified model…'}</p>}
          {notice&&<p role="status" className="mt-3 text-xs text-teal-700">{notice}</p>}{saveError&&<p role="alert" className="mt-3 text-xs text-rose-700">{saveError}</p>}
        </section>
        {current&&<section className={card}><h2 className="font-semibold">Forecast values</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Direct model outputs in mg/dL</caption><thead className="text-xs text-slate-500"><tr><th className="pb-3">Horizon</th><th>Baseline</th><th>What-if</th><th>Difference</th></tr></thead><tbody>{[15,30,60,240].map((h,i)=><tr key={h} className="border-t border-slate-100"><th className="py-3 font-medium">+{h} min</th><td>{current.baseline[i+1].value.toFixed(1)}</td><td>{current.scenario[i+1].value.toFixed(1)}</td><td>{(current.scenario[i+1].value-current.baseline[i+1].value).toFixed(1)}</td></tr>)}</tbody></table></div><details className="mt-5"><summary className="cursor-pointer text-sm font-semibold text-teal-700">Written prediction highlights</summary><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">{predictionHighlights(current).map(line=><li key={line}>{line}</li>)}</ul></details></section>}
        {current&&<details className={card}><summary className="cursor-pointer text-sm font-semibold">Model, data coverage & sensitivity</summary><p className="mt-4 text-sm leading-6">{current.model_version} · {session?.cohort} · origin {current.forecast_start.replace('T',' ').slice(0,19)} source clock.</p><p className="mt-2 text-xs leading-6 text-slate-500">Age/BMI and supported historical carbohydrate/bolus exposure are included. Missing meals remain unknown. Basal, premixed, long-acting, IV and unresolved insulin are outside estimated bolus IOB. Exercise and non-insulin medicines are not trained scenario inputs.</p>{explanations.length>0&&<ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-6">{explanations.map(item=><li key={item.name}>{item.name}: {item.change.toFixed(1)} mg/dL sensitivity at 240 min.</li>)}</ul>}<p className="mt-3 text-xs text-slate-500">Grouped ablations show model sensitivity, not causal treatment effects or recommended doses.</p><p className="mt-3 break-all text-[10px] text-slate-400">Checkpoint: {current.model_sha256}</p></details>}
      </div>
      <aside className={`${card} min-w-0 xl:sticky xl:top-5 xl:max-h-[calc(100vh-2.5rem)] xl:overflow-y-auto`}><h2 className="text-lg font-semibold">What-if simulator</h2><p className="mt-2 text-xs leading-6 text-slate-500">Schedule food{allowInsulin?' or a hypothetical supported bolus':''} within four hours of the recorded origin. The baseline keeps the same observed history without these additional future events.</p><ScenarioBuilder value={drafts} onChange={edit} start={current?.forecast_start} hours={4} engine="conditional" allowedKinds={allowInsulin?['meal','insulin']:['meal']} disabled={!current||busy||saving} onRun={runScenario} onReset={()=>edit([])}/></aside>
    </div>
  </div>;
}
