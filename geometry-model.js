"use strict";

(function exposeGeometryModel(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.PristineSkiesGeometryModel = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildGeometryModel() {
  const MODEL_CONSTANTS = Object.freeze({
    MODEL_VERSION: "balanced-wing-regression-v1",
    MODEL_DISPLAY_NAME: "Balanced Wing Regression v1",
    FUEL_BURN_ANCHOR_GPH: 797.1975,
    MTOW_REFERENCE_LB: 200000,
    ASPECT_RATIO_REFERENCE: 9.6,
    LIFT_TO_DRAG_REFERENCE: 16.8,
    SLENDERNESS_REFERENCE: 11.2,
    WEIGHT_EXPONENT: 0.737258,
    ASPECT_RATIO_EXPONENT: -0.236975,
    LIFT_TO_DRAG_EXPONENT: -0.236975,
    SLENDERNESS_EXPONENT: -0.373390,
    GEOMETRY_SCORE_EXPONENT: 10.427172663391412,
    REGRESSION_RESIDUAL_SIGMA: 0.103878,
    KG_TO_LB: 2.20462262185,
    US_GALLON_TO_LITER: 3.785411784,
    TRAINING_RANGES: Object.freeze({
      mtowLb: Object.freeze({ min: 48501, max: 1268000, label: "Maximum takeoff weight" }),
      aspectRatio: Object.freeze({ min: 7.527, max: 11.327, label: "Wing aspect ratio" }),
      liftToDragRatio: Object.freeze({ min: 15.4, max: 17.78, label: "Maximum lift-to-drag ratio" }),
      fuselageSlenderness: Object.freeze({ min: 8.567, max: 14.106, label: "Fuselage slenderness ratio" })
    })
  });

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function requirePositiveNumber(value, label) {
    if (!isFiniteNumber(value)) {
      throw new TypeError(`${label} must be a finite number.`);
    }
    if (value <= 0) {
      throw new RangeError(`${label} must be greater than zero.`);
    }
    return value;
  }

  function kgToPounds(kg) {
    return requirePositiveNumber(kg, "Kilograms") * MODEL_CONSTANTS.KG_TO_LB;
  }

  function poundsToKg(pounds) {
    return requirePositiveNumber(pounds, "Pounds") / MODEL_CONSTANTS.KG_TO_LB;
  }

  function gallonsToLiters(gallons) {
    return requirePositiveNumber(gallons, "US gallons") * MODEL_CONSTANTS.US_GALLON_TO_LITER;
  }

  function litersToGallons(liters) {
    return requirePositiveNumber(liters, "Liters") / MODEL_CONSTANTS.US_GALLON_TO_LITER;
  }

  function calculateFuselageSlenderness(length, width) {
    const fuselageLength = requirePositiveNumber(length, "Fuselage length");
    const fuselageWidth = requirePositiveNumber(width, "Fuselage width");
    return fuselageLength / fuselageWidth;
  }

  function calculateWingQualityTerm(aspectRatio, liftToDragRatio) {
    const ar = requirePositiveNumber(aspectRatio, "Wing aspect ratio");
    const ld = requirePositiveNumber(liftToDragRatio, "Maximum lift-to-drag ratio");
    return Math.sqrt(
      (ar / MODEL_CONSTANTS.ASPECT_RATIO_REFERENCE) *
      (ld / MODEL_CONSTANTS.LIFT_TO_DRAG_REFERENCE)
    );
  }

  function calculateNeutralFuelBurn(mtowLb) {
    const weight = requirePositiveNumber(mtowLb, "Maximum takeoff weight");
    return MODEL_CONSTANTS.FUEL_BURN_ANCHOR_GPH *
      Math.pow(weight / MODEL_CONSTANTS.MTOW_REFERENCE_LB, MODEL_CONSTANTS.WEIGHT_EXPONENT);
  }

  function predictFuelBurnExpanded(input) {
    const mtowLb = requirePositiveNumber(input.mtowLb, "Maximum takeoff weight");
    const aspectRatio = requirePositiveNumber(input.aspectRatio, "Wing aspect ratio");
    const liftToDragRatio = requirePositiveNumber(input.liftToDragRatio, "Maximum lift-to-drag ratio");
    const fuselageSlenderness = requirePositiveNumber(input.fuselageSlenderness, "Fuselage slenderness ratio");

    return MODEL_CONSTANTS.FUEL_BURN_ANCHOR_GPH *
      Math.pow(mtowLb / MODEL_CONSTANTS.MTOW_REFERENCE_LB, MODEL_CONSTANTS.WEIGHT_EXPONENT) *
      Math.pow(aspectRatio / MODEL_CONSTANTS.ASPECT_RATIO_REFERENCE, MODEL_CONSTANTS.ASPECT_RATIO_EXPONENT) *
      Math.pow(liftToDragRatio / MODEL_CONSTANTS.LIFT_TO_DRAG_REFERENCE, MODEL_CONSTANTS.LIFT_TO_DRAG_EXPONENT) *
      Math.pow(fuselageSlenderness / MODEL_CONSTANTS.SLENDERNESS_REFERENCE, MODEL_CONSTANTS.SLENDERNESS_EXPONENT);
  }

  function predictFuelBurnUsingWingQuality(input) {
    const mtowLb = requirePositiveNumber(input.mtowLb, "Maximum takeoff weight");
    const fuselageSlenderness = requirePositiveNumber(input.fuselageSlenderness, "Fuselage slenderness ratio");
    const wingQuality = calculateWingQualityTerm(input.aspectRatio, input.liftToDragRatio);

    return MODEL_CONSTANTS.FUEL_BURN_ANCHOR_GPH *
      Math.pow(mtowLb / MODEL_CONSTANTS.MTOW_REFERENCE_LB, MODEL_CONSTANTS.WEIGHT_EXPONENT) *
      Math.pow(wingQuality, MODEL_CONSTANTS.ASPECT_RATIO_EXPONENT + MODEL_CONSTANTS.LIFT_TO_DRAG_EXPONENT) *
      Math.pow(fuselageSlenderness / MODEL_CONSTANTS.SLENDERNESS_REFERENCE, MODEL_CONSTANTS.SLENDERNESS_EXPONENT);
  }

  function calculateFuelRatio(predictedFuelBurnGph, neutralFuelBurnGph) {
    const predicted = requirePositiveNumber(predictedFuelBurnGph, "Predicted cruise fuel burn");
    const neutral = requirePositiveNumber(neutralFuelBurnGph, "Neutral fuel burn");
    return predicted / neutral;
  }

  function calculateGeometryImprovementPercent(fuelRatio) {
    return (1 - requirePositiveNumber(fuelRatio, "Predicted geometry fuel ratio")) * 100;
  }

  function calculateGeometryScoreFromRatio(fuelRatio) {
    const ratio = requirePositiveNumber(fuelRatio, "Predicted geometry fuel ratio");
    return 100 / (1 + Math.pow(ratio, MODEL_CONSTANTS.GEOMETRY_SCORE_EXPONENT));
  }

  function calculateFuelValidationScore(predictedFuelBurnGph, actualFuelBurnGph) {
    const predicted = requirePositiveNumber(predictedFuelBurnGph, "Predicted cruise fuel burn");
    const actual = requirePositiveNumber(actualFuelBurnGph, "Measured cruise fuel burn");
    return 100 / (
      1 + Math.exp(
        (-Math.log(3) * Math.log(predicted / actual)) / MODEL_CONSTANTS.REGRESSION_RESIDUAL_SIGMA
      )
    );
  }

  function calculateRegressionResult(input) {
    const predictedFuelBurnGph = predictFuelBurnExpanded(input);
    const neutralFuelBurnGph = calculateNeutralFuelBurn(input.mtowLb);
    const fuelRatio = calculateFuelRatio(predictedFuelBurnGph, neutralFuelBurnGph);
    const wingQualityTerm = calculateWingQualityTerm(input.aspectRatio, input.liftToDragRatio);
    const geometryScore = calculateGeometryScoreFromRatio(fuelRatio);
    const geometryImprovementPercent = calculateGeometryImprovementPercent(fuelRatio);
    const extrapolationWarnings = getExtrapolationWarnings(input);

    const result = {
      modelVersion: MODEL_CONSTANTS.MODEL_VERSION,
      wingQualityTerm,
      predictedFuelBurnGph,
      neutralFuelBurnGph,
      fuelRatio,
      geometryImprovementPercent,
      geometryScore,
      interpretation: interpretGeometryScore(geometryScore),
      extrapolationWarnings,
      normalizedTerms: {
        weight: Math.pow(input.mtowLb / MODEL_CONSTANTS.MTOW_REFERENCE_LB, MODEL_CONSTANTS.WEIGHT_EXPONENT),
        aspectRatio: Math.pow(input.aspectRatio / MODEL_CONSTANTS.ASPECT_RATIO_REFERENCE, MODEL_CONSTANTS.ASPECT_RATIO_EXPONENT),
        liftToDragRatio: Math.pow(input.liftToDragRatio / MODEL_CONSTANTS.LIFT_TO_DRAG_REFERENCE, MODEL_CONSTANTS.LIFT_TO_DRAG_EXPONENT),
        fuselageSlenderness: Math.pow(input.fuselageSlenderness / MODEL_CONSTANTS.SLENDERNESS_REFERENCE, MODEL_CONSTANTS.SLENDERNESS_EXPONENT)
      }
    };

    if (input.actualFuelBurnGph !== undefined && input.actualFuelBurnGph !== null && input.actualFuelBurnGph !== "") {
      const actualFuelBurnGph = requirePositiveNumber(input.actualFuelBurnGph, "Measured cruise fuel burn");
      result.fuelValidation = {
        actualFuelBurnGph,
        predictedFuelBurnGph,
        residualPercent: ((actualFuelBurnGph - predictedFuelBurnGph) / predictedFuelBurnGph) * 100,
        score: calculateFuelValidationScore(predictedFuelBurnGph, actualFuelBurnGph)
      };
    }

    return result;
  }

  function interpretGeometryScore(score) {
    if (!isFiniteNumber(score)) return "Unavailable";
    if (score < 25) return "Poor geometric efficiency";
    if (score < 40) return "Below-average geometric efficiency";
    if (score < 60) return "Typical geometric efficiency";
    if (score < 75) return "Strong geometric efficiency";
    if (score < 90) return "Excellent geometric efficiency";
    return "Exceptional geometric efficiency";
  }

  function validateRegressionInputs(input) {
    const errors = [];
    [
      ["mtowLb", "Maximum takeoff weight"],
      ["aspectRatio", "Wing aspect ratio"],
      ["liftToDragRatio", "Maximum lift-to-drag ratio"],
      ["fuselageSlenderness", "Fuselage slenderness ratio"]
    ].forEach(([key, label]) => {
      const value = input[key];
      if (!isFiniteNumber(value)) {
        errors.push(`${label} must be a valid number.`);
      } else if (value <= 0) {
        errors.push(`${label} must be greater than zero.`);
      }
    });

    if (input.actualFuelBurnGph !== undefined && input.actualFuelBurnGph !== null && input.actualFuelBurnGph !== "") {
      if (!isFiniteNumber(input.actualFuelBurnGph)) {
        errors.push("Measured cruise fuel burn must be a valid number when provided.");
      } else if (input.actualFuelBurnGph <= 0) {
        errors.push("Measured cruise fuel burn must be greater than zero when provided.");
      }
    }

    return errors;
  }

  function getExtrapolationWarnings(input) {
    return Object.entries(MODEL_CONSTANTS.TRAINING_RANGES)
      .filter(([key, range]) => {
        const value = input[key];
        return isFiniteNumber(value) && (value < range.min || value > range.max);
      })
      .map(([key, range]) => ({
        field: key,
        label: range.label,
        value: input[key],
        min: range.min,
        max: range.max,
        message: `${range.label} is outside the trained range (${range.min} to ${range.max}).`
      }));
  }

  return Object.freeze({
    MODEL_CONSTANTS,
    isFiniteNumber,
    requirePositiveNumber,
    kgToPounds,
    poundsToKg,
    gallonsToLiters,
    litersToGallons,
    calculateFuselageSlenderness,
    calculateWingQualityTerm,
    calculateNeutralFuelBurn,
    predictFuelBurnExpanded,
    predictFuelBurnUsingWingQuality,
    calculateFuelRatio,
    calculateGeometryImprovementPercent,
    calculateGeometryScoreFromRatio,
    calculateFuelValidationScore,
    calculateRegressionResult,
    interpretGeometryScore,
    validateRegressionInputs,
    getExtrapolationWarnings
  });
});
