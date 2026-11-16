"""Export the validation-selected auxiliary weights, identity and parity fixture."""
import argparse
import hashlib
import json
from pathlib import Path

from models.training.cgmacros_auxiliary import write_json

ROOT=Path(__file__).resolve().parents[2]


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--run',default='models/evaluation/cgmacros_6h_20261116');args=parser.parse_args()
    run=Path(args.run);experiment=json.loads((run/'experiment.json').read_text())
    mode=experiment.get('deployed_mode',experiment['selected_by_validation'])
    if mode not in ('macros','macros_activity'):
        raise ValueError('Validation did not select additional inputs; do not expose unsupported controls.')
    model=json.loads((run/f'{mode}.json').read_text());checkpoint=run/f'{mode}.pt'
    if hashlib.sha256(checkpoint.read_bytes()).hexdigest()!=model['checkpoint_sha256']:
        raise ValueError('Checkpoint identity mismatch.')
    public=ROOT/'web/frontend/public/conditional-models/CGMacrosAuxiliary.json'
    public.write_bytes((run/f'{mode}.json').read_bytes())
    metrics=json.loads((run/f'{mode}_metrics.json').read_text())
    manifest={'version':'cgmacros-auxiliary-6h-20261116','mode':mode,'path':'/conditional-models/CGMacrosAuxiliary.json',
              'artifact_sha256':hashlib.sha256(public.read_bytes()).hexdigest(),'checkpoint_sha256':model['checkpoint_sha256'],
              'source_doi':'10.13026/3z8q-x658','license':'CC-BY-NC-SA-4.0','evaluation':metrics['test'],
              'evaluation_scope':'CGMacros participant-held-out, recorded future meal/activity conditional; Shanghai transfer unvalidated',
              'shanghai_transfer_validated':False,'causal_treatment_effect_validated':False}
    write_json(ROOT/'web/frontend/src/lib/auxiliaryManifest.json',manifest)
    (ROOT/'web/frontend/tests/fixtures/auxiliary-reference.json').write_bytes((run/f'{mode}_parity.json').read_bytes())
    write_json(ROOT/'models/registry/cgmacros_auxiliary.json',{**manifest,'checkpoint':checkpoint.as_posix(),'activation':'explicit separate research panel only; not a Shanghai v3 replacement or additive correction'})
    print(json.dumps(manifest,indent=2))


if __name__=='__main__':main()
