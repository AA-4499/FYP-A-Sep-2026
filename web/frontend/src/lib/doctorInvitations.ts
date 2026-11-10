import { getSupabaseClient } from './supabase';
import { getForecastApiUrl } from './forecast';
import { AdminApiError, normalizeAdminError } from './adminApi';

export interface DoctorInvitationInput {
  full_name: string;
  email: string;
  organisation: string;
  department: string;
  registration_id: string;
}

export async function inviteDoctor(input: DoctorInvitationInput): Promise<{ message: string; email: string }> {
  const client = getSupabaseClient();
  if (!client) throw new AdminApiError('configuration', 'Supabase is not configured.');
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) throw new AdminApiError('session', 'Your session has expired. Please sign in again.');
  try {
    const response = await fetch(`${getForecastApiUrl()}/api/admin/doctors/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify(input),
    });
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new AdminApiError('configuration', 'The invitation service is unavailable. Check the API service connection.');
    }
    const result = await response.json();
    if (!response.ok) throw new AdminApiError(
      response.status === 403 ? 'forbidden' : response.status === 401 ? 'session' : 'unknown',
      result.error || 'The invitation could not be sent.',
    );
    return result;
  } catch (failure) { throw normalizeAdminError(failure); }
}
