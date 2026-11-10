import React, {useEffect, useState} from 'react';
import {getSupabaseClient} from '../lib/supabase';
import {getForecastApiUrl} from '../lib/forecast';
import type {FoodReference} from '../lib/foodComposition';
import {foodCarbohydrate} from '../lib/scenario';

export function FoodCompositionPicker({portion,engine,disabled,onSelect}:{portion:string;engine:'physiology'|'conditional';disabled:boolean;onSelect:(food:FoodReference)=>void}) {
  const [query,setQuery]=useState('');
  const [foods,setFoods]=useState<FoodReference[]>([]);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [more,setMore]=useState(false);
  useEffect(()=>{
    const abort=new AbortController();
    setFoods([]);setError('');setBusy(true);
    const timer=setTimeout(()=>void(async()=>{
      try {
        const client=getSupabaseClient();const session=client?(await client.auth.getSession()).data.session:null;
        if(!session)throw Error('Sign in to load the food reference table.');
        const response=await fetch(`${getForecastApiUrl()}/api/food-composition?q=${encodeURIComponent(query)}`,{signal:abort.signal,headers:{Authorization:`Bearer ${session.access_token}`}});
        if(!response.headers.get('content-type')?.includes('application/json'))throw Error('The backend food lookup is not deployed at this service address. Manual entry is available.');
        const data=await response.json();if(!response.ok)throw Error(data.error||'Food lookup unavailable.');
        if(!Array.isArray(data.foods))throw Error('The food reference response is invalid.');
        if(!abort.signal.aborted){setFoods(data.foods);setMore(data.has_more===true);}
      }catch(failure){if(!abort.signal.aborted)setError(failure instanceof Error?failure.message:'Food lookup unavailable.');}
      finally{if(!abort.signal.aborted)setBusy(false);}
    })(),300);
    return()=>{clearTimeout(timer);abort.abort();};
  },[query]);
  return <div className="space-y-2 rounded-xl border border-teal-100 bg-teal-50 p-3 text-xs">
    <label className="block font-semibold">Food reference · Supabase<input aria-label="Search food composition" value={query} maxLength={80} disabled={disabled} onChange={e=>setQuery(e.target.value)} placeholder="English or Chinese food name" className="mt-1 w-full rounded-lg border border-slate-200 p-2 font-normal"/></label>
    <p className="text-[10px] text-slate-600">CHO is available carbohydrate per 100 g edible portion. {engine==='conditional'?'This model uses total carbohydrate: CHO + recorded fibre.':'CHO is used directly; fibre is not subtracted again.'}</p>
    {busy&&<p role="status">Loading foods…</p>}{error&&<p role="alert" className="text-rose-700">{error}</p>}
    {!busy&&!error&&!foods.length&&<p>No matching food references. Try another name or enter carbohydrate manually.</p>}
    <div className="max-h-48 space-y-1 overflow-auto">{foods.map(food=>{const carbs=foodCarbohydrate(food,Number(portion),engine);return <button key={food.id} type="button" disabled={disabled||carbs===null||carbs<=0} onClick={()=>onSelect(food)} className="block w-full rounded-lg border border-teal-100 bg-white p-2 text-left disabled:opacity-50"><span className="font-semibold">{food.name}</span><span className="block text-[10px]">{food.chinese_name} · CHO {food.available_per_100g} g/100 g · fibre {food.fiber_per_100g??'unknown'} g/100 g</span><span className="block text-[10px]">{carbs===null?'Enter an edible portion; total-carbohydrate conversion also needs a numeric fibre value.':`${portion} g edible portion → ${carbs} g ${engine==='conditional'?'total':'available'} carbohydrate`}</span></button>;})}</div>
    {more&&<p className="text-[10px]">Showing the first 30 matches. Narrow your search.</p>}
  </div>;
}
