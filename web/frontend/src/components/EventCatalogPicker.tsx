import React,{useEffect,useId,useRef,useState} from 'react';
import {Check,Search,X,ChevronDown,Utensils,Wheat,Cookie,Soup,Apple,Milk,Salad,Syringe,Timer,Footprints,Bike,Dumbbell,Activity,LoaderCircle} from 'lucide-react';

export type CatalogIcon='rice'|'bread'|'noodles'|'fruit'|'milk'|'lowcarb'|'rapid'|'regular'|'walking'|'cycling'|'resistance';
export interface CatalogOption {id:string;name:string;detail:string;disabled?:boolean;icon?:CatalogIcon}
const icons={rice:Wheat,bread:Cookie,noodles:Soup,fruit:Apple,milk:Milk,lowcarb:Salad,rapid:Syringe,regular:Timer,walking:Footprints,cycling:Bike,resistance:Dumbbell};
export function EventCatalogPicker({label,searchLabel,placeholder,quick,options,selectedId,query,onQuery,onSelect,disabled=false,loading=false,error='',footer,more,onMore,onOpen,onRetry,tone='food'}: {
 label:string;searchLabel:string;placeholder:string;quick:CatalogOption[];options:CatalogOption[];selectedId?:string;query:string;onQuery:(query:string)=>void;onSelect:(id:string)=>void;disabled?:boolean;loading?:boolean;error?:string;footer?:string;more?:boolean;onMore?:()=>void;onOpen?:()=>void;onRetry?:()=>void;tone?:'food'|'insulin'|'activity';
}) {
 const [open,setOpen]=useState(false),[active,setActive]=useState(-1);
 const root=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),restoringFocus=useRef(false),id=useId();
 const available=options.filter(option=>!option.disabled);
 useEffect(()=>{if(!open||typeof document==='undefined')return;const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[open]);
 useEffect(()=>setActive(-1),[query,options.length]);
 useEffect(()=>{if(active>=0&&typeof document!=='undefined')document.getElementById(`${id}-${available[active]?.id}`)?.scrollIntoView({block:'nearest'});},[active,id]);
 const choose=(value:string)=>{onSelect(value);setOpen(false);setActive(-1);restoringFocus.current=true;input.current?.focus();restoringFocus.current=false;};
 const HeaderIcon=tone==='food'?Utensils:tone==='insulin'?Syringe:Activity;
 const optionIcon=(option:CatalogOption)=>option.icon?icons[option.icon]:HeaderIcon;
 return <div ref={root} className="event-catalog min-w-0 space-y-4" data-tone={tone} data-testid="event-catalog-picker">
  <div className="event-catalog-heading"><span className="event-catalog-heading-icon"><HeaderIcon size={21} strokeWidth={1.7}/></span><div className="min-w-0"><p className="text-sm font-bold">{label}</p><p className="mt-1 text-[11px] text-slate-500">{tone==='food'?'A favorite food, or something new.':tone==='insulin'?'Choose your supported bolus type.':'Find an activity for your plan.'}</p></div></div>
  <div className={`event-catalog-shortcuts ${quick.length===2?'event-catalog-shortcuts--pair':''} ${quick.length>3?'event-catalog-shortcuts--food':''}`}>{quick.map(option=>{const Icon=optionIcon(option);return <button key={option.id} type="button" disabled={disabled||option.disabled} aria-pressed={selectedId===option.id} title={option.name} onClick={()=>choose(option.id)} className="event-catalog-shortcut"><span className="event-catalog-shortcut-icon"><Icon size={25} strokeWidth={1.65}/></span>{selectedId===option.id&&<span className="event-catalog-selected-mark"><Check size={11} strokeWidth={3}/></span>}<span className="block break-words text-xs font-semibold">{option.name}</span><span className="event-catalog-shortcut-detail">{option.detail}</span></button>;})}</div>
  <div className="event-catalog-search relative">
   <Search size={16} className="event-catalog-search-icon pointer-events-none absolute left-3.5 top-3.5"/>
   <ChevronDown size={14} className="pointer-events-none absolute right-3.5 top-3.5 text-slate-400"/>
   <input ref={input} aria-label={searchLabel} role="combobox" aria-autocomplete="list" aria-expanded={open&&!disabled} aria-controls={`${id}-list`} aria-activedescendant={active>=0?`${id}-${available[active]?.id}`:undefined} autoComplete="off" value={query} disabled={disabled} maxLength={80} placeholder={placeholder} onClick={()=>{setOpen(true);onOpen?.();}} onFocus={()=>{if(!restoringFocus.current){setOpen(true);onOpen?.();}}} onChange={e=>{onQuery(e.target.value);setOpen(true);}} onKeyDown={e=>{
    if(e.key==='Escape'){e.preventDefault();setOpen(false);}
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true);setActive(value=>available.length?(value+(e.key==='ArrowDown'?1:-1)+available.length)%available.length:-1);}
    if(e.key==='Enter'&&open){e.preventDefault();if(active>=0&&available[active])choose(available[active].id);}
   }} className="event-catalog-search-input w-full min-w-0 py-3 pl-10 pr-9 text-xs outline-none"/>
   {open&&!disabled&&<div className="event-catalog-popup absolute inset-x-0 top-full z-30 mt-2" data-testid="catalog-popup">
    <div className="event-catalog-popup-heading"><span className="flex min-w-0 items-center gap-2 text-[11px] font-semibold"><HeaderIcon size={14}/>{footer??'Choose a match'}</span><button type="button" aria-label={`Close ${searchLabel}`} onClick={()=>setOpen(false)} className="rounded-lg p-1.5 transition hover:bg-white"><X size={14}/></button></div>
    <div id={`${id}-list`} role="listbox" aria-label={`${label} results`} className="max-h-60 overflow-y-auto overscroll-contain">
     {loading&&<p role="status" className="flex items-center gap-2 p-4 text-xs text-slate-500"><LoaderCircle size={15} className="motion-safe:animate-spin"/>Searching…</p>}
     {!loading&&error&&<div className="p-3 text-xs leading-5 text-amber-900"><p role="alert">{error}</p>{onRetry&&<button type="button" onClick={onRetry} className="mt-2 font-semibold underline">Retry search</button>}</div>}
     {!loading&&!error&&!options.length&&<p role="status" className="p-3 text-xs text-slate-500">No matches. Try another search.</p>}
     {!loading&&!error&&options.map(option=>{const Icon=optionIcon(option);return <button key={option.id} id={`${id}-${option.id}`} type="button" role="option" aria-selected={selectedId===option.id} data-active={available[active]?.id===option.id} disabled={disabled||option.disabled} onClick={()=>choose(option.id)} className="event-catalog-result"><span className="event-catalog-result-icon"><Icon size={16} strokeWidth={1.8}/></span><span className="min-w-0 flex-1"><span className="block break-words text-xs font-semibold text-slate-800">{option.name}</span><span className="mt-1 block text-[10px] leading-4 text-slate-500">{option.detail}</span></span>{selectedId===option.id&&<Check size={15} className="event-catalog-result-check shrink-0"/>}</button>;})}
    </div>
    {more&&!loading&&!error&&<button type="button" onClick={onMore} className="event-catalog-more w-full p-3 text-xs font-semibold">Load more foods</button>}
   </div>}
  </div>
 </div>;
}
