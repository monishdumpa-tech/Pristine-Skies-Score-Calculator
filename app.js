"use strict";

const GeometryModel = window.PristineSkiesGeometryModel;
const STORAGE_KEY = "pristine-skies-geometry-regression-v1";
const SOURCE_SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1LdQnjMfrHjkv13AR2aZ7FXEUurWcBeAjRgf9zmATXsU/edit?gid=0#gid=0";

const fieldIds = [
  "aircraftName",
  "manufacturer",
  "aircraftType",
  "mtow",
  "mtowUnit",
  "aspectRatio",
  "liftToDragRatio",
  "slendernessMode",
  "fuselageSlenderness",
  "fuselageLength",
  "fuselageWidth",
  "actualFuelBurn",
  "fuelBurnUnit"
];

const numericFieldIds = [
  "mtow",
  "aspectRatio",
  "liftToDragRatio",
  "fuselageSlenderness",
  "fuselageLength",
  "fuselageWidth",
  "actualFuelBurn"
];

const labels = {
  aircraftName: "Aircraft name",
  manufacturer: "Manufacturer",
  aircraftType: "Aircraft type",
  mtow: "Maximum takeoff weight",
  aspectRatio: "Wing aspect ratio",
  liftToDragRatio: "Maximum lift-to-drag ratio",
  fuselageSlenderness: "Fuselage slenderness ratio",
  fuselageLength: "Fuselage length",
  fuselageWidth: "Maximum fuselage width",
  actualFuelBurn: "Measured cruise fuel burn"
};

const popularAircraft = [
  presetAircraft("boeing-737-800", "Boeing 737-800", "Boeing", "Short/medium-haul narrowbody passenger", 174200, 9.423, 16.69, 39.47, 3.76, 850),
  presetAircraft("airbus-a320-ceo", "Airbus A320 (ceo)", "Airbus", "Short/medium-haul narrowbody passenger", 171961, 10.454, 17.34, 37.57, 3.95, 750),
  presetAircraft("airbus-a320neo", "Airbus A320neo", "Airbus", "Short/medium-haul fleet renewal narrowbody", 174165, 10.454, 17.34, 37.57, 3.95, 668),
  presetAircraft("boeing-737-max-8", "Boeing 737 MAX 8", "Boeing", "Replacement-growth narrowbody passenger", 181198, 10.159, 17.15, 39.12, 3.76, 750),
  presetAircraft("airbus-a321-ceo", "Airbus A321 (ceo)", "Airbus", "Higher-capacity narrowbody passenger", 206132, 9.084, 16.47, 44.51, 3.95, 850),
  presetAircraft("airbus-a321neo", "Airbus A321neo", "Airbus", "High-capacity narrowbody fleet renewal", 213848, 10.471, 17.35, 44.51, 3.95, 928),
  presetAircraft("airbus-a319-ceo", "Airbus A319 ceo", "Airbus", "Short-haul specialized narrowbody passenger", 141095, 9.5, 16.74, 33.84, 3.95, 759)
];

const form = document.getElementById("aircraftForm");
const errorBox = document.getElementById("errorBox");
const submitButton = document.getElementById("submitButton");
const cancelEditButton = document.getElementById("cancelEditButton");
const liveMetrics = document.getElementById("liveMetrics");
const popularAircraftList = document.getElementById("popularAircraftList");
const aircraftTableBody = document.getElementById("aircraftTableBody");
const scoreSummary = document.getElementById("scoreSummary");
const scoreBreakdown = document.getElementById("scoreBreakdown");
const insightsList = document.getElementById("insightsList");

let aircraft = loadAircraft();
let editingId = null;
let lockedPresetId = null;
let presetHoverSnapshot = null;
let latestScored = scoreAircraftList(aircraft);

initialize();

function initialize() {
  renderPopularAircraftPanel();
  bindEvents();
  renderAll();
}

function presetAircraft(id, aircraftName, manufacturer, aircraftType, mtow, aspectRatio, liftToDragRatio, fuselageLengthMeters, fuselageWidthMeters, actualFuelBurn) {
  const fuselageSlenderness = fuselageLengthMeters / fuselageWidthMeters;
  return {
    id,
    aircraftName,
    manufacturer,
    aircraftType,
    mtow,
    mtowUnit: "lb",
    aspectRatio,
    liftToDragRatio,
    slendernessMode: "dimensions",
    fuselageSlenderness: roundForInput(fuselageSlenderness, 3),
    fuselageLength: fuselageLengthMeters,
    fuselageWidth: fuselageWidthMeters,
    actualFuelBurn,
    fuelBurnUnit: "gph",
    sourceNote: `${formatNumber(aspectRatio, 3)} AR, ${formatNumber(fuselageSlenderness, 2)} slenderness`
  };
}

