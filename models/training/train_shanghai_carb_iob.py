"""Retrospective history-conditioned candidates; no future-event or exercise input.

USDA reference substitutions and triangular bolus action curves are research
assumptions, not verified dietary measurements or individualized insulin kinetics.
"""
from __future__ import annotations
import argparse, hashlib, io, json, re, warnings, zipfile
from pathlib import Path
import numpy as np
import pandas as pd
import torch
from models.training import train_shanghai_supported_features as base
from models.training.train_shanghai_gru import load_source, patient_split, write_json
import unicodedata

def normalize(value):
    return re.sub(r'\s+',' ',unicodedata.normalize('NFKC',str(value))).strip().casefold()

def parse_items(text):
    items=[]
    for line in re.split(r'[\r\n;；]+',str(text)):
        line=line.strip()
        if not line:continue
        match=re.fullmatch(r'(.+?)\s*(\d+(?:\.\d+)?)\s*(grams?|g|克|毫升|ml)\s*',line,re.I)
        if not match:items.append({'food_key':normalize(line),'amount':None,'unit':'','raw':line});continue
        name,amount,unit=match.groups()
        items.append({'food_key':normalize(name),'amount':float(amount),'unit':'ml' if unit.lower() in ('ml','毫升') else 'g','raw':line})
    return items

def convert_meal(items,lookup):
    total=0.;unresolved=[]
    for item in items:
        entry=lookup.get(item['food_key'])
        if item['amount'] is None or entry is None or item['unit']!='g':unresolved.append(item['raw']);continue
        total+=item['amount']*entry[0]/100
    return (np.nan if unresolved or not items else total),total,unresolved

def read_meal_annotations(archive):
    unavailable={'/','-','--','na','n/a','null','none','nan','data not available','not available','未记录','未記錄','无记录'}
    def classify(text):
        text=normalize(text)
        return 'blank' if not text else 'unavailable' if text in unavailable else 'description'
    rows=[]
    with zipfile.ZipFile(archive) as source:
        for name in sorted(source.namelist()):
            if '__MACOSX' in name or not re.fullmatch(r'\d+_\d+_\d+\.xlsx?',Path(name).name):continue
            cohort='ShanghaiT1DM' if 'T1DM' in name else 'ShanghaiT2DM'
            frame=pd.read_excel(io.BytesIO(source.read(name)),keep_default_na=False)
            en=next((c for c in frame if str(c).strip().casefold()=='dietary intake'),None)
            cn=[c for c in frame if any(s in str(c) for s in ('饮食','进食'))]
            date=next(c for c in frame if base.normalize(c)=='date')
            times=pd.to_datetime(frame[date],errors='coerce')
            for i,row in frame.iterrows():
                if pd.isna(times.iloc[i]):continue
                text=str(row[en]).strip() if en else '';chinese=[str(row[c]).strip() for c in cn]
                if classify(text)!='description':text=next((s for s in chinese if classify(s)=='description'),text)
                if classify(text)=='blank':text=next((s for s in chinese if classify(s)=='unavailable'),text)
                status=classify(text)
                if status=='blank':continue
                rows.append({'cohort':cohort,'session_id':Path(name).stem,'source_row':i+2,
                    'source_timestamp':times.iloc[i],'meal_text':text,'food_description_present':int(status=='description'),
                    'dietary_unavailable_marker':int(status=='unavailable')})
    return pd.DataFrame(rows)

FEATURES=['glucose_mg_dl','hour_sin','hour_cos','reference_complete_meal_carb_g',
          'recorded_complete_meal_carb_0_1h_g','recorded_complete_meal_carb_1_3h_g',
          'recorded_complete_meal_carb_3_6h_g','meal_description_present',
          'meal_conversion_unresolved','meal_explicit_unavailable',
          'modeled_bolus_iob_units','modeled_bolus_annotation_present',
          'excluded_insulin_annotation_8h','iob_session_warmup_incomplete']
