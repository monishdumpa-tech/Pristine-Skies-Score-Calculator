"use strict";

const STORAGE_KEY = "pristine-skies-aircraft-v1";
const EXPONENTIAL_MAX = Math.exp(0.3 * 10);
const GUESSING_MIN = -20;
const GUESSING_MAX = 6;

const conversions = [
  ["Fuel to CO₂", "1 gallon jet fuel = 9.57 kg CO₂", "fuel"],
  ["Mass", "1 kg = 2.20462 lb", "mass"],
  ["Distance", "1 mile = 1.60934 km", "distance"],
  ["Aviation Distance", "1 nautical mile = 1.15078 miles", "distance"],
  ["Volume", "1 gallon = 3.78541 liters", "fuel"],
  ["Volume", "1 liter = 0.264172 gallons", "fuel"],
  ["Area", "1 square meter = 10.7639 square feet", "area"],
  ["Mass", "1 pound = 0.453592 kg", "mass"],
  ["Passenger-Mile", "1 passenger-mile = passenger × miles", "passenger"],
  ["Wing Loading", "Wing loading = aircraft weight / wing area", "wing"],
  ["Fuel per Passenger", "Fuel per passenger = total fuel burn / number of passengers", "fuel"],
  ["Fuel per Passenger-Mile", "Fuel per passenger-mile = total fuel burn / passenger-miles", "fuel"]
];

const sampleAircraft = [
  {
    id: "sample-a320",
    sample: true,
    aircraftName: "Airbus A320",
    glideRatio: 17,
    fuelBurn: 11.2,
    range: 3900,
    passengerCapacity: 180,
    aircraftWeight: 169750,
    wingArea: 1320,
    cruiseSpeed: 515,
    co2Output: 107,
    difficultyRating: 6,
    validDesign: "yes",
    wrongDesignCount: 1
  },
  {
    id: "sample-737-800",
    sample: true,
    aircraftName: "Boeing 737-800",
    glideRatio: 16.5,
    fuelBurn: 11.6,
    range: 3585,
    passengerCapacity: 189,
    aircraftWeight: 174200,
    wingArea: 1341,
    cruiseSpeed: 514,
    co2Output: 111,
    difficultyRating: 6.2,
    validDesign: "yes",
    wrongDesignCount: 1
  },
  {
    id: "sample-787-9",
    sample: true,
    aircraftName: "Boeing 787-9",
    glideRatio: 20,
    fuelBurn: 9.4,
    range: 8786,
    passengerCapacity: 290,
    aircraftWeight: 560000,
    wingArea: 3770,
    cruiseSpeed: 561,
    co2Output: 90,
    difficultyRating: 8.5,
    validDesign: "yes",
    wrongDesignCount: 0
  },
  {
    id: "sample-a350-900",
    sample: true,
    aircraftName: "Airbus A350-900",
    glideRatio: 21,
    fuelBurn: 9.1,
    range: 9320,
    passengerCapacity: 325,
    aircraftWeight: 617300,
    wingArea: 4768,
    cruiseSpeed: 561,
    co2Output: 86,
    difficultyRating: 8.8,
    validDesign: "yes",
    wrongDesignCount: 0
  },
  {
    id: "sample-a220-300",
    sample: true,
    aircraftName: "Airbus A220-300",
    glideRatio: 18.5,
    fuelBurn: 8.9,
    range: 3900,
    passengerCapacity: 145,
    aircraftWeight: 156000,
    wingArea: 1209,
    cruiseSpeed: 541,
    co2Output: 82,
    difficultyRating: 7.4,
    validDesign: "yes",
    wrongDesignCount: 0
  }
];