function bindEvents() {
  form.addEventListener("submit", handleSubmit);
  form.addEventListener("input", (event) => {
    if (event.isTrusted) clearPresetSelection();
    updateSlendernessVisibility();
    renderLivePreview();
  });
  form.addEventListener("change", (event) => {
    if (event.isTrusted) clearPresetSelection();
    updateSlendernessVisibility();
    renderLivePreview();
  });
  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      if (editingId) clearEditState();
      clearPresetSelection();
      hideErrors();
      updateSlendernessVisibility();
      renderLivePreview();
    }, 0);
  });
  cancelEditButton.addEventListener("click", () => {
    clearForm();
    document.getElementById("analysis").scrollIntoView({ behavior: "smooth" });
  });
  document.querySelectorAll(".group-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const group = toggle.closest(".input-group");
      const isCollapsed = group.classList.toggle("is-collapsed");
      toggle.setAttribute("aria-expanded", String(!isCollapsed));
    });
  });
  document.getElementById("exportCsvButton").addEventListener("click", exportCsv);
  document.getElementById("downloadJsonButton").addEventListener("click", downloadJson);
  document.getElementById("resetButton").addEventListener("click", resetAircraft);
  window.addEventListener("resize", debounce(drawCharts, 140));
  updateSlendernessVisibility();
}

function renderPopularAircraftPanel() {
  if (!popularAircraftList) return;

  popularAircraftList.innerHTML = popularAircraft.map((preset) => `
    <button class="preset-aircraft" type="button" data-preset-id="${preset.id}">
      <strong>${escapeHtml(preset.aircraftName)}</strong>
      <span>${escapeHtml(preset.aircraftType)}</span>
      <div class="preset-specs">
        <span>${formatNumber(preset.mtow, 0)} lb MTOW</span>
        <span>AR ${formatNumber(preset.aspectRatio, 2)}</span>
        <span>L/D ${formatNumber(preset.liftToDragRatio, 2)}</span>
        <span>FR ${formatNumber(preset.fuselageSlenderness, 2)}</span>
      </div>
      <em>${escapeHtml(preset.sourceNote)}</em>
    </button>
  `).join("");

  popularAircraftList.querySelectorAll(".preset-aircraft").forEach((button) => {
    const preset = popularAircraft.find((item) => item.id === button.dataset.presetId);
    if (!preset) return;

    button.addEventListener("mouseenter", () => previewPreset(preset));
    button.addEventListener("focus", () => previewPreset(preset));
    button.addEventListener("mouseleave", () => restorePresetPreview());
    button.addEventListener("blur", () => restorePresetPreview());
    button.addEventListener("click", () => lockPreset(preset));
  });
}

function previewPreset(preset) {
  if (!presetHoverSnapshot) presetHoverSnapshot = snapshotFormValues();
  setFormValues(preset);
  form.classList.add("is-preset-preview");
  hideErrors();
  updateSlendernessVisibility();
  renderLivePreview();
}

function restorePresetPreview() {
  if (!presetHoverSnapshot) return;
  setFormValues(presetHoverSnapshot);
  presetHoverSnapshot = null;
  form.classList.remove("is-preset-preview");
  hideErrors();
  updateSlendernessVisibility();
  renderLivePreview();
}

function lockPreset(preset) {
  setFormValues(preset);
  lockedPresetId = preset.id;
  presetHoverSnapshot = null;
  form.classList.remove("is-preset-preview");
  updatePresetSelection();
  hideErrors();
  updateSlendernessVisibility();
  renderLivePreview();
}

function handleSubmit(event) {
  event.preventDefault();
  const normalized = buildNormalizedInput();
  const errors = validateForm(normalized);

  if (errors.length) {
    showErrors(errors);
    renderLivePreview();
    return;
  }

  const record = {
    ...getFormValues(),
    mtowLb: normalized.mtowLb,
    fuselageSlendernessResolved: normalized.fuselageSlenderness,
    actualFuelBurnGph: normalized.actualFuelBurnGph,
    id: editingId || createId(),
    updatedAt: new Date().toISOString()
  };

  aircraft = editingId
    ? aircraft.map((item) => item.id === editingId ? record : item)
    : [...aircraft, record];

  saveAircraft();
  clearForm();
  renderAll();
  document.getElementById("results").scrollIntoView({ behavior: "smooth", block: "start" });
}

function getFormValues() {
  const values = {};
  fieldIds.forEach((id) => {
    const element = document.getElementById(id);
    if (!element) return;
    values[id] = numericFieldIds.includes(id) ? element.value.trim() : element.value.trim();
  });
  return values;
}

