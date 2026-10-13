/**
 * Supabase Connection Configuration & Status Modal
 * Allows connecting to the user's Supabase instance (public.patient_summary & public.patient_detail)
 */
import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  RefreshCw,
  KeyRound,
  Server,
} from 'lucide-react';
import {
  getSupabaseCredentials,
  saveSupabaseCredentials,
  testSupabaseConnection,
} from '../lib/supabase';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
    count?: number;
  }>({
    tested: false,
    success: false,
    message: '',
  });

  useEffect(() => {
    if (isOpen) {
      const creds = getSupabaseCredentials();
      setUrl(creds.url);
      setAnonKey(creds.anonKey);
      setTestResult({ tested: false, success: false, message: '' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTest = async () => {
    setIsTesting(true);
    // Save first so test uses current values
    saveSupabaseCredentials(url, anonKey);
    const res = await testSupabaseConnection();
    setTestResult({
      tested: true,
      success: res.connected,
      message: res.message,
      count: res.count,
    });
    setIsTesting(false);
  };

  const handleSave = () => {
    saveSupabaseCredentials(url, anonKey);
    onConfigSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200/90 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Supabase Database Link
              </h2>
              <p className="text-xs text-slate-400">
                Connect live to <code className="font-mono text-emerald-600">patient_summary</code> &amp; <code className="font-mono text-emerald-600">patient_detail</code>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form fields */}
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Supabase Project URL
            </label>
            <div className="relative">
              <Server className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="https://xyzcompany.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 font-mono text-[11px]"
              />
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">
              Found in your Supabase project settings &gt; API &gt; Project URL
            </span>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Supabase Anon / Public Key
            </label>
            <div className="relative">
              <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 font-mono text-[11px]"
              />
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">
              Found in your Supabase project settings &gt; API &gt; Project API keys (anon public)
            </span>
          </div>

          {/* Test Status feedback */}
          {testResult.tested && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="leading-snug">
                <strong className="block font-semibold">
                  {testResult.success ? 'Connected Successfully' : 'Connection Failed'}
                </strong>
                <span className="text-[11px] block mt-0.5">{testResult.message}</span>
                {testResult.count !== undefined && (
                  <span className="text-[11px] font-semibold block mt-1">
                    Found {testResult.count} records in public.patient_summary.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Schema confirmation box */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600 space-y-1">
            <span className="font-bold text-slate-700 block">
              Configured Target Tables:
            </span>
            <p>
              • <code className="font-mono text-blue-600">public.patient_summary</code> (Demographics, HbA1c, FPG, Lipids, eGFR)
            </p>
            <p>
              • <code className="font-mono text-blue-600">public.patient_detail</code> (Time-series CGM, CBG, Ketones, Diet, Insulin)
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-500 hover:text-slate-700 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs"
            >
              Save &amp; Load Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
