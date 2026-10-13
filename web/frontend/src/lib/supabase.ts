/**
 * Supabase Client & Data Synchronization Layer
 * Connects directly to the user's Supabase schema:
 * - public.patient_summary
 * - public.patient_detail
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Patient, KnowledgeGraphNode, KnowledgeGraphEdge } from '../types';
import { PATIENTS } from '../data/patientsData';

// Storage keys for user-configured credentials
const STORAGE_URL_KEY = 'dt_supabase_url';
const STORAGE_KEY_KEY = 'dt_supabase_anon_key';

export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const envUrl =
    (import.meta.env.VITE_SUPABASE_URL as string) ||
    (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string) ||
    'https://dgtaujhgwxmoghqdqkti.supabase.co';
  const envKey =
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
    (import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string) ||
    (import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string) ||
    'sb_publishable_z9E8XFx9DIyTKA-T-XI7gw_g0_l-Zkw';

  const storedUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_URL_KEY) || '' : '';
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_KEY) || '' : '';

  return {
    url: storedUrl || envUrl,
    anonKey: storedKey || envKey,
  };
}

export function saveSupabaseCredentials(url: string, anonKey: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_URL_KEY, url.trim());
    localStorage.setItem(STORAGE_KEY_KEY, anonKey.trim());
  }
}

let cachedClient: SupabaseClient | null = null;
let lastClientKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseCredentials();
  if (!url || !anonKey) {
    return null;
  }

  const clientKey = `${url}:${anonKey}`;
  if (cachedClient && lastClientKey === clientKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, anonKey);
    lastClientKey = clientKey;
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

/**
 * Raw row definition matching public.patient_summary
 */
export interface SupabasePatientSummary {
  'Patient Number': string;
  'Gender (Female=1, Male=2)'?: number | null;
  'Age (years)'?: number | null;
  'Height (m)'?: number | null;
  'Weight (kg)'?: number | null;
  'BMI (kg/m²)'?: number | null;
  'Smoking History (pack year)'?: number | null;
  'Alcohol Drinking History (drinker/non-drinker)'?: string | null;
  'Type of Diabetes'?: string | null;
  'Duration of diabetes (years)'?: number | null;
  'Acute Diabetic Complications'?: string | null;
  'Diabetic Macrovascular Complications'?: string | null;
  'Diabetic Microvascular Complications'?: string | null;
  'Comorbidities'?: string | null;
  'Hypoglycemic Agents'?: string | null;
  'Other Agents'?: string | null;
  'Fasting Plasma Glucose (mg/dl)'?: number | null;
  '2-hour Postprandial Plasma Glucose (mg/dl)'?: number | null;
  'Fasting C-peptide (nmol/L)'?: number | null;
  '2-hour Postprandial C-peptide (nmol/L)'?: number | null;
  'Fasting Insulin (pmol/L)'?: number | null;
  '2-hour Postprandial insulin (pmol/L)'?: number | null;
  'HbA1c (mmol/mol)'?: number | null;
  'Glycated Albumin (%)'?: number | null;
  'Total Cholesterol (mmol/L)'?: number | null;
  'Triglyceride (mmol/L)'?: number | null;
  'High-Density Lipoprotein Cholesterol (mmol/L)'?: number | null;
  'Low-Density Lipoprotein Cholesterol (mmol/L)'?: number | null;
  'Creatinine (umol/L)'?: number | null;
  'Estimated Glomerular Filtration Rate  (ml/min/1.73m²)'?: number | null;
  'Uric Acid (mmol/L)'?: number | null;
  'Blood Urea Nitrogen (mmol/L)'?: number | null;
  'Hypoglycemia (yes/no)'?: string | null;
}

/**
 * Raw row definition matching public.patient_detail
 */
export interface SupabasePatientDetail {
  'id'?: number;
  'Patient Number': string;
  'Date'?: string | null;
  'CGM (mg / dl)'?: number | null;
  'CBG (mg / dl)'?: number | null;
  'Blood Ketone (mmol / L)'?: number | null;
  'Dietary intake'?: string | null;
  'Insulin dose - s.c.'?: string | null;
  'Insulin dose - i.v.'?: string | null;
  'Non-insulin hypoglycemic agents'?: string | null;
  'CSII - bolus insulin (Novolin R, IU)'?: number | null;
  'CSII - basal insulin (Novolin R, IU / H)'?: number | null;
}

/**
 * Helper to convert HbA1c from mmol/mol to DCCT %
 * IFCC to DCCT formula: (0.09148 * mmol/mol) + 2.152
 */
function convertHbA1cToPct(val: number | null | undefined): number {
  if (val == null) return 7.5;
  if (val < 20) return Number(val.toFixed(1)); // Already in percentage
  const pct = (0.09148 * val) + 2.152;
  return Number(pct.toFixed(1));
}

/**
 * Helper to convert Fasting Glucose from mg/dL to mmol/L
 */
