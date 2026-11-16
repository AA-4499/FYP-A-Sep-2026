import React,{useState} from 'react';
import {EventCatalogPicker} from './EventCatalogPicker';
import type {Formulation} from '../lib/conditionalFeatures';

const options=[
 {id:'rapid',name:'Rapid-acting bolus',detail:'Model assumption: 6-hour action, 75-minute peak'},
 {id:'regular',name:'Regular insulin bolus',detail:'Model assumption: 8-hour action, 180-minute peak'},
];
export function InsulinPicker({index,formulation,disabled,onSelect}:{index:number;formulation?:Formulation;disabled:boolean;onSelect:(name:string,formulation:Formulation)=>void}) {
 const [query,setQuery]=useState('');
 const matches=options.filter(row=>`${row.name} ${row.detail}`.toLowerCase().includes(query.trim().toLowerCase()));
 return <div className="space-y-3"><EventCatalogPicker label="Choose insulin" searchLabel={`Event ${index} insulin search`} placeholder="Search rapid or regular insulin" quick={options.map(row=>({...row,detail:row.id==='rapid'?'Rapid analogue':'Regular formulation'}))} options={matches} selectedId={formulation} query={query} onQuery={setQuery} onSelect={id=>{const row=options.find(option=>option.id===id);if(row)onSelect(row.name,row.id as Formulation);}} disabled={disabled} footer="2 supported bolus formulations"/>
  <details className="text-[10px] leading-5 text-slate-500"><summary className="cursor-pointer">Insulin model assumptions</summary><p className="mt-2">These are the formulations supported by the trained event inputs. The action curves estimate bolus insulin on board. Basal, premixed and long-acting insulin are not represented. This is a hypothetical scenario, with no suggested dose.</p></details>
 </div>;
}
