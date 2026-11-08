/**
 * Real Supabase-backed Admin workspace API.
 *
 * Every operation calls a server-side SECURITY DEFINER RPC that re-checks the
 * caller's Admin role. Nothing here reads demo data or browser storage.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase';

/* ------------------------------------------------------------------ types */

export type AdminRole = 'admin' | 'doctor' | 'patient';
export type AccountStatus = 'active' | 'suspended';
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';
export type ReviewDecision = 'approved' | 'rejected';
export type ActivityCategory = 'accounts' | 'approvals' | 'assignments';

export interface AdminAccount {
  id: string;
  email: string;
  full_name: string;
  role: AdminRole;
  status: AccountStatus;
  department: string | null;
  registration_id: string | null;
  joined_at: string;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
  patient_id: string | null;
  doctor_application_status: ApplicationStatus | null;
  assignment_count: number;
}

export interface DoctorApplication {
  user_id: string;
  full_name: string;
  email: string;
  organisation: string;
  registration_id: string;
  status: ApplicationStatus;
  review_note: string | null;
  applied_at: string;
  reviewed_at: string | null;
  email_confirmed: boolean;
}

export interface ActivityEntry {
  id: string;
  action: string;
  detail: string;
  subject_label: string | null;
  patient_id: string | null;
  actor_email: string | null;
  created_at: string;
  /** The migration also returns a derived category for display. */
  category?: ActivityCategory | null;
}

export interface AdminOverview {
  accounts: number;
  activeDoctors: number;
  patients: number;
  pendingApplications: number;
  unassignedPatients: number;
  suspendedAccounts: number;
  recentActivity: ActivityEntry[];
  /** Omitted by older migrations; render zeroed bars in that case. */
  roleCounts?: Record<AdminRole, number>;
}

export interface PatientRow {
  patient_number: string;
  patient_name: string | null;
  assigned_doctor_id: string | null;
  assigned_doctor_name: string | null;
  /** Present on newer migrations; lets the UI disable suspended rows. */
  account_status?: AccountStatus | null;
}

export interface AssignableDoctor {
  id: string;
  full_name: string;
  email: string;
  assignment_count: number;
}

/**
 * Shape returned by admin_set_patient_assignment. The current assignment is
 * returned, or null when the patient was unassigned.
 */
export interface PatientAssignment {
  patient_number: string;
  doctor_id: string | null;
  doctor_name?: string | null;
  assigned_at?: string | null;
}

export interface Paged<T> {
  rows: T[];
  total: number;
}

export interface ListAccountsParams {
  search?: string;
  role?: AdminRole;
  status?: AccountStatus;
  limit?: number;
  offset?: number;
}

export interface ListApplicationsParams {
  status?: ApplicationStatus;
  limit?: number;
  offset?: number;
}

export interface ReviewApplicationInput {
  userId: string;
  decision: ReviewDecision;
  note: string;
}

export interface SetAccountRoleInput {
  userId: string;
  role: AdminRole;
  registrationId?: string | null;
  department?: string | null;
  note?: string | null;
}

export interface SetAccountStatusInput {
  userId: string;
  status: AccountStatus;
}

export interface ListPatientDirectoryParams {
  search?: string;
  onlyUnassigned?: boolean;
  limit?: number;
  offset?: number;
}

export interface SetPatientAssignmentInput {
  patientNumber: string;
  doctorId: string | null;
}

export interface ListActivityParams {
  category?: ActivityCategory;
  search?: string;
  limit?: number;
  offset?: number;
}

/* ----------------------------------------------------------------- errors */

export type AdminErrorKind =
  | 'forbidden'
  | 'session'
  | 'configuration'
  | 'network'
  | 'unknown';

const FORBIDDEN_MESSAGE =
  'Your account is not authorized for administration. Sign in with an Admin account.';
const SESSION_MESSAGE = 'Your session has expired. Please sign in again.';
const CONFIGURATION_MESSAGE =
  'The admin database migration has not been applied. Ask the platform operator to run docs/supabase_admin_workspace.sql.';
const NETWORK_MESSAGE =
  'The admin service could not be reached. Check your connection and try again.';

export class AdminApiError extends Error {
  readonly kind: AdminErrorKind;
  readonly retryable: boolean;

  constructor(kind: AdminErrorKind, message: string, retryable = false) {
    super(message);
    this.name = 'AdminApiError';
    this.kind = kind;
    this.retryable = retryable;
    Object.setPrototypeOf(this, AdminApiError.prototype);
  }
}

