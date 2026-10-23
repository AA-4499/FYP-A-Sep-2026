import React, { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Activity, ArrowRight, HeartPulse, LayoutDashboard, LogOut, RefreshCw, UserRound } from 'lucide-react';
import { getSupabaseClient } from '../lib/supabase';
import { loadPatientDashboard, measurement } from '../lib/patientDashboard';
import type { PatientDashboardData } from '../lib/patientDashboard';

type Page = 'home' | 'health' | 'profile';
const navigation = [
  { id: 'home' as const, label: 'My dashboard', icon: LayoutDashboard },
  { id: 'health' as const, label: 'My health', icon: Activity },
  { id: 'profile' as const, label: 'My profile', icon: UserRound },
];
const card = 'rounded-2xl border border-slate-200 bg-white p-5 sm:p-6';

export function PatientWorkspace({ user, error: authError, onExit }: { user: User; error: string; onExit: () => void }) {
  const [page, setPage] = useState<Page>('home');
  const [data, setData] = useState<PatientDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setData(null); setError('');
    const client = getSupabaseClient();
    if (!client) { setError('Unable to connect to your account. Please try again.'); setLoading(false); return; }
    void loadPatientDashboard(client, user.id).then((result) => {
      if (!cancelled) setData(result);
    }).catch((failure) => {
      if (!cancelled) setError(failure instanceof Error ? failure.message : 'Unable to load your dashboard.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user.id, retry]);
  const name = data?.profile.full_name?.trim() || (typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '') || 'Patient';
  const summary = data?.summary;
  const recordId = data?.profile.patient_id;
  const metrics = [
    { label: 'HbA1c', key: 'HbA1c (mmol/mol)', unit: 'mmol/mol' },
    { label: 'Fasting glucose', key: 'Fasting Plasma Glucose (mg/dl)', unit: 'mg/dL' },
    { label: 'BMI', key: 'BMI (kg/m\u00b2)', unit: 'kg/m²' },
    { label: 'Weight', key: 'Weight (kg)', unit: 'kg' },
  ];
  return <div className="min-h-screen bg-[#f8fafc] p-3 font-sans text-slate-900 sm:p-5 lg:p-7">
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 md:flex-row md:items-start">
      <aside className="w-full shrink-0 rounded-3xl border border-slate-200 bg-white p-5 md:sticky md:top-7 md:w-60">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white"><HeartPulse className="h-5 w-5" /></span><div><p className="text-lg font-bold">DiaTwin</p><p className="text-xs text-slate-500">Patient workspace</p></div></div>
        <nav aria-label="Patient navigation" className="my-6 space-y-2">{navigation.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setPage(id)} aria-current={page === id ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold ${page === id ? 'bg-purple-100 text-purple-700' : 'text-slate-600 hover:bg-slate-50'}`}><Icon className="h-4 w-4" />{label}</button>)}</nav>
        <div className="border-t border-slate-100 pt-4"><p className="text-xs leading-relaxed text-slate-500">Your personal health workspace</p><button onClick={onExit} className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-600"><LogOut className="h-4 w-4" />Sign out</button></div>
      </aside>
      <main className="min-w-0 flex-1 space-y-5">
        <header className={`${card} flex flex-wrap items-center justify-between gap-4`}><div><p className="text-xs font-bold uppercase tracking-wider text-purple-600">Patient dashboard</p><h1 className="mt-1 text-2xl font-bold">Welcome, {name}</h1><p className="mt-1 break-all text-xs text-slate-500">{user.email}</p></div><button disabled={loading} onClick={() => setRetry((value) => value + 1)} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button></header>
        {authError && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{authError}</p>}
        {loading ? <section className={card} role="status">Loading your dashboard…</section> : error ? <section role="alert" className={`${card} border-rose-200`}><h2 className="font-semibold">Your dashboard is unavailable</h2><p className="mt-2 text-sm text-slate-600">{error}</p></section> : <>
          {!recordId && <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5"><h2 className="font-semibold text-blue-900">Your dashboard is ready</h2><p className="mt-2 text-sm leading-relaxed text-blue-800">Your email is confirmed. Your care team will link your medical record so your health measurements can appear here.</p></section>}
          {recordId && !summary && <section role="status" className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm text-amber-900">Your account has a record link, but its health summary is not available. Please contact your care team.</section>}
          {page === 'profile' ? <section className={card}><h2 className="text-lg font-bold">My profile</h2><dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2">{[['Full name', name], ['Email', user.email || 'Not provided'], ['Role', 'Patient'], ['Email status', 'Confirmed'], ['Medical record', recordId || 'Awaiting care team link']].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>)}</dl></section> : <>
            <section aria-label="Health measurements" className="grid grid-cols-2 gap-4 xl:grid-cols-4">{metrics.map(({ label, key, unit }) => { const value = measurement(summary?.[key]); return <article key={key} className={card}><h2 className="text-sm text-slate-500">{label}</h2><p className={`mt-3 font-bold ${value === 'Not recorded' ? 'text-base text-slate-400' : 'text-3xl'}`}>{value}</p>{value !== 'Not recorded' && <p className="mt-1 text-xs text-slate-500">{unit}</p>}</article>; })}</section>
            {page === 'home' && <div className="grid gap-5 lg:grid-cols-2"><section className={card}><h2 className="text-lg font-bold">My health record</h2><p className="mt-3 text-sm text-slate-600">{typeof summary?.['Type of Diabetes'] === 'string' && summary['Type of Diabetes'].trim() ? summary['Type of Diabetes'] : 'Your care team has not recorded a condition here yet.'}</p><p className="mt-2 text-xs text-slate-500">Measurements reflect the available clinical record.</p><button onClick={() => setPage('health')} className="mt-5 flex items-center gap-2 text-sm font-semibold text-purple-700">View my health<ArrowRight className="h-4 w-4" /></button></section><section className={card}><h2 className="text-lg font-bold">My account</h2><p className="mt-3 text-sm text-slate-600">Your Patient account is active and your email is confirmed.</p><button onClick={() => setPage('profile')} className="mt-5 flex items-center gap-2 text-sm font-semibold text-purple-700">View my profile<ArrowRight className="h-4 w-4" /></button></section></div>}
            <section className={card}><h2 className="text-lg font-bold">Recent glucose readings</h2><p className="mt-1 text-xs text-slate-500">Up to 100 most recent recorded observations.</p>{data?.readings.length ? <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs text-slate-500"><tr><th scope="col" className="py-3 pr-4">Recorded date</th><th scope="col" className="py-3 pr-4">CGM (mg/dL)</th><th scope="col" className="py-3">CBG (mg/dL)</th></tr></thead><tbody>{data.readings.map((row, index) => <tr key={index} className="border-b border-slate-100"><td className="py-3 pr-4">{typeof row.Date === 'string' && row.Date ? row.Date : 'Not recorded'}</td><td className="py-3 pr-4">{measurement(row['CGM (mg / dl)'])}</td><td className="py-3">{measurement(row['CBG (mg / dl)'])}</td></tr>)}</tbody></table></div> : <div className="mt-5 rounded-xl bg-slate-50 p-6 text-center"><Activity className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-3 text-sm text-slate-500">No glucose readings recorded yet.</p></div>}</section>
          </>}
        </>}
      </main>
    </div>
  </div>;
}