function snapshotFormValues() {
  const values = {};
  fieldIds.forEach((id) => {
    const element = document.getElementById(id);
    if (element) values[id] = element.value;
  });
  return values;
}

function setFormValues(values) {
  fieldIds.forEach((id) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.value = values[id] ?? "";
  });
}

function buildNormalizedInput(values = getFormValues()) {
  const mtowValue = parseOptionalNumber(values.mtow);
  const mtowLb = convertWeightToPounds(mtowValue, values.mtowUnit || "lb");
  const aspectRatio = parseOptionalNumber(values.aspectRatio);
  const liftToDragRatio = parseOptionalNumber(values.liftToDragRatio);
  const actualFuelBurnValue = parseOptionalNumber(values.actualFuelBurn);
  const actualFuelBurnGph = actualFuelBurnValue === undefined
    ? undefined
    : convertFuelBurnToGph(actualFuelBurnValue, values.fuelBurnUnit || "gph");
  const slenderness = resolveFuselageSlenderness(values);

  return {
    values,
    mtowLb,
    aspectRatio,
    liftToDragRatio,
    fuselageSlenderness: slenderness.value,
    actualFuelBurnGph,
    slendernessErrors: slenderness.errors,
    slendernessSource: slenderness.source
  };
}

function parseOptionalNumber(value) {
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function convertWeightToPounds(value, unit) {
  if (value === undefined || !Number.isFinite(value)) return value;
  if (unit === "kg") return value * GeometryModel.MODEL_CONSTANTS.KG_TO_LB;
  return value;
}

function convertFuelBurnToGph(value, unit) {
  if (value === undefined || !Number.isFinite(value)) return value;
  if (unit === "lph") return value / GeometryModel.MODEL_CONSTANTS.US_GALLON_TO_LITER;
  return value;
}

function resolveFuselageSlenderness(values) {
  const mode = values.slendernessMode || "direct";
  if (mode === "dimensions") {
    const length = parseOptionalNumber(values.fuselageLength);
    const width = parseOptionalNumber(values.fuselageWidth);
    const errors = [];

    if (length === undefined) errors.push("Fuselage length is required when using dimensions.");
    if (width === undefined) errors.push("Maximum fuselage width is required when using dimensions.");
    if (Number.isNaN(length)) errors.push("Fuselage length must be a valid number.");
    if (Number.isNaN(width)) errors.push("Maximum fuselage width must be a valid number.");
    if (Number.isFinite(length) && length <= 0) errors.push("Fuselage length must be greater than zero.");
    if (Number.isFinite(width) && width <= 0) errors.push("Maximum fuselage width must be greater than zero.");

    if (errors.length) return { value: Number.NaN, source: "dimensions", errors };
    return {
      value: GeometryModel.calculateFuselageSlenderness(length, width),
      source: "dimensions",
      errors: []
    };
  }

  const direct = parseOptionalNumber(values.fuselageSlenderness);
  if (direct === undefined) {
    return {
      value: Number.NaN,
      source: "direct",
      errors: ["Fuselage slenderness ratio is required."]
    };
  }
  if (Number.isNaN(direct)) {
    return {
      value: Number.NaN,
      source: "direct",
      errors: ["Fuselage slenderness ratio must be a valid number."]
    };
  }
  if (direct <= 0) {
    return {
      value: direct,
      source: "direct",
      errors: ["Fuselage slenderness ratio must be greater than zero."]
    };
  }
  return { value: direct, source: "direct", errors: [] };
}

function validateForm(normalized) {
  const errors = [];
  const values = normalized.values;

  ["aircraftName", "manufacturer", "aircraftType"].forEach((field) => {
    if (!values[field]) errors.push(`${labels[field]} is required.`);
  });

  [
    ["mtow", "Maximum takeoff weight"],
    ["aspectRatio", "Wing aspect ratio"],
    ["liftToDragRatio", "Maximum lift-to-drag ratio"]
  ].forEach(([field, label]) => {
    const value = parseOptionalNumber(values[field]);
    if (value === undefined) errors.push(`${label} is required.`);
    else if (!Number.isFinite(value)) errors.push(`${label} must be a valid number.`);
    else if (value <= 0) errors.push(`${label} must be greater than zero.`);
  });

  if (values.actualFuelBurn) {
    const actual = parseOptionalNumber(values.actualFuelBurn);
    if (!Number.isFinite(actual)) errors.push("Measured cruise fuel burn must be a valid number when provided.");
    else if (actual <= 0) errors.push("Measured cruise fuel burn must be greater than zero when provided.");
  }

  errors.push(...normalized.slendernessErrors);

  if (!errors.length) {
    errors.push(...GeometryModel.validateRegressionInputs({
      mtowLb: normalized.mtowLb,
      aspectRatio: normalized.aspectRatio,
      liftToDragRatio: normalized.liftToDragRatio,
      fuselageSlenderness: normalized.fuselageSlenderness,
      actualFuelBurnGph: normalized.actualFuelBurnGph
    }));
  }

  return [...new Set(errors)];
}

function showErrors(errors) {
  errorBox.hidden = false;
  errorBox.innerHTML = `<ul>${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`;
}

function hideErrors() {
  errorBox.hidden = true;
  errorBox.textContent = "";
}

function clearForm() {
  form.reset();
  clearEditState();
  clearPresetSelection();
  hideErrors();
  updateSlendernessVisibility();
  renderLivePreview();
}

function clearEditState() {
  editingId = null;
  submitButton.innerHTML = `Add Aircraft <span aria-hidden="true">+</span>`;
  cancelEditButton.hidden = true;
}

function clearPresetSelection() {
  lockedPresetId = null;
  presetHoverSnapshot = null;
  form.classList.remove("is-preset-preview");
  updatePresetSelection();
}

function updatePresetSelection() {
  if (!popularAircraftList) return;
  popularAircraftList.querySelectorAll(".preset-aircraft").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.presetId === lockedPresetId);
  });
}

