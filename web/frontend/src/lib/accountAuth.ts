import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { UserRole } from '../types';

export function trustedRole(user: Pick<User, 'app_metadata'>): UserRole | null {
  if (user.app_metadata?.doctor_registration_status === 'pending') return null;
  const role = user.app_metadata?.role;
  if (role === 'admin' || role === 'doctor' || role === 'patient') return role;
  if (role === 'clinician') return 'doctor';
  // Supabase accounts without an assigned platform role have patient-level access only.
  return role == null ? 'patient' : null;
}

export interface AccountAccess {
  role: UserRole | null;
  doctorStatus: 'pending' | 'rejected' | 'missing' | 'sync_required' | 'review' | 'unavailable' | null;
  statusErrorCode?: string;
}

/** Read the saved application before routing; signup metadata never grants access. */
export async function loadAccountAccess(client: SupabaseClient, user: Pick<User, 'id' | 'app_metadata' | 'user_metadata'>): Promise<AccountAccess> {
  const role = trustedRole(user);
  let application: { user_id: string; status: string } | null = null;
  try {
    let result = await client.rpc('get_my_doctor_application_status');
    // Existing installations can keep using their owner-read policy until the RPC is installed.
    if (result.error?.code === 'PGRST202' || result.error?.code === '42883') {
      result = await client.from('doctor_applications')
        .select('user_id,status').eq('user_id', user.id).maybeSingle();
    }
    if (result.error) throw result.error;
    application = result.data;
  } catch (failure) {
    // Auth was already verified. An optional application lookup is not a session failure.
    const status = user.app_metadata?.doctor_registration_status;
    const code = (failure as { code?: string })?.code;
    const statusErrorCode = typeof code === 'string' && /^[A-Z0-9_]{1,24}$/.test(code) ? code : 'LOOKUP_FAILED';
    if (status === 'pending') return { role: null, doctorStatus: 'pending' };
    if (status === 'rejected') return { role: null, doctorStatus: 'rejected' };
    if (user.user_metadata?.requested_role === 'doctor' && status !== 'approved') {
      return { role: null, doctorStatus: 'unavailable', statusErrorCode };
    }
    // Preserve existing permissions only; editable metadata can never grant a role.
    if (status === 'approved' && role !== 'doctor' && role !== 'admin') {
      return { role: null, doctorStatus: 'sync_required' };
    }
    if (status != null && status !== 'approved') return { role: null, doctorStatus: 'review' };
    return { role, doctorStatus: null };
  }
  if (application && application.user_id !== user.id) throw new Error('Your account application could not be verified.');
  if (application?.status === 'pending') return { role: null, doctorStatus: 'pending' };
  if (application?.status === 'rejected') return { role: null, doctorStatus: 'rejected' };
  if (application) {
    if (application.status !== 'approved') return { role: null, doctorStatus: 'review' };
    // Approval in the table alone must not invent a privileged Auth claim.
    if (role !== 'doctor' && role !== 'admin') return { role: null, doctorStatus: 'sync_required' };
  } else if (user.app_metadata?.doctor_registration_status === 'pending'
    || (role !== 'doctor' && role !== 'admin' && user.user_metadata?.requested_role === 'doctor')) {
    return { role: null, doctorStatus: 'missing' };
  }
  return { role, doctorStatus: null };
}

export function validateRegistration(name: string, password: string, confirm: string): void {
  if (!name.trim()) throw new Error('Enter your full name.');
  if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
  if (password !== confirm) throw new Error('The passwords do not match.');
}

export function confirmationUrl(origin: string): string {
  return new URL('/', origin).href;
}

export async function registerPatient(client: SupabaseClient, input: { name: string; identityNumber: string; email: string; password: string; confirm: string }, origin: string) {
  validateRegistration(input.name, input.password, input.confirm);
  const identityNumber = input.identityNumber.trim();
  if (!identityNumber) throw new Error('Enter your NRIC / Passport No.');
  if (identityNumber.length > 64 || /[\u0000-\u001f\u007f]/.test(identityNumber)) throw new Error('Enter a valid NRIC / Passport No. of up to 64 characters.');
  const { data, error } = await client.auth.signUp({
    email: input.email.trim(), password: input.password,
    options: { emailRedirectTo: confirmationUrl(origin), data: { full_name: input.name.trim(), nric_passport_no: identityNumber, requested_role: 'patient' } },
  });
  if (error) throw error;
  return data;
}

export async function registerDoctor(client: SupabaseClient, input: { name: string; clinic: string; registrationNumber: string; email: string; password: string; confirm: string }, origin: string) {
  validateRegistration(input.name, input.password, input.confirm);
  const fields = [
    { label: 'full name', value: input.name.trim(), limit: 120 },
    { label: 'organisation / clinic', value: input.clinic.trim(), limit: 200 },
    { label: 'professional registration number', value: input.registrationNumber.trim(), limit: 64 },
  ];
  for (const { label, value, limit } of fields) {
    if (!value || value.length > limit || /[\u0000-\u001f\u007f]/.test(value)) {
      throw new Error(`Enter a valid ${label} of up to ${limit} characters.`);
    }
  }
  const { data, error } = await client.auth.signUp({
    email: input.email.trim(), password: input.password,
    options: { emailRedirectTo: confirmationUrl(origin), data: {
      full_name: input.name.trim(), organisation: input.clinic.trim(),
      registration_id: input.registrationNumber.trim(), requested_role: 'doctor',
    } },
  });
  if (error) throw error;
  return data;
}

export function authErrorMessage(error: unknown): string {
  const value = error as { code?: string; message?: string };
  if (value?.code === 'email_address_not_authorized') return 'Email delivery is limited to your Supabase project team while default email delivery is enabled. Use an existing team email for this test.';
  if (value?.code === 'over_email_send_rate_limit' || value?.code === 'over_request_rate_limit') return 'Too many requests. Please wait before trying again; confirmation emails are rate limited.';
  if (value?.code === 'email_not_confirmed') return 'Please confirm your email before signing in. You can request another confirmation link below.';
  return value?.message || 'Unable to contact the sign-in service. Please try again.';
}
