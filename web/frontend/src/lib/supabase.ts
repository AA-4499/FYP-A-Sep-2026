/**
 * Supabase Client & Data Synchronization Layer
 * Connects directly to the user's Supabase schema:
 * - public.patient_summary
 * - public.patient_detail
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Patient, KnowledgeGraphNode, KnowledgeGraphEdge } from "../types";
import { mapClinicalRecord } from "./clinicalData";
import { readClinicalRows } from "./supabaseRows";

// Storage keys for user-configured credentials
const STORAGE_URL_KEY = "dt_supabase_url";
const STORAGE_KEY_KEY = "dt_supabase_anon_key";

export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const envUrl =
    (import.meta.env.VITE_SUPABASE_URL as string) ||
    (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string) ||
    "https://dgtaujhgwxmoghqdqkti.supabase.co";
  const envKey =
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
    (import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string) ||
    (import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string) ||
    "sb_publishable_z9E8XFx9DIyTKA-T-XI7gw_g0_l-Zkw";

  const storedUrl =
    typeof window !== "undefined"
      ? localStorage.getItem(STORAGE_URL_KEY) || ""
      : "";
  const storedKey =
    typeof window !== "undefined"
      ? localStorage.getItem(STORAGE_KEY_KEY) || ""
      : "";

  return {
    url: storedUrl || envUrl,
    anonKey: storedKey || envKey,
  };
}

export function saveSupabaseCredentials(url: string, anonKey: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_URL_KEY, url.trim());
    localStorage.setItem(STORAGE_KEY_KEY, anonKey.trim());
  }
}

let cachedClient: SupabaseClient | null = null;
let lastClientKey = "";

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
    cachedClient = createClient(url, anonKey, {
      auth: { persistSession: false },
    });
    lastClientKey = clientKey;
    return cachedClient;
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err);
    return null;
  }
}

/**
 * Raw row definition matching public.patient_summary
 */
export interface SupabasePatientSummary {
  "Patient Number": string;
  "Gender (Female=1, Male=2)"?: number | null;
  "Age (years)"?: number | null;
  "Height (m)"?: number | null;
  "Weight (kg)"?: number | null;
  "BMI (kg/m²)"?: number | null;
  "Smoking History (pack year)"?: number | null;
  "Alcohol Drinking History (drinker/non-drinker)"?: string | null;
  "Type of Diabetes"?: string | null;
  "Duration of diabetes (years)"?: number | null;
  "Acute Diabetic Complications"?: string | null;
  "Diabetic Macrovascular Complications"?: string | null;
  "Diabetic Microvascular Complications"?: string | null;
  Comorbidities?: string | null;
  "Hypoglycemic Agents"?: string | null;
  "Other Agents"?: string | null;
  "Fasting Plasma Glucose (mg/dl)"?: number | null;
  "2-hour Postprandial Plasma Glucose (mg/dl)"?: number | null;
  "Fasting C-peptide (nmol/L)"?: number | null;
  "2-hour Postprandial C-peptide (nmol/L)"?: number | null;
  "Fasting Insulin (pmol/L)"?: number | null;
  "2-hour Postprandial insulin (pmol/L)"?: number | null;
  "HbA1c (mmol/mol)"?: number | null;
  "Glycated Albumin (%)"?: number | null;
  "Total Cholesterol (mmol/L)"?: number | null;
  "Triglyceride (mmol/L)"?: number | null;
  "High-Density Lipoprotein Cholesterol (mmol/L)"?: number | null;
  "Low-Density Lipoprotein Cholesterol (mmol/L)"?: number | null;
  "Creatinine (umol/L)"?: number | null;
  "Estimated Glomerular Filtration Rate  (ml/min/1.73m²)"?: number | null;
  "Uric Acid (mmol/L)"?: number | null;
  "Blood Urea Nitrogen (mmol/L)"?: number | null;
  "Hypoglycemia (yes/no)"?: string | null;
}

/**
 * Raw row definition matching public.patient_detail
 */
export interface SupabasePatientDetail {
  id?: number;
  "Patient Number": string;
  Date?: string | null;
  "CGM (mg / dl)"?: number | null;
  "CBG (mg / dl)"?: number | null;
  "Blood Ketone (mmol / L)"?: number | null;
  "Dietary intake"?: string | null;
  "Insulin dose - s.c."?: string | null;
  "Insulin dose - i.v."?: string | null;
  "Non-insulin hypoglycemic agents"?: string | null;
  "CSII - bolus insulin (Novolin R, IU)"?: number | null;
  "CSII - basal insulin (Novolin R, IU / H)"?: number | null;
}

export function mapSupabaseToPatient(
  summary: SupabasePatientSummary,
  details: SupabasePatientDetail[] = [],
): Patient {
  return mapClinicalRecord(
    summary as unknown as Record<string, unknown>,
    details as unknown as Record<string, unknown>[],
  );
}

let cachedRawSummaries: SupabasePatientSummary[] = [];
let cachedRawDetails: SupabasePatientDetail[] = [];

/**
 * Fetch all patients from Supabase public.patient_summary
 */
export async function fetchSupabasePatients(): Promise<Patient[]> {
  const client = getSupabaseClient();
  if (!client)
    throw new Error("Connect your Supabase project to load patient records.");
  const [summaries, details] = await Promise.all([
    readClinicalRows(client, "patient_summary"),
    readClinicalRows(client, "patient_detail"),
  ]);
  cachedRawSummaries = summaries as unknown as SupabasePatientSummary[];
  cachedRawDetails = details as unknown as SupabasePatientDetail[];
  const grouped = new Map<string, SupabasePatientDetail[]>();
  cachedRawDetails.forEach((row) => {
    const id = String(row["Patient Number"]);
    grouped.set(id, [...(grouped.get(id) ?? []), row]);
  });
  return cachedRawSummaries.map((row) =>
    mapSupabaseToPatient(row, grouped.get(String(row["Patient Number"])) ?? []),
  );
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
 * Fetch specific patient and their longitudinal detail observations from Supabase
 */
export async function fetchSupabasePatientDetail(
  patientNumber: string,
): Promise<{ patient: Patient; details: SupabasePatientDetail[] } | null> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase is not configured.");
  const { data, error } = await client
    .from("patient_summary")
    .select("*")
    .eq("Patient Number", patientNumber)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  if (String(data["Patient Number"]) !== patientNumber)
    throw new Error("The patient record does not match the selection.");
  const details = (await readClinicalRows(
    client,
    "patient_detail",
    patientNumber,
  )) as unknown as SupabasePatientDetail[];
  return {
    patient: mapSupabaseToPatient(data as SupabasePatientSummary, details),
    details,
  };
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
      message: "Supabase credentials not set (URL or Anon Key is missing).",
    };
  }

  try {
    const { data, count, error } = await client
      .from("patient_summary")
      .select("*", { count: "exact", head: false })
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
          "Connected to Supabase, but no records are visible to this account. Sign in with an authorized account, or ask your administrator to verify record assignments and SELECT policies.",
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
      message: err?.message || "Failed to connect to Supabase.",
    };
  }
}