function updateSlendernessVisibility() {
  const mode = document.getElementById("slendernessMode")?.value || "direct";
  document.querySelectorAll("[data-slenderness-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.slendernessPanel !== mode;
  });

  const calculated = document.getElementById("calculatedSlenderness");
  if (!calculated) return;
  const values = getFormValues();
  const resolved = resolveFuselageSlenderness({ ...values, slendernessMode: "dimensions" });
  calculated.textContent = resolved.errors.length ? "--" : formatNumber(resolved.value, 3);
}

function renderAll() {
  latestScored = scoreAircraftList(aircraft);
  renderLivePreview();
  renderScoreStage(latestScored.rows);
  renderTable(latestScored.rows);
  renderInsights(latestScored.rows);
  drawCharts();
  updateUtilityButtons();
}

function renderLivePreview() {
  const normalized = buildNormalizedInput();
  const regressionInput = toRegressionInput(normalized);
  const errors = GeometryModel.validateRegressionInputs(regressionInput);

  if (errors.length || normalized.slendernessErrors.length) {
    liveMetrics.innerHTML = `
      ${metricMarkup("Geometry Score", "--", "/ 100")}
      ${metricMarkup("Predicted Fuel Burn", "--", "US gal/hr")}
      ${metricMarkup("Neutral Benchmark", "--", "US gal/hr")}
      ${metricMarkup("Fuel Ratio r", "--", "predicted / neutral")}
      ${metricMarkup("Wing Quality Q", "--", "combined AR and L/D")}
      ${metricMarkup("Geometry Improvement", "--", "same MTOW")}
    `;
    return;
  }

  const result = GeometryModel.calculateRegressionResult(regressionInput);
  const validationMarkup = result.fuelValidation
    ? metricMarkup("Fuel Validation", formatNumber(result.fuelValidation.score, 1), "/ 100")
    : "";
  const warnings = renderWarningList(result.extrapolationWarnings);
  const displayFuelUnit = normalized.values.fuelBurnUnit || "gph";

  liveMetrics.innerHTML = `
    ${metricMarkup("Geometry Score", formatNumber(result.geometryScore, 1), "/ 100")}
    ${metricMarkup("Predicted Fuel Burn", formatFuelBurn(result.predictedFuelBurnGph, displayFuelUnit), "regression estimate")}
    ${metricMarkup("Neutral Benchmark", formatFuelBurn(result.neutralFuelBurnGph, displayFuelUnit), "same-weight neutral")}
    ${metricMarkup("Fuel Ratio r", formatNumber(result.fuelRatio, 3), "predicted / neutral")}
    ${metricMarkup("Wing Quality Q", formatNumber(result.wingQualityTerm, 3), "combined AR and L/D")}
    ${metricMarkup("Geometry Improvement", `${formatSigned(result.geometryImprovementPercent, 1)}%`, "same MTOW")}
    ${validationMarkup}
    ${warnings}
  `;
}

function metricMarkup(label, value, unit) {
  return `
    <div class="metric-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <em>${escapeHtml(unit)}</em>
    </div>
  `;
}

function renderWarningList(warnings) {
  if (!warnings.length) return "";
  return `
    <div class="warning-box metric-warning">
      <strong>Extrapolation warning</strong>
      <ul>${warnings.map((warning) => `<li>${escapeHtml(warning.message)}</li>`).join("")}</ul>
    </div>
  `;
}

