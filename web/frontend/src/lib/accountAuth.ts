import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { UserRole } from '../types';

export type AccountStatus = 'active' | 'suspended';
export type DoctorApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface DoctorApplicationState {
  status: DoctorApplicationStatus;
  review_note: string | null;
}

/** Authoritative access state read from the database after sign-in. */
export interface AccessState {
  role: UserRole;
  full_name: string;
  status: AccountStatus;
  application: DoctorApplicationState | null;
}

/**
 * Validate the database access-state payload. Anything unexpected fails closed
 * (returns null) so a malformed response can never grant a workspace.
 */
export function accessStateFromRpc(value: unknown): AccessState | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const role = record.role;
  const status = record.status;
  if (role !== 'admin' && role !== 'doctor' && role !== 'patient') return null;
  if (status !== 'active' && status !== 'suspended') return null;
  let application: DoctorApplicationState | null = null;
  if (record.application && typeof record.application === 'object') {
    const candidate = record.application as Record<string, unknown>;
    const applicationStatus = candidate.status;
    if (applicationStatus !== 'pending' && applicationStatus !== 'approved' && applicationStatus !== 'rejected') return null;
    application = {
      status: applicationStatus,
      review_note: typeof candidate.review_note === 'string' ? candidate.review_note : null,
    };
  }
  return {
    role,
    full_name: typeof record.full_name === 'string' ? record.full_name : '',
    status,
    application,
  };
}

/** Read the signed-in account's authoritative role/status/application state. */
export async function fetchAccessState(client: SupabaseClient): Promise<AccessState | null> {
  const { data, error } = await client.rpc('get_my_access_state');
  if (error) throw error;
  return accessStateFromRpc(data);
}

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

export interface DoctorApplicationInput {
  name: string;
  organisation: string;
  registrationNumber: string;
  email: string;
  password: string;
  confirm: string;
}

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export function validateDoctorApplication(input: DoctorApplicationInput): void {
  validateRegistration(input.name, input.password, input.confirm);
  const organisation = input.organisation.trim();
  if (!organisation) throw new Error('Enter your organisation or clinic.');
  if (organisation.length > 160 || CONTROL_CHARACTERS.test(organisation)) throw new Error('Enter a valid organisation name of up to 160 characters.');
  const registration = input.registrationNumber.trim();
  if (!registration) throw new Error('Enter your professional registration number.');
  if (registration.length > 120 || CONTROL_CHARACTERS.test(registration)) throw new Error('Enter a valid professional registration number of up to 120 characters.');
}

/**
 * Self-service Doctor application. The account is created as a Patient in the
 * database; the application metadata is reviewed by an administrator and never
 * grants Doctor access from the browser.
 */
export async function applyAsDoctor(client: SupabaseClient, input: DoctorApplicationInput, origin: string) {
  validateDoctorApplication(input);
  const { data, error } = await client.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      emailRedirectTo: confirmationUrl(origin),
      data: {
        full_name: input.name.trim(),
        requested_role: 'doctor',
        registration_id: input.registrationNumber.trim(),
        organisation: input.organisation.trim(),
      },
    },
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

/** Friendlier message when the account-access RPC is missing or the session expired. */
export function accessErrorMessage(error: unknown): string {
  const value = error as { code?: string; message?: string; details?: string };
  const message = `${value?.message || ''} ${value?.details || ''}`;
  if (value?.code === 'PGRST202' || /could not find the function|schema cache/i.test(message)) {
    return 'Account verification is not configured yet. Ask the platform operator to apply the admin database migration.';
  }
  if (value?.code === 'PGRST301' || /jwt|access token|session/i.test(message)) {
    return 'Your session has expired. Please sign in again.';
  }
  return authErrorMessage(error);
}
