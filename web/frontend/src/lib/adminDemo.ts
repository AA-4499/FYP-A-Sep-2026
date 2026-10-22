import type { UserRole } from '../types';

export type AccountStatus = 'active' | 'suspended' | 'pending' | 'rejected';
export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  department: string;
  joinedAt: string;
  registrationId?: string;
  reviewNote?: string;
  reviewedAt?: string;
}
export interface AdminAssignment { patientId: string; doctorId: string }
export interface AdminEvent {
  id: string;
  at: string;
  category: 'accounts' | 'approvals' | 'assignments';
  action: string;
  subject: string;
  detail: string;
}
export interface AdminState {
  version: 1;
  accounts: AdminAccount[];
  assignments: AdminAssignment[];
  events: AdminEvent[];
}
export type AdminCommand =
  | { type: 'add'; account: Pick<AdminAccount, 'name' | 'email' | 'role' | 'department' | 'registrationId'> }
  | { type: 'status'; id: string; status: 'active' | 'suspended' }
  | { type: 'review'; id: string; decision: 'approved' | 'rejected'; note: string }
  | { type: 'assign'; patientId: string; doctorId: string | null };

export const ADMIN_STORAGE_KEY = 'diatwin.admin-demo.v1';
export const ROLE_LABELS: Record<UserRole, string> = { admin: 'Admin', doctor: 'Doctor', patient: 'Patient' };
export const STATUS_LABELS: Record<AccountStatus, string> = {
  active: 'Active', suspended: 'Suspended', pending: 'Pending review', rejected: 'Declined',
};

export function createAdminDemo(): AdminState {
  const account = (id: string, name: string, role: UserRole, status: AccountStatus, day: number, department: string, registrationId?: string): AdminAccount => ({
    id, name, role, status, department, registrationId,
    email: `${id}@example.com`, joinedAt: `2026-10-${String(day).padStart(2, '0')}T01:00:00.000Z`,
  });
  return {
    version: 1,
    accounts: [
      account('admin-01', 'Demo Administrator', 'admin', 'active', 1, 'Platform operations'),
      account('doctor-01', 'Dr. Sarah Wong', 'doctor', 'active', 2, 'Endocrinology', 'DEMO-001'),
      account('doctor-02', 'Dr. Daniel Lim', 'doctor', 'active', 3, 'Primary care', 'DEMO-002'),
      account('doctor-03', 'Dr. Aisha Rahman', 'doctor', 'pending', 21, 'Endocrinology', 'DEMO-003'),
      account('doctor-04', 'Dr. Marcus Tan', 'doctor', 'pending', 22, 'Family medicine', 'DEMO-004'),
      account('doctor-05', 'Dr. Priya Nair', 'doctor', 'suspended', 5, 'Primary care', 'DEMO-005'),
      account('patient-01', 'Elena Morales', 'patient', 'active', 4, 'Diabetes care'),
      account('patient-02', 'James Bennett', 'patient', 'active', 6, 'Diabetes care'),
      account('patient-03', 'Mei Chen', 'patient', 'active', 7, 'Diabetes care'),
      account('patient-04', 'Amir Hassan', 'patient', 'active', 9, 'Diabetes care'),
      account('patient-05', 'Grace Lee', 'patient', 'active', 12, 'Diabetes care'),
      account('patient-06', 'Ravi Kumar', 'patient', 'suspended', 14, 'Diabetes care'),
    ],
    assignments: [
      { patientId: 'patient-01', doctorId: 'doctor-01' },
      { patientId: 'patient-02', doctorId: 'doctor-02' },
      { patientId: 'patient-03', doctorId: 'doctor-01' },
    ],
    events: [
      { id: 'event-01', at: '2026-10-22T01:00:00.000Z', category: 'approvals', action: 'Application received', subject: 'Dr. Marcus Tan', detail: 'Family medicine · awaiting review' },
      { id: 'event-02', at: '2026-10-21T01:00:00.000Z', category: 'approvals', action: 'Application received', subject: 'Dr. Aisha Rahman', detail: 'Endocrinology · awaiting review' },
      { id: 'event-03', at: '2026-10-20T03:30:00.000Z', category: 'assignments', action: 'Patient assigned', subject: 'Mei Chen', detail: 'Assigned to Dr. Sarah Wong' },
    ],
  };
}