FLAGS=[7,8,9,11,12,13]
# Exact description aliases only. Generic dishes and unknown recipes stay unresolved.
# Mapping is an analyst-selected reference substitution, not dietitian validation.
FOODS={168878:['rice','米饭'],173424:['egg','boiled egg','鸡蛋','水煮蛋'],
       171265:['milk','牛奶'],168409:['cucumber','黄瓜'],169976:['cabbage','卷心菜'],
       169980:['chinese cabbage','大白菜'],168484:['sweet potato','红薯'],
       168486:['taro','芋头'],169999:['corn','玉米'],174924:['bread','面包'],
       169097:['orange','橙子'],173944:['banana','香蕉'],167765:['watermelon','西瓜'],
       174683:['grape','grapes','葡萄'],169249:['lettuce','生菜'],
       170457:['tomato','tomatoes','番茄','西红柿'],170440:['potato','土豆'],
       168449:['pumpkin','南瓜']}

def remaining_fraction(age_minutes, duration, peak):
    """Integral of a unit-area triangular action curve; explicit scenario model."""
    if not 0 < peak < duration: raise ValueError('Require 0 < peak < duration')
    age=np.asarray(age_minutes,dtype=float)
    return np.where(age<=0,1.,np.where(age>=duration,0.,np.where(age<=peak,
        1-age**2/(duration*peak),(duration-age)**2/(duration*(duration-peak)))))

def bolus_curve(text):
    text=str(text).casefold()
    if re.search(r'70\s*/\s*30|30\s*/\s*70|50\s*/\s*50|30r|mix|degludec|detemir|glargine|nph',text):return None
    if any(x in text for x in ['aspart','lispro','glulisine']):return (360.,75.,'rapid_assumed_6h_peak75m')
    if any(x in text for x in ['novolin r','humulin r','gansulin r','regular']):return (480.,180.,'regular_assumed_8h_peak180m')
    return None

def modeled_iob(times,doses):
    times=pd.DatetimeIndex(times).as_unit('ns').asi8
    result=np.zeros(len(times));annotation=np.zeros(len(times))
    for t,dose,curve in doses:
        ages=(times-t)/60e9
        result+=np.where(ages>=0,dose*remaining_fraction(ages,*curve[:2]),0.)
        annotation[times==t]=1
    return result,annotation

def nutrient_lookup(archive,destination):
    with zipfile.ZipFile(archive) as source:
        food=pd.read_csv(source.open(next(n for n in source.namelist() if n.endswith('/food.csv')))).set_index('fdc_id')
        nutrients=pd.read_csv(source.open(next(n for n in source.namelist() if n.endswith('/food_nutrient.csv'))))
        values=nutrients[nutrients.nutrient_id==1005].set_index('fdc_id')['amount']
    lookup={};rows=[]
    for food_id,aliases in FOODS.items():
        value=float(values.loc[food_id])
        for alias in aliases:
            # Volumes are deliberately unresolved: no undocumented density conversion.
            lookup[normalize(alias)]=(value,None)
            rows.append({'food_key':alias,'fdc_id':food_id,'reference_description':food.loc[food_id,'description'],
                'carb_g_per_100g':value,'mapping_status':'analyst_reference_assumption_not_dietitian_reviewed',
                'assumptions':'edible weight; reference preparation; milk whole; egg hard-boiled; rice cooked',
                'source':'USDA SR Legacy April 2018; carbohydrate by difference (1005)'})
    pd.DataFrame(rows).to_csv(destination/'reference_food_mapping.csv',index=False)
    return lookup

