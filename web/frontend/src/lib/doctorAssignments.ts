import { getSupabaseClient } from "./supabase";

function getApiBase(): string {
  const saved =
    typeof window !== "undefined"
      ? localStorage.getItem("dt_forecast_api_url")
      : null;
  return (
    saved ||
    (import.meta.env.VITE_API_BASE_URL as string) ||
    (import.meta.env.DEV ? "http://localhost:5000" : "")
  )
    .trim()
    .replace(/\/+$/, "");
}

export async function fetchDoctorAssignedPatientIds(): Promise<string[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  let sessionToken = "";
  let doctorId = "";
  try {
    const { data } = await client.auth.getSession();
    if (data.session) {
      sessionToken = data.session.access_token;
      doctorId = data.session.user.id;
    }
  } catch (err) {
    console.warn("Could not retrieve Supabase session:", err);
  }

  // 1. Direct query to clinician_patient_assignments via Supabase client
  if (doctorId) {
    try {
      const { data: assignments, error: queryErr } = await client
        .from("clinician_patient_assignments")
        .select("patient_id")
        .eq("clinician_id", doctorId);

      if (!queryErr && Array.isArray(assignments) && assignments.length > 0) {
        const ids = assignments
          .map((row: Record<string, unknown>) => String(row.patient_id ?? "").trim())
          .filter(Boolean);
        if (ids.length > 0) {
          return Array.from(new Set(ids));
        }
      }
    } catch (directErr) {
      console.warn("Direct clinician_patient_assignments query skipped:", directErr);
    }
  }

  // 2. Fallback to python backend API endpoint if configured
  const base = getApiBase();
  if (!base || !sessionToken) return [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(`${base}/api/doctor/assigned-patients`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return [];
    const payload = (await response.json().catch(() => ({}))) as {
      patient_ids?: unknown;
    };
    if (Array.isArray(payload.patient_ids)) {
      return Array.from(
        new Set(
          payload.patient_ids
            .map((id) => String(id).trim())
            .filter(Boolean),
        ),
      );
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn("API doctor assignments unreachable or timed out:", err);
  }

  return [];
}
