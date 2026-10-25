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
const { compileScenario, clockInput, recordTime, cookedRiceCarbohydrate } =
  await moduleFor("scenario");
const { simulatePhysiology, PhysiologyDomainError } =
  await moduleFor("physiology");
const start = "2020-01-01T23:00:00";
const meal = {
  id: "meal-a",
  kind: "meal",
  at: "2020-01-02T00:00",
  description: "Mixed meal",
  amount: "250",
  carbohydrate: "45",
  absorption: "45",
  intensity: "moderate",
};
const assumptions = {
  basalGlucose: 120,
  weightKg: 70,
  betaResponse: 0.5,
  sensitivity: 0.7,
  absorptionMinutes: 45,
};

test("cooked-rice reference converts portion mass explicitly and cannot reuse a stale estimate", () => {
  assert.equal(cookedRiceCarbohydrate(200), 55.5);
  assert.equal(cookedRiceCarbohydrate(400), 111.1);
  for (const invalid of [0, -1, NaN, Infinity, 2001])
    assert.equal(cookedRiceCarbohydrate(invalid), null);
  const rice = {
    ...meal,
    amount: "200",
    carbohydrate: "55.5",
    carbohydrateSource: "usda-cooked-white-rice",
  };
  const plan = compileScenario([rice], start, 6);
  assert.equal(plan.events[0].amount, 55.5);
  assert.equal(plan.schedule[0].amount, "200");
  assert.equal(plan.schedule[0].carbohydrateSource, "usda-cooked-white-rice");
  assert.throws(
    () => compileScenario([{ ...rice, amount: "400" }], start, 6),
    /estimate no longer matches/,
  );
});

test("screenshot scenario distinguishes 200 g carbohydrate from 200 g cooked rice without relaxing model bounds", () => {
  const seeded = { ...assumptions, basalGlucose: 217.8 };
  assert.throws(
    () =>
      simulatePhysiology(217.8, 6, seeded, [
        { kind: "carbohydrate", minute: 120, amount: 200 },
      ]),
    (error) => {
      assert.ok(error instanceof PhysiologyDomainError);
      assert.ok(error.minute > 120 && error.minute < 360);
      assert.ok(error.simulatedGlucose > 600);
      assert.match(error.message, /not a measured patient result/);
      return true;
    },
  );
  const rows = simulatePhysiology(217.8, 6, seeded, [
    { kind: "carbohydrate", minute: 120, amount: cookedRiceCarbohydrate(200) },
  ]);
  assert.ok(rows.every((row) => Number.isFinite(row.glucose)));
  assert.ok(Math.max(...rows.map((row) => row.glucose)) > 217.8);
  assert.ok(Math.max(...rows.map((row) => row.glucose)) < 600);
});

test("record-clock schedule crosses midnight and preserves two meals and an injection in chronological order", () => {
  const plan = compileScenario(
    [
      { ...meal, id: "meal-b", at: "2020-01-02T02:15", carbohydrate: "30" },
      {
        ...meal,
        id: "insulin",
        kind: "insulin",
        at: "2020-01-01T23:45",
        description: "Rapid insulin",
        amount: "1",
      },
      meal,
    ],
    start,
    6,
  );
  assert.deepEqual(
    plan.events.map((row) => [row.kind, row.minute, row.amount]),
    [
      ["insulin", 45, 1],
      ["carbohydrate", 60, 45],
      ["carbohydrate", 195, 30],
    ],
  );
  assert.equal(clockInput(recordTime(start)), "2020-01-01T23:00");
  assert.equal(recordTime("2020-01-02T00:00+01:00"), recordTime(start));
});

test("incomplete, out-of-window and invalid amounts cannot produce a scenario", () => {
  for (const update of [
    { at: "" },
    { at: "2020-01-01T22:59" },
    { at: "2020-01-01T23:00" },
    { at: "2020-01-02T05:00" },
    { at: "invalid" },
    { description: " " },
    { amount: "" },
    { amount: "NaN" },
    { carbohydrate: "" },
    { carbohydrate: "251" },
    { amount: "30" },
    { absorption: "2" },
    { kind: "unknown" },
  ]) {
    assert.throws(
      () => compileScenario([{ ...meal, ...update }], start, 6),
      JSON.stringify(update),
    );
  }
  assert.throws(() => compileScenario([], start, 6));
  assert.throws(() => compileScenario(Array(13).fill(meal), start, 6));
  assert.throws(() => compileScenario([meal], "invalid", 6));
  assert.throws(() => compileScenario([meal], start, 3));
});

