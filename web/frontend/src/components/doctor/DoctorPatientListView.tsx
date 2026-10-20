import React, { useState } from 'react';
import {
  Users,
  Search,
  Filter,
  ArrowRight,
  Sparkles,
  Calendar,
  AlertTriangle,
  FileText,
  Activity,
  ChevronRight,
  TrendingUp,
  Stethoscope,
  Heart,
  Clock,
  Send,
  Plus,
} from 'lucide-react';
import type { Patient } from '../../types';

interface DoctorPatientListViewProps {
  patients: Patient[];
  currentPatient: Patient;
  onSelectPatient: (patientId: string) => void;
  onOpenDigitalTwin: (patientId: string) => void;
}

export const DoctorPatientListView: React.FC<DoctorPatientListViewProps> = ({
  patients,
  currentPatient,
  onSelectPatient,
  onOpenDigitalTwin,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRisk, setFilterRisk] = useState<'All' | 'High' | 'Moderate' | 'Stable'>('All');
  const [activeTab, setActiveTab] = useState<'summary' | 'trends' | 'issues' | 'notes'>('summary');
  const [consultNotes, setConsultNotes] = useState<string[]>([
    'Patient Elena Morales: HbA1c remains elevated at 8.1%. Advised increasing evening basal insulin by 2 units.',
    'CGM demonstrates nocturnal stability; primary excursions occur post-lunch.',
    'Referral made for ophthalmology retinal evaluation regarding microvascular strain.',
  ]);
  const [newNote, setNewNote] = useState('');

  const filteredPatients = patients.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.displayId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.condition.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRisk = filterRisk === 'All' || p.riskCategory === filterRisk;
    return matchesSearch && matchesRisk;
  });

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setConsultNotes([`[${new Date().toLocaleDateString()}] ${newNote.trim()}`, ...consultNotes]);
    setNewNote('');
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-600" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600">
              Assigned Cohort Patient Registry
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            Patient List & Clinical Profiles
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Select a patient to inspect multi-visit history, clinical notes, and directly launch their physiological digital twin.
          </p>
        </div>

        <button
          onClick={() => onOpenDigitalTwin(currentPatient.id)}
          className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Launch Twin for {currentPatient.name.split(' ')[0]}</span>
        </button>
      </div>

      {/* 2. Main 2-Column Layout: Left = Patient Directory, Right = Selected Patient Profile & Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Patient Directory (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden flex flex-col">
          {/* Search & Filter */}
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search patient name, ID, or condition…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white transition"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
              {(['All', 'High', 'Moderate', 'Stable'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setFilterRisk(r)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition ${
                    filterRisk === r
                      ? 'bg-teal-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {r === 'All' ? 'All Risks' : `${r} Risk`}
                </button>
              ))}
            </div>
          </div>

          {/* List of Patients */}
          <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
            {filteredPatients.map((p) => {
              const isSelected = p.id === currentPatient.id;
              return (
                <div
                  key={p.id}
                  onClick={() => onSelectPatient(p.id)}
                  className={`p-3.5 flex items-center justify-between cursor-pointer transition ${
                    isSelected
                      ? 'bg-teal-50/70 border-l-4 border-teal-600'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                        isSelected
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {p.avatarInitials}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-slate-900 font-semibold text-xs">{p.name}</strong>
                        <span className="text-[10px] text-slate-400 font-mono">({p.displayId})</span>
                      </div>
                      <span className="text-[11px] text-slate-500 block">
                        HbA1c: <strong className="text-slate-700">{p.hba1c}%</strong> · TIR:{' '}
                        <strong className="text-slate-700">{p.timeInRangePct}%</strong>
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.riskCategory === 'High'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : p.riskCategory === 'Moderate'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {p.riskCategory}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Patient Detail Profile with 4 Tabs (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          {/* Patient Card Top Header */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <span className="w-12 h-12 rounded-2xl bg-teal-600 text-white font-extrabold text-base flex items-center justify-center shadow-xs">
                {currentPatient.avatarInitials}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">{currentPatient.name}</h2>
                  <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 text-[10px] font-bold font-mono">
                    ID: {currentPatient.displayId}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {currentPatient.age} years old · {currentPatient.condition} · {currentPatient.visitsCount} recorded visits
                </p>
              </div>
            </div>

            <button
              onClick={() => onOpenDigitalTwin(currentPatient.id)}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs self-start sm:self-center"
            >
              <span>Open Digital Twin</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 4 Tabs: Summary, Recent Trends, Key Issues, Notes */}
          <div className="flex border-b border-slate-200 px-5 text-xs bg-white font-semibold">
            {[
              { id: 'summary', label: 'Clinical Summary' },
              { id: 'trends', label: 'Recent Trends' },
              { id: 'issues', label: 'Key Issues & Alerts' },
              { id: 'notes', label: 'Consultation Notes' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-3 border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-teal-600 text-teal-700 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Contents */}
          <div className="p-5 text-xs space-y-4">
            {/* Tab 1: Clinical Summary */}
            {activeTab === 'summary' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">HbA1c</span>
                    <strong className="text-base font-extrabold text-slate-900">{currentPatient.hba1c}%</strong>
                    <span className="text-[10px] text-red-500 block">Target &lt; 7.0%</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">Fasting Glucose</span>
                    <strong className="text-base font-extrabold text-slate-900">{currentPatient.fastingGlucose} mmol/L</strong>
                    <span className="text-[10px] text-slate-500 block">Basal state</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">Time in Range</span>
                    <strong className="text-base font-extrabold text-teal-600">{currentPatient.timeInRangePct}%</strong>
                    <span className="text-[10px] text-slate-500 block">Target &gt; 70%</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">Body Mass Index</span>
                    <strong className="text-base font-extrabold text-slate-900">{currentPatient.bmi}</strong>
                    <span className="text-[10px] text-amber-600 block">Overweight</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-200/80 text-teal-950">
                  <h4 className="font-bold text-xs text-teal-800 flex items-center gap-1.5 mb-1">
                    <Stethoscope className="w-3.5 h-3.5" />
                    <span>Clinical Impression & Risk Vector</span>
                  </h4>
                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    Patient presents with Type 2 Diabetes accompanied by moderate metabolic volatility.
                    Primary organ strain concentrated in Pancreatic Beta-Cell reserve (Stress Index 78%) and secondary Renal filtration strain.
                  </p>
                </div>
              </div>
            )}

            {/* Tab 2: Recent Trends */}
            {activeTab === 'trends' && (
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-slate-900">Multi-Visit Longitudinal HbA1c Progression</h4>
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                  {currentPatient.timelineData?.slice(-5).map((t) => (
                    <div key={t.visit} className="p-3 flex items-center justify-between bg-white text-xs">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold text-slate-800">Visit #{t.visit}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-slate-500">Cohort Avg: {t.avgHba1c}%</span>
                        <span className="font-bold text-slate-900 font-mono">Patient HbA1c: {t.currentHba1c}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 3: Key Issues & Alerts */}
            {activeTab === 'issues' && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold text-xs">Glycemic Excursion Alert</strong>
                    <p className="text-[11px] text-red-800 mt-0.5">
                      {currentPatient.latestSignal} detected during last continuous CGM observation window.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
                  <Activity className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold text-xs">Reduced Physical Compliance</strong>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Daily steps dropped below 4,500 for 4 consecutive days in current cycle.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Consultation Notes */}
            {activeTab === 'notes' && (
              <div className="space-y-3">
                <form onSubmit={handleAddNote} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add clinical consultation note…"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold text-xs flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Post</span>
                  </button>
                </form>

                <div className="space-y-2 mt-2">
                  {consultNotes.map((note, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-slate-700 text-xs leading-relaxed">
                      {note}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
