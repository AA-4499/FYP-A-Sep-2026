import React,{useState} from 'react';
import {activityReference,searchActivities,activityDose} from '../lib/conditionalFeatures';

export function ActivityPicker({index,activityId,minutes,disabled,onSelect}:{index:number;activityId?:string;minutes:string;disabled:boolean;onSelect:(id:string,name:string,met:number)=>void}) {
 const [query,setQuery]=useState(''),[category,setCategory]=useState('all');
 const matches=searchActivities(query,category),selected=activityReference(activityId);
 let dose;try{if(selected)dose=activityDose(selected.met,Number(minutes));}catch{/* Incomplete duration is a draft. */}
 const input='mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs';
 return <div className="space-y-3">
  <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2">
   <label className="text-[11px] text-slate-500">Search activity<input aria-label={`Event ${index} activity search`} type="search" className={input} value={query} disabled={disabled} placeholder="Walking, cycling…" onChange={e=>setQuery(e.target.value)}/></label>
   <label className="text-[11px] text-slate-500">Activity type<select aria-label={`Event ${index} activity category`} className={input} value={category} disabled={disabled} onChange={e=>setCategory(e.target.value)}>{['all','Walking','Cycling','Conditioning'].map(value=><option key={value} value={value}>{value==='all'?'All types':value}</option>)}</select></label>
  </div>
  <label className="block text-[11px] text-slate-500">Choose activity<select aria-label={`Event ${index} activity`} className={input} required value={activityId??''} disabled={disabled} onChange={e=>{const row=activityReference(e.target.value);if(row)onSelect(row.id,row.name,row.met);}}>
   <option value="">Select an activity</option>
   {selected&&!matches.some(row=>row.id===selected.id)&&<option value={selected.id}>{selected.name} (selected)</option>}
   {matches.map(row=><option key={row.id} value={row.id}>{row.name} · {row.met} MET</option>)}
  </select></label>
  {!matches.length&&<p role="status" className="text-xs text-slate-500">No matching activities. Try another search or type.</p>}
  {selected&&<p className="rounded-lg bg-teal-50 p-2 text-xs leading-5 text-teal-900">{selected.met} MET{dose?` × ${minutes} min = ${dose.metMinutes.toFixed(1)} MET-min (${dose.aboveRestMetMinutes.toFixed(1)} above rest)`:'. Enter a duration to calculate exercise volume.'}</p>}
  <details className="text-[10px] leading-5 text-slate-500"><summary className="cursor-pointer">Activity reference & how duration is used</summary><p className="mt-2">Names and intensity presets use the 2024 Adult Compendium. Training data contain measured MET intensity, without sport labels. The model has not separately learned each named activity. Duration becomes a timed MET profile in the same v3 prediction; it is not a fixed glucose reduction. Partial 15-minute bins assume 1 MET outside your activity; other future bins remain unknown.</p>{selected&&<a className="underline" href={selected.source} target="_blank" rel="noreferrer">View MET reference</a>}</details>
 </div>;
}
