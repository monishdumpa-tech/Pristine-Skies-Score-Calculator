"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const model = require("../geometry-model");

const neutral = Object.freeze({
  mtowLb: 200000,
  aspectRatio: 9.6,
  liftToDragRatio: 16.8,
  fuselageSlenderness: 11.2
});

function closeTo(actual, expected, tolerance = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

test("neutral reference case returns expected fuel and score", () => {
  const result = model.calculateRegressionResult(neutral);

  closeTo(model.calculateWingQualityTerm(9.6, 16.8), 1);
  closeTo(result.predictedFuelBurnGph, 797.1975);
  closeTo(result.neutralFuelBurnGph, 797.1975);
  closeTo(result.fuelRatio, 1);
  closeTo(result.geometryScore, 50);
});

test("geometry score calibration points match required curve", () => {
  closeTo(model.calculateGeometryScoreFromRatio(0.9), 75, 1e-10);
  closeTo(model.calculateGeometryScoreFromRatio(0.8), 91.1, 0.02);
  closeTo(model.calculateGeometryScoreFromRatio(1 / 0.9), 25, 1e-10);
});

test("fuel validation score calibration points match required curve", () => {
  const predicted = 1000;

  closeTo(model.calculateFuelValidationScore(predicted, predicted), 50);
  closeTo(model.calculateFuelValidationScore(predicted, 0.9 * predicted), 75.3, 0.02);
  closeTo(model.calculateFuelValidationScore(predicted, 1.1 * predicted), 26.7, 0.05);
});

test("model is monotonic in the requested directions", () => {
  const base = model.calculateRegressionResult(neutral);
  const heavier = model.calculateRegressionResult({ ...neutral, mtowLb: 250000 });
  const higherAspect = model.calculateRegressionResult({ ...neutral, aspectRatio: 10.2 });
  const higherLd = model.calculateRegressionResult({ ...neutral, liftToDragRatio: 17.4 });
  const higherSlenderness = model.calculateRegressionResult({ ...neutral, fuselageSlenderness: 12.2 });

  assert.ok(heavier.predictedFuelBurnGph > base.predictedFuelBurnGph);
  assert.ok(higherAspect.predictedFuelBurnGph < base.predictedFuelBurnGph);
  assert.ok(higherLd.predictedFuelBurnGph < base.predictedFuelBurnGph);
  assert.ok(higherSlenderness.predictedFuelBurnGph < base.predictedFuelBurnGph);
  assert.ok(model.calculateGeometryScoreFromRatio(0.9) > model.calculateGeometryScoreFromRatio(1));
  assert.ok(model.calculateGeometryScoreFromRatio(0.8) > model.calculateGeometryScoreFromRatio(0.9));
});

test("expanded and wing-quality formulas are equivalent", () => {
  const input = {
    mtowLb: 174200,
    aspectRatio: 9.423,
    liftToDragRatio: 16.69,
    fuselageSlenderness: 10.497
  };

  closeTo(
    model.predictFuelBurnExpanded(input),
    model.predictFuelBurnUsingWingQuality(input),
    1e-9
  );
});

test("unit conversions use exact constants", () => {
  closeTo(model.kgToPounds(1), 2.20462262185);
  closeTo(model.gallonsToLiters(1), 3.785411784);
});

test("invalid inputs are rejected and optional actual fuel burn may be missing", () => {
  assert.throws(() => model.calculateNeutralFuelBurn(0), /greater than zero/);
  assert.throws(() => model.calculateNeutralFuelBurn(-1), /greater than zero/);
  assert.throws(() => model.calculateNeutralFuelBurn(Number.NaN), /finite number/);
  assert.throws(() => model.calculateNeutralFuelBurn(Infinity), /finite number/);
  assert.throws(() => model.calculateFuselageSlenderness(30, 0), /greater than zero/);

  assert.deepEqual(model.validateRegressionInputs(neutral), []);
  assert.deepEqual(model.validateRegressionInputs({ ...neutral, actualFuelBurnGph: undefined }), []);
  assert.ok(model.validateRegressionInputs({ ...neutral, actualFuelBurnGph: 0 }).some((error) => error.includes("Measured cruise fuel burn")));
});

test("extrapolation warnings trigger without blocking valid calculations", () => {
  const outOfRange = {
    mtowLb: 1400000,
    aspectRatio: 12,
    liftToDragRatio: 18.2,
    fuselageSlenderness: 15
  };
  const warnings = model.getExtrapolationWarnings(outOfRange);
  const result = model.calculateRegressionResult(outOfRange);

  assert.equal(warnings.length, 4);
  assert.equal(result.extrapolationWarnings.length, 4);
  assert.ok(Number.isFinite(result.geometryScore));
});