function toRegressionInput(normalized) {
  return {
    mtowLb: normalized.mtowLb,
    aspectRatio: normalized.aspectRatio,
    liftToDragRatio: normalized.liftToDragRatio,
    fuselageSlenderness: normalized.fuselageSlenderness,
    actualFuelBurnGph: normalized.actualFuelBurnGph
  };
}

function scoreAircraftList(list) {
  const rows = list
    .map((item) => {
      const normalized = buildNormalizedInput(item);
      const regressionInput = toRegressionInput(normalized);
      const errors = validateStoredRecord(normalized);
      if (errors.length) return { ...item, errors, result: null };
      return {
        ...item,
        mtowLb: normalized.mtowLb,
        fuselageSlendernessResolved: normalized.fuselageSlenderness,
        actualFuelBurnGph: normalized.actualFuelBurnGph,
        result: GeometryModel.calculateRegressionResult(regressionInput),
        errors: []
      };
    })
    .sort((a, b) => (b.result?.geometryScore || 0) - (a.result?.geometryScore || 0));

  return { rows };
}

function validateStoredRecord(normalized) {
  return [
    ...normalized.slendernessErrors,
    ...GeometryModel.validateRegressionInputs(toRegressionInput(normalized))
  ];
}

function renderScoreStage(rows) {
  const validRows = rows.filter((row) => row.result);
  if (!validRows.length) {
    scoreSummary.innerHTML = `
      <span class="section-kicker">Final Output</span>
      <h2>Geometry Efficiency Score</h2>
      <div class="empty-state">No aircraft data available yet.</div>
    `;
    scoreBreakdown.innerHTML = "";
    return;
  }

  const top = validRows[0];
  const result = top.result;
  const displayFuelUnit = top.fuelBurnUnit || "gph";
  scoreSummary.innerHTML = `
    <span class="section-kicker">Final Output</span>
    <h2>Geometry Efficiency Score</h2>
    <div class="score-aircraft">${escapeHtml(top.aircraftName)}</div>
    <div class="final-score">${formatNumber(result.geometryScore, 1)}<span>/100</span></div>
    <p><strong>${escapeHtml(result.interpretation)}</strong> is a calculator interpretation, not a certified industry classification. A score of 75 represents the neutral commercial-aircraft benchmark and should not be interpreted like a school grade.</p>
    <div class="score-scale" aria-label="Geometry score scale">
      <span>0</span>
      <div><i style="left: 75%" title="Neutral benchmark: 75"></i><b style="width: ${clamp(result.geometryScore, 0, 100)}%"></b></div>
      <span>100</span>
    </div>
    ${result.extrapolationWarnings.length ? renderScoreWarnings(result.extrapolationWarnings) : ""}
  `;

  scoreBreakdown.innerHTML = `
    <details class="calculation-details" open>
      <summary>How this was calculated</summary>
      <div>
        ${breakdownRow("Predicted fuel burn", formatFuelBurn(result.predictedFuelBurnGph, displayFuelUnit))}
        ${breakdownRow("Same-weight neutral benchmark", formatFuelBurn(result.neutralFuelBurnGph, displayFuelUnit))}
        ${breakdownRow("Predicted geometry fuel ratio r", formatNumber(result.fuelRatio, 3))}
        ${breakdownRow("Predicted geometry improvement", improvementSentence(result.geometryImprovementPercent))}
        ${breakdownRow("Wing-quality term Q", `${formatNumber(result.wingQualityTerm, 3)} - combines aspect ratio and L/D`)}
        ${breakdownRow("Normalized weight term", formatNumber(result.normalizedTerms.weight, 4))}
        ${breakdownRow("Normalized aspect-ratio term", formatNumber(result.normalizedTerms.aspectRatio, 4))}
        ${breakdownRow("Normalized L/D term", formatNumber(result.normalizedTerms.liftToDragRatio, 4))}
        ${breakdownRow("Normalized fuselage-slenderness term", formatNumber(result.normalizedTerms.fuselageSlenderness, 4))}
        ${breakdownRow("Final geometry score", `${formatNumber(result.geometryScore, 1)} / 100`)}
      </div>
    </details>
    ${result.fuelValidation ? renderFuelValidation(result.fuelValidation, displayFuelUnit) : ""}
  `;
}

function renderScoreWarnings(warnings) {
  return `
    <div class="warning-box score-warning">
      <strong>Extrapolation warning</strong>
      <p>This result is outside part of the 30-aircraft training range. Comparisons with similarly sized narrowbody aircraft are more defensible than comparisons spanning regional jets to the A380.</p>
      <ul>${warnings.map((warning) => `<li>${escapeHtml(warning.message)}</li>`).join("")}</ul>
    </div>
  `;
}

