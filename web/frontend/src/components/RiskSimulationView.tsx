import React from 'react';
import type { Patient, NavigationModule } from '../types';
import { ConditionalSimulatorPanel } from './ConditionalSimulatorPanel';

type Props = {
  canViewPhysiology?: boolean;
  patient: Patient;
  onNavigate: (module: NavigationModule) => void;
  patients?: Patient[];
  onSelectPatient?: (patientId: string) => void;
};

export function RiskSimulationView({patient,patients,onSelectPatient,canViewPhysiology=false}: Props) {
  return <div className="space-y-5">
    {patients && onSelectPatient && <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5" data-testid="prediction-patient-selector">
      <h1 className="text-xl font-semibold">CGM forecast &amp; what-if</h1>
      <label className="w-full text-xs font-semibold text-slate-600 sm:w-auto">Patient record<select aria-label="Prediction patient" value={patient.id} onChange={event=>{if(patients.some(p=>p.id===event.target.value))onSelectPatient(event.target.value);}} className="mt-1.5 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm sm:min-w-64">{patients.map(p=><option key={p.id} value={p.id}>{p.id} ? {p.name}</option>)}</select></label>
    </section>}
    <ConditionalSimulatorPanel key={patient.id} patient={patient} allowInsulin={canViewPhysiology}/>
  </div>;
}
