import type { SupabaseClient } from '@supabase/supabase-js';

export interface PatientDashboardData {
  profile: { id: string; full_name: string | null; patient_id: string | null };
  summary: Record<string, unknown> | null;
  readings: Record<string, unknown>[];
}

/** The database chooses the record from auth.uid(); callers cannot supply a record ID. */
export async function loadPatientDashboard(client: SupabaseClient, userId: string): Promise<PatientDashboardData> {
  const { data, error } = await client.rpc('get_my_patient_dashboard');
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      throw new Error('Your dashboard needs database setup. Ask your administrator to apply the Patient dashboard SQL, then refresh.');
    }
    throw new Error('Your health information could not be loaded. Please try again.');
  }
  if (!data?.profile || data.profile.id !== userId) throw new Error('Your account profile is not available. Please contact your administrator.');
  const recordId = data.profile.patient_id;
  if (recordId !== null && (typeof recordId !== 'string' || !recordId.trim())) throw new Error('Your patient record link needs review. Please contact your care team.');
  if (!Array.isArray(data.readings) || (data.summary !== null && (typeof data.summary !== 'object' || Array.isArray(data.summary)))) {
    throw new Error('Your health information could not be loaded. Please try again.');
  }
  // Fail closed if a response ever contains a record other than the account's link.
  const records = [...(data.summary ? [data.summary] : []), ...data.readings];
  if (records.some((row) => !recordId || !row || row['Patient Number'] !== recordId)) {
    throw new Error('Your patient record link needs review. Please contact your care team.');
  }
  return data as PatientDashboardData;
}

/** Missing clinical measurements stay missing; never substitute sample values. */
export function measurement(value: unknown): string {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return 'Not recorded';
  if (typeof value !== 'number' && typeof value !== 'string') return 'Not recorded';
  if (typeof value === 'string' && !value.trim()) return 'Not recorded';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(numeric) : 'Not recorded';
}