function breakdownRow(label, value) {
  return `
    <div class="breakdown-row detail-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderFuelValidation(validation, displayFuelUnit) {
  return `
    <div class="validation-card">
      <h4>Fuel Validation</h4>
      <p>This score compares reported fuel burn with the model prediction. It is not a second overall aircraft grade and is not included in the geometry rank because cruise conditions, payloads, routes, flight lengths, engine variants, and measurement methods may differ.</p>
      ${breakdownRow("Measured cruise fuel burn", formatFuelBurn(validation.actualFuelBurnGph, displayFuelUnit))}
      ${breakdownRow("Predicted cruise fuel burn", formatFuelBurn(validation.predictedFuelBurnGph, displayFuelUnit))}
      ${breakdownRow("Residual", `${formatSigned(validation.residualPercent, 1)}%`)}
      ${breakdownRow("Actual-vs-predicted fuel score", `${formatNumber(validation.score, 1)} / 100`)}
    </div>
  `;
}

function renderTable(rows) {
  if (!rows.length) {
    aircraftTableBody.innerHTML = `<tr><td colspan="11">No aircraft data available yet.</td></tr>`;
    return;
  }

  aircraftTableBody.innerHTML = rows.map((row, index) => {
    const result = row.result;
    return `
      <tr>
        <td class="rank-cell">${index + 1}</td>
        <td class="name-cell">
          <strong>${escapeHtml(row.aircraftName)}</strong>
          <span>${escapeHtml(row.manufacturer)} - ${escapeHtml(row.aircraftType)}</span>
        </td>
        <td>${formatNumber(row.mtowLb, 0)} lb</td>
        <td>${formatNumber(Number(row.aspectRatio), 3)}</td>
        <td>${formatNumber(Number(row.liftToDragRatio), 2)}</td>
        <td>${formatNumber(row.fuselageSlendernessResolved, 3)}</td>
        <td>${result ? `${formatNumber(result.predictedFuelBurnGph, 1)} gal/hr` : "--"}</td>
        <td>${result ? `${formatNumber(result.neutralFuelBurnGph, 1)} gal/hr` : "--"}</td>
        <td class="score-cell">${result ? formatNumber(result.geometryScore, 1) : "--"}</td>
        <td>${result?.fuelValidation ? formatNumber(result.fuelValidation.score, 1) : "Not supplied"}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-action="edit" data-id="${row.id}">Edit</button>
            <button type="button" data-action="delete" data-id="${row.id}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  aircraftTableBody.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.action === "edit") editAircraft(button.dataset.id);
      if (button.dataset.action === "delete") deleteAircraft(button.dataset.id);
    });
  });
}

