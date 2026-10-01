/**
 * Login & Role Authentication Modal.
 * Adheres to Modern Web Guidance: semantic HTML forms, accessible labels, autocomplete tokens, and keyboard accessibility.
 * Swinburne University of Technology Sarawak · Ts. Dr. Vong Wan Tze
 */
import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  ShieldCheck,
  KeyRound,
  Mail,
  GraduationCap,
  Sparkles,
  ArrowRight,
  HeartPulse,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRole?: UserRole;
  onSuccess?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  defaultRole = 'patient',
  onSuccess,
}) => {
  const { login, loginAsDemo } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>(defaultRole);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedRole(defaultRole);
      setError(null);
      // Pre-fill demo placeholder based on role
      if (defaultRole === 'patient') {
        setIdentifier('chen.wei@patient.health');
        setPassword('patient123');
      } else {
        setIdentifier('dr.wong@swinburne.edu.my');
        setPassword('admin123');
      }
    }
  }, [isOpen, defaultRole]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await login(selectedRole, identifier, password);
      if (res.success) {
        onClose();
        if (onSuccess) onSuccess();
      } else {
        setError(res.message || 'Login failed. Please check your credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = (demoKey: 'patient_1001' | 'patient_1002' | 'admin_clinician') => {
    loginAsDemo(demoKey);
    onClose();
    if (onSuccess) onSuccess();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-dialog-title"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-blue-200 bg-white/15 px-2.5 py-0.5 rounded-full backdrop-blur-xs">
              <GraduationCap className="w-3.5 h-3.5" />
              Swinburne Sarawak FYP
            </span>
          </div>

          <h2 id="login-dialog-title" className="text-2xl font-black tracking-tight">
            Sign In to DiabeTwin
          </h2>
          <p className="text-xs text-blue-100 mt-1">
            Access your personalized Digital Twin, longitudinal CGM telemetry, or clinical cohort workspace.
          </p>
        </div>

        {/* Role Switcher Tabs */}
        <div className="px-6 pt-5">
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setSelectedRole('patient');
                setIdentifier('chen.wei@patient.health');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${
                selectedRole === 'patient'
                  ? 'bg-white text-blue-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Patient Portal</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedRole('admin');
                setIdentifier('dr.wong@swinburne.edu.my');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${
                selectedRole === 'admin'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Clinician & Admin</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="login-identifier"
              className="block text-xs font-bold text-slate-700 uppercase tracking-wide"
            >
              {selectedRole === 'patient' ? 'Patient Email or Cohort ID' : 'Clinician / Admin ID'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="login-identifier"
                name="username"
                type={selectedRole === 'patient' ? 'text' : 'email'}
                required
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={selectedRole === 'patient' ? 'e.g. 1001 or chen.wei@patient.health' : 'e.g. dr.wong@swinburne.edu.my'}
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="login-password"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wide"
              >
                Password
              </label>
              <span className="text-[11px] text-slate-400">Any password for demo</span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                id="login-password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-md hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] transition disabled:opacity-50"
          >
            <span>{isLoading ? 'Verifying...' : `Sign In as ${selectedRole === 'patient' ? 'Patient' : 'Clinician / Admin'}`}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Quick Demo Login Presets */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                One-Click Quick Login
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickDemo('patient_1001')}
                className="flex items-center gap-2.5 p-2 rounded-lg bg-blue-50/70 border border-blue-100 text-left hover:bg-blue-100/80 transition"
              >
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  CW
                </div>
                <div className="truncate">
                  <p className="font-bold text-slate-900 truncate">Chen Wei (#1001)</p>
                  <p className="text-[10px] text-blue-700">Patient Persona</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo('admin_clinician')}
                className="flex items-center gap-2.5 p-2 rounded-lg bg-indigo-50/70 border border-indigo-100 text-left hover:bg-indigo-100/80 transition"
              >
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  Dr
                </div>
                <div className="truncate">
                  <p className="font-bold text-slate-900 truncate">Dr. Alex Wong</p>
                  <p className="text-[10px] text-indigo-700">Admin / Clinician</p>
                </div>
              </button>
            </div>
          </div>
        </form>

        {/* Footer Academic Note */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <HeartPulse className="w-3.5 h-3.5 text-blue-600" />
            ShanghaiT2DM Cohort Study
          </span>
          <span>Ts. Dr. Vong Wan Tze</span>
        </div>
      </div>
    </div>
  );
};
