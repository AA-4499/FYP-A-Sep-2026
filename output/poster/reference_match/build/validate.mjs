import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {createHash} from 'node:crypto';
const runtime='C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies';
process.env.RUNTIME_NODE_MODULES=runtime+'/node/node_modules';
const skill='C:/Users/USER/.codex/plugins/cache/openai-primary-runtime/presentations/26.1026.10807/skills/presentations';
const {finalizePresentation}=await import(pathToFileURL(skill+'/container_tools/artifact_tool_utils.mjs').href);
const work=process.cwd();
const root=path.join(work,'output/poster/reference_match');
const reference=path.join(work,'output/poster/editable/FYP_Poster_Editable.pptx');
await fs.mkdir(path.join(root,'final'),{recursive:true});
const result=await finalizePresentation({
  workspaceDir:work,
  candidatePath:path.join(root,'build/candidate.pptx'),
  finalPath:path.join(root,'final/FYP_Poster_Reference_Matched.pptx'),
  pythonExecutable:runtime+'/python/python.exe',
  integrityValidatorPath:skill+'/container_tools/inspect_presentation_package_integrity.py',
  layoutValidatorPath:skill+'/container_tools/inspect_presentation_layout_geometry.py',
  explicitTotalSlideCount:1,
  requiredNativeTableOwnerSlides:[1],
  requiredNativeChartOwnerSlides:[],
  layoutArgs:['--expected-slide-size-emu','21374100,30276800','--validate-bullet-geometry','--validate-heading-fit','--require-native-table-slide','1'],
  fontPolicy:{basis:'reference',families:['Arial'],referencePath:reference,referenceSha256:createHash('sha256').update(await fs.readFile(reference)).digest('hex')},
  verifyArtifactToolImport:true,
  receiptPath:path.join(root,'build/final-validation.json'),
});
console.log(JSON.stringify(result,null,2));
