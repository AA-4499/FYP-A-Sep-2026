import type { SupabaseClient } from "@supabase/supabase-js";

/** PostgREST caps each response. Never mistake the first page for the whole cohort. */
export async function readClinicalRows(
  client: SupabaseClient,
  table: "patient_summary" | "patient_detail",
  patientId?: string,
  patientIds?: ReadonlySet<string>,
): Promise<Record<string, unknown>[]> {
  if (patientIds?.size === 0) return [];
  const rows: Record<string, unknown>[] = [];
  let expected: number | null = null;
  for (;;) {
    let query = client.from(table).select("*", { count: "exact" });
    if (patientId !== undefined) query = query.eq("Patient Number", patientId);
    if (patientIds !== undefined) query = query.in("Patient Number", [...patientIds]);
    const { data, error, count } = await query
      .order(table === "patient_detail" ? "id" : "Patient Number", {
        ascending: true,
      })
      .range(rows.length, rows.length + 999);
    if (error) throw new Error(`Unable to read ${table}: ${error.message}`);
    if (!Array.isArray(data))
      throw new Error(`Invalid response from ${table}.`);
    if (expected === null && count !== null) expected = count;
    if (!data.length) {
      if (expected !== null && rows.length < expected)
        throw new Error(
          `Incomplete ${table} response. Refresh to reload the cohort.`,
        );
      return rows;
    }
    if (
      patientId !== undefined &&
      data.some((row) => String(row["Patient Number"]) !== patientId)
    )
      throw new Error("The response contains a different patient record.");
    if (patientIds !== undefined && data.some(row => !patientIds.has(String(row['Patient Number']))))
      throw new Error('The clinical response contains a patient outside the Admin assignment list.');
    rows.push(...data);
    if (expected !== null ? rows.length >= expected : data.length < 1000)
      return rows;
  }
}