function editAircraft(id) {
  const item = aircraft.find((entry) => entry.id === id);
  if (!item) return;

  setFormValues(item);
  editingId = id;
  clearPresetSelection();
  submitButton.textContent = "Update Aircraft";
  cancelEditButton.hidden = false;
  hideErrors();
  updateSlendernessVisibility();
  renderLivePreview();
  document.getElementById("analysis").scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteAircraft(id) {
  const item = aircraft.find((entry) => entry.id === id);
  if (!item) return;
  if (!window.confirm(`Delete ${item.aircraftName}?`)) return;

  aircraft = aircraft.filter((entry) => entry.id !== id);
  if (editingId === id) clearForm();
  saveAircraft();
  renderAll();
}

function renderInsights(rows) {
  const validRows = rows.filter((row) => row.result);
  if (!validRows.length) {
    insightsList.innerHTML = `<div class="empty-state">No aircraft data available yet.</div>`;
    return;
  }

  const top = validRows[0];
  const insights = [
    `${top.aircraftName} leads the current list by Geometry Efficiency Score, which compares geometry against a same-weight neutral aircraft.`,
    improvementSentence(top.result.geometryImprovementPercent),
    "Most of the model's statistical accuracy comes from aircraft weight; geometry terms should be read as preliminary relationships, not proof of causation.",
    top.result.extrapolationWarnings.length
      ? "At least one input is outside the training range, so this result is an extrapolation."
      : "The top aircraft's major model inputs sit within the approximate 30-aircraft training ranges."
  ];

  insightsList.innerHTML = insights.map((insight, index) => `
    <article>
      <span>${String(index + 1).padStart(2, "0")}</span>
      <p>${escapeHtml(insight)}</p>
    </article>
  `).join("");
}

function drawCharts() {
  const rows = latestScored.rows.filter((row) => row.result);
  drawBarChart("finalScoreChart", rows, (item) => item.result.geometryScore, 100, "Geometry Score");
  drawBarChart("compositeScoreChart", rows, (item) => item.result.predictedFuelBurnGph, null, "Predicted Fuel Burn");
  drawScatterChart("glideFuelChart", rows, (item) => item.result.wingQualityTerm, (item) => item.result.geometryScore, "Wing Quality Q", "Geometry Score");
  drawScatterChart("wingFinalChart", rows, (item) => item.mtowLb, (item) => item.result.predictedFuelBurnGph, "MTOW", "Predicted Fuel Burn");
  drawScatterChart("co2FinalChart", rows, (item) => item.fuselageSlendernessResolved, (item) => item.result.geometryScore, "Fuselage Slenderness", "Geometry Score");
}

function drawBarChart(canvasId, rows, accessor, forcedMax, valueLabel) {
  const canvas = document.getElementById(canvasId);
  const { ctx, width, height } = prepareCanvas(canvas);
  clearCanvas(ctx, width, height);

  if (!rows.length) {
    drawEmpty(ctx, width, height);
    return;
  }

  const values = rows.map(accessor);
  const maxValue = forcedMax || Math.max(...values) * 1.12 || 1;
  const margin = { top: 34, right: 26, bottom: 82, left: 58 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const gap = Math.max(12, chartWidth * 0.025);
  const barWidth = Math.max(18, (chartWidth - gap * (rows.length - 1)) / rows.length);

  drawGrid(ctx, margin, width, height, 0, maxValue);

  rows.forEach((row, index) => {
    const value = accessor(row);
    const x = margin.left + index * (barWidth + gap);
    const h = (value / maxValue) * chartHeight;
    const y = margin.top + chartHeight - h;
    ctx.fillStyle = valueLabel.includes("Score") ? scoreColor(row.result.geometryScore) : "#8fdcff";
    ctx.fillRect(x, y, barWidth, h);
    ctx.fillStyle = "#f6fff8";
    ctx.font = "600 13px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(formatNumber(value, valueLabel.includes("Fuel") ? 0 : 1), x + barWidth / 2, y - 8);
    ctx.save();
    ctx.translate(x + barWidth / 2, height - 22);
    ctx.rotate(-Math.PI / 5);
    ctx.fillStyle = "#b9c2bd";
    ctx.font = "500 12px Inter, sans-serif";
    ctx.fillText(shortName(row.aircraftName), 0, 0);
    ctx.restore();
  });
}

function drawScatterChart(canvasId, rows, xAccessor, yAccessor, xLabel, yLabel) {
  const canvas = document.getElementById(canvasId);
  const { ctx, width, height } = prepareCanvas(canvas);
  clearCanvas(ctx, width, height);

  if (!rows.length) {
    drawEmpty(ctx, width, height);
    return;
  }

  const margin = { top: 28, right: 30, bottom: 58, left: 62 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const xValues = rows.map(xAccessor);
  const yValues = rows.map(yAccessor);
  const xRange = paddedRange(Math.min(...xValues), Math.max(...xValues));
  const yRange = paddedRange(Math.min(...yValues), Math.max(...yValues), yLabel.includes("Score") ? [0, 100] : null);

  drawGrid(ctx, margin, width, height, yRange.min, yRange.max);
  drawAxisLabels(ctx, width, height, xLabel, yLabel);

  rows.forEach((row, index) => {
    const x = margin.left + ((xAccessor(row) - xRange.min) / (xRange.max - xRange.min)) * chartWidth;
    const y = margin.top + chartHeight - ((yAccessor(row) - yRange.min) / (yRange.max - yRange.min)) * chartHeight;
    ctx.beginPath();
    ctx.arc(x, y, index === 0 ? 7 : 5.5, 0, Math.PI * 2);
    ctx.fillStyle = scoreColor(row.result.geometryScore);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.82)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#eef7f1";
    ctx.font = "500 11px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(shortName(row.aircraftName), x + 9, y - 8);
  });
}

function prepareCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}

function clearCanvas(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
}

function drawEmpty(ctx, width, height) {
  ctx.fillStyle = "#a7aaa7";
  ctx.font = "500 14px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("No aircraft data available yet.", width / 2, height / 2);
}

function drawGrid(ctx, margin, width, height, minY, maxY) {
  const chartHeight = height - margin.top - margin.bottom;
  const chartWidth = width - margin.left - margin.right;
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#8e9691";
  ctx.font = "11px Inter, sans-serif";
  ctx.textAlign = "right";

  for (let i = 0; i <= 4; i += 1) {
    const y = margin.top + (chartHeight / 4) * i;
    const value = maxY - ((maxY - minY) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(margin.left + chartWidth, y);
    ctx.stroke();
    ctx.fillText(formatNumber(value, 0), margin.left - 10, y + 4);
  }
}

function drawAxisLabels(ctx, width, height, xLabel, yLabel) {
  ctx.fillStyle = "#cbd3ce";
  ctx.font = "600 12px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(xLabel, width / 2, height - 14);
  ctx.save();
  ctx.translate(16, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
}

function exportCsv() {
  if (!latestScored.rows.length) return;
  const headers = [
    "Rank",
    "Aircraft Name",
    "MTOW lb",
    "Aspect Ratio",
    "Lift-to-Drag Ratio",
    "Fuselage Slenderness",
    "Wing Quality Q",
    "Predicted Fuel Burn gal/hr",
    "Neutral Fuel Burn gal/hr",
    "Fuel Ratio",
    "Geometry Improvement Percent",
    "Geometry Efficiency Score",
    "Fuel Validation"
  ];
  const rows = latestScored.rows.filter((row) => row.result).map((row, index) => [
    index + 1,
    row.aircraftName,
    row.mtowLb,
    row.aspectRatio,
    row.liftToDragRatio,
    row.fuselageSlendernessResolved,
    row.result.wingQualityTerm,
    row.result.predictedFuelBurnGph,
    row.result.neutralFuelBurnGph,
    row.result.fuelRatio,
    row.result.geometryImprovementPercent,
    row.result.geometryScore,
    row.result.fuelValidation?.score ?? ""
  ]);
  const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
  downloadFile("pristine-skies-geometry-results.csv", csv, "text/csv");
}

function downloadJson() {
  if (!latestScored.rows.length) return;
  downloadFile("pristine-skies-geometry-results.json", JSON.stringify({
    project: "Pristine Skies",
    modelVersion: GeometryModel.MODEL_CONSTANTS.MODEL_VERSION,
    generatedAt: new Date().toISOString(),
    aircraft: latestScored.rows
  }, null, 2), "application/json");
}

function resetAircraft() {
  if (!aircraft.length) return;
  if (!window.confirm("Reset all aircraft data?")) return;
  aircraft = [];
  saveAircraft();
  clearForm();
  renderAll();
}

function updateUtilityButtons() {
  const disabled = latestScored.rows.length === 0;
  document.getElementById("exportCsvButton").disabled = disabled;
  document.getElementById("downloadJsonButton").disabled = disabled;
  document.getElementById("resetButton").disabled = disabled;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function saveAircraft() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(aircraft));
}

function loadAircraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter(isGeometryAircraftRecord) : [];
  } catch {
    return [];
  }
}

