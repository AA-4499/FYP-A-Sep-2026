import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(
  new URL("../src/lib/glucoseRangeDisplay.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
  },
});
const {
  rangeAverage,
  glucoseZoneColor,
  glucoseGradientStops,
  glucoseAxisScale,
} = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("forecast axis uses readable integer steps while retaining every displayed bound", () => {
  for (const [low, high] of [
    [83.652343, 280],
    [101, 103],
    [-22, 510],
    [0, 0],
  ]) {
    const scale = glucoseAxisScale(low, high);
    assert.ok(scale.domain[0] <= low && scale.domain[1] >= high);
    assert.ok(scale.ticks.length >= 3 && scale.ticks.length <= 12);
    assert.ok(
      scale.ticks.every(
        (tick, i) =>
          Number.isInteger(tick) && (!i || tick > scale.ticks[i - 1]),
      ),
    );
  }
  assert.ok(glucoseAxisScale(101, 103).domain[1] < 180);
  assert.ok(glucoseAxisScale(101, 103, false).domain[1] >= 280);
  assert.ok(glucoseAxisScale(NaN, NaN).ticks.every(Number.isFinite));
});

test("middle line is the explicit average of bounds, with no mutation or overflow", () => {
  const bounds = [80, 200];
  assert.equal(rangeAverage(bounds), 140);
  assert.deepEqual(bounds, [80, 200]);
  assert.equal(rangeAverage([1e308, 1e308]), 1e308);
});
test("glucose colours match reference boundaries and retain the darker inner green", () => {
  for (const [value, colour] of [
    [53.9, "#C2410C"],
    [54, "#F97316"],
    [69.9, "#F97316"],
    [70, "#86EFAC"],
    [180, "#86EFAC"],
    [180.1, "#DC2626"],
    [250, "#DC2626"],
    [250.1, "#991B1B"],
  ])
    assert.equal(glucoseZoneColor(value), colour);
  assert.equal(glucoseZoneColor(100, true), "#15803D");
});
test("vertical gradients change sharply at the exact glucose level for each band's own extent", () => {
  const stops = glucoseGradientStops([
    [40, 300],
    [100, 200],
  ]);
  assert.equal(stops[0].color, "#991B1B");
  assert.equal(stops.at(-1).color, "#C2410C");
  for (const threshold of [54, 70, 180, 250]) {
    const offset = (300 - threshold) / 260;
    const pair = stops.filter((stop) => Math.abs(stop.offset - offset) < 1e-12);
    assert.equal(pair.length, 2);
    assert.equal(pair[0].color, glucoseZoneColor(threshold + 0.001));
    assert.equal(pair[1].color, glucoseZoneColor(threshold - 0.001));
  }
  assert.ok(
    stops.every(
      (stop, i) =>
        stop.offset >= 0 &&
        stop.offset <= 1 &&
        (!i || stop.offset >= stops[i - 1].offset),
    ),
  );
  const inner = glucoseGradientStops([[60, 200]], true);
  assert.ok(
    inner.some((stop) => Math.abs(stop.offset - (200 - 180) / 140) < 1e-12),
  );
});
test("flat and threshold-edge bands do not introduce false colour ramps", () => {
  assert.deepEqual(glucoseGradientStops([]), []);
  assert.ok(
    glucoseGradientStops([[70, 180]]).every((stop) => stop.color === "#86EFAC"),
  );
  assert.ok(
    glucoseGradientStops([[54, 70]]).every((stop) => stop.color === "#F97316"),
  );
  assert.ok(
    glucoseGradientStops([[180, 250]]).every(
      (stop) => stop.color === "#DC2626",
    ),
  );
  assert.ok(
    glucoseGradientStops([[180, 180]], true).every(
      (stop) => stop.color === "#15803D",
    ),
  );
});
