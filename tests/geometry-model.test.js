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
  closeTo(result.geometryScore, 75);
});

test("recalibrated geometry score calibration points match required curve", () => {
  closeTo(model.calculateGeometryScoreFromRatio(1), 75, 1e-10);
  closeTo(model.calculateGeometryScoreFromRatio(0.9), 90, 1e-10);
  closeTo(model.calculateGeometryScoreFromRatio(0.8), 96.8, 0.06);
  closeTo(model.calculateGeometryScoreFromRatio(1 / 0.9), 50, 1e-10);
  assert.ok(model.calculateGeometryScoreFromRatio(0.2) < 100);
  assert.ok(model.calculateGeometryScoreFromRatio(10) > 0);
});

test("recalibrated fuel validation score calibration points match required curve", () => {
  const predicted = 1000;

  closeTo(model.calculateFuelValidationScore(predicted, predicted), 75);
  closeTo(model.calculateFuelValidationScore(predicted, 0.9 * predicted), 90, 0.2);
  closeTo(model.calculateFuelValidationScore(predicted, predicted / 0.9), 50, 0.5);
  assert.ok(model.calculateFuelValidationScore(predicted, 0.9 * predicted) > model.calculateFuelValidationScore(predicted, predicted));
  assert.ok(model.calculateFuelValidationScore(predicted, 1.1 * predicted) < model.calculateFuelValidationScore(predicted, predicted));
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
  assert.ok(model.calculateGeometryScoreFromRatio(1.1) < model.calculateGeometryScoreFromRatio(1));
});

test("current preset aircraft ranking remains ordered by geometry score", () => {
  const rows = [
    ["Airbus A321neo", 213848, 10.471, 17.35, 44.51 / 3.95, 80.5, 42.4, 928],
    ["Boeing 737 MAX 8", 181198, 10.159, 17.15, 39.12 / 3.76, 73.2, 74.5, 750],
    ["Airbus A321ceo", 206132, 9.084, 16.47, 44.51 / 3.95, 71.9, 69.4, 850],
    ["Boeing 737-800", 174200, 9.423, 16.69, 39.47 / 3.76, 68.7, 41.6, 850],
    ["Airbus A320ceo", 171961, 10.454, 17.34, 37.57 / 3.95, 67.9, 71.4, 750],
    ["Airbus A320neo", 174165, 10.454, 17.34, 37.57 / 3.95, 67.9, 90.4, 668],
    ["Airbus A319ceo", 141095, 9.5, 16.74, 33.84 / 3.95, 50.5, 49.7, 759]
  ].map(([name, mtowLb, aspectRatio, liftToDragRatio, fuselageSlenderness, expectedGeometry, expectedValidation, actualFuelBurnGph]) => {
    const result = model.calculateRegressionResult({
      mtowLb,
      aspectRatio,
      liftToDragRatio,
      fuselageSlenderness,
      actualFuelBurnGph
    });
    return { name, result, expectedGeometry, expectedValidation };
  });

  rows.forEach((row) => {
    closeTo(row.result.geometryScore, row.expectedGeometry, 0.15);
    closeTo(row.result.fuelValidation.score, row.expectedValidation, 0.2);
  });

  for (let index = 1; index < rows.length; index += 1) {
    assert.ok(
      rows[index - 1].result.geometryScore >= rows[index].result.geometryScore,
      `${rows[index - 1].name} should remain ranked above ${rows[index].name}`
    );
  }
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
