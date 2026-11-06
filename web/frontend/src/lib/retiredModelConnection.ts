/** Remove only the connection override belonging to the deleted model service. */
export function isRetiredModelOrigin(value: string | null): boolean {
  if (!value) return false;
  try { return new URL(value.trim()).hostname === 'fyp-a-sep-2026-2.onrender.com'; }
  catch { return false; }
}

export function readForecastApiOverride(storage: Pick<Storage, 'getItem' | 'removeItem'>): string | null {
  const value = storage.getItem('dt_forecast_api_url');
  if (isRetiredModelOrigin(value)) {
    storage.removeItem('dt_forecast_api_url');
    return null;
  }
  return value;
}
