import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Download, Link2,
  RefreshCw, Search, ShieldCheck, Stethoscope, UserCheck, Users, X,
} from 'lucide-react';
import type {
  ActivityCategory, ActivityEntry, AdminAccount, AdminOverview, AdminRole,
  AssignableDoctor, DoctorApplication, PatientRow, Paged,
} from '../../lib/adminApi';
import {
  ACTIVITY_CATEGORY_LABELS, adminErrorMessage, downloadCsv, formatAdminDate,
  listAccounts, listActivity, listApplications, listAssignableDoctors,
  listPatientDirectory, normalizeAdminError, reviewApplication, ROLE_LABELS,
  setAccountRole, setAccountStatus, setPatientAssignment, STATUS_LABELS,
  validateReviewNote, validateRoleChange,
} from '../../lib/adminApi';
import type { AdminModule } from '../../types';
import {
  Avatar, BusyButton, cardClass, EmptyState, ErrorBanner, fieldClass,
  LoadingState, Modal, PageHeading, primaryButton, RoleBadge,
  secondaryButton, StatusBadge,
} from './AdminUI';

/* --------------------------------------------------------------- helpers */

/** Mutation wrapper supplied by AdminWorkspace: returns null on success. */
export type AdminMutation = (run: () => Promise<string>) => Promise<string | null>;

export interface AdminPageProps {
  reloadToken: number;
  mutate: AdminMutation;
  onFatal: (error: unknown) => void;
}

const PAGE_SIZE = 25;

function useDebounced(value: string, delay = 250): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value.trim()), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function rangeLabel(offset: number, count: number, total: number): string {
  if (!total) return '0 results';
  return `${offset + 1}–${offset + count} of ${total}`;
}

/**
 * The server clamps each page to 100 rows, so exports walk pages until the
 * requested cap is reached.
 */
async function fetchAllPages<T>(
  fetchPage: (limit: number, offset: number) => Promise<Paged<T>>,
  max = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  while (rows.length < max) {
    const limit = Math.min(100, max - rows.length);
    const page = await fetchPage(limit, offset);
    rows.push(...page.rows);
    offset += page.rows.length;
    if (!page.rows.length || rows.length >= page.total) break;
  }
  return rows.slice(0, max);
}

function Pagination({ offset, limit, total, onChange }: { offset: number; limit: number; total: number; onChange: (offset: number) => void }) {
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  return <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-xs text-slate-500">
    <span>{rangeLabel(offset, Math.max(0, Math.min(limit, total - offset)), total)}</span>
    <div className="flex items-center gap-3">
      <button type="button" aria-label="Previous page" disabled={offset <= 0} onClick={() => onChange(Math.max(0, offset - limit))} className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
      <span>{page} / {pages}</span>
      <button type="button" aria-label="Next page" disabled={offset + limit >= total} onClick={() => onChange(offset + limit)} className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
    </div>
  </div>;
}

/* -------------------------------------------------------------- overview */

