import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(
  new URL("../src/lib/browserGru.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
  },
});
const { decodeBrowserModel, rolloutBrowserGru, validateBrowserHistory } =
  await import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
  );
const asset = (path) =>
  JSON.parse(
    readFileSync(
      new URL(`../public/browser-model/${path}`, import.meta.url),
      "utf8",
    ),
  );
const modelFile = asset("gru.json");
const model = decodeBrowserModel(modelFile);
const reference = JSON.parse(
  readFileSync(
    new URL("./fixtures/browser-gru-reference.json", import.meta.url),
    "utf8",
  ),
);

test("browser weights and reference outputs identify the exact checked-in PyTorch checkpoint", () => {
  const checkpoint = readFileSync(
    new URL("../../../models/weights/gru_t2dm_forecaster.pt", import.meta.url),
  );
  assert.equal(
    model.model_sha256,
    createHash("sha256").update(checkpoint).digest("hex"),
  );
  assert.equal(reference.model_sha256, model.model_sha256);
});

for (const fixture of reference.cases) {
  test(`PyTorch numerical parity: ${fixture.patient_id}, ${fixture.horizon_hours}h, ${fixture.events.length} events`, () => {
    const history = asset(`history/${fixture.patient_id}.json`);
    const points = rolloutBrowserGru(
      model,
      history,
      fixture.horizon_hours,
      fixture.events,
    ).slice(1);
    assert.equal(points.length, fixture.expected.length);
    const maxError = Math.max(
      ...points.map((point, i) => Math.abs(point.value - fixture.expected[i])),
    );
    assert.ok(
      maxError < 0.001,
      `Maximum deviation from original PyTorch: ${maxError} mg/dL`,
    );
  });
}

test("every bundled history is exact-record scoped and has a complete continuous model window", () => {
  const manifest = asset("manifest.json");
  assert.ok(manifest.records.length > 100);
  for (const id of manifest.records)
    validateBrowserHistory(model, asset(`history/${id}.json`), id);
  const history = asset(`history/${manifest.records[0]}.json`);
  assert.throws(() => validateBrowserHistory(model, history, "another-record"));
  assert.throws(() =>
    validateBrowserHistory(
      model,
      { ...history, model_sha256: "different" },
      history.patient_id,
    ),
  );
  assert.throws(() =>
    validateBrowserHistory(
      model,
      { ...history, features: history.features.slice(1) },
      history.patient_id,
    ),
  );
});

test("events preserve pre-event predictions, change later output and reset deterministically", () => {
  const id = reference.cases[0].patient_id;
  const history = asset(`history/${id}.json`);
  const baseline = rolloutBrowserGru(model, history, 6);
  const scenario = rolloutBrowserGru(model, history, 6, [
    { kind: "meal", amount: 60, minutes_ahead: 60 },
  ]);
  assert.deepEqual(
    scenario.filter((_, i) => i <= 4),
    baseline.filter((_, i) => i <= 4),
  );
  assert.ok(
    scenario.some(
      (point, i) => Math.abs(point.value - baseline[i].value) > 0.001,
    ),
  );
  assert.deepEqual(rolloutBrowserGru(model, history, 6), baseline);
});

test("invalid events, nonfinite history and corrupted weights fail without producing a curve", () => {
  const history = asset(`history/${reference.cases[0].patient_id}.json`);
  for (const event of [
    { kind: "meal", amount: -1, minutes_ahead: 60 },
    { kind: "insulin", amount: NaN, minutes_ahead: 60 },
    { kind: "meal", amount: 60, minutes_ahead: 180 },
  ])
    assert.throws(() => rolloutBrowserGru(model, history, 3, [event]));
  const invalid = structuredClone(history);
  invalid.features[0][0] = NaN;
  assert.throws(() =>
    validateBrowserHistory(model, invalid, history.patient_id),
  );
  const corrupted = structuredClone(modelFile);
  corrupted.weights["head.3.bias"].base64 = "";
  assert.throws(() => decodeBrowserModel(corrupted));
});
