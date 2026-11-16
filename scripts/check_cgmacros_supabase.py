"""Read-only verification of CGMacros presence; never prints credentials."""
import json
import sys
from pathlib import Path

import requests

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from models.training.supabase_io import supabase_config,supabase_headers


def main():
    url,key=supabase_config(); report={'read_only':True,'tables':{}}
    for table in ['cgmacros_participants','cgmacros_glucose_readings','cgmacros_activity_readings','cgmacros_meal_events','cgmacros_import_audit']:
        response=requests.get(url+'/rest/v1/'+table,headers={**supabase_headers(key),'Prefer':'count=exact','Range':'0-0'},params={'select':'*'},timeout=45)
        item={'http_status':response.status_code,'count':response.headers.get('Content-Range','').split('/')[-1]}
        if response.ok:
            rows=response.json();item['columns']=list(rows[0]) if rows else []
        else:
            try:item['error_code']=response.json().get('code')
            except ValueError:pass
        report['tables'][table]=item
    schema=requests.get(url+'/rest/v1/',headers=supabase_headers(key),timeout=45)
    report['schema_http_status']=schema.status_code
    if schema.ok:
        paths=schema.json().get('paths',{})
        report['matching_exposed_tables']=[p for p in paths if any(term in p.lower() for term in ['macro','nutrition','dataset','meal'])]
    response=requests.get(url+'/rest/v1/patient_summary',headers={**supabase_headers(key),'Prefer':'count=exact'},params={'select':'source_dataset','source_dataset':'eq.CGMacros','limit':1},timeout=45)
    report['cgmacros_in_patient_summary']={'http_status':response.status_code,'count':response.headers.get('Content-Range','').split('/')[-1]}
    Path('output/cgmacros-supabase-verification.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))


if __name__=='__main__':main()
