import React,{useState} from 'react';
import {activityReference,searchActivities,activityDose} from '../lib/conditionalFeatures';
import {EventCatalogPicker} from './EventCatalogPicker';

export function ActivityPicker({index,activityId,minutes,disabled,onSelect}:{index:number;activityId?:string;minutes:string;disabled:boolean;onSelect:(id:string,name:string,met:number)=>void}) {
 const [query,setQuery]=useState('');
 const selected=activityReference(activityId),matches=searchActivities(query);
 let dose;try{if(selected)dose=activityDose(selected.met,Number(minutes));}catch{/* Incomplete duration is a draft. */}
 const choose=(id:string)=>{const row=activityReference(id);if(row)onSelect(row.id,row.name,row.met);};
 return <div className="space-y-3">
  <EventCatalogPicker tone="activity" label="Choose activity" searchLabel={`Event ${index} activity search`} placeholder="Search walking, cycling, resistance..." query={query} onQuery={setQuery} selectedId={activityId} disabled={disabled} onSelect={choose}
   quick={['17190','01010','02054'].map((id,i)=>{const row=activityReference(id)!;return {id,name:['Walking','Cycling','Resistance'][i],detail:`${row.met} MET`,icon:(['walking','cycling','resistance'] as const)[i]};})}
   options={matches.map(row=>({id:row.id,name:row.name,detail:`${row.category} / ${row.met} MET`}))} footer={`${matches.length} supported intensity presets`}/>
  {selected&&<div className="rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50/50 px-4 py-3 text-xs leading-5"><p className="font-semibold text-amber-950">{selected.name}</p><p className="mt-1 font-medium text-amber-800">{selected.met} MET{dose?` x ${minutes} min = ${dose.metMinutes.toFixed(1)} MET-min`:'. Enter a duration to calculate exercise volume.'}</p></div>}
  <details className="text-[10px] leading-5 text-slate-500"><summary className="cursor-pointer">Activity reference & duration</summary><p className="mt-2">The 2024 Adult Compendium supplies activity names and MET presets. Training records contain measured MET intensity without sport labels. Duration enters the same v3 prediction as a timed MET profile. Partial 15-minute bins assume rest at 1 MET outside your interval; other bins remain unknown.</p>{selected&&<a className="underline" href={selected.source} target="_blank" rel="noreferrer">View intensity reference</a>}</details>
 </div>;
}
