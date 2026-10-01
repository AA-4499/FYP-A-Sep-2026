/**
 * TopBar Component for DiabetesTwin
 * Matches the user mockup header with patient profile info and search.
 */
import React, { useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import type { Patient } from '../types';
import { PATIENTS } from '../data/patientsData';

interface TopBarProps {
  currentPatient: Patient;
  onSelectPatient: (patientId: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ currentPatient, onSelectPatient }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const filtered = PATIENTS.filter(
    (p) =>
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <header className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      {/* Patient Avatar & Profile Summary */}
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-full bg-blue-100/90 text-blue-600 font-bold flex items-center justify-center text-sm shrink-0">
          {currentPatient.id}
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
            {currentPatient.name}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            {currentPatient.condition}, {currentPatient.age} y, {currentPatient.visitsCount} visits
          </p>
        </div>
      </div>

      {/* Search & Patient Quick Selector */}
      <div className="relative flex items-center gap-2">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            placeholder="Search patient"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
            className="w-48 sm:w-56 pl-8 pr-3 py-1.5 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:bg-white transition"
          />
        </div>

        {/* Dropdown list if searching or opened */}
        {isDropdownOpen && (
          <div className="absolute top-10 right-0 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 text-xs">
            <div className="px-3 py-1 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Select Patient Record
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
                  className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition ${
                    p.id === currentPatient.id ? 'bg-blue-50/80 font-bold text-blue-600' : 'text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                      {p.id}
                    </span>
                    <span>{p.name} ({p.age}y)</span>
                  </div>
                  <span className="text-[10px] text-slate-500">HbA1c: {p.hba1c}%</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Backdrop click to close */}
        {isDropdownOpen && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsDropdownOpen(false)}
          />
        )}
      </div>
    </header>
  );
};
