import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('src/lib/conditionalManifest.json', root), 'utf8'));
const entries = [...Object.entries(manifest.models).map(([cohort,entry]) => ({...entry,cohort})),manifest.food_reference];
for (const entry of entries) {
  assert.match(entry.path, /^\/conditional-models\/[A-Za-z0-9_-]+\.json$/, 'Invalid model asset path');
  const bytes = readFileSync(new URL(`public${entry.path}`,root));
  assert.equal(bytes.includes(Buffer.from('\r\n')),false,`${entry.path}: export canonical LF bytes before hashing`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.artifact_sha256,`${entry.path}: asset differs from its manifest; re-export the matching model version before deployment`);
  if ('cohort' in entry) {
    const model = JSON.parse(bytes.toString('utf8'));
    assert.equal(model.cohort,entry.cohort);
    assert.equal(model.checkpoint_sha256,entry.checkpoint_sha256);
  }
}
console.log(`Verified ${entries.length} conditional model/reference assets against the deployment manifest.`);
