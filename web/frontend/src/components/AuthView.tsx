/**
 * Complete Authentication & Onboarding Suite matching Figma Image 2
 * Implements all 5 distinct Figma flows:
 * 1. Sign In ("Welcome back")
 * 2. Patient Registration ("Your journey starts here")
 * 3. Doctor Registration ("Join your care workspace")
 * 4. Account Recovery / Forgot Password ("Forgot your password?")
 * 5. Email Verification ("Enter verification code")
 */
import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Mail,
  User,
  Building,
  KeyRound,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import type { AuthFlow } from '../types';

interface AuthViewProps {
  initialFlow?: AuthFlow;
  onSuccessLogin: (role?: 'admin' | 'doctor' | 'patient') => void;
  onClose?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  initialFlow = 'signin',
  onSuccessLogin,
  onClose,
}) => {
  const [currentFlow, setCurrentFlow] = useState<AuthFlow>(initialFlow);

  // Form states
  const [email, setEmail] = useState('admin@borneocenter.my');
  const [password, setPassword] = useState('••••••••••••');
  const [rememberMe, setRememberMe] = useState(true);

  // Patient registration states
  const [patientName, setPatientName] = useState('Elena Morales');
  const [patientNric, setPatientNric] = useState('680412-13-5428');
  const [patientEmail, setPatientEmail] = useState('elena.morales@gmail.com');
  const [patientPass, setPatientPass] = useState('HealthyTwin2026!');
  const [patientConfirmPass, setPatientConfirmPass] = useState('HealthyTwin2026!');
  const [patientTerms, setPatientTerms] = useState(true);

  // Doctor registration states
  const [docName, setDocName] = useState('Dr. Alex Wong');
  const [docEmail, setDocEmail] = useState('alex.wong@borneocenter.my');
  const [docClinic, setDocClinic] = useState('Borneo Center Kuching');
  const [docRegNum, setDocRegNum] = useState('MMC-74892');
  const [docPass, setDocPass] = useState('ClinicianSecPass2026!');
  const [docConfirmPass, setDocConfirmPass] = useState('ClinicianSecPass2026!');
  const [docTerms, setDocTerms] = useState(true);

  // Recovery email
  const [recoveryEmail, setRecoveryEmail] = useState('elena.morales@gmail.com');

  // Verification code digits
  const [codeDigits, setCodeDigits] = useState<string[]>(['4', '8', '2', '9', '1', '0']);

  const handleDigitChange = (index: number, val: string) => {
    if (val.length > 1) val = val.slice(-1);
    const updated = [...codeDigits];
    updated[index] = val;
    setCodeDigits(updated);

    // Auto focus next input
    if (val && index < 5) {
      const nextInput = document.getElementById(`code-digit-${index + 1}`);
      nextInput?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex flex-col justify-between p-4 sm:p-8 lg:p-12 animate-fadeIn selection:bg-blue-600 selection:text-white">
      {/* Top Bar with Brand and Flow Switcher Tabs */}
      <header className="max-w-6xl w-full mx-auto flex flex-col md:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            +
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-tight">
              Smart Diabetes Digital Twin
            </h1>
            <p className="text-[11px] text-slate-400">
              and Personalised Health Management Platform
            </p>
          </div>
        </div>

        {/* Quick Demo Switcher Tabs for all 5 Figma screens */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto max-w-full">
          <button
            onClick={() => setCurrentFlow('signin')}
            className={`px-3 py-1.5 rounded-lg transition shrink-0 ${
              currentFlow === 'signin'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            1. Sign In
          </button>
          <button
            onClick={() => setCurrentFlow('register_patient')}
            className={`px-3 py-1.5 rounded-lg transition shrink-0 ${
              currentFlow === 'register_patient'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            2. Patient Register
          </button>
          <button
            onClick={() => setCurrentFlow('register_doctor')}
            className={`px-3 py-1.5 rounded-lg transition shrink-0 ${
              currentFlow === 'register_doctor'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            3. Doctor Apply
          </button>
          <button
            onClick={() => setCurrentFlow('forgot_password')}
            className={`px-3 py-1.5 rounded-lg transition shrink-0 ${
              currentFlow === 'forgot_password'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            4. Recovery
          </button>
          <button
            onClick={() => setCurrentFlow('verify_email')}
            className={`px-3 py-1.5 rounded-lg transition shrink-0 ${
              currentFlow === 'verify_email'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            5. Verify Code
          </button>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-blue-600 font-semibold flex items-center gap-1"
          >
            <span>Skip to Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </header>

      {/* Main Split Screen Container */}
      <main className="max-w-6xl w-full mx-auto my-auto py-8">
        {/* ========================================================================= */}
        {/* FLOW 1: SIGN IN ("Welcome back") */}
        {/* ========================================================================= */}
        {currentFlow === 'signin' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Hero */}
            <div className="space-y-6">
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
                CONNECTED DIABETES CARE
              </span>
              <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
                Your health.<br />A clearer picture.
              </h2>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-md">
                Understand your health over time with a personalised view of your diabetes journey.
              </p>

              {/* Graphical Card: One connected view / Digital Twin */}
              <div className="p-6 rounded-3xl bg-[#f8fafc] border border-slate-200/80 shadow-2xs space-y-4 max-w-md">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>One connected view</span>
                  <span className="text-blue-600 font-bold uppercase tracking-wider text-[10px] bg-blue-50 px-2 py-0.5 rounded-md">
                    DIGITAL TWIN
                  </span>
                </div>

                <div className="h-28 bg-white rounded-2xl border border-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
                  <div className="flex items-center gap-6 text-xs text-slate-600">
                    <div className="text-center">
                      <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center mx-auto mb-1">
                        📈
                      </span>
                      <span className="text-[11px] font-medium">Health trends</span>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold shadow-sm">
                      👤
                    </div>
                    <div className="text-center">
                      <span className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 font-bold flex items-center justify-center mx-auto mb-1">
                        💡
                      </span>
                      <span className="text-[11px] font-medium">Personal insights</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-500">
                  + A patient-centred perspective, at every step.
                </p>
              </div>
            </div>

            {/* Right Form */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-8 sm:p-10 space-y-6 max-w-md mx-auto w-full">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  WELCOME TO YOUR HEALTH PLATFORM
                </span>
                <h3 className="text-2xl font-bold text-slate-900">Welcome back</h3>
                <p className="text-xs text-slate-500">
                  Sign in to your personalised health workspace.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onSuccessLogin('admin');
                }}
                className="space-y-4 text-xs"
              >
                <div>
                  <label className="block text-slate-700 font-semibold mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-slate-700 font-semibold">Password</label>
                    <button
                      type="button"
                      onClick={() => setCurrentFlow('forgot_password')}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="remember"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="remember" className="text-slate-600">
                    Remember my email
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#2563eb] hover:bg-blue-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition shadow-xs"
                >
                  <span>Sign in</span>
                  <span>→</span>
                </button>
              </form>

              {/* Callout */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] text-slate-600 leading-relaxed">
                One sign-in for patients, doctors and administrators. Your account determines your workspace.
              </div>

              {/* Bottom links */}
              <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">New to the platform?</span>
                  <button
                    onClick={() => setCurrentFlow('register_patient')}
                    className="text-blue-600 hover:text-blue-700 font-bold"
                  >
                    Create a patient account
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Healthcare professional?</span>
                  <button
                    onClick={() => setCurrentFlow('register_doctor')}
                    className="text-slate-700 hover:text-blue-600 font-semibold flex items-center gap-1"
                  >
                    <span>Apply for access</span>
                    <span>↗</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FLOW 2: PATIENT REGISTRATION ("Your journey starts here") */}
        {/* ========================================================================= */}
        {currentFlow === 'register_patient' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            {/* Left Column with Stepper */}
            <div className="space-y-8">
              <button
                onClick={() => setCurrentFlow('signin')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to sign in</span>
              </button>

              <div className="space-y-3">
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
                  YOUR PERSONAL HEALTH SPACE
                </span>
                <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  A little closer.<br />To understanding you.
                </h2>
                <p className="text-slate-600 text-sm leading-relaxed max-w-md">
                  Bring your health history, trends and personalised insights together in one place.
                </p>
              </div>

              {/* 3-Step Indicator */}
              <div className="space-y-6 pt-4 max-w-md">
                <div className="flex items-start gap-4">
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-200">
                    01
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Create your account</h4>
                    <p className="text-[11px] text-slate-500">Start with your name and email address.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 opacity-60">
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                    02
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-700">Verify your email</h4>
                    <p className="text-[11px] text-slate-400">Confirm your email before accessing your workspace.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 opacity-60">
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                    03
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-700">Connect your health record</h4>
                    <p className="text-[11px] text-slate-400">Your care team links the right record to your account.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Registration Form */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-8 sm:p-10 space-y-6 max-w-md mx-auto w-full">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  PATIENT REGISTRATION
                </span>
                <h3 className="text-2xl font-bold text-slate-900">Your journey starts here</h3>
                <p className="text-xs text-slate-500">
                  Create an account for your personal health workspace.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setCurrentFlow('verify_email');
                }}
                className="space-y-4 text-xs"
              >
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Full name</label>
                  <input
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">NRIC / Passport No.</label>
                  <input
                    type="text"
                    value={patientNric}
                    onChange={(e) => setPatientNric(e.target.value)}
                    placeholder="Enter your NRIC or passport number"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Email address</label>
                  <input
                    type="email"
                    value={patientEmail}
                    onChange={(e) => setPatientEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Password</label>
                  <input
                    type="password"
                    value={patientPass}
                    onChange={(e) => setPatientPass(e.target.value)}
                    placeholder="Create a password"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Use a long, unique password for this account.
                  </span>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Confirm password</label>
                  <input
                    type="password"
                    value={patientConfirmPass}
                    onChange={(e) => setPatientConfirmPass(e.target.value)}
                    placeholder="Re-enter your password"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={patientTerms}
                    onChange={(e) => setPatientTerms(e.target.checked)}
                    required
                    className="rounded-sm border-slate-300 text-blue-600 mt-0.5"
                  />
                  <label htmlFor="terms" className="text-slate-600 text-[11px] leading-tight">
                    I accept the terms of use and acknowledge the privacy notice.
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#2563eb] hover:bg-blue-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition"
                >
                  <span>Create patient account</span>
                  <span>→</span>
                </button>
              </form>

              <div className="p-3 rounded-xl bg-slate-50 text-[11px] text-slate-500">
                Health records are linked by your care team after registration.
              </div>

              <div className="text-center text-xs text-slate-500">
                Already have an account?{' '}
                <button
                  onClick={() => setCurrentFlow('signin')}
                  className="text-blue-600 font-bold hover:underline"
                >
                  Sign in
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FLOW 3: DOCTOR REGISTRATION ("Join your care workspace") */}
        {/* ========================================================================= */}
        {currentFlow === 'register_doctor' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            {/* Left Column with Stepper */}
            <div className="space-y-8">
              <button
                onClick={() => setCurrentFlow('signin')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to sign in</span>
              </button>

              <div className="space-y-3">
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
                  A CONNECTED CLINICAL WORKSPACE
                </span>
                <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  More context.<br />For every patient.
                </h2>
                <p className="text-slate-600 text-sm leading-relaxed max-w-md">
                  Explore patient histories, understand model predictions and compare scenarios in one connected workspace.
                </p>
              </div>

              {/* 3-Step Indicator */}
              <div className="space-y-6 pt-4 max-w-md">
                <div className="flex items-start gap-4">
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-200">
                    01
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Share your professional details</h4>
                    <p className="text-[11px] text-slate-500">Tell us about your registration and organisation.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 opacity-60">
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                    02
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-700">Verify and await approval</h4>
                    <p className="text-[11px] text-slate-400">Verify your email while an administrator reviews your application.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 opacity-60">
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                    03
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-700">Access assigned patients</h4>
                    <p className="text-[11px] text-slate-400">Once approved, view the patients assigned to your care.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Doctor Registration Form */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-8 sm:p-10 space-y-5 max-w-md mx-auto w-full">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  DOCTOR REGISTRATION
                </span>
                <h3 className="text-2xl font-bold text-slate-900">Join your care workspace</h3>
                <p className="text-xs text-slate-500">
                  Apply for access with your professional details.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setCurrentFlow('verify_email');
                }}
                className="space-y-3.5 text-xs"
              >
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Full name</label>
                  <input
                    type="text"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Professional email</label>
                  <input
                    type="email"
                    value={docEmail}
                    onChange={(e) => setDocEmail(e.target.value)}
                    placeholder="you@clinic.com"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Organisation / clinic</label>
                  <input
                    type="text"
                    value={docClinic}
                    onChange={(e) => setDocClinic(e.target.value)}
                    placeholder="Enter your organisation name"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Professional registration number</label>
                  <input
                    type="text"
                    value={docRegNum}
                    onChange={(e) => setDocRegNum(e.target.value)}
                    placeholder="Enter your registration number"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Password</label>
                  <input
                    type="password"
                    value={docPass}
                    onChange={(e) => setDocPass(e.target.value)}
                    placeholder="Create a password"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Confirm password</label>
                  <input
                    type="password"
                    value={docConfirmPass}
                    onChange={(e) => setDocConfirmPass(e.target.value)}
                    placeholder="Re-enter your password"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="doc-terms"
                    checked={docTerms}
                    onChange={(e) => setDocTerms(e.target.checked)}
                    required
                    className="rounded-sm border-slate-300 text-blue-600 mt-0.5"
                  />
                  <label htmlFor="doc-terms" className="text-slate-600 text-[11px]">
                    I accept the terms of use and acknowledge the privacy notice.
                  </label>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-tight">
                  <strong>Administrator approval required:</strong> Your application will be reviewed before patient information becomes accessible.
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#2563eb] hover:bg-blue-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition"
                >
                  <span>Submit application</span>
                  <span>→</span>
                </button>
              </form>

              <div className="text-center text-xs text-slate-500">
                Already have an approved account?{' '}
                <button
                  onClick={() => setCurrentFlow('signin')}
                  className="text-blue-600 font-bold hover:underline"
                >
                  Sign in
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FLOW 4: FORGOT PASSWORD ("Forgot your password?") */}
        {/* ========================================================================= */}
        {currentFlow === 'forgot_password' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            <div className="space-y-8">
              <button
                onClick={() => setCurrentFlow('signin')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to sign in</span>
              </button>

              <div className="space-y-3">
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
                  ACCOUNT RECOVERY
                </span>
                <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  A fresh start.<br />Same health journey.
                </h2>
                <p className="text-slate-600 text-sm leading-relaxed max-w-md">
                  Reset your password to return to your personalised health workspace.
                </p>
              </div>

              {/* 3-Step Indicator */}
              <div className="space-y-6 pt-4 max-w-md">
                <div className="flex items-start gap-4">
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-200">
                    01
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Enter your email</h4>
                    <p className="text-[11px] text-slate-500">Use the email address associated with your account.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 opacity-60">
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                    02
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-700">Check your inbox</h4>
                    <p className="text-[11px] text-slate-400">If an account matches, you will receive a password reset link.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 opacity-60">
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                    03
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-700">Choose a new password</h4>
                    <p className="text-[11px] text-slate-400">Follow the link to update your password and sign in again.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Reset Form */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-8 sm:p-10 space-y-6 max-w-md mx-auto w-full">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  LET'S GET YOU BACK IN
                </span>
                <h3 className="text-2xl font-bold text-slate-900">Forgot your password?</h3>
                <p className="text-xs text-slate-500">
                  Enter your account email and we'll send you a link to reset your password.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  alert('Password reset link has been dispatched to ' + recoveryEmail);
                  setCurrentFlow('signin');
                }}
                className="space-y-4 text-xs"
              >
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Email address</label>
                  <input
                    type="email"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Use the same email you use to sign in.
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#2563eb] hover:bg-blue-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition"
                >
                  <span>Send reset link</span>
                  <span>→</span>
                </button>
              </form>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] text-slate-500">
                If an account is associated with this email, a reset link will be sent. Check your spam folder too.
              </div>

              <div className="text-center text-xs text-slate-500">
                Remember your password?{' '}
                <button
                  onClick={() => setCurrentFlow('signin')}
                  className="text-blue-600 font-bold hover:underline"
                >
                  Back to sign in
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FLOW 5: EMAIL VERIFICATION ("Enter verification code") */}
        {/* ========================================================================= */}
        {currentFlow === 'verify_email' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            <div className="space-y-8">
              <button
                onClick={() => setCurrentFlow('signin')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to sign in</span>
              </button>

              <div className="space-y-3">
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
                  EMAIL VERIFICATION
                </span>
                <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  One small step.<br />A more connected you.
                </h2>
                <p className="text-slate-600 text-sm leading-relaxed max-w-md">
                  Confirm your email address to continue setting up your health platform account.
                </p>
              </div>

              {/* 3-Step Indicator */}
              <div className="space-y-6 pt-4 max-w-md">
                <div className="flex items-start gap-4 opacity-60">
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                    01
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-700">Check your inbox</h4>
                    <p className="text-[11px] text-slate-400">Look for the verification email for your account.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-200">
                    02
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Enter your code</h4>
                    <p className="text-[11px] text-slate-500">Enter the six-digit code from your email.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 opacity-60">
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                    03
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-700">Continue your registration</h4>
                    <p className="text-[11px] text-slate-400">Doctor accounts still require administrator approval.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 6-Digit PIN Form */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-8 sm:p-10 space-y-6 max-w-md mx-auto w-full">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  VERIFY YOUR EMAIL
                </span>
                <h3 className="text-2xl font-bold text-slate-900">Enter verification code</h3>
                <p className="text-xs text-slate-500">
                  Enter the six digit verification code sent to your registered email address.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onSuccessLogin('patient');
                }}
                className="space-y-5 text-xs"
              >
                <div>
                  <label className="block text-slate-700 font-semibold mb-2">
                    Verification code
                  </label>
                  {/* 6 Digit Boxes */}
                  <div className="flex items-center justify-between gap-2">
                    {codeDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        id={`code-digit-${idx}`}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                        className="w-11 h-12 text-center text-lg font-bold bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-2 text-center">
                    Enter all six digits from your email.
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#2563eb] hover:bg-blue-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition"
                >
                  <span>Verify email</span>
                  <span>→</span>
                </button>
              </form>

              <div className="text-center text-xs text-slate-500">
                Didn't receive a code? Check your spam folder or{' '}
                <button
                  onClick={() => alert('New verification code sent!')}
                  className="text-blue-600 font-bold hover:underline"
                >
                  Resend code
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer matching mockup */}
      <footer className="max-w-6xl w-full mx-auto pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
        <p>© 2026 Smart Diabetes Digital Twin and Personalised Health Management Platform</p>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-slate-600 transition">Privacy</a>
          <a href="#" className="hover:text-slate-600 transition">Terms</a>
          <a href="#" className="hover:text-slate-600 transition">Support</a>
        </div>
      </footer>
    </div>
  );
};