interface PostgrestLikeError {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  status?: number | null;
}

/** Convert Supabase/PostgREST/network failures into a stable, user-safe error. */
export function normalizeAdminError(error: unknown): AdminApiError {
  if (error instanceof AdminApiError) return error;
  const value = (error ?? {}) as PostgrestLikeError;
  const code = typeof value.code === 'string' ? value.code : '';
  const message = typeof value.message === 'string' ? value.message : '';
  const hint = typeof value.hint === 'string' ? value.hint : '';
  const details = typeof value.details === 'string' ? value.details : '';
  const haystack = `${message} ${details} ${hint}`.toLowerCase();
  const status = typeof value.status === 'number' ? value.status : 0;

  if (code === '42501' || haystack.includes('admin access required') || haystack.includes('permission denied for function')) {
    return new AdminApiError('forbidden', FORBIDDEN_MESSAGE);
  }
  if (
    code === 'PGRST301' ||
    status === 401 ||
    haystack.includes('jwt expired') ||
    haystack.includes('invalid jwt') ||
    haystack.includes('jwt is expired') ||
    haystack.includes('missing authorization')
  ) {
    return new AdminApiError('session', SESSION_MESSAGE);
  }
  if (
    code === 'PGRST202' ||
    code === '42P01' ||
    code === '42883' ||
    status === 404 ||
    haystack.includes('could not find the function') ||
    haystack.includes('schema cache') ||
    haystack.includes('does not exist')
  ) {
    return new AdminApiError('configuration', CONFIGURATION_MESSAGE);
  }
  if (
    error instanceof TypeError ||
    haystack.includes('failed to fetch') ||
    haystack.includes('networkerror') ||
    haystack.includes('network request failed') ||
    haystack.includes('load failed') ||
    haystack.includes('fetch failed') ||
    haystack.includes('econnrefused') ||
    haystack.includes('enotfound')
  ) {
    return new AdminApiError('network', NETWORK_MESSAGE, true);
  }
  return new AdminApiError(
    'unknown',
    message || 'The admin request could not be completed. Please try again.',
  );
}

/** User-facing message for any admin failure. */
export function adminErrorMessage(error: unknown): string {
  return normalizeAdminError(error).message;
}

/** True when the workspace must ask the user to sign in again. */
export function isAuthFailure(error: unknown): boolean {
  const kind = error instanceof AdminApiError ? error.kind : normalizeAdminError(error).kind;
  return kind === 'session' || kind === 'forbidden';
}

/* ------------------------------------------------------------- transport */

function client(): SupabaseClient {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new AdminApiError(
      'configuration',
      'Supabase is not configured, so the admin workspace cannot load. Set the Supabase URL and anon key, then sign in again.',
    );
  }
  return supabase;
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const supabase = client();
  let data: unknown;
  let error: unknown = null;
  try {
    const response = await supabase.rpc(fn as never, args as never);
    data = response.data;
    error = response.error;
  } catch (failure) {
    throw normalizeAdminError(failure);
  }
  if (error) throw normalizeAdminError(error);
  return data as T;
}

const filter = (value?: string | null): string | null => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed : null;
};

