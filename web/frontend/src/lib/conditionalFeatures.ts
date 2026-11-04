import type {Cohort} from './conditionalDecoder';
export type Formulation='rapid'|'regular';
export interface Bolus{time:number;units:number;formulation:Formulation}
export interface PlannedEvent {kind:'meal'|'bolus';minutesAhead:number;amount:number;formulation?:Formulation}
export interface Plan{carbs:number;mealAt:number;bolus:number;bolusAt:number;formulation:Formulation;events?:PlannedEvent[]}
export interface ConditionalHistory{recordId:string;origin:number;timestamps:string[];features:number[][];staticContext:(number|null)[];boluses:Bolus[];excluded:number[];start:number;coverage:{describedMeals:number;convertedMeals:number;excludedInsulin:number;modeledBoluses:number;warmupIncomplete:boolean};}
export const normalizeFood=(value:unknown)=>String(value??'').normalize('NFKC').replace(/\s+/gu,' ').trim().toLowerCase();
export function sourceTime(value:unknown){const text=String(value??'').trim().replace(' ','T');return Date.parse(/Z$|[+-]\d\d:\d\d$/i.test(text)?text:text+'Z');}
const unavailable=new Set(['/','-','--','na','n/a','null','none','nan','data not available','not available','未记录','未記錄','无记录']);
const mealStatus=(v:unknown)=>{const t=normalizeFood(v);return !t?'blank':unavailable.has(t)?'unavailable':'description';};
const present=(v:unknown)=>!['','nan','none','null','/','--','data not available','na','n/a'].includes(String(v??'').trim().toLowerCase());
const columnKey=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function convertMeal(row:Record<string,unknown>,foods:Record<string,number>){
 let text=String(row['Dietary intake']??'').trim();const chinese=Object.keys(row).filter(c=>c.includes('饮食')||c.includes('进食')).map(c=>String(row[c]??'').trim());
 if(mealStatus(text)!=='description')text=chinese.find(s=>mealStatus(s)==='description')??text;
 if(mealStatus(text)==='blank')text=chinese.find(s=>mealStatus(s)==='unavailable')??text;
 const status=mealStatus(text);if(status!=='description')return {carbs:0,described:0,unresolved:0,unavailable:Number(status==='unavailable')};
 let carbs=0,complete=true,count=0;
 for(const part of text.split(/[\r\n;；]+/u).map(x=>x.trim()).filter(Boolean)){
  count++;const match=part.match(/^(.+?)\s*(\d+(?:\.\d+)?)\s*(grams?|g|克|毫升|ml)\s*$/iu);
  const food=match?foods[normalizeFood(match[1])]:undefined;
  if(!match||typeof food!=='number'||!Number.isFinite(food)||['ml','毫升'].includes(match[3].toLowerCase())){complete=false;continue;}
  carbs+=Number(match[2])*food/100;
 }
 complete=complete&&count>0;return {carbs:complete?carbs:0,described:1,unresolved:Number(!complete),unavailable:0};
}
export function insulinAmount(value:unknown){
 if(!present(value))return null;
 const text=String(value).trim();if(/^\d+(?:\.\d+)?$/.test(text))return Number(text);
 const values=[...text.matchAll(/(?<![\d.])(\d+(?:\.\d+)?)\s*(?:iu|units?|u|单位)(?:\s*\/\s*(?:h|hr|hour))?(?=$|[^\p{L}\p{N}_])/giu)];
 return values.length===1?Number(values[0][1]):null;
}
export function formulation(value:unknown):Formulation|null{
 const text=String(value??'').toLowerCase();if(/70\s*\/\s*30|30\s*\/\s*70|50\s*\/\s*50|30r|mix|degludec|detemir|glargine|nph/.test(text))return null;
 if(/aspart|lispro|glulisine/.test(text))return 'rapid';if(/novolin r|humulin r|gansulin r|regular/.test(text))return 'regular';return null;
}
export function remainingAction(age:number,type:Formulation){const duration=type==='rapid'?360:480,peak=type==='rapid'?75:180;if(age<0||age>=duration)return 0;if(age<=peak)return 1-age*age/(duration*peak);return (duration-age)**2/(duration*(duration-peak));}
export const iobAt=(time:number,boluses:Bolus[])=>boluses.reduce((total,b)=>total+(b.time<=time?b.units*remainingAction((time-b.time)/60000,b.formulation):0),0);
function insulinEvents(row:Record<string,unknown>,time:number){
 const routes:Record<string,string[]>={sc:[],iv:[],pump:[],basal:[]};
 for(const col of Object.keys(row)){const key=columnKey(col);if(key.startsWith('insulindosesc'))routes.sc.push(col);else if(key.startsWith('insulindoseiv'))routes.iv.push(col);else if(key.startsWith('csiibolusinsulin'))routes.pump.push(col);else if(key.startsWith('csiibasalinsulin')||key.startsWith(columnKey('胰岛素泵基础量')))routes.basal.push(col);}
 const boluses:Bolus[]=[];let excluded=0;
 for(const [route,cols] of Object.entries(routes)){const supplied=cols.map(c=>row[c]).filter(present);if(!supplied.length)continue;
  const dose=insulinAmount(supplied[0]),type=route==='sc'?formulation(supplied[0]):route==='pump'?'regular':null;
  if(dose===null||type===null||new Set(supplied.map(v=>String(v).trim())).size>1)excluded++;else boluses.push({time,units:dose,formulation:type});
 }
 return {boluses,excluded};
}
export function buildConditionalHistory(rows:Record<string,unknown>[],recordId:string,age:number,bmi:number,foods:Record<string,number>):ConditionalHistory{
 const ordered=rows.filter(r=>String(r['Patient Number'])===recordId).map(r=>({row:r,time:sourceTime(r.Date)})).filter(r=>Number.isFinite(r.time)).sort((a,b)=>a.time-b.time);
 const unique=[...new Map(ordered.map(r=>[r.time,r])).values()];const recent=unique.slice(-24);
 const number=(v:unknown)=>typeof v==='number'?v:typeof v==='string'&&v.trim()!==''&&/^\d+(\.\d+)?$/.test(v.trim())?Number(v):NaN;
 if(recent.length!==24||recent.some((r,i)=>!Number.isFinite(number(r.row['CGM (mg / dl)']))||number(r.row['CGM (mg / dl)'])<=0||(i>0&&Math.abs(r.time-recent[i-1].time-900000)>1000)))throw Error('24 consecutive valid CGM readings at 15-minute intervals are required. Missing readings are not interpolated.');
 const origin=recent[23].time,start=unique[0].time;const events=unique.map(r=>({...r,meal:convertMeal(r.row,foods),insulin:insulinEvents(r.row,r.time)}));
 const boluses=events.flatMap(r=>r.insulin.boluses),excluded=events.filter(r=>r.insulin.excluded>0).map(r=>r.time);
 const features=recent.map(({time,row})=>{
  const current=events.find(e=>e.time===time)!;const sum=(lower:number,upper:number)=>events.filter(e=>e.time<=time-lower*60000&&e.time>time-upper*60000).reduce((total,e)=>total+e.meal.carbs,0);
  const date=new Date(time),hour=date.getUTCHours()+date.getUTCMinutes()/60,m=current.meal;
  return [number(row['CGM (mg / dl)']),Math.sin(2*Math.PI*hour/24),Math.cos(2*Math.PI*hour/24),m.carbs,sum(0,60),sum(60,180),sum(180,360),m.described,m.unresolved,m.unavailable,iobAt(time,boluses),Number(current.insulin.boluses.length>0),Number(excluded.some(t=>t<=time&&t>time-480*60000)),Number(time-start<480*60000)].map(Math.fround);
 });
 const window=events.filter(e=>e.time>origin-360*60000);
 return {recordId,origin,start,timestamps:recent.map(r=>String(r.row.Date)),features,staticContext:[age,bmi].map(v=>Number.isFinite(v)&&v>0?v:null),boluses,excluded,
  coverage:{describedMeals:window.reduce((s,e)=>s+e.meal.described,0),convertedMeals:window.filter(e=>e.meal.described&&!e.meal.unresolved).length,modeledBoluses:boluses.filter(b=>b.time>origin-480*60000).length,excludedInsulin:events.filter(e=>e.time>origin-480*60000).reduce((s,e)=>s+e.insulin.excluded,0),warmupIncomplete:origin-start<480*60000}};
}
export function buildFuturePlan(history:ConditionalHistory,plan:Plan){
 let events:PlannedEvent[];
 if(plan.events!==undefined){
  if(!Array.isArray(plan.events)||plan.events.length>12)throw Error('Provide at most 12 planned events.');
  events=plan.events;
 }else{
  if(![plan.carbs,plan.bolus,plan.mealAt,plan.bolusAt].every(Number.isFinite)||plan.carbs<0||plan.carbs>150||plan.bolus<0||plan.bolus>50||![15,30,45,60,75,90,105,120,135,150,165,180,195,210,225,240].includes(plan.mealAt)||![15,30,45,60,75,90,105,120,135,150,165,180,195,210,225,240].includes(plan.bolusAt)||!['rapid','regular'].includes(plan.formulation))throw Error('Choose a valid four-hour scenario.');
  events=[];if(plan.carbs>0)events.push({kind:'meal',minutesAhead:plan.mealAt,amount:plan.carbs});if(plan.bolus>0)events.push({kind:'bolus',minutesAhead:plan.bolusAt,amount:plan.bolus,formulation:plan.formulation});
 }
 const doses=[...history.boluses],carbs=new Array<number>(16).fill(0),annotations=new Array<number>(16).fill(0);
 for(const event of events){
  if(!event||!['meal','bolus'].includes(event.kind)||!Number.isFinite(event.minutesAhead)||event.minutesAhead<=0||event.minutesAhead>240||!Number.isFinite(event.amount)||event.amount<=0)throw Error('Events need a positive amount and a time within the four-hour forecast.');
  const bin=Math.ceil(event.minutesAhead/15)-1;
  if(event.kind==='meal'){
   carbs[bin]+=event.amount;if(carbs[bin]>150)throw Error('The research model supports at most 150 g carbohydrate in one 15-minute bin.');
  }else{
   if(event.amount>50||!['rapid','regular'].includes(event.formulation??''))throw Error('Specify a supported rapid/regular bolus of at most 50 units.');
   doses.push({time:history.origin+event.minutesAhead*60000,units:event.amount,formulation:event.formulation!});annotations[bin]=1;
  }
 }
 return Array.from({length:16},(_,i)=>{const minute=(i+1)*15,time=history.origin+minute*60000,date=new Date(time),hour=date.getUTCHours()+date.getUTCMinutes()/60;
  return [Math.sin(2*Math.PI*hour/24),Math.cos(2*Math.PI*hour/24),carbs[i],Number(carbs[i]>0),0,0,iobAt(time,doses),annotations[i],Number(history.excluded.some(t=>t<=time&&t>time-480*60000)),Number(time-history.start<480*60000)].map(Math.fround);
 });
}
export function withoutPlannedEvents(plan:Plan,kind:'meal'|'bolus'):Plan{
 return {...plan,...(kind==='meal'?{carbs:0}:{bolus:0}),...(plan.events?{events:plan.events.filter(event=>event.kind!==kind)}:{})};
}
export function syntheticConditionalHistory(cohort:Cohort,foods:Record<string,number>){
 const start=Date.UTC(2021,0,1);const rows=Array.from({length:64},(_,i)=>({'Patient Number':'synthetic',Date:new Date(start+i*900000).toISOString(),'CGM (mg / dl)':120+8*Math.sin(i/8),'Dietary intake':i===52?'Rice 100 g':'','Insulin dose - s.c.':i===48?'Novolin R, 2 IU':''}));
 return buildConditionalHistory(rows,'synthetic',cohort==='ShanghaiT1DM'?35:55,25,foods);
}