const formulaCards = [
  {
    title: "Wing Loading",
    formula: "wingLoading = aircraftWeight / wingArea",
    measures: "How much aircraft weight each square foot of wing must support.",
    matters: "Lower wing loading often supports better low-speed handling and efficient lift.",
    affects: "It feeds the sustainability index and composite score. Lower wing loading improves the wing-loading portion of the composite score.",
    direction: "Lower is usually better for this model."
  },
  {
    title: "Sustainability Index",
    formula: "sustainabilityIndex = (glideRatio × passengerCapacity × range) / (fuelBurn × co2Output × wingLoading)",
    measures: "A combined efficiency value that rewards lift performance, passenger movement, and range while penalizing fuel burn, CO₂, and wing loading.",
    matters: "It acts like the core skill signal for the aircraft before tournament-style scoring is applied.",
    affects: "It drives the logistic score and power score.",
    direction: "Higher is better."
  },
  {
    title: "Difficulty Weighted Score",
    formula: "difficultyWeightedScore = correctValue × difficultyRating²",
    measures: "How much credit a valid design earns for attempting a difficult engineering target.",
    matters: "Squaring difficulty gives harder valid designs a larger reward.",
    affects: "This score is normalized to 0-100 and contributes 20% of the final score.",
    direction: "Higher is better, but invalid designs receive 0."
  },
  {
    title: "Exponential Difficulty Score",
    formula: "exponentialScore = correctValue × e^(0.3 × difficultyRating)",
    measures: "A steeper reward curve for valid designs as difficulty increases.",
    matters: "It separates very difficult valid designs more strongly than a linear score.",
    affects: "This score is normalized to 0-100 and contributes 15% of the final score.",
    direction: "Higher is better, but invalid designs receive 0."
  },
  {
    title: "Guessing Penalty Score",
    formula: "guessingPenaltyScore = 6 × correctValue - 2 × wrongDesignCount",
    measures: "A validity bonus with penalties for failed or inefficient design features.",
    matters: "It discourages adding many weak design claims just to chase points.",
    affects: "This score is normalized to 0-100 and contributes 10% of the final score.",
    direction: "Higher is better. More failed features lower the score."
  },
  {
    title: "Logistic Design Quality Score",
    formula: "normalizedSkill = skill / (skill + 100); logisticScoreFinal = 100 / (1 + e^-((normalizedSkill × 10 - difficultyRating)))",
    measures: "How well the sustainability index clears the selected design difficulty.",
    matters: "The S-curve makes the score change smoothly, then flatten near the extremes.",
    affects: "It contributes 15% of the final score.",
    direction: "Higher is better."
  },
  {
    title: "Power Score",
    formula: "powerScore = 100 × (sustainabilityIndex / bestSustainabilityIndex)³",
    measures: "How close the aircraft is to the best sustainability index in the dataset.",
    matters: "Cubing the ratio makes top sustainability designs stand out dramatically.",
    affects: "It is shown as a supporting tournament metric and helps explain separation.",
    direction: "Higher is better."
  },
  {
    title: "Composite Aerospace Score",
    formula: "100 × [0.30G_n² + 0.20R_n + 0.15P_n + 0.15(1-F_n)² + 0.10(1-W_n)² + 0.10(1-C_n)²]",
    measures: "A weighted aircraft efficiency score using normalized glide, range, passenger capacity, fuel burn, wing loading, and CO₂.",
    matters: "It balances performance and environmental efficiency in one score.",
    affects: "It contributes 25% of the final score and also powers the elite score.",
    direction: "Higher is better."
  },
  {
    title: "Elite Tournament Separation Score",
    formula: "eliteScore = 100 × (compositeScore / 100)³",
    measures: "A power-scaled version of the composite score.",
    matters: "It compresses average designs and makes elite designs stand apart.",
    affects: "It contributes 15% of the final score.",
    direction: "Higher is better."
  },
  {
    title: "Final Pristine Skies Score",
    formula: "0.20D + 0.15E + 0.10G + 0.15L + 0.25C + 0.15T",
    measures: "The final blend of difficulty, exponential reward, penalty control, logistic quality, composite efficiency, and elite separation.",
    matters: "This is the headline tournament ranking score.",
    affects: "Aircraft are ranked from highest to lowest by this score.",
    direction: "Higher is better."
  },
  {
    title: "Final Score Z-Score",
    formula: "z = (finalScore - datasetMean) / datasetStandardDeviation",
    measures: "How far an aircraft's final score sits above or below the group average.",
    matters: "It helps compare tournament separation when several aircraft are loaded.",
    affects: "It is displayed for context and does not change the final score.",
    direction: "Higher is better than the dataset average."
  }
];

const fieldIds = [
  "aircraftName",
  "glideRatio",
  "fuelBurn",
  "range",
  "passengerCapacity",
  "aircraftWeight",
  "wingArea",
  "cruiseSpeed",
  "co2Output",
  "difficultyRating",
  "validDesign",
  "wrongDesignCount"
];

const numericFields = fieldIds.filter((field) => !["aircraftName", "validDesign"].includes(field));
const form = document.getElementById("aircraftForm");
const formTitle = document.getElementById("formTitle");
const submitButton = document.getElementById("submitButton");
const cancelEditButton = document.getElementById("cancelEditButton");
const errorBox = document.getElementById("errorBox");
const aircraftTableBody = document.getElementById("aircraftTableBody");
const derivedMetrics = document.getElementById("derivedMetrics");
const singleAircraftNote = document.getElementById("singleAircraftNote");
const normalizationPanel = document.getElementById("normalizationPanel");

let aircraft = loadAircraft();
let editingId = null;
let latestScored = { rows: [], baselines: getEmptyBaselines() };

initialize();

function initialize() {
  renderConversionChart();
  renderFormulaCards();
  bindEvents();
  renderAll();
}

