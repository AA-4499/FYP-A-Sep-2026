import type { SupabaseClient } from '@supabase/supabase-js';

/** Admin owns the assignments; the signed-in Doctor reads only their own rows.
 * This uses Supabase directly and does not depend on the Python/Render service.
 */
export async function fetchDoctorAssignedPatientIds(client: SupabaseClient | null): Promise<string[]> {
  if (!client) throw Error('Connect your Supabase project to verify patient assignments.');
  const {data: identity, error: identityError} = await client.auth.getUser();
  if (identityError || !identity.user) throw Error('Sign in again to verify your Doctor identity.');
  const {data: access, error: accessError} = await client.rpc('get_my_access_state');
  if (accessError) throw Error(`Unable to verify Doctor access: ${accessError.message}`);
  if (access?.role !== 'doctor' || access.status !== 'active') throw Error('An active, approved Doctor account is required.');
  const ids = new Set<string>();
  let offset = 0, expected: number | null = null;
  for (;;) {
    const {data, error, count} = await client.from('clinician_patient_assignments')
      .select('clinician_id,patient_id', {count:'exact'})
      .eq('clinician_id', identity.user.id).order('patient_id', {ascending:true})
      .range(offset, offset + 999);
    if (error) throw Error(`Unable to read Admin patient assignments: ${error.message}`);
    if (!Array.isArray(data)) throw Error('Supabase returned an invalid patient assignment list.');
    if (expected === null && count != null) expected = count;
    if (!data.length) {
      if (expected !== null && offset < expected) throw Error('The patient assignment list is incomplete. Refresh and retry.');
      return [...ids];
    }
    for (const row of data) {
      if (row.clinician_id !== identity.user.id || typeof row.patient_id !== 'string' || !row.patient_id.trim())
        throw Error('The assignment response does not match the signed-in Doctor.');
      const id = row.patient_id.trim();
      if (ids.has(id)) throw Error('Patient assignments changed while loading. Refresh and retry.');
      ids.add(id);
    }
    offset += data.length;
    if (expected !== null && offset >= expected) return [...ids];
  }
}
