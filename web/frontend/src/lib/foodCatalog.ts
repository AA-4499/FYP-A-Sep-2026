import {getSupabaseClient} from './supabase';
import {getForecastApiUrl} from './forecast';
import type {FoodReference} from './foodComposition';

export interface FoodCatalogPage {foods:FoodReference[];has_more:boolean;total:number|null;offset:number;source:string}
const nutrient=(raw:unknown):number|null=>{
 if(raw==null||typeof raw==='boolean'||String(raw).trim()==='')return null;
 const value=Number(raw);return Number.isFinite(value)&&value>=0&&value<=100?value:null;
};
export async function catalogReference(row:Record<string,unknown>):Promise<FoodReference|null> {
 const available=nutrient(row['CHO (g)']);
 if(available===null||row.id==null)return null;
 const value={id:String(row.id),name:String(row.englishName||row.foodName||'').trim(),chinese_name:String(row.foodName??''),category:String(row.categoryMain??''),available_per_100g:available,fiber_per_100g:nutrient(row['dietaryFiber (g)']),protein_per_100g:nutrient(row['protein (g)']),fat_per_100g:nutrient(row['fat (g)']),basis:'available_carbohydrate_per_100g_edible_portion' as const};
 if(!value.name)return null;
 const canonical=JSON.stringify(value,Object.keys(value).sort());
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));
 return {...value,reference_sha256:Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')};
}
export async function searchFoodCatalog(query:string,offset=0,signal?:AbortSignal):Promise<FoodCatalogPage> {
 const client=getSupabaseClient();
 const auth=client?(await client.auth.getSession()).data.session:null;
 if(!auth)throw Error('Sign in to search the food catalog.');
 if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
 const timeout=AbortSignal.timeout(12000),bounded=signal?AbortSignal.any([signal,timeout]):timeout;
 // Respect the signed-in user's existing RLS. An empty response cannot prove
 // the catalog is empty, so use the authenticated server route as a fallback.
 if(client&&typeof client.from==='function'){
  try{
   const term=query.slice(0,80).replace(/[^\p{L}\p{N}\s-]/gu,'').trim();
   let request=client.from('food_composition').select('id,foodName,englishName,categoryMain,"CHO (g)","dietaryFiber (g)","protein (g)","fat (g)"',{count:'exact'}).order('id').range(offset,offset+30);
   if(term)request=request.or(`englishName.ilike.*${term}*,foodName.ilike.*${term}*`);
   request=request.abortSignal(bounded);
   const result=await request;
   if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
   if(!result.error&&Array.isArray(result.data)&&(result.data.length||Number(result.count)>0)){
    const rows=await Promise.all(result.data.slice(0,30).map(row=>catalogReference(row)));
    return {foods:rows.filter((row):row is FoodReference=>row!==null),has_more:result.data.length>30,total:result.count,offset,source:'supabase.food_composition'};
   }
  }catch(error){if(signal?.aborted)throw error;}
 }
 let response:Response;
 try{response=await fetch(`${getForecastApiUrl()}/api/food-composition?${new URLSearchParams({q:query,offset:String(offset)})}`,{signal:bounded,headers:{Authorization:`Bearer ${auth.access_token}`}});}
 catch(error){if(signal?.aborted)throw error;throw Error('Food search is unavailable. Retry when the food service is online, or enter food and carbohydrate manually.');}
 if(!response.headers.get('content-type')?.includes('application/json'))throw Error('The food service is unavailable. Manual food entry remains available.');
 const page=await response.json();
 if(!response.ok)throw Error(page.error??'Unable to load the food catalog.');
 if(page.source!=='supabase.food_composition'||!Array.isArray(page.foods)||typeof page.has_more!=='boolean'||page.foods.some((row:FoodReference)=>!row||!row.id||!row.name||row.basis!=='available_carbohydrate_per_100g_edible_portion'||!Number.isFinite(row.available_per_100g)||row.available_per_100g<0||row.available_per_100g>100||!/^[a-f0-9]{64}$/.test(row.reference_sha256)))throw Error('The food service returned an unsupported catalog format.');
 return page;
}