function bindEvents() {
  form.addEventListener("submit", handleSubmit);
  form.addEventListener("input", renderDerivedPreview);
  form.addEventListener("change", renderDerivedPreview);
  cancelEditButton.addEventListener("click", clearForm);
  document.getElementById("loadExamplesButton").addEventListener("click", loadExampleAircraft);
  document.getElementById("exportCsvButton").addEventListener("click", exportCsv);
  document.getElementById("downloadJsonButton").addEventListener("click", downloadJson);
  document.getElementById("resetButton").addEventListener("click", resetAllAircraft);
  window.addEventListener("resize", debounce(drawCharts, 120));
}

function renderAll() {
  latestScored = scoreAircraftList(aircraft);
  renderTable(latestScored.rows);
  renderNormalizationPanel(latestScored.baselines);
  renderDerivedPreview();
  drawCharts();
  updateExportButtons();
}

function renderConversionChart() {
  document.getElementById("conversionList").innerHTML = conversions.map(([title, text, icon]) => `
    <div class="conversion-item">
      <div class="conversion-icon" aria-hidden="true">${getIcon(icon)}</div>
      <div>
        <strong>${title}</strong>
        <span>${text}</span>
      </div>
    </div>
  `).join("");
}

function renderFormulaCards() {
  document.getElementById("formulaCards").innerHTML = formulaCards.map((card, index) => `
    <details class="formula-card" ${index < 2 ? "open" : ""}>
      <summary>${card.title}</summary>
      <div class="formula-body">
        <code>${card.formula}</code>
        <p><strong>What it measures:</strong> ${card.measures}</p>
        <p><strong>Why it matters:</strong> ${card.matters}</p>
        <p><strong>Final score effect:</strong> ${card.affects}</p>
        <p><strong>Better direction:</strong> ${card.direction}</p>
      </div>
    </details>
  `).join("");
}

function handleSubmit(event) {
  event.preventDefault();
  const values = getFormValues();
  const errors = validateAircraft(values);

  if (errors.length) {
    showErrors(errors);
    return;
  }

  hideErrors();
  const record = {
    ...values,
    id: editingId || createId(),
    sample: false
  };

  if (editingId) {
    aircraft = aircraft.map((item) => item.id === editingId ? record : item);
  } else {
    aircraft = [...aircraft, record];
  }

  saveAircraft();
  clearForm();
  renderAll();
}

function getFormValues() {
  const values = {};
  fieldIds.forEach((id) => {
    const element = document.getElementById(id);
    values[id] = numericFields.includes(id) ? Number(element.value) : element.value.trim();
  });
  values.validDesign = document.getElementById("validDesign").value;
  return values;
}

function validateAircraft(values, options = {}) {
  const errors = [];

  if (!options.allowBlankName && !values.aircraftName) {
    errors.push("Aircraft name is required.");
  }

  numericFields.forEach((field) => {
    if (!Number.isFinite(values[field])) {
      errors.push(`${labelFor(field)} must be a valid number.`);
    } else if (values[field] < 0) {
      errors.push(`${labelFor(field)} cannot be negative.`);
    }
  });

  if (Number.isFinite(values.glideRatio) && values.glideRatio <= 0) {
    errors.push("Glide ratio must be greater than 0.");
  }
  if (Number.isFinite(values.fuelBurn) && values.fuelBurn <= 0) {
    errors.push("Fuel burn cannot be zero. Enter gallons per passenger.");
  }
  if (Number.isFinite(values.range) && values.range <= 0) {
    errors.push("Range must be positive.");
  }
  if (Number.isFinite(values.passengerCapacity) && values.passengerCapacity <= 0) {
    errors.push("Passenger capacity must be positive.");
  }
  if (Number.isFinite(values.aircraftWeight) && values.aircraftWeight <= 0) {
    errors.push("Aircraft weight must be greater than 0 so wing loading can be calculated.");
  }
  if (Number.isFinite(values.wingArea) && values.wingArea <= 0) {
    errors.push("Wing area cannot be zero.");
  }
  if (Number.isFinite(values.cruiseSpeed) && values.cruiseSpeed <= 0) {
    errors.push("Cruise speed must be greater than 0.");
  }
  if (Number.isFinite(values.co2Output) && values.co2Output <= 0) {
    errors.push("CO₂ output cannot be zero. Enter kg per passenger.");
  }
  if (Number.isFinite(values.difficultyRating) && (values.difficultyRating < 1 || values.difficultyRating > 10)) {
    errors.push("Difficulty rating must be between 1 and 10.");
  }
  if (Number.isFinite(values.wrongDesignCount) && !Number.isInteger(values.wrongDesignCount)) {
    errors.push("Wrong/failed design count must be a whole number.");
  }
  if (!["yes", "no"].includes(values.validDesign)) {
    errors.push("Correct/valid design must be yes or no.");
  }

  return [...new Set(errors)];
}

