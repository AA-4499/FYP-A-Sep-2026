import React, { useEffect, useState } from 'react';
import { fetchSupabasePatients } from '../../lib/supabase';
import type { Patient } from '../../types';
import { RiskSimulationView } from '../RiskSimulationView';
import { LabResultsView } from '../LabResultsView';

export function AdminPredictionView() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selected, setSelected] = useState('');
  const [history, setHistory] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetchSupabasePatients().then(rows => {
      if (!cancelled) { setPatients(rows); setSelected(rows[0]?.id || ''); }
    }).catch(failure => { if (!cancelled) setError(failure.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  const patient = patients.find(row => row.id === selected);
  return <div className="space-y-5">
    <button type="button" className="text-sm font-semibold text-indigo-700" onClick={() => setHistory(value => !value)}>{history ? 'Back to prediction' : 'View lab results'}</button>
    {error && <p role="alert">{error}</p>}
    {patient ? history ? <LabResultsView key={patient.id} patientId={patient.id} /> : <RiskSimulationView patient={patient} patients={patients} onSelectPatient={setSelected} canViewPhysiology onNavigate={module => setHistory(module === 'patient_lab_results')} /> : <p role="status">{loading ? 'Loading patient records…' : 'No accessible patient records.'}</p>}
  </div>;
}
