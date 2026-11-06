/** Models use their own variable and connection setting, never the KG origin. */
export function resolveModelApiUrl(configured: unknown, saved: string | null, developmentOrigin = ''): string {
  const value = [saved, configured, developmentOrigin].find(v => typeof v === 'string' && v.trim());
  return typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
}

/** Keep the existing KG variable independent of all model connection settings. */
export function resolveKnowledgeGraphApiUrl(configured: unknown, developmentOrigin = ''): string {
  const value = typeof configured === 'string' ? configured.trim() : '';
  if (!value) return developmentOrigin.trim().replace(/\/+$/, '');
  let url: URL;
  try { url = new URL(value); }
  catch { throw Error('VITE_API_BASE_URL must be a complete http:// or https:// Knowledge Graph service origin.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw Error('VITE_API_BASE_URL must be a Knowledge Graph service origin without credentials, an API path, query or fragment.');
  }
  return url.origin;
}