test("medicine name and mg dose never become invented insulin or a numeric drug response", () => {
  const drug = {
    ...meal,
    kind: "medication",
    description: "Metformin immediate-release",
    amount: "500",
  };
  const plan = compileScenario([drug], start, 6);
  assert.equal(plan.events.length, 0);
  assert.match(plan.unmodelled.join(" "), /Metformin/);
  assert.equal(plan.schedule[0].amount, "500");
  assert.deepEqual(
    simulatePhysiology(120, 6, assumptions, plan.events),
    simulatePhysiology(120, 6, assumptions),
  );
});

test("each meal has its own absorption rate; food mass alone cannot drive a glucose rise", () => {
  const faster = compileScenario([{ ...meal, absorption: "25" }], start, 6);
  const slower = compileScenario([{ ...meal, absorption: "75" }], start, 6);
  const a = simulatePhysiology(120, 6, assumptions, faster.events);
  const b = simulatePhysiology(120, 6, assumptions, slower.events);
  const peakMinute = (rows) =>
    rows.reduce((best, row) => (row.glucose > best.glucose ? row : best))
      .minute;
  assert.ok(peakMinute(a) < peakMinute(b));
  assert.ok(Math.max(...a.map((row) => row.glucose)) > 120);
  assert.ok(a.at(-1).glucose < Math.max(...a.map((row) => row.glucose)));
  const renamed = compileScenario(
    [
      {
        ...meal,
        description: "Different food name",
        amount: "500",
        absorption: "25",
      },
    ],
    start,
    6,
  );
  assert.deepEqual(renamed.events, faster.events);
});

test("events cannot alter the past; delayed insulin lowers the matched meal scenario and beta response matters", () => {
  const plan = compileScenario([meal], start, 6);
  const baseline = simulatePhysiology(120, 6, assumptions);
  const food = simulatePhysiology(120, 6, assumptions, plan.events);
  assert.deepEqual(
    food.filter((row) => row.minute <= 60),
    baseline.filter((row) => row.minute <= 60),
  );
  const withInsulin = simulatePhysiology(120, 6, assumptions, [
    ...plan.events,
    { kind: "insulin", amount: 1, minute: 60 },
  ]);
  assert.ok(
    withInsulin.find((row) => row.minute === 180).glucose <
      food.find((row) => row.minute === 180).glucose,
  );
  const absent = simulatePhysiology(
    120,
    6,
    { ...assumptions, betaResponse: 0 },
    plan.events,
  );
  assert.ok(absent.at(-1).glucose > food.at(-1).glucose);
});

test("moderate uptake and intense hepatic stress have distinct illustrative responses, with bounded activity duration", () => {
  const moderate = compileScenario(
    [{ ...meal, kind: "activity", description: "Walking", amount: "30" }],
    start,
    6,
  );
  const intense = compileScenario(
    [
      {
        ...meal,
        kind: "activity",
        description: "Sprints",
        amount: "30",
        intensity: "intense",
      },
    ],
    start,
    6,
  );
  const walking = simulatePhysiology(120, 6, assumptions, moderate.events);
  const sprints = simulatePhysiology(120, 6, assumptions, intense.events);
  assert.ok(walking.find((row) => row.minute === 90).glucose < 120);
  assert.ok(sprints.find((row) => row.minute === 90).glucose > 120);
  assert.throws(() =>
    compileScenario([{ ...meal, kind: "activity", amount: "121" }], start, 6),
  );
  assert.throws(() =>
    compileScenario(
      [{ ...meal, kind: "activity", at: "2020-01-02T04:45", amount: "30" }],
      start,
      6,
    ),
  );
  assert.throws(() =>
    simulatePhysiology(120, 6, assumptions, [
      { kind: "activity", minute: 60, amount: 30, intensity: "unknown" },
    ]),
  );
});
