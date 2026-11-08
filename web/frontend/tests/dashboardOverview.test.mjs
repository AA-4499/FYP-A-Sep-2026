import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

const { outputText } = ts.transpileModule(readFileSync(new URL("../src/lib/dashboardOverview.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const { glucoseOverview, filterReviewPatients, reviewSignals, dashboardDate } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const at = Date.UTC(2020, 0, 2);
const reading = (cgm, timestamp = at) => ({ cgm, timestamp, date: new Date(timestamp).toISOString() });

test("glucose ranges include boundaries and use valid observed readings as denominator", () => {
  const summary = glucoseOverview([reading(69, at - 3), reading(70, at - 2), reading(180, at - 1), reading(181), reading(0), reading(NaN), { cgm: 120, timestamp: NaN }]);
  assert.equal(summary.rows.length, 4);
  assert.equal(summary.low, 25);
  assert.equal(summary.inRange, 50);
  assert.equal(summary.high, 25);
  assert.equal(summary.mean, 125);
});

test("historical last-day window is anchored to the newest observation, independent of current date or input order", () => {
  const summary = glucoseOverview([reading(100), reading(80, at - 86400000), reading(110, at - 86400001)]);
  assert.equal(summary.latest.timestamp, at);
  assert.deepEqual(summary.recent.map(r => r.cgm), [80, 100]);
  assert.equal(dashboardDate(at), "2 Jan 2020");
  assert.equal(dashboardDate(NaN), "No dated readings");
});

test("missing CGM remains unknown and never becomes a zero average or 100% in range", () => {
  const summary = glucoseOverview([]);
  assert.equal(summary.latest, undefined);
  for (const metric of ["mean", "low", "inRange", "high"]) assert.ok(Number.isNaN(summary[metric]));
});

test("review flags have separate low, raised HbA1c, and missing-data filters", () => {
  const patients = [
    { id: "a", name: "Alice", condition: "T2D", hba1c: 9, cgmReadings: [] },
    { id: "b", name: "Bob", condition: "T2D", hba1c: 7, cgmReadings: [reading(65)] },
    { id: "c", name: "Chris", condition: "", hba1c: NaN, cgmReadings: [] },
    { id: "d", name: "Dana", condition: "", hba1c: 8.5, cgmReadings: [reading(70)] },
  ];
  assert.deepEqual(filterReviewPatients(patients, "review").map(p => p.id), ["b", "a", "d"]);
  assert.deepEqual(filterReviewPatients(patients, "low").map(p => p.id), ["b"]);
  assert.deepEqual(filterReviewPatients(patients, "missing").map(p => p.id), ["c"]);
  assert.deepEqual(filterReviewPatients(patients, "all", " ALICE ").map(p => p.id), ["a"]);
  assert.equal(reviewSignals(patients[2]).review, false);
  assert.equal(reviewSignals(patients[3]).low, false);
  assert.equal(filterReviewPatients(patients, "review", "Chris").length, 0);
});