const pageLimit = (value?: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(Math.floor(value), 1000)
    : 25;

const pageOffset = (value?: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;

/* ------------------------------------------------------------------- API */

export function getOverview(): Promise<AdminOverview> {
  return rpc<AdminOverview>('admin_overview');
}

export function listAccounts(params: ListAccountsParams = {}): Promise<Paged<AdminAccount>> {
  return rpc<Paged<AdminAccount>>('admin_list_accounts', {
    p_search: filter(params.search),
    p_role: params.role ?? null,
    p_status: params.status ?? null,
    p_limit: pageLimit(params.limit),
    p_offset: pageOffset(params.offset),
  });
}

export function listApplications(params: ListApplicationsParams = {}): Promise<Paged<DoctorApplication>> {
  return rpc<Paged<DoctorApplication>>('admin_list_doctor_applications', {
    p_status: params.status ?? null,
    p_limit: pageLimit(params.limit),
    p_offset: pageOffset(params.offset),
  });
}

export function reviewApplication(input: ReviewApplicationInput): Promise<AdminAccount> {
  return rpc<AdminAccount>('admin_review_doctor_application', {
    p_user_id: input.userId,
    p_decision: input.decision,
    p_note: input.note.trim(),
  });
}

export function setAccountRole(input: SetAccountRoleInput): Promise<AdminAccount> {
  return rpc<AdminAccount>('admin_set_account_role', {
    p_user_id: input.userId,
    p_role: input.role,
    p_registration_id: filter(input.registrationId),
    p_department: filter(input.department),
    p_note: filter(input.note),
  });
}

export function setAccountStatus(input: SetAccountStatusInput): Promise<AdminAccount> {
  return rpc<AdminAccount>('admin_set_account_status', {
    p_user_id: input.userId,
    p_status: input.status,
  });
}

export function listPatientDirectory(params: ListPatientDirectoryParams = {}): Promise<Paged<PatientRow>> {
  return rpc<Paged<PatientRow>>('admin_list_patient_directory', {
    p_search: filter(params.search),
    p_only_unassigned: Boolean(params.onlyUnassigned),
    p_limit: pageLimit(params.limit),
    p_offset: pageOffset(params.offset),
  });
}

export function listAssignableDoctors(): Promise<AssignableDoctor[]> {
  return rpc<AssignableDoctor[]>('admin_list_assignable_doctors');
}

export function setPatientAssignment(
  input: SetPatientAssignmentInput,
): Promise<PatientAssignment | null> {
  return rpc<PatientAssignment | null>('admin_set_patient_assignment', {
    p_patient_number: input.patientNumber,
    p_doctor_id: input.doctorId ?? null,
  });
}

export function listActivity(params: ListActivityParams = {}): Promise<Paged<ActivityEntry>> {
  return rpc<Paged<ActivityEntry>>('admin_list_activity', {
    p_category: params.category ?? null,
    p_search: filter(params.search),
    p_limit: pageLimit(params.limit),
    p_offset: pageOffset(params.offset),
  });
}

export const adminApi = {
  getOverview,
  listAccounts,
  listApplications,
  reviewApplication,
  setAccountRole,
  setAccountStatus,
  listPatientDirectory,
  listAssignableDoctors,
  setPatientAssignment,
  listActivity,
};

/* --------------------------------------------------------------- display */

export const ROLE_LABELS: Record<AdminRole, string> = {
  admin: 'Admin',
  doctor: 'Doctor',
  patient: 'Patient',
};

/** Covers both account statuses and doctor-application statuses. */
export const STATUS_LABELS: Record<AccountStatus | ApplicationStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Declined',
};

export const ACTIVITY_CATEGORY_LABELS: Record<ActivityCategory, string> = {
  accounts: 'Accounts',
  approvals: 'Approvals',
  assignments: 'Assignments',
};

/** MYT (Asia/Kuala_Lumpur) date used throughout the admin workspace. */
export function formatAdminDate(value: string | null | undefined, includeTime = false): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? ({ hour: '2-digit', minute: '2-digit' } as const) : {}),
  }).format(date);
}

/** RFC-4180 CSV with spreadsheet formula-injection protection. */
export function adminCsv(rows: string[][]): string {
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((cell) => {
            const text = String(cell ?? '');
            const safe = /^[\s]*[=+@-]|^[\t\r\n]/.test(text) ? `'${text}` : text;
            return `"${safe.replace(/"/g, '""')}"`;
          })
          .join(','),
      )
      .join('\r\n')
  );
}

/** Trigger a browser download of a CSV built by `adminCsv`. */
export function downloadCsv(filename: string, rows: string[][]): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([adminCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* -------------------------------------------------------------- validation */

/** Returns an error message, or null when the note is acceptable. */
export function validateReviewNote(decision: ReviewDecision, note: string): string | null {
  const text = note.trim();
  if (text.length > 600) return 'Keep the review note to 600 characters or fewer.';
  if (decision === 'rejected' && text.length < 3) {
    return 'Add a reason of at least 3 characters before declining this application.';
  }
  return null;
}

/** Returns an error message, or null when the role change is acceptable. */
export function validateRoleChange(input: {
  role: AdminRole;
  registrationId?: string | null;
  department?: string | null;
}): string | null {
  if (!['admin', 'doctor', 'patient'].includes(input.role)) return 'Select a valid role.';
  if (input.role === 'doctor') {
    if (!(input.registrationId ?? '').trim()) return 'Enter the doctor’s registration number.';
    if (!(input.department ?? '').trim()) return 'Enter the doctor’s department or care group.';
  }
  return null;
}
