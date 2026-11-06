/** Public origin of the original KG/shared backend; no credentials are stored here. */
export const ORIGINAL_API_ORIGIN = 'https://diabetes-digital-twin-kg-api.onrender.com';

/** Preserve main's settings while keeping deployments with no API variable usable. */
export function resolveMainApiOrigin(configured: string | undefined, saved: string | null, development: boolean): string {
  const value = [saved, configured].find(value => typeof value === 'string' && value.trim());
  return typeof value === 'string'
    ? value.trim().replace(/\/+$/, '')
    : development ? 'http://localhost:5000' : ORIGINAL_API_ORIGIN;
}
