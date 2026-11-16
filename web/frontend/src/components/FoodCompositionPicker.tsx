import React,{useEffect,useState} from 'react';
import {EventCatalogPicker} from './EventCatalogPicker';
import {searchFoodCatalog,type FoodCatalogPage} from '../lib/foodCatalog';
import {foodCarbohydrate} from '../lib/scenario';
import type {FoodReference} from '../lib/foodComposition';
export interface QuickFoodItem {id:string;name:string;chineseName:string;icon:string;defaultPortion:number;carbsPer100g:number;presets:{label:string;grams:number}[]}
export const QUICK_FOODS: QuickFoodItem[] = [
  {
    id: 'rice',
    name: 'White Rice',
    chineseName: '白米饭',
    icon: 'rice',
    defaultPortion: 150,
    carbsPer100g: 28.2,
    presets: [
      { label: 'Small (100g)', grams: 100 },
      { label: '1 Bowl (150g)', grams: 150 },
      { label: 'Large (200g)', grams: 200 },
    ],
  },
  {
    id: 'bread',
    name: 'Bread',
    chineseName: '面包',
    icon: 'bread',
    defaultPortion: 60,
    carbsPer100g: 49.4,
    presets: [
      { label: '1 Slice (30g)', grams: 30 },
      { label: '2 Slices (60g)', grams: 60 },
      { label: '3 Slices (90g)', grams: 90 },
    ],
  },
  {
    id: 'noodles',
    name: 'Noodles / Pasta',
    chineseName: '面条 / 意面',
    icon: 'noodles',
    defaultPortion: 180,
    carbsPer100g: 25.0,
    presets: [
      { label: 'Small (120g)', grams: 120 },
      { label: '1 Bowl (180g)', grams: 180 },
      { label: 'Large (240g)', grams: 240 },
    ],
  },
  {
    id: 'fruit',
    name: 'Fresh Fruit',
    chineseName: '水果 (苹果/橙)',
    icon: 'fruit',
    defaultPortion: 150,
    carbsPer100g: 13.5,
    presets: [
      { label: 'Small (100g)', grams: 100 },
      { label: 'Medium (150g)', grams: 150 },
      { label: 'Large (220g)', grams: 220 },
    ],
  },
  {
    id: 'milk',
    name: 'Milk / Drink',
    chineseName: '牛奶 / 饮品',
    icon: 'milk',
    defaultPortion: 250,
    carbsPer100g: 4.8,
    presets: [
      { label: 'Small (120ml)', grams: 120 },
      { label: '1 Glass (250ml)', grams: 250 },
      { label: 'Large (350ml)', grams: 350 },
    ],
  },
  {
    id: 'lowcarb',
    name: 'Low-Carb Meal',
    chineseName: '低碳餐 (肉/蛋/菜)',
    icon: 'lowcarb',
    defaultPortion: 200,
    carbsPer100g: 3.5,
    presets: [
      { label: 'Light (150g)', grams: 150 },
      { label: 'Regular (200g)', grams: 200 },
      { label: 'Hearty (300g)', grams: 300 },
    ],
  },
];