function showErrors(errors) {
  errorBox.hidden = false;
  errorBox.innerHTML = `<ul>${errors.map((error) => `<li>${error}</li>`).join("")}</ul>`;
}

function hideErrors() {
  errorBox.hidden = true;
  errorBox.textContent = "";
}

function clearForm() {
  form.reset();
  document.getElementById("wrongDesignCount").value = "0";
  document.getElementById("validDesign").value = "yes";
  editingId = null;
  formTitle.textContent = "Add Aircraft";
  submitButton.querySelector("span").textContent = "Add Aircraft";
  cancelEditButton.hidden = true;
  hideErrors();
  renderDerivedPreview();
}

function editAircraft(id) {
  const item = aircraft.find((entry) => entry.id === id);
  if (!item) return;

  fieldIds.forEach((field) => {
    document.getElementById(field).value = item[field];
  });

  editingId = id;
  formTitle.textContent = "Edit Aircraft";
  submitButton.querySelector("span").textContent = "Update Aircraft";
  cancelEditButton.hidden = false;
  hideErrors();
  renderDerivedPreview();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteAircraft(id) {
  const item = aircraft.find((entry) => entry.id === id);
  if (!item) return;
  const shouldDelete = window.confirm(`Delete ${item.aircraftName}?`);
  if (!shouldDelete) return;

  aircraft = aircraft.filter((entry) => entry.id !== id);
  if (editingId === id) clearForm();
  saveAircraft();
  renderAll();
}

function loadExampleAircraft() {
  const shouldReplace = aircraft.length === 0 || window.confirm("Replace current aircraft with sample estimates?");
  if (!shouldReplace) return;

  aircraft = sampleAircraft.map((item) => ({ ...item, id: `${item.id}-${Date.now()}` }));
  saveAircraft();
  clearForm();
  renderAll();
}

function resetAllAircraft() {
  if (aircraft.length === 0) return;
  const shouldReset = window.confirm("Reset all aircraft data?");
  if (!shouldReset) return;

  aircraft = [];
  saveAircraft();
  clearForm();
  renderAll();
}

function renderTable(rows) {
  if (rows.length === 0) {
    aircraftTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="12">No aircraft yet. Add an aircraft or load sample estimates to begin comparing scores.</td>
      </tr>
    `;
    return;
  }

  aircraftTableBody.innerHTML = rows.map((row, index) => `
    <tr>
      <td class="rank-cell">#${index + 1}</td>
      <td class="name-cell">
        ${escapeHtml(row.aircraftName)}
        ${row.sample ? `<span class="sample-badge">Sample Estimate</span>` : ""}
      </td>
      <td>${formatNumber(row.glideRatio, 2)}</td>
      <td>${formatNumber(row.fuelBurn, 2)} gal/passenger</td>
      <td>${formatNumber(row.range, 0)} mi</td>
      <td>${formatNumber(row.passengerCapacity, 0)}</td>
      <td>${formatNumber(row.derived.wingLoading, 2)} lb/ft²</td>
      <td>${formatNumber(row.co2Output, 2)} kg/passenger</td>
      <td>${formatNumber(row.scores.compositeScore, 2)}</td>
      <td>${formatNumber(row.scores.eliteScore, 2)}</td>
      <td class="score-cell">${formatNumber(row.scores.finalScore, 2)}</td>
      <td>
        <div class="row-actions">
          <button class="row-button" type="button" title="Edit ${escapeHtml(row.aircraftName)}" aria-label="Edit ${escapeHtml(row.aircraftName)}" data-action="edit" data-id="${row.id}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.7-1 10-10a2.2 2.2 0 0 0-3.1-3.1l-10 10L4 20Z"/><path d="m14 7 3 3"/></svg>
          </button>
          <button class="row-button" type="button" title="Delete ${escapeHtml(row.aircraftName)}" aria-label="Delete ${escapeHtml(row.aircraftName)}" data-action="delete" data-id="${row.id}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m7 6 1 14h8l1-14"/><path d="M10 11v5M14 11v5"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join("");

  aircraftTableBody.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      const id = button.dataset.id;
      if (action === "edit") editAircraft(id);
      if (action === "delete") deleteAircraft(id);
    });
  });
}

