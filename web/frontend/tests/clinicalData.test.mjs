import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

async function moduleFor(name) {
  const source = readFileSync(
    new URL(`../src/lib/${name}.ts`, import.meta.url),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
    },
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
  );
}
const { mapClinicalRecord } = await moduleFor("clinicalData");
const { readClinicalRows } = await moduleFor("supabaseRows");
const { simulatePhysiology } = await moduleFor("physiology");

test("missing clinical values do not become diagnoses, organ scores, timelines or synthetic risks", () => {
  const patient = mapClinicalRecord({ "Patient Number": "record-a" });
  for (const field of [
    "age",
    "bmi",
    "hba1c",
    "fastingGlucose",
    "currentRiskPct",
    "timeInRangePct",
  ])
    assert.ok(Number.isNaN(patient[field]), field);
  assert.equal(patient.riskCategory, "Unknown");
  assert.deepEqual(patient.keyFactors, []);
  assert.deepEqual(patient.timelineData, []);
  for (const organ of Object.values(patient.organs)) {
    assert.equal(organ.status, "Not assessed");
    assert.ok(Number.isNaN(organ.stress));
  }
});

test("database columns use explicit units even when values are small; real zeros remain zero", () => {
  const p = mapClinicalRecord({
    "Patient Number": "a",
    "Age (years)": 0,
    "BMI (kg/m²)": 0,
    "HbA1c (mmol/mol)": 10,
    "Fasting Plasma Glucose (mg/dl)": 18,
  });
  assert.equal(p.age, 0);
  assert.equal(p.bmi, 0);
  assert.equal(p.hba1c, 3.1);
  assert.equal(p.fastingGlucose, 1);
});

test("CGM is scoped to one record, validates timestamps, deduplicates samples and preserves insulin routes", () => {
  const p = mapClinicalRecord({ "Patient Number": "a" }, [
    { "Patient Number": "a", Date: "2020-01-01T00:00:00", "CGM (mg / dl)": 50 },
    {
      "Patient Number": "a",
      Date: "2020-01-01T00:00:00",
      "CGM (mg / dl)": 100,
      "Insulin dose - i.v.": "2 IU",
      "CSII - basal insulin (Novolin R, IU / H)": 1,
    },
    {
      "Patient Number": "b",
      Date: "2020-01-01T00:15:00",
      "CGM (mg / dl)": 500,
    },
    { "Patient Number": "a", Date: "invalid", "CGM (mg / dl)": 500 },
    {
      "Patient Number": "a",
      Date: "2020-01-01T00:15:00",
      "CGM (mg / dl)": 200,
    },
  ]);
  assert.equal(p.cgmReadings.length, 2);
  assert.equal(p.cgmSummary.meanGlucose, 150);
  assert.equal(p.timeInRangePct, 50);
  assert.match(p.cgmReadings[0].insulin, /i\.v\.: 2 IU/);
  assert.match(p.cgmReadings[0].insulin, /basal \(IU\/h\): 1/);
});

test("pagination respects a server cap smaller than the requested page and returns all rows", async () => {
  const all = Array.from({ length: 5 }, (_, id) => ({
    id,
    "Patient Number": "a",
  }));
  const ranges = [];
  const client = {
    from: () => {
      const query = {
        select: () => query,
        order: () => query,
        eq: () => query,
        range: async (from, to) => {
          ranges.push([from, to]);
          return {
            data: all.slice(from, from + 2),
            count: all.length,
            error: null,
          };
        },
      };
      return query;
    },
  };
  assert.deepEqual(await readClinicalRows(client, "patient_detail", "a"), all);
  assert.deepEqual(
    ranges.map((row) => row[0]),
    [0, 2, 4],
  );
});

test("database failures, incomplete pages and mismatched patient IDs never return fallback records", async () => {
  for (const response of [
    { data: null, error: { message: "Denied" } },
    { data: [], count: 5, error: null },
    { data: [{ "Patient Number": "b" }], count: 1, error: null },
  ]) {
    const query = {
      select: () => query,
      order: () => query,
      eq: () => query,
      range: async () => response,
    };
    await assert.rejects(
      readClinicalRows({ from: () => query }, "patient_detail", "a"),
    );
  }
});

const assumptions = {
  basalGlucose: 120,
  weightKg: 70,
  betaResponse: 0.5,
  sensitivity: 0.7,
  absorptionMinutes: 45,
};
test("physiology has a stable basal state and never fabricates periodic glucose rebounds", () => {
  const rows = simulatePhysiology(120, 12, assumptions);
  assert.ok(rows.every((row) => Math.abs(row.glucose - 120) < 1e-9));
});
test("a meal has no effect before its time, produces delayed insulin response and subsequently recovers", () => {
  const baseline = simulatePhysiology(120, 12, assumptions);
  const rows = simulatePhysiology(120, 12, assumptions, [
    { kind: "carbohydrate", minute: 30, amount: 40 },
  ]);
  assert.deepEqual(
    rows.filter((r) => r.minute <= 30),
    baseline.filter((r) => r.minute <= 30),
  );
  assert.ok(Math.max(...rows.map((r) => r.glucose)) > 180);
  assert.ok(rows.some((r) => r.secretion > 0));
  assert.ok(rows.at(-1).glucose < Math.max(...rows.map((r) => r.glucose)) - 50);
});
test("beta-cell capacity and tissue sensitivity have separate effects and zero beta response makes no endogenous secretion", () => {
  const event = [{ kind: "carbohydrate", minute: 30, amount: 40 }];
  const absent = simulatePhysiology(
    120,
    12,
    { ...assumptions, betaResponse: 0 },
    event,
  );
  const stronger = simulatePhysiology(
    120,
    12,
    { ...assumptions, betaResponse: 1 },
    event,
  );
  assert.ok(absent.every((r) => r.secretion === 0));
  assert.ok(
    Math.max(...stronger.map((r) => r.glucose)) <
      Math.max(...absent.map((r) => r.glucose)),
  );
  const resistant = simulatePhysiology(
    120,
    12,
    { ...assumptions, sensitivity: 0 },
    event,
  );
  assert.ok(
    Math.max(...resistant.map((r) => r.glucose)) >
      Math.max(...stronger.map((r) => r.glucose)),
  );
});
test("hypothetical insulin acts after absorption and cannot change the pre-event curve", () => {
  const base = simulatePhysiology(180, 6, assumptions);
  const rows = simulatePhysiology(180, 6, assumptions, [
    { kind: "insulin", minute: 60, amount: 1 },
  ]);
  assert.deepEqual(
    rows.filter((r) => r.minute <= 60),
    base.filter((r) => r.minute <= 60),
  );
  assert.ok(rows.some((r, i) => r.glucose < base[i].glucose - 1));
});
test("physiology rejects invalid assumptions, nonfinite amounts and events beyond the horizon", () => {
  assert.throws(() => simulatePhysiology(NaN, 6, assumptions));
  assert.throws(() =>
    simulatePhysiology(120, 6, { ...assumptions, weightKg: 0 }),
  );
  for (const event of [
    { kind: "carbohydrate", minute: 360, amount: 40 },
    { kind: "insulin", minute: 15, amount: Infinity },
    { kind: "insulin", minute: 15, amount: 21 },
  ])
    assert.throws(() => simulatePhysiology(120, 6, assumptions, [event]));
});
