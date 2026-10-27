import type { CGMReading, Patient } from "../types";

export type ReviewFilter = "all" | "review" | "low" | "hba1c" | "missing";

export function validReadings(readings: CGMReading[] = []) {
  return readings.filter(r => Number.isFinite(r.timestamp) && Number.isFinite(r.cgm) && r.cgm > 0)
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function glucoseOverview(readings: CGMReading[] = []) {
  const rows = validReadings(readings);
  const latest = rows[rows.length - 1];
  const count = rows.length;
  const percentage = (predicate: (value: number) => boolean) => count
    ? 100 * rows.filter(row => predicate(row.cgm)).length / count : NaN;
  return {
    rows, latest,
    recent: latest ? rows.filter(row => row.timestamp >= latest.timestamp - 24 * 60 * 60 * 1000) : [],
    mean: count ? rows.reduce((sum, row) => sum + row.cgm, 0) / count : NaN,
    low: percentage(value => value < 70),
    inRange: percentage(value => value >= 70 && value <= 180),
    high: percentage(value => value > 180),
  };
}

export function reviewSignals(patient: Patient) {
  const low = (patient.cgmReadings ?? []).some(row => Number.isFinite(row.timestamp) && Number.isFinite(row.cgm) && row.cgm > 0 && row.cgm < 70);
  const hba1c = Number.isFinite(patient.hba1c) && patient.hba1c >= 8.5;
  const missing = !Number.isFinite(patient.hba1c);
  return { low, hba1c, missing, review: low || hba1c, score: (low ? 100 : 0) + (hba1c ? 10 : 0) + (missing ? 1 : 0) };
}

export function filterReviewPatients(patients: Patient[], filter: ReviewFilter, query = "") {
  const search = query.trim().toLowerCase();
  return patients.filter(patient => {
    const signals = reviewSignals(patient);
    return (filter === "all" || signals[filter]) && `${patient.name} ${patient.id} ${patient.condition}`.toLowerCase().includes(search);
  }).sort((a, b) => reviewSignals(b).score - reviewSignals(a).score ||
    (Number.isFinite(b.hba1c) ? b.hba1c : -1) - (Number.isFinite(a.hba1c) ? a.hba1c : -1) || a.id.localeCompare(b.id));
}

export function dashboardDate(timestamp?: number, includeTime = false) {
  if (timestamp === undefined || !Number.isFinite(timestamp)) return "No dated readings";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit", hour12: false } as const : {}),
  }).format(timestamp);
}
