/** Compare the complete stored output independently of JSON object key ordering. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function verifyForecastReadback(result: Record<string, unknown>, saved: unknown): void {
  const { storage: _receipt, ...output } = result;
  const record = saved as { run_id?: string; patient_id?: string; model_sha256?: string; output?: unknown } | null;
  const receipt = result.storage as { saved?: boolean; run_id?: string } | undefined;
  if (!receipt?.saved || !record || record.run_id !== receipt.run_id || record.patient_id !== result.patient_id ||
      record.model_sha256 !== result.model_sha256 || canonical(record.output) !== canonical(output)) {
    throw new Error('The prediction was saved, but its retrieved patient, model version or output did not match. Keep the run ID and ask an administrator to check the saved result.');
  }
}
