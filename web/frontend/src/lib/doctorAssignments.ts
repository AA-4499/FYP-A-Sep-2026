import { getSupabaseClient } from "./supabase";
import { getForecastApiUrl } from "./forecast";

/**
 * Read the authenticated Doctor's assignment list from the backend endpoint.
 * This avoids requiring the newer get_my_access_state migration from TrainingModel.
 */
export async function fetchDoctorAssignedPatientIds(): Promise<string[]> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase authentication is not configured.");
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error(error.message);
  if (!data.session) throw new Error("Sign in again to verify your Doctor identity.");

  const apiBase = getForecastApiUrl();
  if (!apiBase) throw new Error("The backend API is not configured.");

  const response = await fetch(apiBase + "/api/doctor/assigned-patients", {
    headers: {
      Authorization: "Bearer " + data.session.access_token,
      Accept: "application/json",
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Unable to verify Doctor patient assignments.");
  }
  if (!Array.isArray(payload.patient_ids)) {
    throw new Error("The backend returned an invalid Doctor assignment list.");
  }
  const ids = payload.patient_ids
    .map((value: unknown) => String(value).trim())
    .filter(Boolean);
  return [...new Set(ids)];
}