function renderNormalizationPanel(baselines) {
  const stats = [
    ["Best Glide Ratio", baselines.bestGlideRatio, ""],
    ["Best Range", baselines.bestRange, "mi"],
    ["Best Capacity", baselines.bestPassengerCapacity, "passengers"],
    ["Worst Fuel Burn", baselines.worstFuelBurn, "gal/passenger"],
    ["Worst Wing Loading", baselines.worstWingLoading, "lb/ft²"],
    ["Worst CO₂ Output", baselines.worstCO2Output, "kg/passenger"]
  ];

  normalizationPanel.innerHTML = stats.map(([label, value, unit]) => `
    <div class="normalization-stat">
      <span>${label}</span>
      <strong>${value > 0 ? `${formatNumber(value, 2)} ${unit}`.trim() : "No data"}</strong>
    </div>
  `).join("");
}

function renderDerivedPreview() {
  const values = getFormValues();
  const canCompute = validateAircraft({ ...values, aircraftName: values.aircraftName || "Preview" }, { allowBlankName: true }).length === 0;

  if (!canCompute) {
    derivedMetrics.innerHTML = getMetricCards([
      ["Wing Loading", "--", "lb/ft²"],
      ["Fuel Efficiency Score", "--", "1 / gallons"],
      ["CO₂ Efficiency Score", "--", "1 / kg"],
      ["Passenger Range Value", "--", "passenger-miles"],
      ["Sustainability Index", "--", "higher is better"],
      ["Final Pristine Skies Score", "--", "0-100"]
    ]);
    singleAircraftNote.textContent = "Complete all required numeric fields with positive values to preview derived metrics.";
    return;
  }

  const previewId = editingId || "preview-aircraft";
  const previewRecord = {
    ...values,
    aircraftName: values.aircraftName || "Preview Aircraft",
    id: previewId,
    sample: false
  };

  const comparisonSet = editingId
    ? aircraft.map((item) => item.id === editingId ? previewRecord : item)
    : [...aircraft, previewRecord];

  const scored = scoreAircraftList(comparisonSet);
  const preview = scored.rows.find((row) => row.id === previewId);

  if (!preview) return;

  derivedMetrics.innerHTML = getMetricCards([
    ["Wing Loading", formatNumber(preview.derived.wingLoading, 2), "lb/ft²"],
    ["Fuel Efficiency Score", formatNumber(preview.derived.fuelEfficiency, 4), "1 / gallons"],
    ["CO₂ Efficiency Score", formatNumber(preview.derived.co2Efficiency, 4), "1 / kg"],
    ["Passenger Range Value", formatNumber(preview.derived.passengerRange, 0), "passenger-miles"],
    ["Sustainability Index", formatNumber(preview.derived.sustainabilityIndex, 3), "higher is better"],
    ["Difficulty Weighted", formatNumber(preview.scores.difficultyWeightedScore, 2), "raw"],
    ["Exponential Difficulty", formatNumber(preview.scores.exponentialScore, 2), "raw"],
    ["Guessing Penalty", formatNumber(preview.scores.guessingPenaltyScore, 2), "raw"],
    ["Logistic Quality", formatNumber(preview.scores.logisticScoreFinal, 2), "0-100"],
    ["Power Score", formatNumber(preview.scores.powerScore, 2), "0-100"],
    ["Composite Aerospace", formatNumber(preview.scores.compositeScore, 2), "0-100"],
    ["Elite Separation", formatNumber(preview.scores.eliteScore, 2), "0-100"],
    ["Final Pristine Skies", formatNumber(preview.scores.finalScore, 2), "0-100", true],
    ["Final Score Z-Score", formatNumber(preview.scores.zScore, 2), "dataset context"]
  ]);

  singleAircraftNote.textContent = comparisonSet.length < 2
    ? "Comparison warning: power, composite, and z-score values are more meaningful with multiple aircraft."
    : "Preview scores use the current dataset normalization values.";
}

function getMetricCards(metrics) {
  return metrics.map(([label, value, unit, accent]) => `
    <div class="metric ${accent ? "accent" : ""}">
      <span>${label}</span>
      <strong>${value}</strong>
      <span>${unit}</span>
    </div>
  `).join("");
}

function scoreAircraftList(list) {
  const derivedRows = list.map((item) => ({
    ...item,
    derived: calculateDerivedMetrics(item)
  }));

  const baselines = calculateBaselines(derivedRows);
  const rowsWithScores = derivedRows.map((item) => ({
    ...item,
    scores: calculateScores(item, baselines)
  }));

  const mean = rowsWithScores.length
    ? rowsWithScores.reduce((sum, item) => sum + item.scores.finalScore, 0) / rowsWithScores.length
    : 0;
  const variance = rowsWithScores.length
    ? rowsWithScores.reduce((sum, item) => sum + Math.pow(item.scores.finalScore - mean, 2), 0) / rowsWithScores.length
    : 0;
  const standardDeviation = Math.sqrt(variance);

  const rows = rowsWithScores
    .map((item) => ({
      ...item,
      scores: {
        ...item.scores,
        zScore: standardDeviation > 0 ? (item.scores.finalScore - mean) / standardDeviation : 0
      }
    }))
    .sort((a, b) => b.scores.finalScore - a.scores.finalScore);

  return { rows, baselines: { ...baselines, mean, standardDeviation } };
}