export function AdminOverviewPage({
  overview, loading, error, onRetry, navigate,
}: {
  overview: AdminOverview | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  navigate: (page: AdminModule) => void;
}) {
  if (error) return <div className="space-y-6"><PageHeading eyebrow="Your administration workspace" title="A clear view of your platform." description="Manage access, keep your care team connected, and stay on top of what needs attention." /><ErrorBanner message={error} onRetry={onRetry} /></div>;
  if (loading && !overview) return <div className={cardClass}><LoadingState label="Loading platform overview…" /></div>;
  if (!overview) return <div className={cardClass}><EmptyState title="No overview available" description="Refresh to try loading the administration summary again." /></div>;

  const activeAccounts = Math.max(0, overview.accounts - overview.suspendedAccounts);
  const metrics = [
    { label: 'Total accounts', value: overview.accounts, detail: `${activeAccounts} active accounts`, icon: Users, page: 'admin_users' as const, color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Active doctors', value: overview.activeDoctors, detail: 'Approved to receive assignments', icon: Stethoscope, page: 'admin_users' as const, color: 'bg-teal-50 text-teal-600' },
    { label: 'Patient accounts', value: overview.patients, detail: `${overview.unassignedPatients} without a doctor`, icon: UserCheck, page: 'admin_assignments' as const, color: 'bg-sky-50 text-sky-600' },
    { label: 'Awaiting approval', value: overview.pendingApplications, detail: 'Doctor applications to review', icon: ShieldCheck, page: 'admin_approvals' as const, color: 'bg-amber-50 text-amber-600' },
  ];
  const roleCounts = overview.roleCounts;
  const roleTotal = (['admin', 'doctor', 'patient'] as AdminRole[])
    .reduce((sum, role) => sum + (roleCounts?.[role] ?? 0), 0);
  const totalForBars = Math.max(roleTotal, 1);
  const attention = overview.pendingApplications + overview.unassignedPatients;

  return <div className="space-y-6">
    <PageHeading eyebrow="Your administration workspace" title="A clear view of your platform." description="Manage access, keep your care team connected, and stay on top of what needs attention." action={<button type="button" className={secondaryButton} onClick={() => navigate('admin_activity')}><ArrowUpRight className="h-4 w-4" />View activity</button>} />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <button key={metric.label} type="button" onClick={() => navigate(metric.page)} className={`${cardClass} p-5 text-left transition hover:border-indigo-300 hover:shadow-md`}><div className="flex items-center justify-between"><span className={`rounded-xl p-2.5 ${metric.color}`}><metric.icon className="h-5 w-5" /></span><ArrowUpRight className="h-4 w-4 text-slate-300" /></div><p className="mt-5 text-3xl font-bold tracking-tight text-slate-900">{metric.value}</p><p className="mt-1 text-sm font-semibold text-slate-700">{metric.label}</p><p className="mt-2 text-[11px] leading-relaxed text-slate-400">{metric.detail}</p></button>)}</div>

    <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
      <section className={cardClass}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><h2 className="text-sm font-bold">Needs your attention</h2><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">{attention} items</span></div>
        <div className="divide-y divide-slate-100">
          <button type="button" onClick={() => navigate('admin_approvals')} className="flex w-full items-center gap-4 p-6 text-left hover:bg-slate-50"><span className="rounded-xl bg-amber-50 p-3 text-amber-600"><ShieldCheck className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{overview.pendingApplications} doctor application{overview.pendingApplications === 1 ? '' : 's'} awaiting review</p><p className="mt-1 text-xs leading-relaxed text-slate-500">Review registration details before approving access.</p></div><ArrowRight className="h-4 w-4 shrink-0 text-slate-400" /></button>
          <button type="button" onClick={() => navigate('admin_assignments')} className="flex w-full items-center gap-4 p-6 text-left hover:bg-slate-50"><span className="rounded-xl bg-sky-50 p-3 text-sky-600"><UserCheck className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{overview.unassignedPatients} patient{overview.unassignedPatients === 1 ? '' : 's'} without a doctor</p><p className="mt-1 text-xs leading-relaxed text-slate-500">Connect each patient with an approved care provider.</p></div><ArrowRight className="h-4 w-4 shrink-0 text-slate-400" /></button>
        </div>
      </section>
      <section className={`${cardClass} p-6`}>
        <h2 className="text-sm font-bold">Accounts by role</h2>
        <p className="mt-1 text-xs text-slate-400">{overview.suspendedAccounts} suspended account{overview.suspendedAccounts === 1 ? '' : 's'}</p>
        <div className="mt-6 space-y-5">{(['admin', 'doctor', 'patient'] as AdminRole[]).map((role) => {
          const count = roleCounts?.[role] ?? 0;
          return <div key={role}><div className="mb-2 flex justify-between text-xs"><span className="font-medium text-slate-600">{ROLE_LABELS[role]}</span><span className="font-bold">{count}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${role === 'admin' ? 'bg-indigo-500' : role === 'doctor' ? 'bg-teal-500' : 'bg-sky-400'}`} style={{ width: `${(count / totalForBars) * 100}%` }} /></div></div>;
        })}</div>
      </section>
    </div>

    <section className={cardClass}>
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><div><h2 className="text-sm font-bold">Recent activity</h2><p className="mt-1 text-xs text-slate-400">Latest changes across the platform · MYT</p></div><button type="button" onClick={() => navigate('admin_activity')} className="flex items-center gap-1 text-xs font-semibold text-indigo-600">View all<ArrowRight className="h-3.5 w-3.5" /></button></div>
      <div className="divide-y divide-slate-100">{overview.recentActivity.slice(0, 5).map((entry) => <div key={entry.id} className="flex flex-wrap items-center gap-3 px-6 py-4"><span className="h-2 w-2 rounded-full bg-indigo-300" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-700">{entry.action}{entry.subject_label && <span className="font-normal text-slate-400"> · {entry.subject_label}</span>}</p><p className="mt-1 text-[11px] text-slate-500">{entry.detail}</p></div><time className="text-[11px] text-slate-400" dateTime={entry.created_at}>{formatAdminDate(entry.created_at, true)} MYT</time></div>)}{!overview.recentActivity.length && <EmptyState title="No recent activity" description="Account, approval, and assignment changes will appear here." />}</div>
    </section>
  </div>;
}

/* ----------------------------------------------------------------- users */

export function AdminAccountsPage({ reloadToken, mutate, onFatal }: AdminPageProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);
  const [role, setRole] = useState<'all' | AdminRole>('all');
  const [status, setStatus] = useState<'all' | 'active' | 'suspended'>('all');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Paged<AdminAccount> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AdminAccount | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const revision = useRef(0);

  const load = () => {
    const request = ++revision.current;
    setLoading(true);
    setError('');
    listAccounts({
      search: debouncedSearch || undefined,
      role: role === 'all' ? undefined : role,
      status: status === 'all' ? undefined : status,
      limit: PAGE_SIZE,
      offset,
    }).then((result) => {
      if (request !== revision.current) return;
      setData(result);
    }).catch((failure: unknown) => {
      if (request !== revision.current) return;
      const normalized = normalizeAdminError(failure);
      setError(normalized.message);
      onFatal(normalized);
    }).finally(() => {
      if (request === revision.current) setLoading(false);
    });
  };

  useEffect(() => {
    load();
    return () => { revision.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, role, status, offset, reloadToken]);

  const exportRows = async () => {
    setExporting(true);
    setExportError('');
    try {
      const rows = await fetchAllPages((limit, offset) => listAccounts({
        search: debouncedSearch || undefined,
        role: role === 'all' ? undefined : role,
        status: status === 'all' ? undefined : status,
        limit,
        offset,
      }));
      downloadCsv('diatwin-admin-accounts.csv', [
        ['Name', 'Email', 'Role', 'Status', 'Department', 'Registration ID', 'Joined (MYT)', 'Last sign-in (MYT)', 'Email confirmed', 'Patient number'],
        ...rows.map((account) => [
          account.full_name, account.email, ROLE_LABELS[account.role], STATUS_LABELS[account.status],
          account.department ?? '', account.registration_id ?? '', formatAdminDate(account.joined_at),
          account.last_sign_in_at ? formatAdminDate(account.last_sign_in_at, true) : '',
          account.email_confirmed ? 'Yes' : 'No', account.patient_id ?? '',
        ]),
      ]);
    } catch (failure) {
      const normalized = normalizeAdminError(failure);
      setExportError(normalized.message);
      onFatal(normalized);
    } finally {
      setExporting(false);
    }
  };

  return <div className="space-y-6">
    <PageHeading eyebrow="People & access" title="User accounts" description="One directory for Admin, Patient, and Doctor accounts. Changes are saved to the platform database." action={<BusyButton variant="secondary" busy={exporting} onClick={() => void exportRows()}><Download className="h-4 w-4" />Export CSV</BusyButton>} />
    {error && <ErrorBanner message={error} onRetry={load} />}
    {exportError && <ErrorBanner message={exportError} onRetry={() => void exportRows()} />}
    <section className={cardClass}>
      <div className="flex flex-wrap gap-3 border-b border-slate-100 p-5">
        <label className="relative min-w-48 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input aria-label="Search accounts" placeholder="Search name, email or department" className={`${fieldClass} pl-9`} value={search} onChange={(event) => { setSearch(event.target.value); setOffset(0); }} /></label>
        <select aria-label="Filter accounts by role" value={role} onChange={(event) => { setRole(event.target.value as 'all' | AdminRole); setOffset(0); }} className={`${fieldClass} !w-auto`}><option value="all">All roles</option>{(Object.keys(ROLE_LABELS) as AdminRole[]).map((value) => <option key={value} value={value}>{ROLE_LABELS[value]}</option>)}</select>
        <select aria-label="Filter accounts by status" value={status} onChange={(event) => { setStatus(event.target.value as 'all' | 'active' | 'suspended'); setOffset(0); }} className={`${fieldClass} !w-auto`}><option value="all">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select>
        <button type="button" onClick={load} className={secondaryButton} aria-label="Refresh account list"><RefreshCw className="h-4 w-4" /></button>
      </div>
      {loading && !data ? <LoadingState label="Loading accounts…" /> : <>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-400"><tr>{['Account', 'Role', 'Status', 'Department', 'Joined', ''].map((label, index) => <th scope="col" key={index} className="px-5 py-3.5">{label || <span className="sr-only">Actions</span>}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.rows ?? []).map((account) => <tr key={account.id} className="hover:bg-slate-50/60">
                <td className="px-5 py-4"><div className="flex items-center gap-3"><Avatar name={account.full_name} /><div><p className="font-semibold text-slate-800">{account.full_name || 'Unnamed account'}</p><p className="mt-1 text-[11px] text-slate-400">{account.email}</p></div></div></td>
                <td className="px-5 py-4"><RoleBadge role={account.role} /></td>
                <td className="px-5 py-4"><StatusBadge status={account.status} /></td>
                <td className="px-5 py-4 text-slate-500">{account.department || '—'}</td>
                <td className="whitespace-nowrap px-5 py-4 text-slate-400">{formatAdminDate(account.joined_at)}</td>
                <td className="px-5 py-4"><button type="button" aria-label={`Manage ${account.full_name || account.email}`} onClick={() => setSelected(account)} className="font-semibold text-indigo-600 hover:underline">Manage</button></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        {data && !data.rows.length && <EmptyState title="No matching accounts" description="Try another search or change the role and status filters." />}
        {data && data.total > 0 && <Pagination offset={offset} limit={PAGE_SIZE} total={data.total} onChange={setOffset} />}
      </>}
    </section>
    {selected && <AccountManageModal account={selected} mutate={mutate} onFatal={onFatal} onClose={() => setSelected(null)} />}
  </div>;
}

function AccountManageModal({ account, mutate, onFatal, onClose }: { account: AdminAccount; mutate: AdminMutation; onFatal: (error: unknown) => void; onClose: () => void }) {
  const [role, setRole] = useState<AdminRole>(account.role);
  const [department, setDepartment] = useState(account.department ?? '');
  const [registrationId, setRegistrationId] = useState(account.registration_id ?? '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const dirty = role !== account.role
    || department.trim() !== (account.department ?? '')
    || registrationId.trim() !== (account.registration_id ?? '');

  const saveRole = async () => {
    const validation = validateRoleChange({ role, registrationId, department });
    if (validation) { setError(validation); return; }
    setBusy(true);
    setError(null);
    const message = await mutate(async () => {
      const updated = await setAccountRole({
        userId: account.id, role,
        registrationId: registrationId.trim() || null,
        department: department.trim() || null,
        note: note.trim() || null,
      });
      return `Account details for ${updated.full_name || account.email} saved.`;
    });
    setBusy(false);
    if (message) { setError(message); return; }
    onClose();
  };

  const changeStatus = async (status: 'active' | 'suspended') => {
    setBusy(true);
    setError(null);
    const message = await mutate(async () => {
      const updated = await setAccountStatus({ userId: account.id, status });
      return status === 'suspended'
        ? `${updated.full_name || account.email} has been suspended.`
        : `${updated.full_name || account.email} has been reactivated.`;
    });
    setBusy(false);
    if (message) { setError(message); return; }
    onClose();
  };

  const pendingApplication = account.doctor_application_status === 'pending';
  const suspendBlocked = account.role === 'admin' && account.status === 'active';

  return <Modal title="Manage account" onClose={onClose}>
    <div className="flex items-center gap-3"><Avatar name={account.full_name} /><div><h3 className="font-semibold">{account.full_name || 'Unnamed account'}</h3><p className="text-xs text-slate-500">{account.email}</p></div></div>
    <div className="mt-4 flex flex-wrap gap-2"><RoleBadge role={account.role} /><StatusBadge status={account.status} /></div>
    <dl className="mt-5 space-y-3 text-sm">
      <div className="flex justify-between gap-4"><dt className="text-slate-400">Joined</dt><dd>{formatAdminDate(account.joined_at)}</dd></div>
      <div className="flex justify-between gap-4"><dt className="text-slate-400">Last sign-in</dt><dd>{account.last_sign_in_at ? `${formatAdminDate(account.last_sign_in_at, true)} MYT` : 'Never'}</dd></div>
      <div className="flex justify-between gap-4"><dt className="text-slate-400">Email confirmed</dt><dd>{account.email_confirmed ? 'Yes' : 'No'}</dd></div>
      {account.patient_id && <div className="flex justify-between gap-4"><dt className="text-slate-400">Patient number</dt><dd className="font-mono text-xs">{account.patient_id}</dd></div>}
      {account.registration_id && <div className="flex justify-between gap-4"><dt className="text-slate-400">Registration</dt><dd>{account.registration_id}</dd></div>}
      <div className="flex justify-between gap-4"><dt className="text-slate-400">Assignments</dt><dd>{account.assignment_count}</dd></div>
    </dl>

    {pendingApplication && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">This account has a pending doctor application. Review it from Doctor approvals before changing the role.</p>}

    <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-600">Role<select value={role} onChange={(event) => { setRole(event.target.value as AdminRole); setError(null); }} className={`${fieldClass} mt-2`}>{(Object.keys(ROLE_LABELS) as AdminRole[]).map((value) => <option key={value} value={value}>{ROLE_LABELS[value]}</option>)}</select></label>
        <label className="block text-xs font-semibold text-slate-600">Department / care group<input maxLength={100} value={department} onChange={(event) => { setDepartment(event.target.value); setError(null); }} className={`${fieldClass} mt-2`} placeholder={role === 'doctor' ? 'Required for doctors' : 'Optional'} /></label>
      </div>
      {role === 'doctor' && <label className="block text-xs font-semibold text-slate-600">Registration number<input maxLength={60} value={registrationId} onChange={(event) => { setRegistrationId(event.target.value); setError(null); }} className={`${fieldClass} mt-2`} placeholder="Required for doctors" /><span className="mt-1 block text-[11px] font-normal text-slate-400">A doctor needs a registration number and department before they can receive patients.</span></label>}
      <label className="block text-xs font-semibold text-slate-600">Audit note (optional)<input maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} className={`${fieldClass} mt-2`} placeholder="Why was this changed?" /></label>
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      <BusyButton busy={busy} disabled={!dirty} onClick={() => void saveRole()}>Save role & details</BusyButton>
    </div>

    <div className="mt-6 border-t border-slate-100 pt-5">
      {account.status === 'active' ? (confirmSuspend ? <div>
        <p className="mb-4 text-sm leading-relaxed text-slate-600">Suspend {account.full_name || account.email}? They will lose access immediately and any patient assignments handled by this account are removed.</p>
        <div className="flex flex-wrap gap-2"><button type="button" className={secondaryButton} onClick={() => setConfirmSuspend(false)}>Cancel</button><BusyButton busy={busy} className="!bg-rose-600 hover:!bg-rose-700" onClick={() => void changeStatus('suspended')}>Confirm suspension</BusyButton></div>
      </div> : <button type="button" disabled={suspendBlocked} title={suspendBlocked ? 'Keep at least one active Admin account.' : undefined} className={`${secondaryButton} !text-rose-600`} onClick={() => setConfirmSuspend(true)}>Suspend account</button>)
        : <BusyButton variant="secondary" busy={busy} onClick={() => void changeStatus('active')}>Reactivate account</BusyButton>}
    </div>
  </Modal>;
}

/* ------------------------------------------------------------- approvals */

export function AdminApprovalsPage({ reloadToken, mutate, onFatal }: AdminPageProps) {
  const [filter, setFilter] = useState<'pending' | 'reviewed'>('pending');
  const [rows, setRows] = useState<DoctorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState<DoctorApplication | null>(null);
  const revision = useRef(0);

  const load = () => {
    const request = ++revision.current;
    setLoading(true);
    setError('');
    const query = filter === 'pending'
      ? listApplications({ status: 'pending', limit: 50 })
      : Promise.all([
        listApplications({ status: 'approved', limit: 50 }),
        listApplications({ status: 'rejected', limit: 50 }),
      ]).then(([approved, rejected]) => ({
        rows: [...approved.rows, ...rejected.rows].sort((a, b) => (b.reviewed_at ?? b.applied_at).localeCompare(a.reviewed_at ?? a.applied_at)),
        total: approved.total + rejected.total,
      }));
    query.then((result) => {
      if (request !== revision.current) return;
      setRows(result.rows);
    }).catch((failure: unknown) => {
      if (request !== revision.current) return;
      const normalized = normalizeAdminError(failure);
      setError(normalized.message);
      onFatal(normalized);
    }).finally(() => {
      if (request === revision.current) setLoading(false);
    });
  };

  useEffect(() => {
    load();
    return () => { revision.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, reloadToken]);

  return <div className="space-y-6">
    <PageHeading eyebrow="Care team onboarding" title="Doctor approvals" description="Review new applications and keep a record of every decision." />
    <div className="flex w-fit gap-1 rounded-xl bg-slate-200/50 p-1">{[['pending', 'Awaiting review'], ['reviewed', 'Reviewed applications']].map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value as 'pending' | 'reviewed')} aria-pressed={filter === value} className={`rounded-lg px-4 py-2 text-xs font-semibold ${filter === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>{label}</button>)}</div>
    {error && <ErrorBanner message={error} onRetry={load} />}
    {loading && !rows.length ? <div className={cardClass}><LoadingState label="Loading doctor applications…" /></div> : <>
      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((application) => <article key={application.user_id} className={`${cardClass} p-6`}>
          <div className="flex items-start justify-between gap-3"><Avatar name={application.full_name} /><StatusBadge status={application.status} /></div>
          <h2 className="mt-4 text-base font-bold">{application.full_name || 'Unnamed applicant'}</h2>
          <p className="mt-1 text-xs text-slate-500">{application.organisation || 'Organisation not provided'}</p>
          <dl className="my-5 space-y-3 border-y border-slate-100 py-4 text-xs">
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-slate-400">Email</dt><dd className="break-all text-slate-600">{application.email}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-400">Registration</dt><dd>{application.registration_id || <span className="text-rose-500">Not provided</span>}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-400">Email confirmed</dt><dd>{application.email_confirmed ? 'Yes' : <span className="text-amber-600">No</span>}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-400">Applied</dt><dd>{formatAdminDate(application.applied_at)}</dd></div>
          </dl>
          {application.status === 'pending'
            ? <button type="button" className={`${primaryButton} w-full`} onClick={() => setReviewing(application)}>Review application<ArrowRight className="h-4 w-4" /></button>
            : <div className="text-xs leading-relaxed text-slate-500"><p>{application.review_note || (application.status === 'approved' ? 'Application approved.' : 'Application declined.')}</p><p className="mt-2 text-slate-400">Reviewed {application.reviewed_at ? `${formatAdminDate(application.reviewed_at, true)} MYT` : '—'}</p></div>}
        </article>)}
      </div>
      {!rows.length && <section className={cardClass}><EmptyState title={filter === 'pending' ? 'You’re all caught up' : 'No reviewed applications yet'} description={filter === 'pending' ? 'There are no doctor applications waiting for review.' : 'Your approval and decline decisions will appear here.'} /></section>}
    </>}
    {reviewing && <ReviewApplicationModal application={reviewing} mutate={mutate} onClose={() => setReviewing(null)} />}
  </div>;
}

