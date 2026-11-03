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
  if (!client) throw new Error("Connect your Supabase project to load assignments.");
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error(error.message);
  if (!data.session) throw new Error("Sign in again to verify patient assignments.");

  const base = getApiBase();
  if (!base) throw new Error("The doctor assignment service is not configured.");
  const response = await fetch(`${base}/api/doctor/assigned-patients`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as {
    patient_ids?: unknown;
    error?: unknown;
  };
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : "Assigned patient access could not be verified.",
    );
  }
  if (!Array.isArray(payload.patient_ids)) {
    throw new Error("The assignment service returned an invalid patient list.");
  }
  return Array.from(
    new Set(
      payload.patient_ids
        .map((id) => String(id).trim())
        .filter(Boolean),
    ),
  );
}
