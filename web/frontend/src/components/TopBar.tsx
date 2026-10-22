/** Header for the Doctor dashboard and Patient workspace. */
import React, { useState } from 'react';
import {
  Search,
  Bell,
  User,
  ChevronDown,
  ArrowLeft,
  KeyRound,
  Hospital,
  Database,
} from 'lucide-react';
import type { Patient } from '../types';

interface TopBarProps {
  mode: 'patient' | 'doctor';
  currentPatient: Patient;
  patientsList: Patient[];
  isSupabaseConnected: boolean;
  onSelectPatient: (patientId: string) => void;
  onSwitchMode: (mode: 'patient' | 'doctor') => void;
  onOpenAuth: () => void;
  onOpenSupabaseModal: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  mode,
  currentPatient,
  patientsList,
  isSupabaseConnected,
  onSelectPatient,
  onSwitchMode,
  onOpenAuth,
  onOpenSupabaseModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const roleLabel = mode === 'doctor' ? 'Doctor' : 'Patient';

  const filtered = patientsList.filter(
    (p) =>
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.displayId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <header className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      {/* Left: Mode Context */}
      {mode === 'doctor' ? (
        <div className="flex items-center gap-3">
          <div className="relative w-64 sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search patients…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:bg-white transition"
            />

            {/* Dropdown list if searching or opened */}
            {isDropdownOpen && (
              <div className="absolute top-10 left-0 w-80 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 text-xs">
                <div className="px-3 py-1 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Patient Cohort Records</span>
                  {isSupabaseConnected && (
                    <span className="text-emerald-600 font-bold">Supabase</span>
                  )}
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {filtered.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        onSelectPatient(p.id);
                        setIsDropdownOpen(false);
                        setSearchQuery('');
                      }}
                      className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition text-slate-700"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                          {p.avatarInitials}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <strong className="text-slate-900">{p.name}</strong>
                            {(p.hasContinuousCGM || ['2000_0_20201230', '2001_0_20201102', '2001_1_20201117', '2002_0_20210513', '2003_0_20210615'].includes(p.id)) && (
                              <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                CGM 14D
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">{p.id}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500 font-semibold">
                        HbA1c: {p.hba1c}%
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Patient Mode Left Profile */
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => onSwitchMode('doctor')}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
            title="Back to Doctor dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
            {currentPatient.displayId}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                {currentPatient.name}
              </h2>
              {currentPatient.hasContinuousCGM ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>14-Day CGM Feed</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                  Admission Labs Only
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {currentPatient.condition}, age {currentPatient.age}, BMI {currentPatient.bmi}
            </p>
          </div>
        </div>
      )}

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto">
        {/* Supabase Live Status Pill */}
        <button
          onClick={onOpenSupabaseModal}
          className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
            isSupabaseConnected
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
          title="Configure Supabase Connection"
        >
          <Database className={`w-3.5 h-3.5 ${isSupabaseConnected ? 'text-emerald-600' : 'text-slate-400'}`} />
          <span className="text-[11px]">
            {isSupabaseConnected ? 'Supabase: Live' : 'Link Supabase'}
          </span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isSupabaseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
            }`}
          />
        </button>

        {mode === 'patient' && (
          <button
            onClick={() => onSwitchMode('doctor')}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5"
          >
            <Hospital className="w-3.5 h-3.5 text-blue-600" />
            <span>Doctor dashboard</span>
          </button>
        )}

        {/* Notification Icon */}
        <button
          onClick={() => alert('17 clinical alerts need review. 1 critical alert for Elena Morales.')}
          className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-500 hover:text-slate-700 flex items-center justify-center transition relative"
        >
          <Bell className="w-3.5 h-3.5" />
          <span className="w-2 h-2 rounded-full bg-amber-500 absolute top-1.5 right-1.5 ring-2 ring-white" />
        </button>

        {/* Workspace profile menu */}
        <div className="relative">
          <button
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            aria-label={`${roleLabel} workspace menu`}
            aria-expanded={isProfileMenuOpen}
            className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"
          >
            <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
              {roleLabel[0]}
            </div>
            <div className="text-left hidden sm:block">
              <span className="block text-xs font-bold text-slate-900 leading-tight">
                {roleLabel}
              </span>
              <span className="block text-[10px] text-slate-400">
                {mode === 'doctor' ? 'Clinical workspace' : 'Personal workspace'}
              </span>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {isProfileMenuOpen && (
            <div className="absolute right-0 top-10 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 text-xs space-y-1">
              <div className="px-3 py-1 border-b border-slate-100">
                <strong className="block text-slate-900 font-bold">{roleLabel} workspace</strong>
                <span className="text-[10px] text-slate-400">Borneo Center Kuching</span>
              </div>
              <button
                onClick={() => {
                  onOpenSupabaseModal();
                  setIsProfileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
              >
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                <span>Supabase Database Settings</span>
              </button>
              <button
                onClick={() => {
                  onOpenAuth();
                  setIsProfileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
              >
                <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                <span>Auth &amp; Onboarding Suite</span>
              </button>
              <button
                onClick={() => {
                  onSwitchMode(mode === 'patient' ? 'doctor' : 'patient');
                  setIsProfileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
              >
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Switch to {mode === 'patient' ? 'Doctor dashboard' : 'Patient workspace'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Backdrop */}
      {(isDropdownOpen || isProfileMenuOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsDropdownOpen(false);
            setIsProfileMenuOpen(false);
          }}
        />
      )}
    </header>
  );
};