function isGeometryAircraftRecord(item) {
  return item && fieldIds.every((field) => Object.prototype.hasOwnProperty.call(item, field));
}

function improvementSentence(percent) {
  if (percent >= 0) {
    return `The entered geometry is predicted to require ${formatNumber(percent, 1)}% less fuel than the neutral geometry at the same MTOW.`;
  }
  return `The entered geometry is predicted to require ${formatNumber(Math.abs(percent), 1)}% more fuel than the neutral geometry at the same MTOW.`;
}

function scoreColor(score) {
  if (score < 40) return "#bf5a5a";
  if (score < 55) return "#d28b54";
  if (score < 70) return "#d4c867";
  if (score < 80) return "#a7d86d";
  return "#8fdcff";
}

function paddedRange(min, max, forced) {
  if (forced) return { min: forced[0], max: forced[1] };
  if (min === max) return { min: min * 0.9, max: max * 1.1 || 1 };
  const padding = (max - min) * 0.14;
  return { min: Math.max(0, min - padding), max: max + padding };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundForInput(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function formatNumber(value, decimals = 2) {
  if (!Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

function formatSigned(value, decimals = 1) {
  if (!Number.isFinite(value)) return "--";
  const formatted = formatNumber(Math.abs(value), decimals);
  return value > 0 ? `+${formatted}` : value < 0 ? `-${formatted}` : formatted;
}

function formatFuelBurn(gallonsPerHour, displayUnit = "gph") {
  if (!Number.isFinite(gallonsPerHour) || gallonsPerHour <= 0) return "--";
  const gallons = `${formatNumber(gallonsPerHour, 1)} gal/hr`;
  if (displayUnit === "lph") {
    return `${gallons} (${formatNumber(GeometryModel.gallonsToLiters(gallonsPerHour), 1)} liters/hr)`;
  }
  return gallons;
}

function shortName(name) {
  return name.length > 18 ? `${name.slice(0, 16)}...` : name;
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `aircraft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function debounce(callback, delay) {
  let timeout;
  return (...args) => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => callback(...args), delay);
  };
}