/** Local demo operations only. No Auth roles or real patient records are changed. */
export function applyAdminCommand(state: AdminState, command: AdminCommand, at: string, id: string): AdminState {
  let accounts = state.accounts;
  let assignments = state.assignments;
  let event: Omit<AdminEvent, 'id' | 'at'>;
  if (command.type === 'add') {
    const name = command.account.name.trim();
    const email = command.account.email.trim().toLowerCase();
    const department = command.account.department.trim();
    const registrationId = command.account.registrationId?.trim();
    if (!name || !department) throw new Error('Enter a name and department or care group.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
    if (accounts.some((item) => item.email.toLowerCase() === email)) throw new Error('An account with this email already exists.');
    if (!['admin', 'patient', 'doctor'].includes(command.account.role)) throw new Error('Select a valid role.');
    if (command.account.role === 'doctor' && !registrationId) throw new Error('Enter the doctor’s registration number.');
    const status = command.account.role === 'doctor' ? 'pending' : 'active';
    accounts = [{ id: `account-${id}`, name, email, department, role: command.account.role, status, registrationId, joinedAt: at }, ...accounts];
    event = { category: 'accounts', action: 'Account added', subject: name, detail: `${ROLE_LABELS[command.account.role]} · ${STATUS_LABELS[status]}` };
  } else if (command.type === 'assign') {
    const patient = accounts.find((item) => item.id === command.patientId && item.role === 'patient');
    const doctor = accounts.find((item) => item.id === command.doctorId && item.role === 'doctor' && item.status === 'active');
    if (!patient) throw new Error('Patient account not found.');
    if (command.doctorId && patient.status !== 'active') throw new Error('Activate this patient account before assigning a doctor.');
    if (command.doctorId && !doctor) throw new Error('Select an active, approved doctor.');
    const previous = assignments.find((item) => item.patientId === patient.id);
    if ((previous?.doctorId ?? null) === command.doctorId) throw new Error('This assignment has not changed.');
    assignments = assignments.filter((item) => item.patientId !== patient.id);
    if (doctor) assignments = [...assignments, { patientId: patient.id, doctorId: doctor.id }];
    event = { category: 'assignments', action: doctor ? 'Patient assigned' : 'Assignment removed', subject: patient.name, detail: doctor ? `Assigned to ${doctor.name}` : 'Patient is now unassigned' };
  } else {
    const account = accounts.find((item) => item.id === command.id);
    if (!account) throw new Error('Account not found.');
    if (command.type === 'review') {
      if (account.role !== 'doctor' || account.status !== 'pending') throw new Error('This application has already been reviewed.');
      const note = command.note.trim();
      if (command.decision === 'rejected' && !note) throw new Error('Add a reason for declining this application.');
      accounts = accounts.map((item) => item.id === account.id ? { ...item, status: command.decision === 'approved' ? 'active' : 'rejected', reviewNote: note, reviewedAt: at } : item);
      event = { category: 'approvals', action: command.decision === 'approved' ? 'Doctor approved' : 'Application declined', subject: account.name, detail: note || 'Application reviewed and approved' };
    } else {
      if (account.status === 'pending' || account.status === 'rejected') throw new Error('Doctor applications must go through the review process.');
      if (account.status === command.status) throw new Error('This account status has not changed.');
      if (account.role === 'admin' && command.status === 'suspended' && accounts.filter((item) => item.role === 'admin' && item.status === 'active').length === 1) {
        throw new Error('Keep at least one active Admin account.');
      }
      accounts = accounts.map((item) => item.id === account.id ? { ...item, status: command.status } : item);
      // Suspended accounts cannot retain active care assignments.
      const removed = command.status === 'suspended' ? assignments.filter((item) => item.doctorId === account.id || item.patientId === account.id).length : 0;
      if (removed) assignments = assignments.filter((item) => item.doctorId !== account.id && item.patientId !== account.id);
      event = { category: 'accounts', action: command.status === 'active' ? 'Account reactivated' : 'Account suspended', subject: account.name, detail: `${ROLE_LABELS[account.role]} account${removed ? ` · ${removed} care assignment(s) removed` : ''}` };
    }
  }
  return { version: 1, accounts, assignments, events: [{ id, at, ...event }, ...state.events] };
}

/** Reject stale/corrupt storage instead of breaking the Admin workspace. */
export function parseAdminState(raw: string): AdminState {
  const value = JSON.parse(raw) as AdminState;
  if (!value || value.version !== 1 || !Array.isArray(value.accounts) || !Array.isArray(value.assignments) || !Array.isArray(value.events)) throw new Error('Unsupported demo data.');
  const text = (item: unknown) => typeof item === 'string';
  if (!value.accounts.every((item) => item && [item.id, item.name, item.email, item.department, item.joinedAt].every(text)
    && ['admin', 'doctor', 'patient'].includes(item.role) && ['active', 'suspended', 'pending', 'rejected'].includes(item.status)
    && Number.isFinite(Date.parse(item.joinedAt))
    && (item.registrationId === undefined || text(item.registrationId))
    && (item.reviewNote === undefined || text(item.reviewNote))
    && (item.reviewedAt === undefined || Number.isFinite(Date.parse(item.reviewedAt))))) throw new Error('Invalid account data.');
  if (new Set(value.accounts.map((item) => item.id)).size !== value.accounts.length
    || new Set(value.accounts.map((item) => item.email.toLowerCase())).size !== value.accounts.length
    || !value.accounts.some((item) => item.role === 'admin' && item.status === 'active')
    || value.accounts.some((item) => item.role !== 'doctor' && ['pending', 'rejected'].includes(item.status))) throw new Error('Invalid account roles.');
  if (!value.assignments.every((item) => item
    && value.accounts.some((account) => account.id === item.patientId && account.role === 'patient' && account.status === 'active')
    && value.accounts.some((account) => account.id === item.doctorId && account.role === 'doctor' && account.status === 'active'))
    || new Set(value.assignments.map((item) => item.patientId)).size !== value.assignments.length) throw new Error('Invalid assignments.');
  if (!value.events.every((item) => item && [item.id, item.at, item.action, item.subject, item.detail].every(text)
    && ['accounts', 'approvals', 'assignments'].includes(item.category) && Number.isFinite(Date.parse(item.at)))) throw new Error('Invalid activity data.');
  return value;
}

export function adminCsv(rows: string[][]): string {
  // Treat spreadsheet formula prefixes as text, including imported user input.
  return '\uFEFF' + rows.map((row) => row.map((cell) => {
    const safe = /^[\s]*[=+@-]|^[\t\r\n]/.test(cell) ? `'${cell}` : cell;
    return `"${safe.replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
}
