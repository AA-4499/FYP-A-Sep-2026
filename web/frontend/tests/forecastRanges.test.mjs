import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

const modules = {};
async function moduleFor(name) {
  let source = readFileSync(
    new URL(`../src/lib/${name}.ts`, import.meta.url),
    "utf8",
  );
  for (const [dependency, url] of Object.entries(modules))
    source = source.replaceAll(`"./${dependency}"`, JSON.stringify(url));
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
    },
  });
  const url = `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
  modules[name] = url;
  return import(url);
}
const { historicalErrorRange, sensitivityRange } =
  await moduleFor("forecastRanges");
await moduleFor("physiology");
const { physiologyRanges } = await moduleFor("physiologyRanges");
const at = (minute) =>
  new Date(Date.UTC(2020, 0, 2) + minute * 60000).toISOString();
const forecast = Array.from({ length: 5 }, (_, i) => ({
  timestamp: at(i * 15),
  value: 120,
}));
const actual = Array.from({ length: 40 }, (_, i) => ({
  timestamp: at(-(40 - i) * 15),
  value: 120,
}));
const predicted = actual.map((point) => ({ ...point, value: 110 }));

test("historical reference uses timestamp-matched finite pre-origin errors and explicit sqrt-step growth", () => {
  const result = historicalErrorRange(
    forecast,
    predicted,
    [...actual].reverse(),
  );
  assert.equal(result.method, "historical-error-reference");
  assert.equal(result.samples, 40);
  assert.deepEqual(result.points[0].outer, [120, 120]);
  assert.deepEqual(result.points[1].outer, [110, 130]);
  assert.deepEqual(result.points[4].outer, [100, 140]);
  const contaminated = historicalErrorRange(
    forecast,
    [
      ...predicted,
      ...predicted,
      { timestamp: at(15), value: 0 },
      { timestamp: "invalid", value: 0 },
    ],
    [...actual, { timestamp: at(15), value: 500 }],
  );
  assert.deepEqual(contaminated, result);
});

test("missing pairs, insufficient errors, malformed steps and nonfinite data cannot invent an envelope", () => {
  assert.equal(
    historicalErrorRange(forecast, predicted.slice(0, 29), actual),
    null,
  );
  assert.equal(historicalErrorRange(forecast, predicted, []), null);
  assert.equal(
    historicalErrorRange([{ timestamp: at(0), value: NaN }], predicted, actual),
    null,
  );
  assert.equal(
    historicalErrorRange(
      [
        { timestamp: at(0), value: 120 },
        { timestamp: at(10), value: 120 },
      ],
      predicted,
      actual,
    ),
    null,
  );
  assert.equal(
    historicalErrorRange([forecast[0], forecast[0]], predicted, actual),
    null,
  );
});

test("reference bounds are not clipped to target glucose or labelled as calibrated coverage", () => {
  const low = forecast.map((point) => ({ ...point, value: 5 }));
  const range = historicalErrorRange(low, predicted, actual);
  assert.ok(range.points[4].outer[0] < 0);
  assert.equal(range.coverage, undefined);
  assert.equal(range.confidence, undefined);
});

test("sensitivity envelope spans every aligned trajectory and rejects missing/nonfinite members", () => {
  const trajectories = [100, 120, 150, 180].map((value) =>
    forecast.map((point) => ({ ...point, value })),
  );
  const range = sensitivityRange(trajectories);
  assert.equal(range.method, "assumption-sensitivity");
  assert.deepEqual(range.points[1].outer, [100, 180]);
  assert.deepEqual(range.points[1].inner, [115, 157.5]);
  assert.equal(sensitivityRange([trajectories[0], trajectories[1]]), null);
  assert.equal(
    sensitivityRange([...trajectories, [{ timestamp: at(0), value: 120 }]]),
    null,
  );
  assert.equal(
    sensitivityRange([
      ...trajectories,
      forecast.map((point) => ({ ...point, value: Infinity })),
    ]),
    null,
  );
});

const assumptions = {
  basalGlucose: 120,
  weightKg: 70,
  betaResponse: 0.5,
  sensitivity: 0.7,
  absorptionMinutes: 45,
};
test("27 physiology settings produce ordered event envelopes without changing pre-event values", () => {
  const range = physiologyRanges(
    120,
    6,
    assumptions,
    [{ kind: "carbohydrate", minute: 60, amount: 40, absorptionMinutes: 45 }],
    Date.parse(at(0)),
  );
  assert.equal(range.error, "");
  assert.equal(range.scenario.samples, 27);
  assert.equal(range.scenario.points.length, 25);
  assert.ok(
    range.baseline.points.every(
      (point) => point.outer[0] === 120 && point.outer[1] === 120,
    ),
  );
  assert.ok(
    range.scenario.points
      .filter((point) => Date.parse(point.timestamp) <= Date.parse(at(60)))
      .every((point) => point.outer[0] === 120 && point.outer[1] === 120),
  );
  for (const point of range.scenario.points)
    assert.ok(
      point.outer[0] <= point.inner[0] &&
        point.inner[0] <= point.inner[1] &&
        point.inner[1] <= point.outer[1],
    );
  assert.ok(
    range.scenario.points.some((point) => point.outer[1] > point.outer[0]),
  );
});

test("failed extreme physiology settings do not silently produce a narrower surviving range", () => {
  const range = physiologyRanges(
    120,
    6,
    { ...assumptions, weightKg: 0 },
    [],
    Date.parse(at(0)),
  );
  assert.equal(range.baseline, null);
  assert.equal(range.scenario, null);
  assert.match(range.error, /No failed settings were silently discarded/);
});
