import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const runtime='C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies';
const modules=runtime+'/node/node_modules';
process.env.RUNTIME_NODE_MODULES=modules;
const require=createRequire(modules+'/__runtime__.cjs');
const {FileBlob,PresentationFile}=require('@oai/artifact-tool');
const work=process.cwd();
const build=path.join(work,'output/poster/reference_match/build');
const p=await PresentationFile.importPptx(await FileBlob.load(path.join(build,'reference-layout.pptx')));
const s=p.slides.getItem(0);
s.speakerNotes.text=`Sources: COS40005 Team and Project Plan, 27 September 2026, Part 2. Sprint Report 1, updated 30 October 2026, sections 2.1–2.6 and 3.3–3.4. https://github.com/AA-4499/FYP-A-Sep-2026
Visual reference and artwork: supplied Smart Diabetes Digital Twin poster.png.
Next-step evaluation: identical 22,401 held-out windows. GRU MAE 3.81 mg/dL and RMSE 5.28 mg/dL. Persistence MAE 5.93 mg/dL and RMSE 8.78 mg/dL. These are 15-minute predictions, not six- or twelve-hour accuracy.
Trajectory comparison: 108 matched starting points, without future meal or insulin plans. Unseen-patient generalisation remains untested.
Knowledge graph: 37 concepts, 42 candidate relationships and 15 relationship types. All relationships remained candidate_for_review at the report check.
The nine-stage workflow is the target workflow. Risk assessment, SHAP, personalised insights, complete state and simulation workflow, and reporting include planned or unvalidated capabilities.`;
await (await PresentationFile.exportPptx(p)).save(path.join(build,'candidate.pptx'));
console.log('Exported editable candidate');
const blob=await s.export({format:'png',scale:0.75});
await fs.writeFile(path.join(build,'artifact-candidate.png'),new Uint8Array(await blob.arrayBuffer()));
console.log('Rendered candidate');
