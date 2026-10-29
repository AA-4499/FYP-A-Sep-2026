import { AdminRetrainingView } from "./AdminRetrainingView";
import { FontSizeSettings } from "../FontSizeSettings";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, ArrowLeft, ChevronRight, LayoutDashboard, Link2, RefreshCw,
  ShieldAlert, ShieldCheck, Users,
} from 'lucide-react';
import type { AdminApiError, AdminOverview, AdminRole } from '../../lib/adminApi';
import {
  getOverview, isAuthFailure, normalizeAdminError,
} from '../../lib/adminApi';
import type { AdminModule } from '../../types';
import type { AdminMutation } from './AdminPages';
import {
  AdminAccountsPage, AdminActivityPage, AdminApprovalsPage,
  AdminAssignmentsPage, AdminOverviewPage,
} from './AdminPages';
import { Notice } from './AdminUI';

export interface AdminWorkspaceProps {
  admin: { id: string; full_name: string; email: string };
  onExit: () => void;
}

const pages = [
  { id: 'admin_overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'admin_users', label: 'User accounts', icon: Users },
  { id: 'admin_approvals', label: 'Doctor approvals', icon: ShieldCheck },
  { id: 'admin_assignments', label: 'Patient assignments', icon: Link2 },
  { id: 'admin_activity', label: 'Activity history', icon: Activity },
  { id: 'admin_retraining', label: 'Retrain model', icon: RefreshCw },
  { id: 'admin_settings', label: 'Settings', icon: LayoutDashboard },
] as const;

function initials(name: string, email: string): string {
  const source = (name || email || '?').replace(/^Dr\.\s*/i, '').trim();
  return source.split(/[\s.@_-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
}

export function AdminWorkspace({ admin, onExit }: AdminWorkspaceProps) {
  const [page, setPage] = useState<AdminModule>('admin_overview');
  const [reloadToken, setReloadToken] = useState(0);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState('');
  const [notice, setNotice] = useState('');
  const [fatal, setFatal] = useState<AdminApiError | null>(null);
  const overviewRevision = useRef(0);

  const refresh = useCallback(() => setReloadToken((value) => value + 1), []);

  const onFatal = useCallback((error: unknown) => {
    const normalized = normalizeAdminError(error);
    if (isAuthFailure(normalized)) setFatal(normalized);
  }, []);

  useEffect(() => {
    const request = ++overviewRevision.current;
    setOverviewLoading(true);
    setOverviewError('');
    getOverview().then((summary) => {
      if (request !== overviewRevision.current) return;
      setOverview(summary);
    }).catch((failure: unknown) => {
      if (request !== overviewRevision.current) return;
      const normalized = normalizeAdminError(failure);
      setOverviewError(normalized.message);
      onFatal(normalized);
    }).finally(() => {
      if (request === overviewRevision.current) setOverviewLoading(false);
    });
    return () => { overviewRevision.current++; };
  }, [reloadToken, onFatal]);

  const mutate: AdminMutation = async (run) => {
    try {
      const summary = await run();
      setNotice(summary);
      refresh();
      return null;
    } catch (failure) {
      const normalized = normalizeAdminError(failure);
      if (isAuthFailure(normalized)) setFatal(normalized);
      return normalized.message;
    }
  };

  const navigate = (next: AdminModule) => setPage(next);
  const pending = overview?.pendingApplications ?? 0;
  const displayName = admin.full_name?.trim() || admin.email;

  return <div className="admin-workspace min-h-screen bg-[#f5f6fa] text-slate-900 lg:flex">
    <a href="#admin-content" className="sr-only fixed left-4 top-4 z-50 rounded-lg bg-white px-4 py-2 text-sm font-semibold focus:not-sr-only">Skip to content</a>
    <aside className="shrink-0 bg-[#141b2e] text-slate-300 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-col">
      <div className="flex items-center justify-between px-6 py-6 lg:px-7 lg:py-8"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-2xl font-medium text-white">+</span><div><p className="text-lg font-bold tracking-tight text-white">DiaTwin<span className="text-indigo-400">.</span></p><p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">Administration</p></div></div><span className="rounded-md border border-slate-700 px-2 py-1 text-[9px] font-bold tracking-wider text-slate-400 lg:hidden">ADMIN</span></div>
      <p className="hidden px-7 pb-3 pt-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500 lg:block">Workspace</p>
      <nav aria-label="Admin navigation" className="flex gap-1 overflow-x-auto px-3 pb-4 lg:flex-col lg:px-4">{pages.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => navigate(id)} aria-current={page === id ? 'page' : undefined} className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-4 py-3.5 text-xs font-medium transition ${page === id ? 'bg-indigo-500/15 text-indigo-200 ring-1 ring-inset ring-indigo-400/15' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><Icon className={`h-4 w-4 ${page === id ? 'text-indigo-400' : 'text-slate-500'}`} />{label}{id === 'admin_approvals' && pending > 0 && <span className="ml-auto rounded-md bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">{pending}</span>}</button>)}</nav>
      <div className="mt-auto hidden space-y-5 p-5 lg:block"><div className="rounded-xl border border-white/5 bg-white/[0.03] p-4"><ShieldCheck className="mb-3 h-5 w-5 text-indigo-400" /><p className="text-xs font-semibold text-slate-200">An organized care platform.</p><p className="mt-2 text-[11px] leading-relaxed text-slate-500">Manage people and access from one dedicated workspace.</p></div><button type="button" onClick={onExit} className="flex items-center gap-2 px-2 text-xs text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" />Back to sign in</button></div>
    </aside>
    <div className="min-w-0 flex-1">
      <header className="flex min-h-20 items-center justify-between gap-4 border-b border-slate-200/70 bg-white px-5 sm:px-8 xl:px-10">
        <div className="flex items-center gap-2 text-xs"><span className="hidden text-slate-400 sm:inline">Administration</span><ChevronRight className="hidden h-3 w-3 text-slate-300 sm:block" /><span className="font-semibold text-slate-700">{pages.find((item) => item.id === page)?.label}</span></div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={refresh} aria-label="Refresh admin data" className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50"><RefreshCw className={`h-4 w-4 ${overviewLoading ? 'animate-spin' : ''}`} /></button>
          <button type="button" onClick={() => navigate('admin_approvals')} aria-label={`${pending} doctor applications awaiting approval`} className="relative rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50"><ShieldCheck className="h-4 w-4" />{pending > 0 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-amber-950">{pending}</span>}</button>
          <div className="hidden h-7 w-px bg-slate-100 sm:block" />
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600">{initials(admin.full_name, admin.email)}</span>
          <div className="hidden text-right sm:block"><p className="text-xs font-bold">{displayName}</p><p className="mt-0.5 max-w-48 truncate text-[10px] text-slate-400">{admin.email}</p></div>
          <button type="button" onClick={onExit} aria-label="Back to sign in" className="rounded-lg p-2 text-slate-500 lg:hidden"><ArrowLeft className="h-4 w-4" /></button>
        </div>
      </header>
      <main id="admin-content" tabIndex={-1} className="mx-auto max-w-[1500px] space-y-6 px-5 py-6 outline-none sm:px-8 sm:py-8 xl:px-10">
        {fatal && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"><ShieldAlert className="h-4 w-4 shrink-0" /><p className="min-w-0 flex-1 leading-relaxed"><strong className="font-bold">{fatal.kind === 'forbidden' ? 'Administration access denied. ' : 'Session expired. '}</strong>{fatal.message}</p><button type="button" onClick={onExit} className="rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-rose-700">Sign in again</button></div>}
        {notice && <Notice message={notice} onDismiss={() => setNotice('')} />}
        {page === 'admin_overview' && <AdminOverviewPage overview={overview} loading={overviewLoading} error={overviewError} onRetry={refresh} navigate={navigate} />}
        {page === 'admin_users' && <AdminAccountsPage reloadToken={reloadToken} mutate={mutate} onFatal={onFatal} />}
        {page === 'admin_approvals' && <AdminApprovalsPage reloadToken={reloadToken} mutate={mutate} onFatal={onFatal} />}
        {page === 'admin_assignments' && <AdminAssignmentsPage reloadToken={reloadToken} mutate={mutate} onFatal={onFatal} />}
        {page === 'admin_retraining' && <AdminRetrainingView />}
        {page === 'admin_settings' && <FontSizeSettings />}
        {page === 'admin_activity' && <AdminActivityPage reloadToken={reloadToken} mutate={mutate} onFatal={onFatal} />}
        <footer className="flex flex-wrap justify-between gap-2 border-t border-slate-200/70 pt-5 text-[10px] text-slate-400"><span>DiaTwin · Smart Diabetes Digital Twin</span><span>Admin workspace · Live platform data</span></footer>
      </main>
    </div>
  </div>;
}
