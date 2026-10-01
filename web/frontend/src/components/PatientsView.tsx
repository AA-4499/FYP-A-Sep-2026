/**
 * Login and Patient List View
 * Enables selecting any cohort patient and signing in.
 */
import React, { useState } from 'react';
import { Search, UserCheck, ArrowRight, Lock, KeyRound, CheckCircle2 } from 'lucide-react';
import type { Patient, NavigationModule } from '../types';
import { PATIENTS } from '../data/patientsData';

interface PatientsViewProps {
  currentPatient: Patient;
  onSelectPatient: (patientId: string) => void;
  onNavigate: (module: NavigationModule) => void;
}

export const PatientsView: React.FC<PatientsViewProps> = ({
  currentPatient,
  onSelectPatient,
  onNavigate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRisk, setFilterRisk] = useState<'all' | 'high' | 'moderate' | 'low'>('all');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('clinician@swinburne.edu.my');
  const [loginPass, setLoginPass] = useState('password123');
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  const filtered = PATIENTS.filter((p) => {
    const matchesSearch =
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRisk =
      filterRisk === 'all' ||
      (filterRisk === 'high' && p.currentRiskPct >= 65) ||
      (filterRisk === 'moderate' && p.currentRiskPct >= 40 && p.currentRiskPct < 65) ||
      (filterRisk === 'low' && p.currentRiskPct < 40);

    return matchesSearch && matchesRisk;
  });

  const handleOpenPatient = (id: string) => {
    onSelectPatient(id);
    onNavigate('patients');
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Patient Directory & Access Control
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Select a ShanghaiT2DM longitudinal patient record to load their digital twin dashboard.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLoginModal(true)}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5 text-blue-600" />
            <span>{isLoggedIn ? 'Account: Dr. Alex Wong' : 'Sign In'}</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by ID or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Risk Filter:</span>
          {(['all', 'high', 'moderate', 'low'] as const).map((risk) => (
            <button
              key={risk}
              onClick={() => setFilterRisk(risk)}
              className={`px-3 py-1.5 rounded-lg capitalize font-medium transition ${
                filterRisk === risk
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {risk}
            </button>
          ))}
        </div>
      </div>

      {/* Patient Records Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p) => {
          const isSelected = p.id === currentPatient.id;
          const isHigh = p.currentRiskPct >= 65;
          const isModerate = p.currentRiskPct >= 40 && p.currentRiskPct < 65;

          return (
            <div
              key={p.id}
              className={`bg-white rounded-2xl border p-5 shadow-2xs space-y-4 transition ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-500/20'
                  : 'border-slate-200/90 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-xs">
                    {p.id}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{p.name}</h3>
                    <p className="text-[11px] text-slate-500">{p.condition}, {p.age}y</p>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    isHigh
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : isModerate
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  {p.currentRiskPct}% Risk
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs py-2 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-[10px] text-slate-400 block">HbA1c</span>
                  <strong className="text-slate-800">{p.hba1c}%</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Glucose</span>
                  <strong className="text-slate-800">{p.fastingGlucose}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Visits</span>
                  <strong className="text-slate-800">{p.visitsCount}</strong>
                </div>
              </div>

              <button
                onClick={() => handleOpenPatient(p.id)}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700'
                }`}
              >
                <span>{isSelected ? 'Currently Loaded in Dashboard' : 'Open in Dashboard'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Simple Login Dialog */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-600" />
                Clinician Sign In
              </h3>
              <button
                onClick={() => setShowLoginModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Password</label>
                <input
                  type="password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <button
              onClick={() => {
                setIsLoggedIn(true);
                setShowLoginModal(false);
              }}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition"
            >
              Sign In
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
