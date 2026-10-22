import React, { useRef, useState } from 'react';
import { Activity, ArrowLeft, CheckCircle2, ChevronRight, FlaskConical, LayoutDashboard, Link2, RotateCcw, ShieldCheck, Users, X } from 'lucide-react';
import { ADMIN_STORAGE_KEY, applyAdminCommand, createAdminDemo, parseAdminState } from '../../lib/adminDemo';
import type { AdminCommand } from '../../lib/adminDemo';
import type { AdminModule } from '../../types';
import { AddAccountModal, AdminAccountsPage, AdminActivityPage, AdminApprovalsPage, AdminAssignmentsPage, AdminOverviewPage } from './AdminPages';
import { Modal, primaryButton, secondaryButton } from './AdminUI';

const pages = [
  { id: 'admin_overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'admin_users', label: 'User accounts', icon: Users },
  { id: 'admin_approvals', label: 'Doctor approvals', icon: ShieldCheck },
  { id: 'admin_assignments', label: 'Patient assignments', icon: Link2 },
  { id: 'admin_activity', label: 'Activity history', icon: Activity },
] as const;

function loadDemo() {
  try {
    const stored = localStorage.getItem(ADMIN_STORAGE_KEY);
    return { state: stored ? parseAdminState(stored) : createAdminDemo(), warning: '' };
  } catch {
    return { state: createAdminDemo(), warning: 'Saved demo data could not be loaded. Sample data is shown for this session.' };
  }
}

export function AdminWorkspace({ onExit }: { onExit: () => void }) {
  const [initial] = useState(loadDemo);
  const [state, setState] = useState(initial.state);
  const stateRef = useRef(state);
  const [page, setPage] = useState<AdminModule>('admin_overview');
  const [warning, setWarning] = useState(initial.warning);
  const [notice, setNotice] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const pending = state.accounts.filter((account) => account.status === 'pending').length;
  const navigate = (next: AdminModule) => { setPage(next); setReviewId(null); };
  const persist = (next: typeof state) => {
    stateRef.current = next;
    setState(next);
    try {
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(next));
      setWarning('');
      return true;
    } catch {
      setWarning('Browser storage is unavailable. Your changes are kept for this session only.');
      return false;
    }
  };
  const run = (command: AdminCommand) => {
    try {
      const next = applyAdminCommand(stateRef.current, command, new Date().toISOString(), crypto.randomUUID());
      const saved = persist(next);
      setNotice(`${next.events[0].action}. ${saved ? 'Saved in this browser.' : 'Updated for this session.'}`);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'The change could not be completed. Please try again.';
    }
  };
  return <div className="admin-workspace min-h-screen bg-[#f5f6fa] text-slate-900 lg:flex">
    <a href="#admin-content" className="sr-only fixed left-4 top-4 z-50 rounded-lg bg-white px-4 py-2 text-sm font-semibold focus:not-sr-only">Skip to content</a>
    <aside className="shrink-0 bg-[#141b2e] text-slate-300 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-col">
      <div className="flex items-center justify-between px-6 py-6 lg:px-7 lg:py-8"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-2xl font-medium text-white">+</span><div><p className="text-lg font-bold tracking-tight text-white">DiaTwin<span className="text-indigo-400">.</span></p><p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">Administration</p></div></div><span className="rounded-md border border-slate-700 px-2 py-1 text-[9px] font-bold tracking-wider text-slate-400 lg:hidden">ADMIN</span></div>
      <p className="hidden px-7 pb-3 pt-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500 lg:block">Workspace</p>
      <nav aria-label="Admin navigation" className="flex gap-1 overflow-x-auto px-3 pb-4 lg:flex-col lg:px-4">{pages.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => navigate(id)} aria-current={page === id ? 'page' : undefined} className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-4 py-3.5 text-xs font-medium transition ${page === id ? 'bg-indigo-500/15 text-indigo-200 ring-1 ring-inset ring-indigo-400/15' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><Icon className={`h-4 w-4 ${page === id ? 'text-indigo-400' : 'text-slate-500'}`} />{label}{id === 'admin_approvals' && pending > 0 && <span className="ml-auto rounded-md bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">{pending}</span>}</button>)}</nav>
      <div className="mt-auto hidden space-y-5 p-5 lg:block"><div className="rounded-xl border border-white/5 bg-white/[0.03] p-4"><ShieldCheck className="mb-3 h-5 w-5 text-indigo-400" /><p className="text-xs font-semibold text-slate-200">An organized care platform.</p><p className="mt-2 text-[11px] leading-relaxed text-slate-500">Manage people and access from one dedicated workspace.</p></div><button onClick={onExit} className="flex items-center gap-2 px-2 text-xs text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" />Back to sign in</button></div>
    </aside>
    <div className="min-w-0 flex-1"><header className="flex min-h-20 items-center justify-between gap-4 border-b border-slate-200/70 bg-white px-5 sm:px-8 xl:px-10"><div className="flex items-center gap-2 text-xs"><span className="hidden text-slate-400 sm:inline">Administration</span><ChevronRight className="hidden h-3 w-3 text-slate-300 sm:block" /><span className="font-semibold text-slate-700">{pages.find((item) => item.id === page)?.label}</span></div><div className="flex items-center gap-3"><button onClick={() => navigate('admin_approvals')} aria-label={`${pending} doctor applications awaiting approval`} className="relative rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50"><ShieldCheck className="h-4 w-4" />{pending > 0 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-amber-950">{pending}</span>}</button><div className="hidden h-7 w-px bg-slate-100 sm:block" /><span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600">AD</span><div className="hidden sm:block"><p className="text-xs font-bold">Demo admin</p><p className="mt-0.5 text-[10px] text-slate-400">Platform administrator</p></div><button onClick={onExit} aria-label="Back to sign in" className="rounded-lg p-2 text-slate-500 lg:hidden"><ArrowLeft className="h-4 w-4" /></button></div></header>
      <main id="admin-content" tabIndex={-1} className="mx-auto max-w-[1500px] space-y-6 px-5 py-6 outline-none sm:px-8 sm:py-8 xl:px-10">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3"><FlaskConical className="h-4 w-4 shrink-0 text-indigo-500" /><p className="min-w-0 flex-1 text-[11px] leading-relaxed text-indigo-800"><strong className="font-bold">Demo workspace.</strong> Sample accounts only. Changes are saved in this browser and do not affect live accounts.</p><button onClick={() => setShowReset(true)} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-100"><RotateCcw className="h-3 w-3" />Reset demo</button></div>
        {warning && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">{warning}</p>}
        {notice && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0" /><span className="flex-1">{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notification" className="rounded p-1 hover:bg-emerald-100"><X className="h-4 w-4" /></button></div>}
        {page === 'admin_overview' && <AdminOverviewPage state={state} navigate={navigate} onAdd={() => setShowAdd(true)} />}
        {page === 'admin_users' && <AdminAccountsPage state={state} run={run} onAdd={() => setShowAdd(true)} onReview={(id) => { navigate('admin_approvals'); setReviewId(id); }} />}
        {page === 'admin_approvals' && <AdminApprovalsPage state={state} run={run} reviewId={reviewId} onReview={setReviewId} />}
        {page === 'admin_assignments' && <AdminAssignmentsPage state={state} run={run} />}
        {page === 'admin_activity' && <AdminActivityPage state={state} />}
        <footer className="flex flex-wrap justify-between gap-2 border-t border-slate-200/70 pt-5 text-[10px] text-slate-400"><span>DiaTwin · Smart Diabetes Digital Twin</span><span>Admin workspace · Browser demo</span></footer>
      </main>
    </div>
    {showAdd && <AddAccountModal run={run} onClose={() => setShowAdd(false)} />}
    {showReset && <Modal title="Reset the demo workspace?" onClose={() => setShowReset(false)}><p className="text-sm leading-relaxed text-slate-600">This replaces your demo accounts, approvals, assignments, and activity history with the original sample data. Live accounts are unaffected.</p><div className="mt-6 flex justify-end gap-3"><button onClick={() => setShowReset(false)} className={secondaryButton}>Keep my changes</button><button className={primaryButton} onClick={() => { const saved = persist(createAdminDemo()); setNotice(saved ? 'Demo workspace reset and saved in this browser.' : 'Demo workspace reset for this session.'); setShowReset(false); setShowAdd(false); navigate('admin_overview'); }}>Reset demo</button></div></Modal>}
  </div>;
}