function calculateDerivedMetrics(item) {
  const wingLoading = item.aircraftWeight / item.wingArea;
  const fuelEfficiency = 1 / item.fuelBurn;
  const co2Efficiency = 1 / item.co2Output;
  const passengerRange = item.passengerCapacity * item.range;
  const sustainabilityIndex = (item.glideRatio * item.passengerCapacity * item.range) /
    (item.fuelBurn * item.co2Output * wingLoading);

  return {
    wingLoading,
    fuelEfficiency,
    co2Efficiency,
    passengerRange,
    sustainabilityIndex
  };
}

function calculateBaselines(rows) {
  if (rows.length === 0) return getEmptyBaselines();

  return {
    bestSustainabilityIndex: maxValue(rows, (item) => item.derived.sustainabilityIndex),
    bestGlideRatio: maxValue(rows, (item) => item.glideRatio),
    bestRange: maxValue(rows, (item) => item.range),
    bestPassengerCapacity: maxValue(rows, (item) => item.passengerCapacity),
    worstFuelBurn: maxValue(rows, (item) => item.fuelBurn),
    worstWingLoading: maxValue(rows, (item) => item.derived.wingLoading),
    worstCO2Output: maxValue(rows, (item) => item.co2Output)
  };
}

function calculateScores(item, baselines) {
  const correctValue = item.validDesign === "yes" ? 1 : 0;
  const difficultyWeightedScore = correctValue * Math.pow(item.difficultyRating, 2);
  const exponentialScore = correctValue * Math.exp(0.3 * item.difficultyRating);
  const guessingPenaltyScore = 6 * correctValue - 2 * item.wrongDesignCount;
  const normalizedSkill = item.derived.sustainabilityIndex / (item.derived.sustainabilityIndex + 100);
  const logisticScore = 1 / (1 + Math.exp(-((normalizedSkill * 10) - item.difficultyRating)));
  const logisticScoreFinal = logisticScore * 100;
  const powerScore = baselines.bestSustainabilityIndex > 0
    ? clamp(100 * Math.pow(item.derived.sustainabilityIndex / baselines.bestSustainabilityIndex, 3), 0, 100)
    : 0;

  const G_n = clampRatio(item.glideRatio, baselines.bestGlideRatio);
  const R_n = clampRatio(item.range, baselines.bestRange);
  const P_n = clampRatio(item.passengerCapacity, baselines.bestPassengerCapacity);
  const F_n = clampRatio(item.fuelBurn, baselines.worstFuelBurn);
  const W_n = clampRatio(item.derived.wingLoading, baselines.worstWingLoading);
  const C_n = clampRatio(item.co2Output, baselines.worstCO2Output);

  const compositeScore = clamp(100 * (
    0.30 * Math.pow(G_n, 2) +
    0.20 * R_n +
    0.15 * P_n +
    0.15 * Math.pow(1 - F_n, 2) +
    0.10 * Math.pow(1 - W_n, 2) +
    0.10 * Math.pow(1 - C_n, 2)
  ), 0, 100);

  const eliteScore = clamp(100 * Math.pow(compositeScore / 100, 3), 0, 100);
  const difficultyWeightedScoreNormalized = clamp(difficultyWeightedScore, 0, 100);
  const exponentialScoreNormalized = clamp((exponentialScore / EXPONENTIAL_MAX) * 100, 0, 100);
  const guessingPenaltyScoreNormalized = clamp(((guessingPenaltyScore - GUESSING_MIN) / (GUESSING_MAX - GUESSING_MIN)) * 100, 0, 100);

  const finalScore = clamp(
    0.20 * difficultyWeightedScoreNormalized +
    0.15 * exponentialScoreNormalized +
    0.10 * guessingPenaltyScoreNormalized +
    0.15 * logisticScoreFinal +
    0.25 * compositeScore +
    0.15 * eliteScore,
    0,
    100
  );

  return {
    correctValue,
    difficultyWeightedScore,
    difficultyWeightedScoreNormalized,
    exponentialScore,
    exponentialScoreNormalized,
    guessingPenaltyScore,
    guessingPenaltyScoreNormalized,
    normalizedSkill,
    logisticScoreFinal,
    powerScore,
    compositeScore,
    eliteScore,
    finalScore,
    zScore: 0
  };
}

