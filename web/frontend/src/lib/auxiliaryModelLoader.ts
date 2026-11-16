import manifest from './auxiliaryManifest.json';
import { validateAuxiliary, type AuxiliaryModel } from './auxiliaryNutrition';

export async function loadAuxiliaryModel(signal: AbortSignal): Promise<AuxiliaryModel> {
  const response=await fetch(`${manifest.path}?sha256=${manifest.artifact_sha256}`,{signal,cache:'no-store'});
  if(!response.ok) throw Error('The auxiliary model asset could not be loaded.');
  const bytes=await response.arrayBuffer();
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(signal.aborted) throw new DOMException('Cancelled','AbortError');
  if(digest!==manifest.artifact_sha256) throw Error('Auxiliary model version mismatch. Reload after deployment completes.');
  const model=validateAuxiliary(JSON.parse(new TextDecoder().decode(bytes)) as AuxiliaryModel);
  if(model.checkpoint_sha256!==manifest.checkpoint_sha256||model.mode!==manifest.mode) throw Error('Auxiliary checkpoint identity mismatch.');
  return model;
}
