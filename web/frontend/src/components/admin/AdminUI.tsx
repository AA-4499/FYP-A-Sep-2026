import React, { useEffect, useId, useRef } from 'react';
import { AlertTriangle, Inbox, Loader2, X } from 'lucide-react';
import type { ApplicationStatus, AccountStatus } from '../../lib/adminApi';
import { ROLE_LABELS, STATUS_LABELS } from '../../lib/adminApi';
import type { AdminRole } from '../../lib/adminApi';

export const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40';
export const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40';
export const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-50';
export const cardClass = 'rounded-2xl border border-slate-200/80 bg-white shadow-sm';

export function RoleBadge({ role }: { role: AdminRole }) {
  const colors = { admin: 'bg-indigo-50 text-indigo-700', doctor: 'bg-teal-50 text-teal-700', patient: 'bg-sky-50 text-sky-700' };
  return <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold ${colors[role]}`}>{ROLE_LABELS[role]}</span>;
}

export function StatusBadge({ status }: { status: AccountStatus | ApplicationStatus }) {
  const colors = { active: 'bg-emerald-50 text-emerald-700', suspended: 'bg-slate-100 text-slate-600', pending: 'bg-amber-50 text-amber-800', approved: 'bg-emerald-50 text-emerald-700', rejected: 'bg-rose-50 text-rose-700' };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${colors[status]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{STATUS_LABELS[status]}</span>;
}

export function Avatar({ name }: { name: string | null | undefined }) {
  const initials = (name || '?').replace(/^Dr\.\s*/i, '').split(' ').slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || '?';
  return <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-xs font-bold text-slate-600">{initials}</span>;
}

export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-600">{eyebrow}</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p></div>{action}</div>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="px-6 py-12 text-center"><Inbox className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="text-sm font-semibold text-slate-700">{title}</p><p className="mt-1 text-xs text-slate-500">{description}</p></div>;
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
    <AlertTriangle className="h-4 w-4 shrink-0" />
    <p className="min-w-0 flex-1 leading-relaxed">{message}</p>
    {onRetry && <button type="button" onClick={onRetry} className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100">Retry</button>}
  </div>;
}

export function Notice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-800"><span className="flex-1">{message}</span><button type="button" onClick={onDismiss} aria-label="Dismiss notification" className="rounded p-1 hover:bg-emerald-100"><X className="h-4 w-4" /></button></div>;
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 px-6 py-12 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />{label}</div>;
}

interface BusyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  busy?: boolean;
  variant?: 'primary' | 'secondary';
}

export function BusyButton({ busy = false, variant = 'primary', disabled, children, className = '', ...rest }: BusyButtonProps) {
  const base = variant === 'primary' ? primaryButton : secondaryButton;
  return <button {...rest} disabled={disabled || busy} className={`${base} ${className}`}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{children}</button>;
}

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-5"><h2 id={titleId} className="text-lg font-bold">{title}</h2><button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button></div>
    <div className="p-6">{children}</div>
  </dialog>;
}
