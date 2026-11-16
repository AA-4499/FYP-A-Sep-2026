import React,{useEffect,useId,useRef,useState} from 'react';
import {Check,Search,X} from 'lucide-react';

export interface CatalogOption {id:string;name:string;detail:string;disabled?:boolean}
export function EventCatalogPicker({label,searchLabel,placeholder,quick,options,selectedId,query,onQuery,onSelect,disabled=false,loading=false,error='',footer,more,onMore,onOpen,onRetry}: {
 label:string;searchLabel:string;placeholder:string;quick:CatalogOption[];options:CatalogOption[];selectedId?:string;query:string;onQuery:(query:string)=>void;onSelect:(id:string)=>void;disabled?:boolean;loading?:boolean;error?:string;footer?:string;more?:boolean;onMore?:()=>void;onOpen?:()=>void;onRetry?:()=>void;
}) {
 const [open,setOpen]=useState(false),[active,setActive]=useState(-1);
 const root=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),restoringFocus=useRef(false),id=useId();
 const available=options.filter(option=>!option.disabled);
 useEffect(()=>{if(!open||typeof document==='undefined')return;const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[open]);
 useEffect(()=>setActive(-1),[query,options.length]);
 useEffect(()=>{if(active>=0&&typeof document!=='undefined')document.getElementById(`${id}-${available[active]?.id}`)?.scrollIntoView({block:'nearest'});},[active,id]);
 const choose=(value:string)=>{onSelect(value);setOpen(false);setActive(-1);restoringFocus.current=true;input.current?.focus();restoringFocus.current=false;};
 return <div ref={root} className="min-w-0 space-y-3 rounded-2xl border border-teal-100 bg-teal-50/40 p-3" data-testid="event-catalog-picker">
  <p className="text-xs font-semibold text-teal-950">{label}</p>
  <div className={`grid gap-2 ${quick.length===2?'grid-cols-2':'grid-cols-3'}`}>{quick.map(option=><button key={option.id} type="button" disabled={disabled||option.disabled} aria-pressed={selectedId===option.id} title={option.name} onClick={()=>choose(option.id)} className={`min-w-0 rounded-xl border px-2 py-3 text-left text-xs transition disabled:opacity-40 ${selectedId===option.id?'border-teal-600 bg-teal-700 text-white':'border-slate-200 bg-white text-slate-700 hover:border-teal-300'}`}><span className="block break-words font-semibold">{option.name}</span><span className={`mt-1 block text-[10px] leading-4 ${selectedId===option.id?'text-teal-100':'text-slate-500'}`}>{option.detail}</span></button>)}</div>
  <div className="relative">
   <Search size={15} className="pointer-events-none absolute left-3 top-3 text-slate-400"/>
   <input ref={input} aria-label={searchLabel} role="combobox" aria-autocomplete="list" aria-expanded={open&&!disabled} aria-controls={`${id}-list`} aria-activedescendant={active>=0?`${id}-${available[active]?.id}`:undefined} autoComplete="off" value={query} disabled={disabled} maxLength={80} placeholder={placeholder} onClick={()=>{setOpen(true);onOpen?.();}} onFocus={()=>{if(!restoringFocus.current){setOpen(true);onOpen?.();}}} onChange={e=>{onQuery(e.target.value);setOpen(true);}} onKeyDown={e=>{
    if(e.key==='Escape'){e.preventDefault();setOpen(false);}
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true);setActive(value=>available.length?(value+(e.key==='ArrowDown'?1:-1)+available.length)%available.length:-1);}
    if(e.key==='Enter'&&open){e.preventDefault();if(active>=0&&available[active])choose(available[active].id);}
   }} className="w-full min-w-0 rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"/>
   {open&&!disabled&&<div className="absolute inset-x-0 top-full z-30 mt-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl" data-testid="catalog-popup">
    <div className="flex items-center justify-between border-b border-slate-100 px-2 pb-2 pt-1"><span className="text-[10px] font-semibold text-slate-500">{footer??'Choose a match'}</span><button type="button" aria-label={`Close ${searchLabel}`} onClick={()=>setOpen(false)} className="rounded p-1 text-slate-500"><X size={13}/></button></div>
    <div id={`${id}-list`} role="listbox" aria-label={`${label} results`} className="max-h-60 overflow-y-auto overscroll-contain">
     {loading&&<p role="status" className="p-3 text-xs text-slate-500">Searching…</p>}
     {!loading&&error&&<div className="p-3 text-xs leading-5 text-amber-900"><p role="alert">{error}</p>{onRetry&&<button type="button" onClick={onRetry} className="mt-2 font-semibold underline">Retry search</button>}</div>}
     {!loading&&!error&&!options.length&&<p role="status" className="p-3 text-xs text-slate-500">No matches. Try another search.</p>}
     {!loading&&!error&&options.map(option=><button key={option.id} id={`${id}-${option.id}`} type="button" role="option" aria-selected={selectedId===option.id} disabled={disabled||option.disabled} onClick={()=>choose(option.id)} className={`flex w-full items-start justify-between gap-2 rounded-lg px-3 py-2.5 text-left disabled:opacity-50 ${available[active]?.id===option.id?'bg-teal-50':'hover:bg-slate-50'}`}><span className="min-w-0"><span className="block break-words text-xs font-semibold text-slate-800">{option.name}</span><span className="mt-1 block text-[10px] leading-4 text-slate-500">{option.detail}</span></span>{selectedId===option.id&&<Check size={14} className="shrink-0 text-teal-700"/>}</button>)}
    </div>
    {more&&!loading&&!error&&<button type="button" onClick={onMore} className="w-full border-t border-slate-100 p-2 text-xs font-semibold text-teal-700">Load more foods</button>}
   </div>}
  </div>
 </div>;
}
