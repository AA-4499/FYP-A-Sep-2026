import React, { useState } from 'react';
import { Users, Upload, Search, ChevronDown, ChevronUp } from 'lucide-react';
import type { PatientSummary } from '../types';

interface PatientSelectorProps {
  currentNumber: number;
  totalPatients: number;
  datasetName: string;
  actualLabel: string | null;
  patientWindow: PatientSummary[];
  currentValues: Record<string, number>;
  onSelectPatient: (patientNumber: number) => void;
  onUploadDataset: (file: File) => void;
  isLoading: boolean;
}

export const PatientSelector: React.FC<PatientSelectorProps> = ({
  currentNumber,
  totalPatients,
  datasetName,
  actualLabel,
  patientWindow,
  currentValues,
  onSelectPatient,
  onUploadDataset,
  isLoading,
}) => {
  const [inputNumber, setInputNumber] = useState<number>(currentNumber);
  const [showProfileGrid, setShowProfileGrid] = useState<boolean>(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputNumber >= 1 && inputNumber <= totalPatients) {
      onSelectPatient(inputNumber);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadNotice(`Uploading ${file.name}...`);
      onUploadDataset(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* Patient Selection & Import Bar */}
      <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Dataset-Backed Patient Explorer</h2>
              <p className="text-xs text-slate-500">
                Active dataset: <span className="font-semibold text-slate-700">{datasetName}</span> ({totalPatients.toLocaleString()} valid patients)
              </p>
            </div>
          </div>

          <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition">
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            <span>Import Patient CSV</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileChange}
              disabled={isLoading}
            />
          </label>
        </div>

        {uploadNotice && (
          <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
            {uploadNotice}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="patient-jump" className="text-xs font-medium text-slate-600">
              Select Patient #:
            </label>
            <input
              id="patient-jump"
              type="number"
              min={1}
              max={totalPatients}
              value={inputNumber}
              onChange={(e) => setInputNumber(Number(e.target.value))}
              className="w-28 px-3 py-1.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold text-slate-800"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center gap-1 text-xs font-semibold px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-sm"
          >
            <Search className="w-3.5 h-3.5" />
            {isLoading ? 'Processing Stages...' : 'Load Patient & Run Pipeline'}
          </button>
        </form>

        {/* Patient Table Window */}
        <div className="overflow-x-auto rounded-lg border border-slate-200 mt-3">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold">
              <tr>
                <th className="px-3 py-2 text-left">No.</th>
                <th className="px-3 py-2 text-left">BMI</th>
                <th className="px-3 py-2 text-left">Age Code</th>
                <th className="px-3 py-2 text-left">Sex</th>
                <th className="px-3 py-2 text-left">Recorded Dataset Class</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {patientWindow.map((p) => {
                const isSelected = p.number === currentNumber;
                return (
                  <tr
                    key={p.number}
                    className={`transition ${
                      isSelected ? 'bg-blue-50 font-semibold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-3 py-2 text-slate-900">#{p.number}</td>
                    <td className="px-3 py-2 text-slate-700">{p.bmi.toFixed(1)}</td>
                    <td className="px-3 py-2 text-slate-700">{p.age}</td>
                    <td className="px-3 py-2 text-slate-700">{p.sex}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {p.actual_label ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] ${
                            p.actual_label.includes('High')
                              ? 'bg-rose-100 text-rose-800'
                              : p.actual_label.includes('Medium')
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {p.actual_label}
                        </span>
                      ) : (
                        'Not supplied'
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => {
                          setInputNumber(p.number);
                          onSelectPatient(p.number);
                        }}
                        className={`text-xs px-2.5 py-1 rounded transition ${
                          isSelected
                            ? 'bg-blue-600 text-white cursor-default'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {isSelected ? 'Active' : 'Use'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Patient Profile Card */}
      <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Current Patient Profile · #{currentNumber}
            </span>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">
              21 Standardized BRFSS Clinical & Lifestyle Indicators
            </h3>
            {actualLabel && (
              <p className="text-xs text-slate-500 mt-0.5">
                Dataset ground truth: <span className="font-semibold text-slate-700">{actualLabel}</span> (Evaluation benchmark only; not a model input).
              </p>
            )}
          </div>
          <button
            onClick={() => setShowProfileGrid(!showProfileGrid)}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <span>{showProfileGrid ? 'Collapse Features' : 'Expand All 21 Features'}</span>
            {showProfileGrid ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showProfileGrid && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5 mt-4 text-xs animate-fadeIn">
            {Object.entries(currentValues).map(([key, val]) => (
              <div key={key} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex flex-col justify-between">
                <span className="text-slate-500 text-[11px] font-medium truncate" title={key}>
                  {key}
                </span>
                <strong className="text-slate-800 text-sm font-bold mt-1">
                  {Number.isInteger(val) ? val : val.toFixed(1)}
                </strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
