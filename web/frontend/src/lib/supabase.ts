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
/**
 * Transforms a Supabase patient summary & detail rows into our Patient model
 */
export function mapSupabaseToPatient(
  summary: SupabasePatientSummary,
  details: SupabasePatientDetail[] = []
): Patient {
  const patientNumber = summary['Patient Number'] || 'Unknown';
  const age = Number(summary['Age (years)']) || 58;
  const bmi = Number(summary['BMI (kg/m\u00b2)']);
  const hba1c = convertHbA1cToPct(summary['HbA1c (mmol/mol)']);
  const fbg = convertGlucoseToMmol(summary['Fasting Plasma Glucose (mg/dl)']);
  const condition = summary['Type of Diabetes'] || '';
  const genderNum = summary['Gender (Female=1, Male=2)'];
  const genderStr = genderNum === 1 ? 'Female' : genderNum === 2 ? 'Male' : 'Patient';

  // 1. Process continuous CGM telemetry if present in patient_detail
  const cgmReadings: import('../types').CGMReading[] = [];
  const cgmValues: number[] = [];
  const dayBuckets: Record<string, { cgms: number[]; cbgCount: number; dateStr: string }> = {};

  for (const d of details) {
    const val = d['CGM (mg / dl)'];
    if (val != null && !isNaN(val)) {
      const dateStr = d.Date || '';
      const ts = dateStr ? new Date(dateStr).getTime() : 0;
      cgmValues.push(val);
      cgmReadings.push({
        date: dateStr,
        timestamp: ts,
        cgm: Number(val.toFixed(1)),
        cbg: d['CBG (mg / dl)'],
        diet: d['Dietary intake'],
        insulin: d['Insulin dose - s.c.'] || d['Insulin dose - i.v.'] || d['Non-insulin hypoglycemic agents'],
      });

      const dayKey = dateStr.slice(0, 10);
      if (dayKey) {
        if (!dayBuckets[dayKey]) {
          dayBuckets[dayKey] = { cgms: [], cbgCount: 0, dateStr: dayKey };
        }
        dayBuckets[dayKey].cgms.push(val);
        if (d['CBG (mg / dl)'] != null) dayBuckets[dayKey].cbgCount++;
      }
    }
  }

  cgmReadings.sort((a, b) => a.timestamp - b.timestamp);
  const hasContinuousCGM = cgmReadings.length > 0;

  // Calculate Ambulatory Glucose Profile (AGP) metrics if CGM exists
  let cgmSummary: import('../types').CGMSummary | undefined = undefined;
  let tirPct = Math.round(Math.max(25, 95 - (hba1c - 6) * 15));

  if (hasContinuousCGM && cgmValues.length > 0) {
    const totalCount = cgmValues.length;
    const meanVal = cgmValues.reduce((a, b) => a + b, 0) / totalCount;
    const inRange = cgmValues.filter((v) => v >= 70 && v <= 180).length;
    const aboveRange = cgmValues.filter((v) => v > 180).length;
    const belowRange = cgmValues.filter((v) => v < 70).length;

    // Standard deviation and CV%
    const variance = cgmValues.reduce((sum, v) => sum + Math.pow(v - meanVal, 2), 0) / totalCount;
    const sd = Math.sqrt(variance);
    const cvPct = Number(((sd / meanVal) * 100).toFixed(1));

    tirPct = Math.round((inRange / totalCount) * 100);

    // Group daily profiles
    const sortedDayKeys = Object.keys(dayBuckets).sort();
    const dailyProfiles = sortedDayKeys.map((dayKey, idx) => {
      const vals = dayBuckets[dayKey].cgms;
      const dMean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const dMin = Math.min(...vals);
      const dMax = Math.max(...vals);
      const dTir = Math.round((vals.filter((v) => v >= 70 && v <= 180).length / vals.length) * 100);
      const dFormatted = dayKey.slice(5).replace('-', '/'); // "12/30"
      return {
        dayLabel: `Day ${idx + 1} (${dFormatted})`,
        dayNumber: idx + 1,
        mean: Number(dMean.toFixed(1)),
        tir: dTir,
        min: Number(dMin.toFixed(1)),
        max: Number(dMax.toFixed(1)),
        readingsCount: vals.length,
      };
    });

    cgmSummary = {
      totalReadings: totalCount,
      startDate: cgmReadings[0]?.date || '',
      endDate: cgmReadings[cgmReadings.length - 1]?.date || '',
      meanGlucose: Number(meanVal.toFixed(1)),
      timeInRangePct: tirPct,
      timeAboveRangePct: Math.round((aboveRange / totalCount) * 100),
      timeBelowRangePct: Math.round((belowRange / totalCount) * 100),
      cvPct,
      dailyProfiles,
    };
  }

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

  // Generate timeline: if CGM daily profiles exist, use actual day-by-day continuous means
  const timelineData = cgmSummary && cgmSummary.dailyProfiles.length > 0
    ? cgmSummary.dailyProfiles.map((dp) => ({
        visit: dp.dayNumber,
        currentHba1c: Number((dp.mean / 18.0182).toFixed(1)),
        avgHba1c: Number((6.5 + (dp.dayNumber / cgmSummary!.dailyProfiles.length) * 0.8).toFixed(1)),
      }))
    : [
        { visit: 1, currentHba1c: hba1c, avgHba1c: 7.0 },
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

  const initials = patientNumber.slice(-2).toUpperCase();

  return {
    id: patientNumber,
    displayId: patientNumber.length > 5 ? patientNumber.slice(-3) : patientNumber,
    name: `Patient ${patientNumber}`,
    avatarInitials: initials || 'PT',
    age,
    condition,
    visitsCount: cgmSummary ? cgmSummary.dailyProfiles.length : 1,
    hba1c,
    fastingGlucose: fbg,
    bmi,
    currentRiskPct,
    timeInRangePct: tirPct,
    hasContinuousCGM,
    cgmReadings,
    cgmSummary,
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

let cachedRawSummaries: SupabasePatientSummary[] = [];
let cachedRawDetails: SupabasePatientDetail[] = [];

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
      .limit(250);

    if (error) {
      console.warn('Supabase query error on patient_summary:', error.message);
      return PATIENTS;
    }

    if (!data || data.length === 0) {
      return PATIENTS;
    }

    cachedRawSummaries = data as SupabasePatientSummary[];
    const { data: detailData, error: detailError } = await client.from('patient_detail').select('*').limit(100000);
    if (detailError) console.warn('Supabase query error on patient_detail:', detailError.message);
    cachedRawDetails = (detailData || []) as SupabasePatientDetail[];
    return cachedRawSummaries.map((row) => {
      const patientNumber = row['Patient Number'];

      const patientDetails = cachedRawDetails.filter(
        (detail) => detail['Patient Number'] === patientNumber
      );

      return mapSupabaseToPatient(row, patientDetails);
    });
  } catch (err) {
    console.error('Error fetching patients from Supabase:', err);
    return PATIENTS;
  }
}

export function getCachedRawDetails(): SupabasePatientDetail[] {
  return cachedRawDetails;
}

export function clearSupabasePatientCache(): void {
  cachedRawSummaries = [];
  cachedRawDetails = [];
}

export function getCachedRawSummaries(): SupabasePatientSummary[] {
  return cachedRawSummaries;
}

/**
 * Computes live cohort-wide metrics directly from Supabase patient_summary rows
 */
export function computeCohortStats(
  _patients: Patient[],
  summaries: SupabasePatientSummary[] = cachedRawSummaries,
  details: SupabasePatientDetail[] = cachedRawDetails
) {
  const total = summaries.length;
  const values = (key: keyof SupabasePatientSummary) => summaries.map((row) => row[key]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const average = (items: number[]) => items.length ? Number((items.reduce((a, b) => a + b, 0) / items.length).toFixed(1)) : null;
  const ages = values('Age (years)');
  const bmis = summaries.map((s) => s['BMI (kg/m\u00b2)']).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const fbg = values('Fasting Plasma Glucose (mg/dl)');
  const hba1cs = values('HbA1c (mmol/mol)');
  const cgm = details.map((d) => d['CGM (mg / dl)']).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const meanCgm = average(cgm);
  const genderTotal = summaries.filter((s) => s['Gender (Female=1, Male=2)'] === 1 || s['Gender (Female=1, Male=2)'] === 2).length;
  const female = summaries.filter((s) => s['Gender (Female=1, Male=2)'] === 1).length;
  const male = summaries.filter((s) => s['Gender (Female=1, Male=2)'] === 2).length;
  const ageBins = { '18 - 30': 0, '31 - 40': 0, '41 - 50': 0, '51 - 60': 0, '61 - 70': 0, '71+': 0 };
  ages.forEach((a) => { if (a <= 30) ageBins['18 - 30']++; else if (a <= 40) ageBins['31 - 40']++; else if (a <= 50) ageBins['41 - 50']++; else if (a <= 60) ageBins['51 - 60']++; else if (a <= 70) ageBins['61 - 70']++; else ageBins['71+']++; });
  const bmiBins = { Underweight: 0, Normal: 0, Overweight: 0, Obese: 0 };
  bmis.forEach((b) => { if (b < 18.5) bmiBins.Underweight++; else if (b <= 24.9) bmiBins.Normal++; else if (b <= 29.9) bmiBins.Overweight++; else bmiBins.Obese++; });
  const pct = (n: number, d: number) => d ? Number(((n / d) * 100).toFixed(1)) : 0;
  const alerts = summaries.filter((s) => s['Hypoglycemia (yes/no)']?.toLowerCase() === 'yes').map((s, i) => ({ id: `ALT-${i + 1}`, patient: `Patient ${s['Patient Number']}`, code: s['Patient Number'], severity: 'Critical' as const, issue: 'Hypoglycemia documented in patient_summary', time: 'Admission record' }));
  const glycemic = hba1cs.reduce((acc, h) => { const pctValue = 0.09148 * h + 2.152; if (pctValue < 7) acc.atTarget++; else if (pctValue <= 8.5) acc.aboveTarget++; else acc.highRisk++; return acc; }, { atTarget: 0, aboveTarget: 0, highRisk: 0 });
  const sortedHba1c = [...hba1cs].sort((a, b) => a - b);
  const medianMmol = sortedHba1c.length ? sortedHba1c[Math.floor(sortedHba1c.length / 2)] : null;
  return {
    activePatients: total,
    activePatientsGrowth: `${total} rows in patient_summary`,
    timeInRange: meanCgm,
    timeInRangeGrowth: cgm.length ? `${cgm.length} CGM rows averaged` : 'No CGM rows in patient_detail',
    meanGlucose: meanCgm,
    meanGlucoseDelta: cgm.length ? 'Average CGM (mg/dL)' : 'No CGM data',
    alertsCount: alerts.length,
    reviewCapacityPct: total ? Math.round(((total - alerts.length) / total) * 100) : 0,
    reviewsCompleted: total - alerts.length,
    totalReviewsNeeded: total,
    avgAge: average(ages),
    avgBmi: average(bmis),
    avgHbA1c: medianMmol == null ? null : Number((0.09148 * medianMmol + 2.152).toFixed(1)),
    avgHbA1cMmol: average(hba1cs),
    genderDistribution: [{ name: 'Female', value: pct(female, genderTotal), color: '#84cc16' }, { name: 'Male', value: pct(male, genderTotal), color: '#3b82f6' }],
    ageDistribution: Object.entries(ageBins).map(([range, count]) => ({ range, pct: pct(count, ages.length) })),
    bmiDistribution: Object.entries(bmiBins).map(([category, count]) => ({ category, pct: pct(count, bmis.length) })),
    glycemicControl: { ...glycemic, medianHbA1c: medianMmol == null ? null : Number((0.09148 * medianMmol + 2.152).toFixed(1)) },
    clinicalAlerts: alerts,
  };
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

    // 2. Fetch all detail observations (up to 2000 continuous readings)
    const { data: detailsData } = await client
      .from('patient_detail')
      .select('*')
      .eq('Patient Number', patientNumber)
      .order('Date', { ascending: true })
      .limit(2000);

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

    const totalCount = count ?? data?.length ?? 0;
    if (totalCount === 0) {
      return {
        connected: true,
        count: 0,
        message:
          'Connected to Supabase, but Row Level Security (RLS) is hiding rows from the public key. To allow the frontend to read the data, disable RLS or add a SELECT policy in your Supabase SQL Editor.',
      };
    }

    return {
      connected: true,
      count: totalCount,
      message: `Successfully connected! Found ${totalCount} records in public.patient_summary.`,
    };
  } catch (err: any) {
    return {
      connected: false,
      message: err?.message || 'Failed to connect to Supabase.',
    };
  }
}





