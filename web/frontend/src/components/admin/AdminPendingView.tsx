import React from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

interface AdminPendingViewProps {
  onBackToSignIn: () => void;
}

export const AdminPendingView: React.FC<AdminPendingViewProps> = ({ onBackToSignIn }) => (
  <main className="min-h-screen bg-slate-50 px-6 py-12 flex items-center justify-center text-slate-900">
    <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 shadow-sm">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
        <ShieldCheck className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">DiaTwin · Admin</p>
      <h1 className="mt-2 text-2xl font-bold">Admin dashboard</h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-600">
        The Admin dashboard has not been implemented yet.
      </p>
      <button
        type="button"
        onClick={onBackToSignIn}
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to sign in
      </button>
    </section>
  </main>
);