function drawCharts() {
  const rows = latestScored.rows;
  drawBarChart("finalScoreChart", rows, (item) => item.scores.finalScore, "Final Score");
  drawBarChart("compositeScoreChart", rows, (item) => item.scores.compositeScore, "Composite Score");
  drawScatterChart("glideFuelChart", rows, (item) => item.glideRatio, (item) => item.fuelBurn, "Glide Ratio", "Fuel Burn");
  drawScatterChart("wingFinalChart", rows, (item) => item.derived.wingLoading, (item) => item.scores.finalScore, "Wing Loading", "Final Score");
  drawScatterChart("co2FinalChart", rows, (item) => item.co2Output, (item) => item.scores.finalScore, "CO₂ Output", "Final Score");
}

function drawBarChart(canvasId, rows, valueAccessor, label) {
  const canvas = document.getElementById(canvasId);
  const { ctx, width, height } = prepareCanvas(canvas);
  clearChart(ctx, width, height);

  if (rows.length === 0) {
    drawEmptyChart(ctx, width, height, "Add aircraft to populate chart.");
    return;
  }

  const margin = { top: 24, right: 20, bottom: 72, left: 48 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const barGap = 10;
  const barWidth = Math.max(12, (chartWidth - barGap * (rows.length - 1)) / rows.length);
  const gradient = ctx.createLinearGradient(0, margin.top, 0, margin.top + chartHeight);
  gradient.addColorStop(0, "#75e39a");
  gradient.addColorStop(1, "#63dce1");

  drawGrid(ctx, margin, width, height, 0, 100);
  ctx.fillStyle = gradient;

  rows.forEach((row, index) => {
    const value = clamp(valueAccessor(row), 0, 100);
    const x = margin.left + index * (barWidth + barGap);
    const barHeight = (value / 100) * chartHeight;
    const y = margin.top + chartHeight - barHeight;
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = "#eaf0ed";
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(formatNumber(value, 1), x + barWidth / 2, y - 7);
    ctx.save();
    ctx.translate(x + barWidth / 2, height - 16);
    ctx.rotate(-Math.PI / 5);
    ctx.fillStyle = "#b7c1bd";
    ctx.fillText(shortName(row.aircraftName), 0, 0);
    ctx.restore();
    ctx.fillStyle = gradient;
  });

  drawChartLabel(ctx, label, width);
}

function drawScatterChart(canvasId, rows, xAccessor, yAccessor, xLabel, yLabel) {
  const canvas = document.getElementById(canvasId);
  const { ctx, width, height } = prepareCanvas(canvas);
  clearChart(ctx, width, height);

  if (rows.length === 0) {
    drawEmptyChart(ctx, width, height, "Add aircraft to populate chart.");
    return;
  }

  const margin = { top: 24, right: 28, bottom: 50, left: 58 };
  const xs = rows.map(xAccessor);
  const ys = rows.map(yAccessor);
  const xRange = paddedRange(Math.min(...xs), Math.max(...xs));
  const yRange = paddedRange(Math.min(...ys), Math.max(...ys), yLabel.includes("Score") ? [0, 100] : null);
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  drawGrid(ctx, margin, width, height, yRange.min, yRange.max);
  drawAxisLabels(ctx, width, height, xLabel, yLabel);

  rows.forEach((row, index) => {
    const x = margin.left + ((xAccessor(row) - xRange.min) / (xRange.max - xRange.min)) * chartWidth;
    const y = margin.top + chartHeight - ((yAccessor(row) - yRange.min) / (yRange.max - yRange.min)) * chartHeight;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = index === 0 ? "#75e39a" : "#63dce1";
    ctx.fill();
    ctx.strokeStyle = "rgba(244, 247, 245, 0.76)";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = "#d8e4de";
    ctx.font = "11px Segoe UI, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(shortName(row.aircraftName), x + 8, y - 8);
  });
}

function prepareCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}

function clearChart(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
}

