import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
const require = createRequire('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/__runtime__.cjs');
const { FileBlob, Presentation, PresentationFile } = require('@oai/artifact-tool');
const file = process.argv[2];
let p;
try { p=await PresentationFile.importPptx(await FileBlob.load(file)); }
catch(e) { console.log(e.message); process.exit(1); }
console.log(await p.inspect({kind:'slide,layout', maxChars:1800}));
await fs.writeFile('output/poster/reference_match/build/import-check.json', JSON.stringify(await p.inspect({kind:'textbox,table,image',maxChars:20000})));
if(process.argv[3]) {
  const s=p.slides.getItem(0);
  const blob=await s.export({format:'png',scale:0.75});
  await fs.writeFile(process.argv[3],new Uint8Array(await blob.arrayBuffer()));
}