def add_features(archive,sessions,lookup,destination):
    events=read_meal_annotations(archive)
    meals={};meal_audit=[]
    for row in events.to_dict('records'):
        carb,partial,unresolved=convert_meal(parse_items(row['meal_text']),lookup) if row['food_description_present'] else (np.nan,0,[])
        key=(row['cohort'],row['session_id'],pd.Timestamp(row['source_timestamp']).value)
        if key in meals:raise ValueError('Duplicate meal annotation timestamp')
        meals[key]=(float(carb) if np.isfinite(carb) else 0.,int(row['food_description_present']),
                    int(bool(row['food_description_present']) and not np.isfinite(carb)),int(row['dietary_unavailable_marker']))
        meal_audit.append({'cohort':row['cohort'],'session':row['session_id'],'source_row':row['source_row'],
                          'complete_conversion':bool(np.isfinite(carb)),'reference_carb_g':float(carb) if np.isfinite(carb) else None,
                          'unresolved_items':unresolved})
    write_json(destination/'meal_conversion_audit.json',meal_audit)
    insulin={};dose_audit=[]
    with zipfile.ZipFile(archive) as source:
        for name in sorted(source.namelist()):
            if '__MACOSX' in name or not re.fullmatch(r'\d+_\d+_\d+\.xlsx?',Path(name).name):continue
            cohort='ShanghaiT1DM' if 'T1DM' in name else 'ShanghaiT2DM'
            frame=pd.read_excel(io.BytesIO(source.read(name)),keep_default_na=False)
            date=next(c for c in frame if base.normalize(c)=='date');columns=base.route_columns(frame)
            times=pd.to_datetime(frame[date],errors='coerce');doses=[];excluded=[]
            for i,row in frame.iterrows():
                if pd.isna(times.iloc[i]):continue
                t=times.iloc[i].value
                for route,cols in columns.items():
                    supplied=[row[c] for c in cols if base.present(row[c])]
                    if not supplied:continue
                    amount,flag,missing=base.insulin_amount(supplied[0]);text=str(supplied[0])
                    curve=bolus_curve(text) if route=='sc_dose_units' else bolus_curve('Novolin R') if route=='pump_bolus_units' else None
                    conflict=len({str(v).strip() for v in supplied})>1
                    usable=curve is not None and not missing and not conflict
                    if usable:doses.append((t,amount,curve))
                    else:excluded.append(t)
                    dose_audit.append({'cohort':cohort,'session':Path(name).stem,'source_row':i+2,'route':route,
                        'modeled':usable,'dose_units':amount if usable else None,'curve':curve[2] if usable else None})
            insulin[(cohort,Path(name).stem)]=(doses,np.asarray(excluded,dtype=np.int64))
    write_json(destination/'insulin_conversion_audit.json',dose_audit)
    coverage=[]
    for cohort,data in sessions.items():
        for s in data:
            times=pd.DatetimeIndex(s['times']).as_unit('ns').asi8
            m=np.asarray([meals.get((cohort,s['record'],int(t)),(0.,0.,0.,0.)) for t in times])
            doses,excluded=insulin[(cohort,s['record'])]
            iob,annotation=modeled_iob(s['times'],doses)
            recent=np.asarray([float(np.any((excluded<=t)&(excluded>t-480*60e9))) for t in times])
            rolling=[]
            for lower,upper in [(0,60),(60,180),(180,360)]:
                rolling.append(np.asarray([m[(times<=t-lower*60e9)&(times>t-upper*60e9),0].sum() for t in times]))
            s['dynamic']=np.column_stack([s['dynamic'][:,:3],m[:,0],*rolling,m[:,1:],iob,annotation,recent,(times-times[0]<480*60e9).astype(float)]).astype(np.float32)
            assert s['dynamic'].shape[1]==len(FEATURES)
            coverage.append({'cohort':cohort,'session':s['record'],'described_meals':int(m[:,1].sum()),
                'complete_reference_meals':int(((m[:,1]==1)&(m[:,2]==0)).sum()),
                'modeled_bolus_events':len(doses),'excluded_insulin_annotations':len(excluded)})
    write_json(destination/'coverage.json',coverage)