function drawGrid(ctx, margin, width, height, minY, maxY) {
  const chartHeight = height - margin.top - margin.bottom;
  const chartWidth = width - margin.left - margin.right;
  ctx.strokeStyle = "rgba(183, 193, 189, 0.16)";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#82908b";
  ctx.font = "11px Segoe UI, sans-serif";
  ctx.textAlign = "right";

  for (let i = 0; i <= 4; i += 1) {
    const y = margin.top + (chartHeight / 4) * i;
    const value = maxY - ((maxY - minY) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(margin.left + chartWidth, y);
    ctx.stroke();
    ctx.fillText(formatNumber(value, 0), margin.left - 8, y + 4);
  }
}

function drawAxisLabels(ctx, width, height, xLabel, yLabel) {
  ctx.fillStyle = "#b7c1bd";
  ctx.font = "12px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(xLabel, width / 2, height - 12);
  ctx.save();
  ctx.translate(14, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
}

function drawChartLabel(ctx, label, width) {
  ctx.fillStyle = "#b7c1bd";
  ctx.font = "12px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, width / 2, 18);
}

function drawEmptyChart(ctx, width, height, message) {
  ctx.fillStyle = "#b7c1bd";
  ctx.font = "14px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(message, width / 2, height / 2);
}

function exportCsv() {
  if (latestScored.rows.length === 0) return;
  const headers = [
    "Rank",
    "Aircraft Name",
    "Glide Ratio",
    "Fuel Burn gal/passenger",
    "Range miles",
    "Passenger Capacity",
    "Wing Loading lb/ft2",
    "CO2 Output kg/passenger",
    "Composite Score",
    "Elite Score",
    "Final Pristine Skies Score"
  ];
  const rows = latestScored.rows.map((row, index) => [
    index + 1,
    row.aircraftName,
    row.glideRatio,
    row.fuelBurn,
    row.range,
    row.passengerCapacity,
    row.derived.wingLoading,
    row.co2Output,
    row.scores.compositeScore,
    row.scores.eliteScore,
    row.scores.finalScore
  ]);
  const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
  downloadFile("pristine-skies-results.csv", csv, "text/csv");
}

function downloadJson() {
  if (latestScored.rows.length === 0) return;
  const payload = {
    project: "Pristine Skies Score Calculator",
    generatedAt: new Date().toISOString(),
    note: "Sample aircraft are educational estimates when sample is true.",
    baselines: latestScored.baselines,
    aircraft: latestScored.rows
  };
  downloadFile("pristine-skies-results.json", JSON.stringify(payload, null, 2), "application/json");
}

function updateExportButtons() {
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

function loadAircraft() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAircraft() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(aircraft));
}

function maxValue(rows, accessor) {
  return rows.reduce((max, item) => Math.max(max, accessor(item)), 0);
}

function getEmptyBaselines() {
  return {
    bestSustainabilityIndex: 0,
    bestGlideRatio: 0,
    bestRange: 0,
    bestPassengerCapacity: 0,
    worstFuelBurn: 0,
    worstWingLoading: 0,
    worstCO2Output: 0,
    mean: 0,
    standardDeviation: 0
  };
}

function clampRatio(value, denominator) {
  return denominator > 0 ? clamp(value / denominator, 0, 1) : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function paddedRange(min, max, forcedRange) {
  if (forcedRange) {
    return { min: forcedRange[0], max: forcedRange[1] };
  }
  if (min === max) {
    return { min: min - 1, max: max + 1 };
  }
  const padding = (max - min) * 0.12;
  return { min: Math.max(0, min - padding), max: max + padding };
}

function formatNumber(value, decimals = 2) {
  if (!Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

function shortName(name) {
  return name.length > 16 ? `${name.slice(0, 14)}...` : name;
}

function labelFor(field) {
  const labels = {
    glideRatio: "Glide ratio",
    fuelBurn: "Fuel burn",
    range: "Range",
    passengerCapacity: "Passenger capacity",
    aircraftWeight: "Aircraft weight",
    wingArea: "Wing area",
    cruiseSpeed: "Cruise speed",
    co2Output: "CO₂ output",
    difficultyRating: "Difficulty rating",
    wrongDesignCount: "Wrong/failed design count"
  };
  return labels[field] || field;
}

function createId() {
  if (crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
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
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

function debounce(callback, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => callback(...args), wait);
  };
}

function getIcon(type) {
  const icons = {
    fuel: `<svg viewBox="0 0 24 24"><path d="M7 20V4h8v16"/><path d="M7 8h8"/><path d="M15 7h2l2 2v8a2 2 0 0 0 4 0v-5l-3-3"/><path d="M5 20h12"/></svg>`,
    mass: `<svg viewBox="0 0 24 24"><path d="M8 7a4 4 0 0 1 8 0"/><path d="M6 7h12l2 13H4L6 7Z"/><path d="M9 12h6"/></svg>`,
    distance: `<svg viewBox="0 0 24 24"><path d="M4 17c4-7 12-7 16 0"/><path d="M5 17h14"/><path d="M12 5v9"/><path d="m8 9 4-4 4 4"/></svg>`,
    area: `<svg viewBox="0 0 24 24"><path d="M5 5h14v14H5Z"/><path d="M9 5v14M15 5v14M5 9h14M5 15h14"/></svg>`,
    passenger: `<svg viewBox="0 0 24 24"><path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`,
    wing: `<svg viewBox="0 0 24 24"><path d="M3 14 21 5 9 19l-2-6-4 1Z"/><path d="m9 19 4-8"/></svg>`
  };
  return icons[type] || icons.wing;
}
