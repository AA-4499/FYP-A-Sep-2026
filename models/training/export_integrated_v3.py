"""Publish the integrated checkpoint and synthetic parity case, never raw CGM."""
import argparse
import hashlib
import json
from pathlib import Path
from models.training.train_integrated_v3 import write

def export(run):
    run=Path(run)
    source=json.loads((run/'model.json').read_text(encoding='utf-8'))
    metrics=json.loads((run/'metrics.json').read_text(encoding='utf-8'))
    public=Path('web/frontend/public/conditional-models/ShanghaiT2DMIntegrated.json')
    write(public,source)
    path=Path('web/frontend/src/lib/conditionalManifest.json')
    manifest=json.loads(path.read_text(encoding='utf-8'))
    if manifest['models']['ShanghaiT2DM']['path']!='/conditional-models/ShanghaiT2DMIntegrated.json':
        manifest['legacy_models']={'ShanghaiT2DM':manifest['models']['ShanghaiT2DM']}
    manifest['models']['ShanghaiT2DM']={
      'path':'/conditional-models/'+public.name,
      'artifact_sha256':hashlib.sha256(public.read_bytes()).hexdigest(),
      'checkpoint_sha256':source['checkpoint_sha256'],
      'name':'Shanghai T2DM integrated conditional GRU v3',
      'version':'conditional-v3-integrated-20261116',
      'horizons_minutes':source['horizons_minutes'],
      'evaluation_scope':'Single joint Shanghai T2DM / CGMacros T2D-group GRU; retrospective recorded-future-event evaluation. No joint insulin/activity or causal validation.',
      'test_metrics':metrics['test_metrics_by_domain']['ShanghaiT2DM']}
    write(path,manifest)
    write('web/frontend/tests/fixtures/integrated-v3-reference.json',json.loads((run/'synthetic_parity.json').read_text(encoding='utf-8')))
    write('web/frontend/src/lib/activitySupport.json',json.loads((run/'activity_support.json').read_text(encoding='utf-8')))
    write('models/registry/integrated_v3.json',{
      'version':'conditional-v3-integrated-20261116','checkpoint':(run/'checkpoint.pt').as_posix(),
      'checkpoint_sha256':source['checkpoint_sha256'],'cohort':'ShanghaiT2DM',
      'architecture':source['architecture'],'single_model':True,
      'history_features':source['dynamic_features'],'future_features':source['future_features'],
      'test_metrics_by_domain':metrics['test_metrics_by_domain'],
      'activity_name_source':'2024 Adult Compendium of Physical Activities; reference MET presets, not observed sport labels',
      'limitations':metrics['limitations']})
    registry_path=Path('models/registry/conditional_v3.json')
    registry=json.loads(registry_path.read_text(encoding='utf-8'))
    for entry in registry['models']:
        entry.setdefault('version',registry['version'])
        if entry['cohort']=='ShanghaiT2DM':
            entry.update({'checkpoint':(run/'checkpoint.pt').as_posix(),
              'checkpoint_sha256':source['checkpoint_sha256'],
              'test_metrics':metrics['test_metrics_by_domain']['ShanghaiT2DM'],
              'version':'conditional-v3-integrated-20261116',
              'architecture':source['architecture']})
    registry['version']='conditional-v3-integrated-20261116'
    write(registry_path,registry)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--run',default='models/evaluation/integrated_v3_20261116')
    export(p.parse_args().run)
