import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { UserRole } from '../types';

export function trustedRole(user: Pick<User, 'app_metadata'>): UserRole | null {
  const role = user.app_metadata?.role;
  if (role === 'admin' || role === 'doctor' || role === 'patient') return role;
  if (role === 'clinician') return 'doctor';
  // Supabase accounts without an assigned platform role have patient-level access only.
  return role == null ? 'patient' : null;
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

export function authErrorMessage(error: unknown): string {
  const value = error as { code?: string; message?: string };
  if (value?.code === 'email_address_not_authorized') return 'Email delivery is limited to your Supabase project team while default email delivery is enabled. Use an existing team email for this test.';
  if (value?.code === 'over_email_send_rate_limit' || value?.code === 'over_request_rate_limit') return 'Too many requests. Please wait before trying again; confirmation emails are rate limited.';
  if (value?.code === 'email_not_confirmed') return 'Please confirm your email before signing in. You can request another confirmation link below.';
  return value?.message || 'Unable to contact the sign-in service. Please try again.';
}
