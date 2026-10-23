import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Mail, ShieldCheck } from 'lucide-react';
import { getSupabaseClient } from '../lib/supabase';
import { authErrorMessage, confirmationUrl, registerPatient, validateRegistration } from '../lib/accountAuth';

type Flow = 'signin' | 'register' | 'verify' | 'forgot' | 'reset';
interface Props { recovery: boolean; initialError?: string; onPasswordUpdated: () => void; onPreview: () => void }

export function AccountAuthView({ recovery, initialError = '', onPasswordUpdated, onPreview }: Props) {
  const [flow, setFlow] = useState<Flow>(recovery ? 'reset' : 'signin');
  const [name, setName] = useState('');
  const [identityNumber, setIdentityNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState('');
  const [resendAfter, setResendAfter] = useState(0);
  const activeFlow = recovery ? 'reset' : flow;
  const changeFlow = (next: Flow) => { setFlow(next); setError(''); setNotice(''); setPassword(''); setConfirm(''); setIdentityNumber(''); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase is not configured.');
      if (activeFlow === 'register') {
        await registerPatient(client, { name, identityNumber, email, password, confirm }, window.location.origin);
        setPassword(''); setConfirm(''); setIdentityNumber(''); setFlow('verify'); setResendAfter(Date.now() + 60000);
        setNotice('If this address can be registered, a confirmation link will be emailed to you. For an existing account, try signing in or resetting your password.');
      } else if (activeFlow === 'signin') {
        const { error: failure } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (failure) throw failure;
        setPassword('');
      } else if (activeFlow === 'forgot') {
        const { error: failure } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${confirmationUrl(window.location.origin)}?auth=recovery` });
        if (failure) throw failure;
        setNotice('If an account exists for this email, you will receive a password reset link. Check your inbox and spam folder.');
      } else if (activeFlow === 'reset') {
        validateRegistration('Account', password, confirm);
        const { error: failure } = await client.auth.updateUser({ password });
        if (failure) throw failure;
        const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
        if (signOutError) throw signOutError;
        setPassword(''); setConfirm(''); setFlow('signin');
        setNotice('Password updated. Sign in with your new password.');
        onPasswordUpdated();
      } else {
        if (Date.now() < resendAfter) throw new Error('Please wait at least one minute before requesting another email.');
        const { error: failure } = await client.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: confirmationUrl(window.location.origin) } });
        if (failure) throw failure;
        setResendAfter(Date.now() + 60000);
        setNotice('If this account is awaiting confirmation, a new link will be emailed to you.');
      }
    } catch (failure) { setError(authErrorMessage(failure)); }
    finally { setBusy(false); }
  };
  const title = { signin: 'Welcome back', register: 'Create your Patient account', verify: 'Check your inbox', forgot: 'Forgot your password?', reset: 'Choose a new password' }[activeFlow];
  const action = { signin: 'Sign in', register: 'Create Patient account', verify: 'Resend confirmation link', forgot: 'Send reset link', reset: 'Update password' }[activeFlow];
  const inputClass = 'mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-60';
  return <div className="flex min-h-screen flex-col bg-white px-5 py-6 text-slate-900 sm:px-10">
    <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-6"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-2xl text-white">+</span><div><p className="text-sm font-bold">Smart Diabetes Digital Twin</p><p className="mt-1 text-[11px] text-slate-400">Personalised Health Management Platform</p></div></div>{!recovery && <button type="button" onClick={onPreview} className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-blue-600">Preview sample dashboards<ArrowRight className="h-4 w-4" /></button>}</header>
    <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 py-10 lg:grid-cols-2 lg:gap-20"><section><span className="text-xs font-bold uppercase tracking-widest text-blue-600">Connected diabetes care</span><h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Your health.<br />A clearer picture.</h1><p className="mt-5 max-w-md text-sm leading-relaxed text-slate-500">One account connects you to your personal health workspace. Your care team links your health record after registration.</p><div className="mt-8 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-5"><ShieldCheck className="h-5 w-5 shrink-0 text-blue-600" /><p className="text-xs leading-relaxed text-blue-900">Patients can register here. Doctor and Admin access is assigned separately by an authorized administrator.</p></div></section>
      <section className="rounded-3xl border border-slate-200 p-6 shadow-sm sm:p-9" aria-labelledby="auth-heading">{activeFlow !== 'signin' && !recovery && <button type="button" onClick={() => changeFlow('signin')} className="mb-5 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><ArrowLeft className="h-3.5 w-3.5" />Back to sign in</button>}<h2 id="auth-heading" className="text-2xl font-bold">{title}</h2><p className="mb-6 mt-2 text-xs leading-relaxed text-slate-500">{activeFlow === 'verify' ? 'Open the confirmation link in your email. This screen does not use a six-digit code.' : activeFlow === 'register' ? 'Register with your name, NRIC / Passport No., email, and a password of at least 8 characters.' : activeFlow === 'reset' ? 'Enter and confirm your new password.' : 'Use the email address associated with your account.'}</p>
        {error && <p role="alert" className="mb-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs leading-relaxed text-rose-700">{error}</p>}{notice && <p role="status" className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800">{notice}</p>}
        <form onSubmit={submit} className="space-y-4"><fieldset disabled={busy} className="space-y-4">
          {activeFlow === 'register' && <label className="block text-xs font-semibold text-slate-600">Full name<input required autoComplete="name" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className={inputClass} /></label>}
          {activeFlow === 'register' && <label className="block text-xs font-semibold text-slate-600">NRIC / Passport No.<input required type="text" autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={64} value={identityNumber} onChange={(event) => setIdentityNumber(event.target.value)} className={inputClass} placeholder="Enter your NRIC or passport number" /></label>}
          {activeFlow !== 'reset' && <label className="block text-xs font-semibold text-slate-600">Email address<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} placeholder="you@example.com" /></label>}
          {['signin', 'register', 'reset'].includes(activeFlow) && <label className="block text-xs font-semibold text-slate-600">Password<input required type="password" minLength={activeFlow === 'signin' ? undefined : 8} autoComplete={activeFlow === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} /></label>}
          {['register', 'reset'].includes(activeFlow) && <label className="block text-xs font-semibold text-slate-600">Confirm password<input required type="password" minLength={8} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className={inputClass} /></label>}
          {activeFlow === 'signin' && <button type="button" onClick={() => changeFlow('forgot')} className="text-xs font-semibold text-blue-600">Forgot password?</button>}
          <button disabled={busy} type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">{activeFlow === 'verify' && <Mail className="h-4 w-4" />}{busy ? 'Please wait…' : action}</button>
        </fieldset></form>
        {activeFlow === 'signin' && <div className="mt-6 space-y-3 border-t border-slate-100 pt-5 text-xs"><button onClick={() => changeFlow('register')} className="block font-semibold text-blue-600">New here? Create a Patient account</button><button onClick={() => changeFlow('verify')} className="block text-slate-500">Need another confirmation email?</button></div>}
      </section>
    </main><footer className="mx-auto w-full max-w-6xl border-t border-slate-100 py-4 text-[11px] text-slate-400">DiaTwin · Patient registration and secure sign-in</footer>
  </div>;
}