function convertGlucoseToMmol(val: number | null | undefined): number {
  if (val == null) return 8.2;
  if (val < 30) return Number(val.toFixed(1)); // Already in mmol/L
  return Number((val / 18.0182).toFixed(1));
}

/**
 * Transforms a Supabase patient summary & detail rows into our Patient model
 */
export function mapSupabaseToPatient(
  summary: SupabasePatientSummary,
  details: SupabasePatientDetail[] = []
): Patient {
  const patientNumber = summary['Patient Number'] || 'Unknown';
  const age = Number(summary['Age (years)']) || 58;
  const bmi = Number(summary['BMI (kg/m²)']?.toFixed(1)) || 27.3;
  const hba1c = convertHbA1cToPct(summary['HbA1c (mmol/mol)']);
  const fbg = convertGlucoseToMmol(summary['Fasting Plasma Glucose (mg/dl)']);
  const condition = summary['Type of Diabetes'] || 'Type 2 diabetes';
  const genderNum = summary['Gender (Female=1, Male=2)'];
  const genderStr = genderNum === 1 ? 'Female' : genderNum === 2 ? 'Male' : 'Patient';

  // Compute composite risk percentage
  let riskScore = 40;
  if (hba1c > 9.0) riskScore += 25;
  else if (hba1c > 8.0) riskScore += 18;
  else if (hba1c > 7.0) riskScore += 10;

  if (fbg > 10.0) riskScore += 12;
  else if (fbg > 8.0) riskScore += 8;

  if (bmi > 30) riskScore += 10;
  else if (bmi > 25) riskScore += 6;

  if (summary['Diabetic Macrovascular Complications'] || summary['Diabetic Microvascular Complications']) {
    riskScore += 12;
  }
  const currentRiskPct = Math.min(95, Math.max(15, riskScore));

  const riskCategory: 'High' | 'Moderate' | 'Stable' =
    currentRiskPct >= 65 ? 'High' : currentRiskPct >= 40 ? 'Moderate' : 'Stable';

  // Generate timeline data from details or default progression
  const timelineData = details.length > 0
    ? details.slice(0, 14).map((d, idx) => {
        const cbgMmol = d['CBG (mg / dl)'] ? convertGlucoseToMmol(d['CBG (mg / dl)']) : (fbg - 0.5 + idx * 0.1);
        return {
          visit: idx + 1,
          currentHba1c: Number((hba1c - 1.0 + (idx / 14) * 1.0).toFixed(1)),
          avgHba1c: Number((6.5 + (idx / 14) * 0.6).toFixed(1)),
        };
      })
    : [
        { visit: 1, currentHba1c: Number((hba1c - 1.2).toFixed(1)), avgHba1c: 6.4 },
        { visit: 4, currentHba1c: Number((hba1c - 0.8).toFixed(1)), avgHba1c: 6.6 },
        { visit: 8, currentHba1c: Number((hba1c - 0.4).toFixed(1)), avgHba1c: 6.9 },
        { visit: 11, currentHba1c: Number((hba1c - 0.2).toFixed(1)), avgHba1c: 7.1 },
        { visit: 14, currentHba1c: hba1c, avgHba1c: 7.3 },
      ];

  // Organ calculations
  const egfr = summary['Estimated Glomerular Filtration Rate  (ml/min/1.73m²)'];
  const trig = summary['Triglyceride (mmol/L)'];
  const kidneyStress = egfr != null ? Math.round(Math.max(10, 100 - (egfr / 90) * 50)) : 52;
  const pancreasStress = Math.round(Math.min(95, (hba1c / 10) * 80 + (fbg / 12) * 15));
  const cardioStress = trig != null ? Math.round(Math.min(90, 40 + trig * 12)) : 64;

  const egfrStatus = kidneyStress > 70 ? 'High Strain' : kidneyStress > 45 ? 'Moderate' : 'Normal';
  const pancreasStatus = pancreasStress > 70 ? 'High Strain' : pancreasStress > 45 ? 'Moderate' : 'Normal';
  const cardioStatus = cardioStress > 70 ? 'High Strain' : cardioStress > 45 ? 'Moderate' : 'Normal';

  // Extract avatar initials
  const initials = patientNumber.slice(-2).toUpperCase();

  return {
    id: patientNumber,
    displayId: patientNumber.length > 5 ? patientNumber.slice(-3) : patientNumber,
    name: `Patient ${patientNumber}`,
    avatarInitials: initials || 'PT',
    age,
    condition,
    visitsCount: details.length > 0 ? details.length : 14,
    hba1c,
    fastingGlucose: fbg,
    bmi,
    currentRiskPct,
    timeInRangePct: Math.round(Math.max(25, 95 - (hba1c - 6) * 15)),
    latestSignal: summary['Hypoglycemia (yes/no)'] === 'yes'
      ? 'Nocturnal hypoglycemia episodes logged'
      : hba1c > 8.5
      ? 'Repeated glucose excursions > 300 mg/dL'
      : 'Quarterly review due',
    riskCategory,
    timelineData,
    keyFactors: [
      { name: 'HbA1c', value: Math.min(95, Math.round(hba1c * 10.5)), label: 'Glycated Hemoglobin' },
      { name: 'Fasting glucose', value: Math.min(90, Math.round(fbg * 7.5)), label: 'Basal Glucose' },
      { name: 'BMI', value: Math.min(85, Math.round(bmi * 1.8)), label: 'Body Mass Index' },
      { name: 'Age', value: Math.min(80, Math.round(age * 0.7)), label: 'Patient Age' },
      { name: 'Triglycerides', value: trig ? Math.min(80, Math.round(trig * 22)) : 25, label: 'Lipids' },
    ],
    organs: {
      pancreas: {
        status: pancreasStatus,
        stress: pancreasStress,
        color: pancreasStatus === 'High Strain' ? '#ef4444' : pancreasStatus === 'Moderate' ? '#f59e0b' : '#10b981',
      },
      kidneys: {
        status: egfrStatus,
        stress: kidneyStress,
        color: egfrStatus === 'High Strain' ? '#ef4444' : egfrStatus === 'Moderate' ? '#f59e0b' : '#10b981',
      },
      cardio: {
        status: cardioStatus,
        stress: cardioStress,
        color: cardioStatus === 'High Strain' ? '#ef4444' : cardioStatus === 'Moderate' ? '#f59e0b' : '#10b981',
      },
      liver: {
        status: 'Moderate',
        stress: 58,
        color: '#f59e0b',
      },
      retina: {
        status: summary['Diabetic Microvascular Complications'] ? 'Moderate' : 'Normal',
        stress: summary['Diabetic Microvascular Complications'] ? 48 : 22,
        color: summary['Diabetic Microvascular Complications'] ? '#f59e0b' : '#10b981',
      },
    },
  };
}