export interface FoodCompositionPickerProps {
 portion:string;carbohydrate?:string;description?:string;foodReference?:FoodReference;engine?:'physiology'|'conditional';disabled?:boolean;
 onSelect?:(food:FoodReference)=>void;
 onSelectFood?:(name:string,grams:number,carbs:number,reference?:FoodReference)=>void;
 onUpdatePortion?:(grams:number,carbs:number,reference?:FoodReference)=>void;
 onUpdateCarbs?:(carbs:number)=>void;
 onPortionDraft?:(value:string)=>void;
}
export function FoodCompositionPicker({portion,carbohydrate,description='',foodReference,engine='conditional',disabled=false,onSelectFood,onSelect,onUpdatePortion,onUpdateCarbs,onPortionDraft}:FoodCompositionPickerProps) {
 const [query,setQuery]=useState(''),[enabled,setEnabled]=useState(false),[offset,setOffset]=useState(0);
 const [page,setPage]=useState<FoodCatalogPage|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [retry,setRetry]=useState(0);
 const quick=QUICK_FOODS.find(row=>row.name.toLowerCase()===description.toLowerCase());
 const grams=Number(portion)>0?Number(portion):150;
 useEffect(()=>{
  if(!enabled)return;const abort=new AbortController();setLoading(true);setError('');
  const timer=setTimeout(()=>{searchFoodCatalog(query,offset,abort.signal).then(next=>{
   if(!abort.signal.aborted)setPage(previous=>({...next,foods:offset?[...(previous?.foods??[]),...next.foods]:next.foods}));
  }).catch(failure=>{if(!abort.signal.aborted){setPage(null);setError(failure instanceof Error?failure.message:'Unable to search foods.');}}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});},200);
  return()=>{abort.abort();clearTimeout(timer);};
 },[query,offset,enabled,retry]);
 function select(id:string){
  const common=QUICK_FOODS.find(row=>row.id===id);
  if(common){onSelectFood?.(common.name,common.defaultPortion,Number((common.defaultPortion*common.carbsPer100g/100).toFixed(1)));return;}
  const reference=page?.foods.find(row=>row.id===id);if(!reference)return;
  const carbs=foodCarbohydrate(reference,grams,engine);if(carbs===null)return;
  onSelectFood?.(reference.name,grams,carbs,reference);onSelect?.(reference);
 }
 function updatePortion(value:number){
  if(!Number.isFinite(value)||value<1||value>2000)return;
  const calculated=foodReference?foodCarbohydrate(foodReference,value,engine):Number((value*(quick?.carbsPer100g??(Number(carbohydrate)||0)/grams*100)/100).toFixed(1));
  if(calculated!==null)onUpdatePortion?.(value,calculated,foodReference);
 }
 const numeric='mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs';
 return <div className="min-w-0 space-y-3">
  <EventCatalogPicker label="Choose food" searchLabel="Search food catalog" placeholder="Search foods in English or Chinese" selectedId={foodReference?.id??quick?.id} query={query} onQuery={value=>{setQuery(value);setOffset(0);setPage(null);setEnabled(true);}} onOpen={()=>setEnabled(true)}
   quick={QUICK_FOODS.slice(0,3).map(row=>({id:row.id,name:row.name,detail:`${row.carbsPer100g} g carbs / 100 g`}))}
   options={(page?.foods??[]).map(row=>({id:row.id,name:row.name,detail:`${row.chinese_name} / ${row.category} / ${foodCarbohydrate(row,100,engine)??'Unknown'} g ${engine==='conditional'?'total':'available'} carbs / 100 g`,disabled:foodCarbohydrate(row,grams,engine)===null}))}
   disabled={disabled} loading={loading} error={error} onSelect={select} footer={page?.total!=null?`${page.total.toLocaleString()} ${query.trim()?'matching foods':'foods in Supabase'}`:'Supabase food catalog'} more={page?.has_more} onMore={()=>setOffset((page?.offset??0)+30)} onRetry={()=>{setOffset(0);setRetry(value=>value+1);}}/>
  {foodReference&&<p className="text-xs leading-5 text-slate-600"><strong className="text-slate-800">{foodReference.name}</strong><span className="mt-1 block">Supabase food reference / per 100 g edible portion</span></p>}
  <div className="grid grid-cols-2 gap-3">
   <label className="text-[11px] text-slate-500">Portion (g)<input aria-label="Food portion grams" className={numeric} type="number" min={1} max={2000} step={1} required disabled={disabled} value={portion} onChange={e=>{const value=Number(e.target.value);if(!e.target.value||!Number.isFinite(value)||value<1||value>2000)onPortionDraft?.(e.target.value);else updatePortion(value);}}/></label>
   <label className="text-[11px] text-slate-500">{engine==='conditional'?'Total carbohydrate':'Available carbohydrate'} (g)<input aria-label="Food carbohydrate grams" className={numeric} type="number" min={0} max={engine==='conditional'?150:200} step={0.1} required disabled={disabled} value={carbohydrate??''} onChange={e=>onUpdateCarbs?.(Number(e.target.value))}/></label>
  </div>
  {quick&&<div className="flex flex-wrap gap-2">{quick.presets.map(preset=><button type="button" key={preset.label} disabled={disabled} onClick={()=>updatePortion(preset.grams)} className={`rounded-lg px-3 py-1.5 text-[11px] ${grams===preset.grams?'bg-teal-700 text-white':'bg-slate-100 text-slate-600'}`}>{preset.label}</button>)}</div>}
  <details className="text-[10px] leading-5 text-slate-500"><summary className="cursor-pointer">Food reference & manual entry</summary><p className="mt-2">Search reads the Supabase catalog through the authenticated food service. Quick choices are editable reference estimates. Enter a custom food name and carbohydrate if needed. Catalog CHO is available carbohydrate; v3 adds known fiber once. Foods with unknown fiber need a manual total. Protein, fat and fiber are filled only when all three are recorded.</p></details>
 </div>;
}
