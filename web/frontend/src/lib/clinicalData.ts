import type { Patient, CGMReading, CGMSummary } from "../types";

export function clinicalNumber(value: unknown): number {
  if (
    value == null ||
    typeof value === "boolean" ||
    (typeof value !== "number" && typeof value !== "string") ||
    String(value).trim() === ""
  )
    return NaN;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}
export const clinicalValue = (value: unknown, unit = "") => {
  const number = clinicalNumber(value);
  return Number.isFinite(number)
    ? `${Number(number.toFixed(1)).toLocaleString()}${unit ? ` ${unit}` : ""}`
    : "Not recorded";
};

/** Explicit database units; absence is never replaced by a synthetic measurement. */
export function mapClinicalRecord(
  summary: Record<string, unknown>,
  details: Record<string, unknown>[] = [],
): Patient {
  const id = String(summary["Patient Number"] ?? "");
  const rawHba1c = clinicalNumber(summary["HbA1c (mmol/mol)"]);
  const fasting = clinicalNumber(summary["Fasting Plasma Glucose (mg/dl)"]);
  const readings: CGMReading[] = details
    .filter((row) => String(row["Patient Number"]) === id)
    .flatMap((row) => {
      const cgm = clinicalNumber(row["CGM (mg / dl)"]);
      const date = typeof row.Date === "string" ? row.Date : "";
      const timestamp = Date.parse(date);
      return Number.isFinite(cgm) && cgm > 0 && Number.isFinite(timestamp)
        ? [
            {
              cgm,
              date,
              timestamp,
              cbg: Number.isFinite(clinicalNumber(row["CBG (mg / dl)"]))
                ? clinicalNumber(row["CBG (mg / dl)"])
                : null,
              diet:
                row["Dietary intake"] == null
                  ? null
                  : String(row["Dietary intake"]),
              insulin:
                [
                  ["s.c.", row["Insulin dose - s.c."]],
                  ["i.v.", row["Insulin dose - i.v."]],
                  [
                    "pump bolus (IU)",
                    row["CSII - bolus insulin (Novolin R, IU)"],
                  ],
                  [
                    "pump basal (IU/h)",
                    row["CSII - basal insulin (Novolin R, IU / H)"],
                  ],
                ]
                  .filter(
                    ([, value]) => value != null && String(value).trim() !== "",
                  )
                  .map(([route, value]) => `${route}: ${value}`)
                  .join(" · ") || null,
            },
          ]
        : [];
    })
    .sort((a, b) => a.timestamp - b.timestamp);
  // One sensor observation per timestamp. Last database row wins on duplicates.
  const cgmReadings = [
    ...new Map(readings.map((row) => [row.timestamp, row])).values(),
  ];
  const values = cgmReadings.map((row) => row.cgm);
  const mean = values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : NaN;
  const pct = (items: number[], predicate: (value: number) => boolean) =>
    items.length ? (100 * items.filter(predicate).length) / items.length : NaN;
  const timeInRangePct = pct(values, (value) => value >= 70 && value <= 180);
  const days = new Map<string, number[]>();
  cgmReadings.forEach((row) => {
    const day = row.date.slice(0, 10);
    days.set(day, [...(days.get(day) ?? []), row.cgm]);
  });
  const cgmSummary: CGMSummary | undefined = values.length
    ? {
        totalReadings: values.length,
        startDate: cgmReadings[0].date,
        endDate: cgmReadings[cgmReadings.length - 1].date,
        meanGlucose: mean,
        timeInRangePct,
        timeAboveRangePct: pct(values, (value) => value > 180),
        timeBelowRangePct: pct(values, (value) => value < 70),
        cvPct:
          mean > 0
            ? (Math.sqrt(
                values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
                  values.length,
              ) /
                mean) *
              100
            : NaN,
        dailyProfiles: [...days].map(([day, rows], index) => ({
          dayLabel: day,
          dayNumber: index + 1,
          mean: rows.reduce((a, b) => a + b, 0) / rows.length,
          tir: pct(rows, (value) => value >= 70 && value <= 180),
          min: Math.min(...rows),
          max: Math.max(...rows),
          readingsCount: rows.length,
        })),
      }
    : undefined;
  const notAssessed = () => ({
    status: "Not assessed" as const,
    stress: NaN,
    color: "#94a3b8",
  });
  return {
    id,
    displayId: id,
    name: `Patient ${id}`,
    avatarInitials: "PT",
    dataSource: "supabase",
    recordedFields: { ...summary },
    age: clinicalNumber(summary["Age (years)"]),
    bmi: clinicalNumber(summary["BMI (kg/m\u00b2)"]),
    condition:
      typeof summary["Type of Diabetes"] === "string"
        ? summary["Type of Diabetes"]
        : "",
    hba1c: Number.isFinite(rawHba1c)
      ? Number((rawHba1c * 0.09148 + 2.152).toFixed(1))
      : NaN,
    fastingGlucose: Number.isFinite(fasting)
      ? Number((fasting / 18.0182).toFixed(1))
      : NaN,
    currentRiskPct: NaN,
    riskCategory: "Unknown",
    timeInRangePct,
    visitsCount: days.size,
    hasContinuousCGM: values.length > 0,
    cgmReadings,
    cgmSummary,
    timelineData: [],
    keyFactors: [],
    latestSignal: values.length
      ? `Last recorded CGM: ${Number(values[values.length - 1].toFixed(1))} mg/dL`
      : "No dated CGM observations",
    organs: {
      pancreas: notAssessed(),
      kidneys: notAssessed(),
      cardio: notAssessed(),
      liver: notAssessed(),
      retina: notAssessed(),
    },
  };
}
