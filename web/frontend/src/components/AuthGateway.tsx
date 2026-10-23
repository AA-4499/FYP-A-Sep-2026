import React, { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { CheckCircle2, LogOut, RefreshCw } from 'lucide-react';
import { getSupabaseClient, clearSupabasePatientCache } from '../lib/supabase';
import { authErrorMessage, trustedRole } from '../lib/accountAuth';
import type { UserRole } from '../types';
import { AccountAuthView } from './AccountAuthView';

interface Props { renderWorkspace: (role: UserRole, demo: boolean, onExit: () => void) => React.ReactNode }

export function AuthGateway({ renderWorkspace }: Props) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [demo, setDemo] = useState(false);
  const [recovery, setRecovery] = useState(() => new URLSearchParams(window.location.search).get('auth') === 'recovery');
  const [error, setError] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('error_description') || '');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) { setSession(null); setChecking(false); setError('Supabase is not configured.'); return; }
    const { data } = client.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (nextSession) setDemo(false);
      if (event === 'SIGNED_OUT') { clearSupabasePatientCache(); setUser(null); }
      setSession(nextSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (session === undefined) return;
    if (!session) { setUser(null); setChecking(false); return; }
    let cancelled = false;
    setChecking(true); setUser(null);
    // Verify outside the auth event callback, avoiding Supabase's callback lock.
    getSupabaseClient()!.auth.getUser().then(({ data, error: failure }) => {
      if (cancelled) return;
      if (failure || !data.user) setError(failure ? authErrorMessage(failure) : 'Please sign in again.');
      else { setUser(data.user); setError(''); }
      setChecking(false);
    }).catch((failure) => { if (!cancelled) { setError(authErrorMessage(failure)); setChecking(false); } });
    return () => { cancelled = true; };
  }, [session, retry]);
  const signOut = async () => {
    try {
      const { error: failure } = await getSupabaseClient()!.auth.signOut({ scope: 'local' });
      if (failure) throw failure;
      setRecovery(false); setError(''); setDemo(false); setUser(null); setSession(null);
      clearSupabasePatientCache();
      window.history.replaceState(null, '', window.location.pathname);
    } catch (failure) { setError(authErrorMessage(failure)); }
  };
  if (checking) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500" role="status">Checking your session…</div>;
  if (session && !user) return <AccountStatus title="We couldn’t verify your session" message={error} onExit={signOut} onRetry={() => setRetry((value) => value + 1)} />;
  if (!user || recovery) {
    if (!user && demo && !recovery) return <>{renderWorkspace('doctor', true, () => setDemo(false))}</>;
    return <AccountAuthView key={recovery ? 'recovery' : 'signin'} recovery={recovery} initialError={error} onPasswordUpdated={() => { setRecovery(false); window.history.replaceState(null, '', window.location.pathname); }} onPreview={() => setDemo(true)} />;
  }
  if (!user.email_confirmed_at) return <AccountStatus title="Confirm your email" message="Open the confirmation link in your inbox, then sign in again." onExit={signOut} />;
  const role = trustedRole(user);
  if (!role) return <AccountStatus title="Account access needs review" message="Your account does not have a recognized platform role. Contact your administrator." onExit={signOut} />;
  if (role === 'patient') return <PatientAccount key={user.id} user={user} error={error} onExit={signOut} />;
  return <>{error && <p role="alert" className="bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}{renderWorkspace(role, false, signOut)}</>;
}

function AccountStatus({ title, message, onExit, onRetry, children }: { title: string; message: string; onExit: () => void; onRetry?: () => void; children?: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><section className="w-full max-w-lg space-y-5 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"><CheckCircle2 className="h-9 w-9 text-blue-600" /><p className="text-xs font-bold uppercase tracking-widest text-blue-600">DiaTwin account</p><h1 className="text-2xl font-bold text-slate-900">{title}</h1><p className="text-sm leading-relaxed text-slate-500">{message}</p>{children}<div className="flex flex-wrap gap-3">{onRetry && <button onClick={onRetry} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600"><RefreshCw className="h-4 w-4" />Check again</button>}<button onClick={onExit} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"><LogOut className="h-4 w-4" />Sign out</button></div></section></main>;
}

function PatientAccount({ user, error, onExit }: { user: User; error: string; onExit: () => void }) {
  const [recordId, setRecordId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoaded(false); setProfileError(false);
    const load = async () => {
      try {
        const { data, error: failure } = await getSupabaseClient()!.from('profiles').select('patient_id').eq('id', user.id).maybeSingle();
        if (cancelled) return;
        if (failure || !data) setProfileError(true);
        setRecordId(typeof data?.patient_id === 'string' ? data.patient_id : null);
      } catch { if (!cancelled) setProfileError(true); }
      finally { if (!cancelled) setLoaded(true); }
    };
    void load();
    return () => { cancelled = true; };
  }, [user.id, retry]);
  const message = !loaded ? 'Checking your account profile…' : profileError ? 'You are signed in, but your profile is not ready. Ask your project administrator to complete profile setup, then check again.' : recordId ? 'Your patient record has been linked. Clinical dashboard access will be connected in the next development step.' : 'Your email is confirmed and you are signed in. Your care team will link your patient record before clinical information becomes available.';
  return <AccountStatus title="Your Patient account is ready" message={message} onExit={onExit} onRetry={() => setRetry((value) => value + 1)}><div className="rounded-xl bg-blue-50 p-4 text-xs text-blue-900"><p className="font-semibold">{user.email}</p><p className="mt-2">Role: Patient · Email confirmed</p></div>{error && <p role="alert" className="text-sm text-rose-600">{error}</p>}</AccountStatus>;
}