function ReviewApplicationModal({ application, mutate, onClose }: { application: DoctorApplication; mutate: AdminMutation; onClose: () => void }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'approved' | 'rejected' | null>(null);
  const blockers: string[] = [];
  if (!application.email_confirmed) blockers.push('The applicant has not confirmed their email address.');
  if (!application.registration_id || !application.registration_id.trim()) blockers.push('The application has no registration number.');
  const canApprove = blockers.length === 0;

  const review = async (decision: 'approved' | 'rejected') => {
    const validation = validateReviewNote(decision, note);
    if (validation) { setError(validation); return; }
    setBusy(decision);
    setError(null);
    const message = await mutate(async () => {
      const updated = await reviewApplication({ userId: application.user_id, decision, note });
      return decision === 'approved'
        ? `${updated.full_name || application.full_name} has been approved as a doctor.`
        : `The application from ${updated.full_name || application.full_name} was declined.`;
    });
    setBusy(null);
    if (message) { setError(message); return; }
    onClose();
  };

  return <Modal title="Review doctor application" onClose={onClose}>
    <div className="flex gap-3"><Avatar name={application.full_name} /><div><h3 className="font-semibold">{application.full_name || 'Unnamed applicant'}</h3><p className="mt-1 text-xs text-slate-500">{application.organisation || 'Organisation not provided'} · {application.registration_id || 'No registration number'}</p><p className="mt-1 text-xs text-slate-400">{application.email}</p></div></div>
    <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">Applied {formatAdminDate(application.applied_at)} · Email {application.email_confirmed ? 'confirmed' : 'not confirmed'}</div>
    <label className="mt-5 block text-xs font-semibold text-slate-600">Review note<textarea autoFocus maxLength={600} rows={4} value={note} onChange={(event) => { setNote(event.target.value); setError(null); }} className={`${fieldClass} mt-2 resize-y`} placeholder="Add context for your decision. A reason of at least 3 characters is required when declining." /></label>
    {blockers.length > 0 && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800"><p className="font-semibold">Approval is unavailable:</p><ul className="mt-1 list-disc pl-4">{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
    <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
      <BusyButton variant="secondary" className="!text-rose-600" busy={busy === 'rejected'} disabled={busy !== null} onClick={() => void review('rejected')}>Decline application</BusyButton>
      <BusyButton busy={busy === 'approved'} disabled={busy !== null || !canApprove} title={!canApprove ? blockers.join(' ') : undefined} onClick={() => void review('approved')}><Check className="h-4 w-4" />Approve doctor</BusyButton>
    </div>
  </Modal>;
}

/* ----------------------------------------------------------- assignments */

export function AdminAssignmentsPage({ reloadToken, mutate, onFatal }: AdminPageProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [data, setData] = useState<Paged<PatientRow> | null>(null);
  const [doctors, setDoctors] = useState<AssignableDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [doctorsError, setDoctorsError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingRow, setSavingRow] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ key: string; message: string } | null>(null);
  const [offset, setOffset] = useState(0);
  const revision = useRef(0);
  const doctorsRevision = useRef(0);

  const load = () => {
    const request = ++revision.current;
    setLoading(true);
    setError('');
    listPatientDirectory({ search: debouncedSearch || undefined, onlyUnassigned, limit: PAGE_SIZE, offset }).then((result) => {
      if (request !== revision.current) return;
      setData(result);
    }).catch((failure: unknown) => {
      if (request !== revision.current) return;
      const normalized = normalizeAdminError(failure);
      setError(normalized.message);
      onFatal(normalized);
    }).finally(() => {
      if (request === revision.current) setLoading(false);
    });
  };

  const loadDoctors = () => {
    const request = ++doctorsRevision.current;
    setDoctorsError('');
    listAssignableDoctors().then((result) => {
      if (request !== doctorsRevision.current) return;
      setDoctors(result);
    }).catch((failure: unknown) => {
      if (request !== doctorsRevision.current) return;
      const normalized = normalizeAdminError(failure);
      setDoctorsError(normalized.message);
      onFatal(normalized);
    });
  };

  useEffect(() => {
    load();
    return () => { revision.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, onlyUnassigned, offset, reloadToken]);

  useEffect(() => {
    loadDoctors();
    return () => { doctorsRevision.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken]);

  const assign = async (row: PatientRow, doctorId: string | null) => {
    setSavingRow(row.patient_number);
    setRowError(null);
    const message = await mutate(async () => {
      await setPatientAssignment({ patientNumber: row.patient_number, doctorId });
      const name = row.patient_name || row.patient_number;
      return doctorId ? `Saved a doctor assignment for ${name}.` : `Removed the doctor assignment for ${name}.`;
    });
    setSavingRow(null);
    if (message) { setRowError({ key: row.patient_number, message }); return; }
    setDrafts((previous) => { const next = { ...previous }; delete next[row.patient_number]; return next; });
  };

  return <div className="space-y-6">
    <PageHeading eyebrow="Care coordination" title="Patient assignments" description="Link each patient to one approved doctor. Every change is written to the database and recorded in Activity history." />
    {error && <ErrorBanner message={error} onRetry={load} />}
    {doctorsError && <ErrorBanner message={doctorsError} onRetry={loadDoctors} />}
    {!doctors.length && !doctorsError && !loading && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">No active doctors are available. Approve a doctor application or reactivate an existing doctor first.</p>}
    {doctors.length > 0 && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{doctors.map((doctor) => <div key={doctor.id} className={`${cardClass} flex items-center gap-3 p-4`}><Avatar name={doctor.full_name} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{doctor.full_name}</p><p className="mt-1 truncate text-[11px] text-slate-400">{doctor.email}</p></div><span title={`${doctor.assignment_count} assigned patients`} className="rounded-lg bg-teal-50 px-3 py-2 text-sm font-bold text-teal-700">{doctor.assignment_count}<span className="sr-only"> assigned patients</span></span></div>)}</div>}
    <section className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5">
        <label className="relative min-w-48 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setOffset(0); }} aria-label="Search patient assignments" placeholder="Search patients by name or number…" className={`${fieldClass} pl-9`} /></label>
        <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={onlyUnassigned} onChange={(event) => { setOnlyUnassigned(event.target.checked); setOffset(0); }} className="accent-indigo-600" />Unassigned only</label>
        <button type="button" onClick={() => { load(); loadDoctors(); }} className={secondaryButton} aria-label="Refresh assignments"><RefreshCw className="h-4 w-4" /></button>
      </div>
      {loading && !data ? <LoadingState label="Loading patient directory…" /> : <>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-400"><tr>{['Patient', 'Patient number', 'Assigned doctor', 'Change assignment', ''].map((label, index) => <th scope="col" key={index} className="px-5 py-3.5">{label || <span className="sr-only">Actions</span>}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.rows ?? []).map((row) => {
                const saved = row.assigned_doctor_id ?? '';
                const chosen = drafts[row.patient_number] ?? saved;
                const suspended = row.account_status === 'suspended';
                const saving = savingRow === row.patient_number;
                return <React.Fragment key={row.patient_number}>
                  <tr className="hover:bg-slate-50/60">
                    <td className="px-5 py-4"><div className="flex items-center gap-3"><Avatar name={row.patient_name} /><div><p className="font-semibold text-slate-800">{row.patient_name || 'Unnamed patient'}</p><p className="mt-1 text-[11px] text-slate-400">{saved ? `Assigned to ${row.assigned_doctor_name || 'another doctor'}` : 'Not assigned'}</p></div></div></td>
                    <td className="px-5 py-4 font-mono text-[11px] text-slate-500">{row.patient_number}</td>
                    <td className="px-5 py-4 text-slate-500">{row.assigned_doctor_name || <span className="inline-flex items-center gap-1 text-amber-700"><Link2 className="h-3 w-3" />Unassigned</span>}</td>
                    <td className="px-5 py-4"><select aria-label={`Doctor for ${row.patient_name || row.patient_number}`} disabled={suspended || saving} value={chosen} onChange={(event) => setDrafts((previous) => ({ ...previous, [row.patient_number]: event.target.value }))} className={`${fieldClass} !w-full sm:!w-56 disabled:opacity-40`}><option value="">Unassigned</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.full_name}</option>)}</select></td>
                    <td className="px-5 py-4"><div className="flex flex-wrap items-center justify-end gap-2"><BusyButton variant="secondary" busy={saving} disabled={suspended || chosen === saved} onClick={() => void assign(row, chosen || null)}>Save</BusyButton>{saved && <button type="button" disabled={suspended || saving} onClick={() => void assign(row, null)} className={`${secondaryButton} !px-3 !py-2 text-[11px]`}>Clear</button>}</div></td>
                  </tr>
                  {rowError?.key === row.patient_number && <tr><td colSpan={5} className="px-5 pb-4"><div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800"><X className="h-3.5 w-3.5 shrink-0" />{rowError.message}<button type="button" aria-label="Dismiss assignment error" onClick={() => setRowError(null)} className="ml-auto rounded p-1 hover:bg-rose-100"><X className="h-3.5 w-3.5" /></button></div></td></tr>}
                  {suspended && <tr><td colSpan={5} className="px-5 pb-3 text-[11px] text-slate-400">This patient account is suspended, so assignments are read-only.</td></tr>}
                </React.Fragment>;
              })}
            </tbody>
          </table>
        </div>
        {data && !data.rows.length && <EmptyState title="No matching patients" description="Try another search, or clear the “Unassigned only” filter." />}
        {data && data.total > 0 && <Pagination offset={offset} limit={PAGE_SIZE} total={data.total} onChange={setOffset} />}
      </>}
    </section>
  </div>;
}

