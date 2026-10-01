import React, { useState } from 'react';
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  Activity,
  Heart,
  Pill,
  Clock,
} from 'lucide-react';
import type { PatientProfile, PatientListResponse } from '../types';

interface PatientSelectorProps {
  currentPatient: PatientProfile | null;
  patientList: PatientListResponse | null;
  onSelectPatient: (patientId: string) => void;
  onSearch: (query: string, page: number) => void;
  isLoading: boolean;
}

export const PatientSelector: React.FC<PatientSelectorProps> = ({
  currentPatient,
  patientList,
  onSelectPatient,
  onSearch,
  isLoading,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery, 1);
  };

  const currentPage = patientList?.page || 1;
  const totalPages = patientList?.total_pages || 1;

  const getRiskBadge = (category: string) => {
    if (category.toLowerCase().includes('high')) {
      return 'bg-rose-100 text-rose-800 border-rose-200';
    }
    if (category.toLowerCase().includes('moderate')) {
      return 'bg-amber-100 text-amber-800 border-amber-200';
    }
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  };

  return (
    <div className="space-y-6">
      {/* Search & Header Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                ShanghaiT2DM Longitudinal Cohort Explorer
              </h2>
              <p className="text-xs text-slate-500">
                Tracking repeated physiological and continuous glucose monitoring data from 105 patients
              </p>
            </div>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search ID or risk (e.g. 1002)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-52 sm:w-64 pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              Filter
            </button>
          </form>
        </div>

        {/* Patient Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Patient ID</th>
                <th className="py-2.5 px-3">Age / Sex</th>
                <th className="py-2.5 px-3">BMI</th>
                <th className="py-2.5 px-3">T2D Duration</th>
                <th className="py-2.5 px-3">HbA1c</th>
                <th className="py-2.5 px-3">Fasting Glucose</th>
                <th className="py-2.5 px-3">Blood Pressure</th>
                <th className="py-2.5 px-3">Risk Category</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {patientList?.patients.map((p) => {
                const isSelected = currentPatient?.id === p.id;
                return (
                  <tr
                    key={p.id}
                    className={`transition ${
                      isSelected ? 'bg-blue-50/80 font-semibold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-slate-900 font-bold">#{p.id}</td>
                    <td className="py-2.5 px-3 text-slate-700">
                      {p.age}y / {p.gender.charAt(0)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{p.bmi} kg/m²</td>
                    <td className="py-2.5 px-3 text-slate-700">{p.diabetes_duration_years} yrs</td>
                    <td className="py-2.5 px-3 font-semibold text-blue-600">{p.hba1c}%</td>
                    <td className="py-2.5 px-3 text-slate-700">{p.fasting_glucose} mmol/L</td>
                    <td className="py-2.5 px-3 text-slate-700">
                      {p.systolic_bp}/{p.diastolic_bp}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getRiskBadge(
                          p.risk_category
                        )}`}
                      >
                        {p.risk_category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => onSelectPatient(p.id)}
                        disabled={isLoading}
                        className={`text-xs px-2.5 py-1 rounded transition font-medium ${
                          isSelected
                            ? 'bg-blue-600 text-white cursor-default'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {isSelected ? 'Active' : 'Select'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
          <div>
            Showing page <span className="font-semibold text-slate-800">{currentPage}</span> of{' '}
            <span className="font-semibold text-slate-800">{totalPages}</span> (Total{' '}
            {patientList?.total || 0} cohort records)
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onSearch(searchQuery, Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1 || isLoading}
              className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onSearch(searchQuery, Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages || isLoading}
              className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Selected Patient Detailed Summary Card */}
      {currentPatient && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Selected Patient Health Record
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5 flex items-center gap-2">
                <span>{currentPatient.name}</span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${getRiskBadge(
                    currentPatient.risk_category
                  )}`}
                >
                  {currentPatient.risk_category}
                </span>
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>{currentPatient.cgm_days_recorded} Days CGM Recorded</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-500 block">Age &amp; Gender</span>
              <span className="text-sm font-bold text-slate-800 mt-0.5 block">
                {currentPatient.age}y / {currentPatient.gender}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-500 block">Body Mass Index</span>
              <span className="text-sm font-bold text-slate-800 mt-0.5 block">
                {currentPatient.bmi} kg/m²
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-500 block">T2D Duration</span>
              <span className="text-sm font-bold text-slate-800 mt-0.5 block">
                {currentPatient.diabetes_duration_years} Years
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-500 block">HbA1c / FBG</span>
              <span className="text-sm font-bold text-blue-600 mt-0.5 block">
                {currentPatient.hba1c}% / {currentPatient.fasting_glucose}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-500 block">Blood Pressure</span>
              <span className="text-sm font-bold text-slate-800 mt-0.5 block">
                {currentPatient.systolic_bp}/{currentPatient.diastolic_bp} mmHg
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-500 block">eGFR / Lipids</span>
              <span className="text-sm font-bold text-slate-800 mt-0.5 block">
                {currentPatient.egfr} mL / LDL {currentPatient.ldl_cholesterol}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-slate-700">
              <Pill className="w-4 h-4 text-indigo-500" />
              <span className="font-semibold">Current Medications:</span>
              <span>{currentPatient.medications.join(', ')}</span>
            </div>
            <div className="text-slate-500">
              Physical Activity: <span className="font-semibold text-slate-700">{currentPatient.phys_activity_level}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
