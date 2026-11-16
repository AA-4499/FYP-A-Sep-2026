import React, { useEffect, useState } from 'react';
import { listPredictionResults, type SavedPrediction } from '../lib/predictionResults';
import type { Patient } from '../types';
import { clinicalValue } from '../lib/clinicalData';
import { labGroups, laboratoryHighlights, predictionHighlights } from '../lib/resultHighlights';
import { PredictionChart } from './PredictionChart';
import { ForecastIntervalControl } from './ForecastIntervalControl';
import { sampleForecast, type ForecastInterval } from '../lib/forecastSampling';

const modelName=(row:SavedPrediction)=>row.output.model_family==='cgmacros-auxiliary'?'Nutrition & activity auxiliary':row.output.model_family==='conditional-v3'?'Conditional GRU v3':row.engine==='physiology'?'Previous physiology result':'Previous GRU result';
const dateLabel=(value:string)=>new Date(value).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur'});

export function LabResultsView({patient}:{patient:Patient}) {
  const [rows,setRows]=useState<SavedPrediction[]>([]),[selectedId,setSelectedId]=useState<string|null>(null);
  const [error,setError]=useState(''),[loading,setLoading]=useState(true);
  const [offset,setOffset]=useState(0),[retry,setRetry]=useState(0),[interval,setInterval]=useState<ForecastInterval>(15);
  useEffect(()=>{setOffset(0);setSelectedId(null);setRows([]);},[patient.id]);
  useEffect(()=>{
    let cancelled=false;setLoading(true);setError('');setSelectedId(null);setRows([]);
    listPredictionResults(patient.id,offset).then(data=>{if(!cancelled)setRows(data);}).catch(failure=>{if(!cancelled)setError(failure.message);}).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[patient.id,offset,retry]);
  const selected=rows.find(row=>row.id===selectedId&&row.patient_id===patient.id);
  const output=selected?(selected.scenario?{...selected.output,...selected.scenario}:selected.output):null;
  const baseline=output?sampleForecast(output.baseline,output.forecast_start,interval):[];
  const scenario=output?sampleForecast(output.scenario,output.forecast_start,interval):[];
  return <div className="space-y-5">
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <h1 className="text-2xl font-bold">Lab results</h1><p className="text-sm text-slate-500">{patient.id}</p>
      <details><summary className="cursor-pointer text-sm font-semibold text-teal-700">Recorded laboratory measurements &amp; explanations</summary>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">{laboratoryHighlights(patient).map(line=><li key={line}>{line}</li>)}</ul>
        <div className="mt-4 grid gap-4 md:grid-cols-2">{labGroups.map(group=><section key={group.title} className="rounded-xl border border-slate-200 p-4"><h2 className="font-semibold">{group.title}</h2><details><summary className="mt-2 cursor-pointer text-xs text-slate-500">About these measurements</summary><p className="mt-2 text-xs leading-5">{group.purpose}</p></details><dl className="mt-3 divide-y divide-slate-100">{group.tests.map(([label,key,unit])=><div key={key} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><dt className="text-slate-600">{label}</dt><dd>{clinicalValue(patient.recordedFields?.[key],unit)}</dd></div>)}</dl></section>)}</div>
      </details>
    </section>
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Saved results</h2><button type="button" onClick={()=>setRetry(v=>v+1)} className="text-sm font-semibold text-teal-700">Refresh</button></div>
      {loading?<p role="status">Loading saved results…</p>:error?<p role="alert" className="text-sm text-rose-700">{error}</p>:rows.length===0?<p className="text-sm text-slate-500">No saved predictions. Use “Save to lab results” after running a prediction.</p>:<div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="mb-3 text-left text-xs text-slate-500">Select a saved result to review its chart and values. Times shown in MYT.</caption><thead className="text-xs text-slate-500"><tr><th className="p-2">Select</th><th className="p-2">Result</th><th className="p-2">Saved at</th><th className="p-2">Model</th><th className="p-2">Window</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className={`border-t border-slate-100 ${selectedId===row.id?'bg-teal-50':''}`}><td className="p-2"><input type="radio" name="saved-result" aria-label={`Select result ${row.id}`} checked={selectedId===row.id} onChange={()=>setSelectedId(row.id)}/></td><td className="p-2"><button type="button" onClick={()=>setSelectedId(row.id)} className="text-left font-semibold text-teal-700">{row.output.result_label||`${modelName(row)} · ${dateLabel(row.created_at)}`}</button></td><td className="whitespace-nowrap p-2"><time dateTime={row.created_at}>{dateLabel(row.created_at)}</time></td><td className="p-2">{modelName(row)}</td><td className="p-2">{row.output.horizon_hours}h</td></tr>)}</tbody></table></div>}
      <div className="flex items-center gap-4 text-sm"><button type="button" disabled={loading||offset===0} onClick={()=>setOffset(v=>Math.max(0,v-20))} className="disabled:opacity-40">Previous</button><span className="text-xs text-slate-500">Page {offset/20+1}</span><button type="button" disabled={loading||rows.length<20} onClick={()=>setOffset(v=>v+20)} className="disabled:opacity-40">Next</button></div>
      <details className="text-xs leading-6 text-slate-500"><summary className="cursor-pointer font-semibold">About saved results</summary><p className="mt-2">These are model predictions, not measured laboratory tests. Each snapshot retains its original model, input plans and all available prediction points. Display intervals do not retrain or alter the saved result.</p></details>
    </section>
    {selected&&output?<section key={selected.id} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6" data-testid="selected-saved-result">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{selected.output.result_label||modelName(selected)}</h2><ForecastIntervalControl value={interval} onChange={setInterval}/></div>
      <PredictionChart clockLabel="source clock" loading={false} markSamples series={[{key:'baseline',label:'Reference plan',color:'#2563eb',points:baseline},{key:'scenario',label:'Changed plan',color:'#0f766e',points:scenario}]}/>
      <div className="max-h-96 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th className="py-2">Forecast time (source clock)</th><th>Reference mg/dL</th><th>Changed mg/dL</th><th>Difference</th></tr></thead><tbody>{baseline.map((point,i)=><tr key={point.timestamp} className="border-t border-slate-100"><td className="py-2">{point.timestamp.replace('T',' ').slice(0,16)}</td><td>{point.value.toFixed(1)}</td><td>{scenario[i]?.value.toFixed(1)??'—'}</td><td>{scenario[i]?(scenario[i].value-point.value).toFixed(1):'—'}</td></tr>)}</tbody></table></div>
      <details className="text-sm"><summary className="cursor-pointer font-semibold text-teal-700">Explanation, saved inputs &amp; model details</summary><p className="mt-3 whitespace-pre-wrap text-sm">{selected.event_summary}</p><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">{predictionHighlights(output,selected.engine).map(line=><li key={line}>{line}</li>)}</ul><p className="mt-3 break-all text-xs text-slate-500">Model: {output.model_version||modelName(selected)} · {selected.model_sha256}</p><p className="mt-2 text-xs text-slate-500">Forecast origin: {output.forecast_start} · Source: {output.source}</p></details>
    </section>:!loading&&rows.length>0?<p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">Select a result from the list.</p>:null}
  </div>;
}