/* -------------------------------------------------------------- activity */

export function AdminActivityPage({ reloadToken, onFatal }: AdminPageProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);
  const [category, setCategory] = useState<'all' | ActivityCategory>('all');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Paged<ActivityEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const revision = useRef(0);

  const load = () => {
    const request = ++revision.current;
    setLoading(true);
    setError('');
    listActivity({ category: category === 'all' ? undefined : category, search: debouncedSearch || undefined, limit: PAGE_SIZE, offset }).then((result) => {
      if (request !== revision.current) return;
      setData(result);
    }).catch((failure: unknown) => {
      if (request !== revision.current) return;
      const normalized = normalizeAdminError(failure);
      setError(normalized.message);
      onFatal(normalized);
    }).finally(() => {
      if (request === revision.current) setLoading(false);
    });
  };

  useEffect(() => {
    load();
    return () => { revision.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, category, offset, reloadToken]);

  const exportRows = async () => {
    setExporting(true);
    setExportError('');
    try {
      const rows = await fetchAllPages((limit, offset) => listActivity({ category: category === 'all' ? undefined : category, search: debouncedSearch || undefined, limit, offset }));
      downloadCsv('diatwin-admin-activity.csv', [
        ['Time (MYT)', 'Category', 'Action', 'Subject', 'Details', 'Actor'],
        ...rows.map((entry) => [formatAdminDate(entry.created_at, true), entry.category ?? entry.action, entry.action, entry.subject_label ?? '', entry.detail, entry.actor_email ?? '']),
      ]);
    } catch (failure) {
      const normalized = normalizeAdminError(failure);
      setExportError(normalized.message);
      onFatal(normalized);
    } finally {
      setExporting(false);
    }
  };

  return <div className="space-y-6">
    <PageHeading eyebrow="Workspace history" title="Activity history" description="Review account, approval, and assignment changes. All times are MYT." action={<BusyButton variant="secondary" busy={exporting} onClick={() => void exportRows()}><Download className="h-4 w-4" />Export CSV</BusyButton>} />
    {error && <ErrorBanner message={error} onRetry={load} />}
    {exportError && <ErrorBanner message={exportError} onRetry={() => void exportRows()} />}
    <section className={cardClass}>
      <div className="flex flex-wrap gap-3 border-b border-slate-100 p-5">
        <label className="relative min-w-48 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input aria-label="Search activity" value={search} onChange={(event) => { setSearch(event.target.value); setOffset(0); }} placeholder="Search activity…" className={`${fieldClass} pl-9`} /></label>
        <select aria-label="Filter activity category" value={category} onChange={(event) => { setCategory(event.target.value as 'all' | ActivityCategory); setOffset(0); }} className={`${fieldClass} !w-auto`}><option value="all">All activity</option>{(Object.keys(ACTIVITY_CATEGORY_LABELS) as ActivityCategory[]).map((value) => <option key={value} value={value}>{ACTIVITY_CATEGORY_LABELS[value]}</option>)}</select>
        <button type="button" onClick={load} className={secondaryButton} aria-label="Refresh activity"><RefreshCw className="h-4 w-4" /></button>
      </div>
      {loading && !data ? <LoadingState label="Loading activity…" /> : <>
        <div className="divide-y divide-slate-100">{(data?.rows ?? []).map((entry) => <article key={entry.id} className="flex items-start gap-4 px-5 py-5 sm:px-6">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${entry.category === 'approvals' ? 'bg-amber-400' : entry.category === 'assignments' ? 'bg-teal-400' : 'bg-indigo-400'}`} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">{entry.action}</h2><time dateTime={entry.created_at} className="text-[11px] text-slate-400">{formatAdminDate(entry.created_at, true)} MYT</time></div>
            {entry.subject_label && <p className="mt-1 text-xs font-medium text-slate-600">{entry.subject_label}{entry.patient_id ? ` · ${entry.patient_id}` : ''}</p>}
            <p className="mt-2 break-words text-xs leading-relaxed text-slate-500">{entry.detail}</p>
            {entry.actor_email && <p className="mt-1 text-[11px] text-slate-400">{entry.actor_email}</p>}
          </div>
        </article>)}</div>
        {data && !data.rows.length && <EmptyState title="No matching activity" description="Try clearing your filters or search for something else." />}
        {data && data.total > 0 && <Pagination offset={offset} limit={PAGE_SIZE} total={data.total} onChange={setOffset} />}
      </>}
    </section>
  </div>;
}
