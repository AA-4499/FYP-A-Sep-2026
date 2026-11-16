import React, { useEffect, useRef, useState } from 'react';
import type { ConditionalHistory } from '../lib/conditionalFeatures';
import { compareNutrition, type NutritionPlan, type AuxiliaryModel } from '../lib/auxiliaryNutrition';
import { loadAuxiliaryModel } from '../lib/auxiliaryModelLoader';
import manifest from '../lib/auxiliaryManifest.json';
import { PredictionChart } from './PredictionChart';
import { sampleForecast, type ForecastInterval } from '../lib/forecastSampling';
import { savePrediction } from '../lib/predictionResults';
import { auxiliaryForecast } from '../lib/auxiliaryForecast';

const reference: NutritionPlan={at:30,carbs:40,protein:20,fat:15,fiber:6,activityAt:60,activityMinutes:30,met:1};
type Result={baseline:number[];scenario:number[]};

/** Separate research comparison; never silently correct Shanghai outputs. */
export function AuxiliaryNutritionPanel({history,cohort,interval=15}:{history:ConditionalHistory;cohort:string;interval?:ForecastInterval}) {
  const [baseline,setBaseline]=useState({...reference}),[scenario,setScenario]=useState({...reference});
  const [result,setResult]=useState<Result|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [open,setOpen]=useState(false);
  const [label,setLabel]=useState(''),[saved,setSaved]=useState(false),[saving,setSaving]=useState(false);
  const snapshot=useRef(crypto.randomUUID());
  const model=useRef<AuxiliaryModel|null>(null),abort=useRef<AbortController|null>(null);
  useEffect(()=>()=>abort.current?.abort(),[]);
  const activity=manifest.mode==='macros_activity';
  function edit(side:'baseline'|'scenario',key:keyof NutritionPlan,value:string) {
    abort.current?.abort();setBusy(false);setResult(null);setError('');setSaved(false);snapshot.current=crypto.randomUUID();
    (side==='baseline'?setBaseline:setScenario)(previous=>({...previous,[key]:value.trim()===''?NaN:Number(value)}));
  }
  async function run() {
    abort.current?.abort();const controller=new AbortController();abort.current=controller;
    setBusy(true);setError('');setResult(null);
    try {
      const loaded=model.current??await loadAuxiliaryModel(controller.signal);
      if(controller.signal.aborted)return;
      model.current=loaded;
      const comparison=compareNutrition(loaded,history,cohort,baseline,scenario);
      if(!controller.signal.aborted)setResult(comparison);
    } catch(failure) {if(!controller.signal.aborted)setError(failure instanceof Error?failure.message:'Auxiliary comparison unavailable.');}
    finally{if(!controller.signal.aborted)setBusy(false);}
  }
  const fields: {key:keyof NutritionPlan;label:string;min:number;max:number;step?:number}[]=[
    {key:'at',label:'Meal after origin (min)',min:15,max:360,step:15},
    {key:'carbs',label:'Total carbohydrate (g)',min:0,max:150},
    {key:'protein',label:'Protein (g)',min:0,max:100},
    {key:'fat',label:'Fat (g)',min:0,max:100},
    {key:'fiber',label:'Fiber (g)',min:0,max:40},
    ...(activity?[{key:'activityAt' as const,label:'Activity start (min)',min:0,max:345,step:15},
      {key:'activityMinutes' as const,label:'Activity duration (min)',min:15,max:120,step:15},
      {key:'met' as const,label:'Activity intensity (MET)',min:1,max:8,step:.1}]:[]),
  ];
  const points=(values:number[])=>sampleForecast([{timestamp:new Date(history.origin).toISOString(),value:history.features[23][0]},...Array.from({length:24},(_,i)=>(i+1)*15).map((h,i)=>({timestamp:new Date(history.origin+h*60000).toISOString(),value:values[i]}))],new Date(history.origin).toISOString(),interval);
  async function save() {
    if(!result||saving||saved)return;
    const id=snapshot.current;setSaving(true);setError('');
    try {
      const output=auxiliaryForecast(history,result,baseline,scenario,manifest,label);
      await savePrediction({id,patient_id:history.recordId,engine:'gru',model_sha256:manifest.checkpoint_sha256,output,scenario:null,event_summary:'CGMacros nutrition/activity comparison. '+JSON.stringify({baseline,scenario})});
      if(id===snapshot.current)setSaved(true);
    } catch(failure){if(id===snapshot.current)setError(failure instanceof Error?failure.message:'Save unavailable.');}
    finally{setSaving(false);}
  }
  function download() {
    if(!result)return;
    const payload={record_id:history.recordId,forecast_origin:new Date(history.origin).toISOString(),model_version:manifest.version,checkpoint_sha256:manifest.checkpoint_sha256,source_doi:manifest.source_doi,scope:manifest.evaluation_scope,shanghai_transfer_validated:false,causal_treatment_effect_validated:false,baseline,scenario,horizons_minutes:Array.from({length:24},(_,i)=>(i+1)*15),predictions_mg_dl:result};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='cgmacros-auxiliary-research.json';link.click();URL.revokeObjectURL(url);
  }
  if(cohort!=='ShanghaiT2DM')return null;
  return <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6" data-testid="auxiliary-nutrition">
    <button type="button" aria-expanded={open} onClick={()=>setOpen(v=>!v)} className="flex w-full items-center justify-between gap-3 text-left"><span><span className="block text-base font-semibold">Nutrition &amp; activity research model</span><span className="mt-1 block text-xs text-slate-500">CGMacros auxiliary GRU · {open?'Hide comparison':'Compare additional inputs'}</span></span><span aria-hidden="true">{open?'−':'+'}</span></button>
    {open&&<div className="mt-5 space-y-5">
      <details className="rounded-xl bg-amber-50 p-4 text-xs"><summary className="cursor-pointer font-semibold">Research scope &amp; explanation</summary><p className="rounded-xl bg-amber-50 p-4 text-xs leading-6 text-amber-950">Experimental transfer from CGMacros to this Shanghai T2DM history. This separate model has not been validated for this patient population or as a causal treatment model. The v3 chart above keeps its original predictions. Insulin, medication and sleep are outside this auxiliary model.</p>
      <p className="text-xs leading-6 text-slate-600">Compare two meals{activity?' and activity intervals':''} after the same recorded origin. MET 1 is resting intensity; MET is an assumed activity average, not measured steps. Unspecified future activity remains unknown. Fiber is included in total carbohydrate. Editing clears the previous comparison.</p></details>
      <form onSubmit={event=>{event.preventDefault();void run();}} className="space-y-4">
        <div className="grid gap-5 sm:grid-cols-2">{(['baseline','scenario'] as const).map(side=><fieldset key={side} disabled={busy} className="min-w-0 space-y-3 rounded-2xl border border-slate-200 p-4"><legend className="px-1 text-sm font-semibold">{side==='baseline'?'Reference plan':'Changed plan'}</legend>{fields.map(({key,label,min,max,step})=><label key={key} className="block text-xs text-slate-600">{label}<input required type="number" min={min} max={max} step={step??.1} aria-label={`${side} ${label}`} value={Number.isFinite((side==='baseline'?baseline:scenario)[key])?(side==='baseline'?baseline:scenario)[key]:''} onChange={event=>edit(side,key,event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"/></label>)}</fieldset>)}</div>
        <button disabled={busy} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy?'Running auxiliary GRU…':'Run research comparison'}</button>
      </form>
      {error&&<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{error}</p>}
      {result&&<div className="space-y-4"><PredictionChart loading={false} markSamples clockLabel="source clock" series={[{key:'reference',label:'Auxiliary reference',color:'#0891b2',points:points(result.baseline)},{key:'changed',label:'Auxiliary changed plan',color:'#a855f7',points:points(result.scenario)}]}/><div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="mb-3 text-left text-xs text-slate-500">Auxiliary estimates in mg/dL; connecting lines guide the eye between 24 trained 15-minute horizons.</caption><thead><tr><th>Horizon</th><th>Reference</th><th>Changed</th><th>Difference</th></tr></thead><tbody>{Array.from({length:24},(_,i)=>[(i+1)*15,i]).filter(([h])=>h%interval===0).map(([h,i])=><tr key={h} className="border-t border-slate-100"><th className="py-2">+{h} min</th><td>{result.baseline[i].toFixed(1)}</td><td>{result.scenario[i].toFixed(1)}</td><td>{(result.scenario[i]-result.baseline[i]).toFixed(1)}</td></tr>)}</tbody></table></div><label className="block text-xs">Result name<input aria-label="Auxiliary result name" value={label} maxLength={120} onChange={e=>{setLabel(e.target.value);setSaved(false);snapshot.current=crypto.randomUUID();}} className="ml-2 rounded-lg border border-slate-200 px-3 py-2"/></label><button type="button" onClick={()=>void save()} disabled={saving||saved} className="mr-4 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saved?'Saved':saving?'Saving?':'Save to lab results'}</button><button type="button" onClick={download} className="text-xs font-semibold text-teal-700 underline">Download research comparison with model identity</button></div>}
      <details className="text-xs leading-6 text-slate-600"><summary className="cursor-pointer font-semibold">Training evidence and limits</summary><p className="mt-2">CGMacros: 45 original participants across no diabetes, prediabetes and T2DM. After sensor-quality filtering: 28 training, 5 validation and 8 test participants. Participants never overlap splits. Checkpoint epochs use validation only. The full feature set retains activity controls; macros-only achieved a lower validation error. Test MAE at 15 / 30 / 60 / 240 / 360 minutes: {[15,30,60,240,360].map(h=>Number((manifest.evaluation.mae_mg_dl as Record<string,number>)[String(h)]).toFixed(2)).join(' / ')} mg/dL, conditional on recorded future inputs. These errors do not measure Shanghai transfer or intervention differences.</p><p className="mt-2">Small, single-seed experiment; no calibrated uncertainty or independent intervention outcomes. Effects can have unexpected directions. Sleep, stress, oral drugs, basal/long-acting insulin, beta-cell and incretin function require other datasets and evaluation.</p><p className="mt-2"><a className="underline" href="https://physionet.org/content/cgmacros/1.0.0/" target="_blank" rel="noreferrer">Gutierrez-Osuna, Kerr, Mortazavi &amp; Das (2025), CGMacros</a> · CC BY-NC-SA 4.0 · {manifest.version}</p></details>
    </div>}
  </section>;
}
