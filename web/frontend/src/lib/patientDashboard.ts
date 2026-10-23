import type { SupabaseClient } from '@supabase/supabase-js';
import type { DashboardPatient } from '../components/DashboardView';

export interface PatientDashboardData {
  profile: { id: string; full_name: string | null; patient_id: string | null };
  summary: Record<string, unknown> | null;
  readings: Record<string, unknown>[];
}

/** The database chooses the record from auth.uid(); callers cannot supply a record ID. */
export async function loadPatientDashboard(client: SupabaseClient, userId: string): Promise<PatientDashboardData> {
  const { data, error } = await client.rpc('get_my_patient_dashboard');
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      throw new Error('Your dashboard needs database setup. Ask your administrator to apply the Patient dashboard SQL, then refresh.');
    }
    throw new Error('Your health information could not be loaded. Please try again.');
  }
  if (!data?.profile || data.profile.id !== userId) throw new Error('Your account profile is not available. Please contact your administrator.');
  const recordId = data.profile.patient_id;
  if (recordId !== null && (typeof recordId !== 'string' || !recordId.trim())) throw new Error('Your patient record link needs review. Please contact your care team.');
  if (!Array.isArray(data.readings) || (data.summary !== null && (typeof data.summary !== 'object' || Array.isArray(data.summary)))) {
    throw new Error('Your health information could not be loaded. Please try again.');
  }
  // Fail closed if a response ever contains a record other than the account's link.
  const records = [...(data.summary ? [data.summary] : []), ...data.readings];
  if (records.some((row) => !recordId || !row || row['Patient Number'] !== recordId)) {
    throw new Error('Your patient record link needs review. Please contact your care team.');
  }
  return data as PatientDashboardData;
}

/** Missing clinical measurements stay missing; never substitute sample values. */
export function measurement(value: unknown): string {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return 'Not recorded';
  if (typeof value !== 'number' && typeof value !== 'string') return 'Not recorded';
  if (typeof value === 'string' && !value.trim()) return 'Not recorded';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(numeric) : 'Not recorded';
}

/** Adapt only measured values to the existing dashboard; unavailable predictions stay empty. */
export function toDashboardPatient(data: PatientDashboardData): DashboardPatient {
  const numeric = (value: unknown) => measurement(value) === 'Not recorded' ? NaN : Number(value);
  const rounded = (value: number) => Number(value.toFixed(1));
  const hba1cMmol = numeric(data.summary?.['HbA1c (mmol/mol)']);
  const glucoseMg = numeric(data.summary?.['Fasting Plasma Glucose (mg/dl)']);
  const cgmReadings = data.readings.flatMap((row) => {
    const cgm = numeric(row['CGM (mg / dl)']);
    const date = typeof row.Date === 'string' ? row.Date : '';
    const timestamp = Date.parse(date);
    return Number.isFinite(cgm) && cgm >= 0 && Number.isFinite(timestamp) ? [{ cgm, date, timestamp }] : [];
  }).sort((a, b) => a.timestamp - b.timestamp);
  const total = cgmReadings.length;
  const mean = total ? cgmReadings.reduce((sum, row) => sum + row.cgm, 0) / total : NaN;
  const percent = (predicate: (value: number) => boolean) => total ? Math.round(cgmReadings.filter((row) => predicate(row.cgm)).length / total * 100) : NaN;
  const timeInRangePct = percent((value) => value >= 70 && value <= 180);
  return {
    hba1c: rounded(hba1cMmol * 0.09148 + 2.152),
    fastingGlucose: rounded(glucoseMg / 18.0182),
    bmi: numeric(data.summary?.['BMI (kg/m²)']),
    currentRiskPct: NaN,
    keyFactors: [],
    timeInRangePct,
    hasContinuousCGM: total > 0,
    cgmReadings,
    cgmSummary: total ? {
      totalReadings: total, startDate: cgmReadings[0].date, endDate: cgmReadings[total - 1].date,
      meanGlucose: rounded(mean), timeInRangePct,
      timeAboveRangePct: percent((value) => value > 180), timeBelowRangePct: percent((value) => value < 70),
      cvPct: mean > 0 ? rounded(Math.sqrt(cgmReadings.reduce((sum, row) => sum + (row.cgm - mean) ** 2, 0) / total) / mean * 100) : NaN,
      dailyProfiles: [],
    } : undefined,
  };
}