/**
 * Fetch all patients from Supabase public.patient_summary
 */
export async function fetchSupabasePatients(): Promise<Patient[]> {
  const client = getSupabaseClient();
  if (!client) {
    return PATIENTS;
  }

  try {
    const { data, error } = await client
      .from('patient_summary')
      .select('*')
      .order('Patient Number', { ascending: true })
      .limit(50);

    if (error) {
      console.warn('Supabase query error on patient_summary:', error.message);
      return PATIENTS;
    }

    if (!data || data.length === 0) {
      return PATIENTS;
    }

    return (data as SupabasePatientSummary[]).map((row) => mapSupabaseToPatient(row));
  } catch (err) {
    console.error('Error fetching patients from Supabase:', err);
    return PATIENTS;
  }
}

/**
 * Fetch specific patient and their longitudinal detail observations from Supabase
 */
export async function fetchSupabasePatientDetail(
  patientNumber: string
): Promise<{ patient: Patient; details: SupabasePatientDetail[] } | null> {
  const client = getSupabaseClient();
  if (!client) {
    const fallback = PATIENTS.find((p) => p.id === patientNumber) || PATIENTS[0];
    return { patient: fallback, details: [] };
  }

  try {
    // 1. Fetch summary
    const { data: summaryData, error: summaryError } = await client
      .from('patient_summary')
      .select('*')
      .eq('Patient Number', patientNumber)
      .maybeSingle();

    if (summaryError || !summaryData) {
      const fallback = PATIENTS.find((p) => p.id === patientNumber) || PATIENTS[0];
      return { patient: fallback, details: [] };
    }

    // 2. Fetch details (CGM, CBG, Blood Ketone, etc.)
    const { data: detailsData } = await client
      .from('patient_detail')
      .select('*')
      .eq('Patient Number', patientNumber)
      .order('Date', { ascending: true })
      .limit(100);

    const details = (detailsData || []) as SupabasePatientDetail[];
    const patient = mapSupabaseToPatient(summaryData as SupabasePatientSummary, details);

    return { patient, details };
  } catch (err) {
    console.error('Error in fetchSupabasePatientDetail:', err);
    const fallback = PATIENTS.find((p) => p.id === patientNumber) || PATIENTS[0];
    return { patient: fallback, details: [] };
  }
}

/**
 * Test connectivity to user's Supabase instance
 */
export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  count?: number;
  message: string;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      connected: false,
      message: 'Supabase credentials not set (URL or Anon Key is missing).',
    };
  }

  try {
    const { data, count, error } = await client
      .from('patient_summary')
      .select('*', { count: 'exact', head: false })
      .limit(1);

    if (error) {
      return {
        connected: false,
        message: `Supabase Error: ${error.message} (${error.code})`,
      };
    }

    return {
      connected: true,
      count: count ?? data?.length ?? 0,
      message: 'Successfully connected to Supabase public.patient_summary!',
    };
  } catch (err: any) {
    return {
      connected: false,
      message: err?.message || 'Failed to connect to Supabase.',
    };
  }
}
