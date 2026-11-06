/** An explicit KG origin keeps a separate graph service independent of model settings. */
export function resolveKnowledgeGraphApiUrl(configured: unknown, modelOrigin: string): string {
  const value = typeof configured === 'string' ? configured.trim() : '';
  if (!value) return modelOrigin.trim().replace(/\/+$/, '');
  let url: URL;
  try { url = new URL(value); }
  catch { throw Error('VITE_KG_API_BASE_URL must be a complete http:// or https:// service origin.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw Error('VITE_KG_API_BASE_URL must be a service origin without credentials, an API path, query or fragment.');
  }
  return url.origin;
}