def main():
    p=argparse.ArgumentParser();p.add_argument('--archive',required=True);p.add_argument('--nutrients',required=True);p.add_argument('--output',required=True)
    p.add_argument('--epochs',type=int,default=30);p.add_argument('--patience',type=int,default=6);p.add_argument('--batch-size',type=int,default=256)
    p.add_argument('--training-stride',type=int,default=4);p.add_argument('--seed',type=int,default=20261029);p.add_argument('--threads',type=int,default=2);args=p.parse_args()
    torch.set_num_threads(args.threads);torch.set_num_interop_threads(1);torch.use_deterministic_algorithms(True)
    warnings.filterwarnings('ignore',category=UserWarning,module='openpyxl')
    dest=Path(args.output);dest.mkdir(parents=True,exist_ok=True)
    if any(dest.iterdir()):p.error('Output folder must be empty')
    sessions,audit=load_source(Path(args.archive));base.enrich_source(args.archive,sessions)
    lookup=nutrient_lookup(args.nutrients,dest);add_features(args.archive,sessions,lookup,dest)
    write_json(dest/'source_audit.json',audit)
    contract={'features':FEATURES,'excluded':['exercise','future events','IV/premixed/long-acting insulin IOB','unresolved meal totals'],
        'carbohydrate':'USDA reference estimates for completely matched gram-portioned meals only; unresolved intake not zero',
        'iob':'known rapid/regular bolus only; triangular remaining action; 6h/75m and 8h/180m duration/peak assumptions',
        'timing':'source-aligned retrospective meal and insulin annotations; availability/eating times unverified',
        'basal':'not inferred from sparse rate annotations; IOB is incomplete bolus exposure, not total patient IOB',
        'conditioning':'past recorded history only, no planned future event conditioning or causal treatment effect',
        'nutrient_archive_sha256':hashlib.sha256(Path(args.nutrients).read_bytes()).hexdigest()}
    write_json(dest/'feature_contract.json',contract)
    base.DYNAMIC=FEATURES
    base.VARIANTS={'gru_carb_iob':('GRU',list(range(len(FEATURES)))),'lstm_carb_iob':('LSTM',list(range(len(FEATURES))))}
    results=[]
    for cohort,data in sessions.items():
        if not any(np.any(s['dynamic'][:,3]>0) for s in data):
            raise ValueError(f'No positive carbohydrate feature aligned for {cohort}')
        if not any(np.any(s['dynamic'][:,10]>0) for s in data):
            raise ValueError(f'No positive modeled IOB feature aligned for {cohort}')
        split=patient_split([s['patient'] for s in data],args.seed);batches=base.feature_windows(data,split,args.training_stride)
        scalers=base.fit_scalers(data,split,batches)
        raw=np.concatenate([s['dynamic'] for s in data if s['patient'] in split['train']])
        scalers['dynamic_mean']=np.nanmean(raw,axis=0);scalers['dynamic_scale']=np.nanstd(raw,axis=0)
        scalers['dynamic_scale'][scalers['dynamic_scale']<1e-6]=1
        scalers['dynamic_mean'][FLAGS]=0;scalers['dynamic_scale'][FLAGS]=1
        for variant in base.VARIANTS:
            result=base.train_variant(cohort,variant,batches,scalers,split,dest,args)
            folder=dest/cohort/variant
            result['limitations']=[contract[k] for k in ['carbohydrate','iob','timing','basal','conditioning']]+[
                'Single seed; correlated overlapping windows; T1 test includes only two patients.']
            result['architecture']='shanghai-history-carb-iob-context-v1'
            # Re-export corrected architecture and limitations without altering fitted weights.
            checkpoint=torch.load(folder/'checkpoint.pt',weights_only=True)
            checkpoint['architecture']=result['architecture'];torch.save(checkpoint,folder/'checkpoint.pt')
            portable=json.loads((folder/'model.json').read_text());portable['architecture']=result['architecture'];write_json(folder/'model.json',portable)
            result['checkpoint_sha256']=hashlib.sha256((folder/'checkpoint.pt').read_bytes()).hexdigest()
            write_json(folder/'metrics.json',result);write_json(folder/'preprocessing_contract.json',contract);results.append(result)
    write_json(dest/'training_summary.json',results)

if __name__=='__main__':main()
