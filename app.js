"use strict";

const STORAGE_KEY = "pristine-skies-aircraft-platform-v2";

const fieldIds = [
  "aircraftName",
  "manufacturer",
  "aircraftType",
  "wingspan",
  "wingArea",
  "aircraftWeight",
  "liftCoefficient",
  "dragCoefficient",
  "totalFuelBurn",
  "flightDistance",
  "passengerCapacity",
  "averageLoadFactor",
  "totalCo2Output",
  "cruiseSpeed",
  "maximumRange"
];

const numericFields = [
  "wingspan",
  "wingArea",
  "aircraftWeight",
  "liftCoefficient",
  "dragCoefficient",
  "totalFuelBurn",
  "flightDistance",
  "passengerCapacity",
  "averageLoadFactor",
  "totalCo2Output",
  "cruiseSpeed",
  "maximumRange"
];

const labels = {
  aircraftName: "Aircraft name",
  manufacturer: "Manufacturer",
  aircraftType: "Aircraft type",
  wingspan: "Wingspan",
  wingArea: "Wing area",
  aircraftWeight: "Aircraft weight / MTOW",
  liftCoefficient: "Lift coefficient",
  dragCoefficient: "Drag coefficient",
  totalFuelBurn: "Total fuel burn",
  flightDistance: "Flight distance",
  passengerCapacity: "Passenger capacity",
  averageLoadFactor: "Average load factor",
  totalCo2Output: "Total CO₂ output",
  cruiseSpeed: "Cruise speed",
  maximumRange: "Maximum range"
};

const form = document.getElementById("aircraftForm");
const errorBox = document.getElementById("errorBox");
const submitButton = document.getElementById("submitButton");
const cancelEditButton = document.getElementById("cancelEditButton");
const liveMetrics = document.getElementById("liveMetrics");
const aircraftTableBody = document.getElementById("aircraftTableBody");
const scoreSummary = document.getElementById("scoreSummary");
const scoreBreakdown = document.getElementById("scoreBreakdown");
const insightsList = document.getElementById("insightsList");

let aircraft = loadAircraft();
let editingId = null;
let latestScored = scoreAircraftList(aircraft);

initialize();

function initialize() {
  bindEvents();
  renderAll();
}

function bindEvents() {
  form.addEventListener("submit", handleSubmit);
  form.addEventListener("input", renderLivePreview);
  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      if (editingId) clearEditState();
      hideErrors();
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
}

function handleSubmit(event) {
  event.preventDefault();
  const values = getFormValues();
  const errors = validateAircraft(values);

  if (errors.length) {
    showErrors(errors);
    return;
  }

  const record = {
    ...values,
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
    values[id] = numericFields.includes(id) ? Number(element.value) : element.value.trim();
  });
  return values;
}

function validateAircraft(values, options = {}) {
  const errors = [];
  const textFields = ["aircraftName", "manufacturer", "aircraftType"];

  textFields.forEach((field) => {
    if (!options.allowBlankText && !values[field]) {
      errors.push(`${labels[field]} is required.`);
    }
  });

  numericFields.forEach((field) => {
    if (!Number.isFinite(values[field])) {
      errors.push(`${labels[field]} must be a valid number.`);
    } else if (values[field] < 0) {
      errors.push(`${labels[field]} cannot be negative.`);
    }
  });

  const positiveFields = [
    "wingspan",
    "wingArea",
    "aircraftWeight",
    "liftCoefficient",
    "dragCoefficient",
    "totalFuelBurn",
    "flightDistance",
    "passengerCapacity",
    "averageLoadFactor",
    "totalCo2Output",
    "cruiseSpeed",
    "maximumRange"
  ];

  positiveFields.forEach((field) => {
    if (Number.isFinite(values[field]) && values[field] <= 0) {
      errors.push(`${labels[field]} must be greater than zero.`);
    }
  });

  if (Number.isFinite(values.averageLoadFactor) && values.averageLoadFactor > 100) {
    errors.push("Average load factor must be 100% or less.");
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
  hideErrors();
  renderLivePreview();
}

function clearEditState() {
  editingId = null;
  submitButton.innerHTML = `Add Aircraft <span aria-hidden="true">+</span>`;
  cancelEditButton.hidden = true;
}

function renderAll() {
  latestScored = scoreAircraftList(aircraft);
  renderLivePreview();
  renderScoreStage(latestScored.rows);
  renderTable(latestScored.rows);
  renderInsights(latestScored.rows, latestScored.baselines);
  drawCharts();
  updateUtilityButtons();
}

function renderLivePreview() {
  const values = getFormValues();
  const previewValues = {
    ...values,
    aircraftName: values.aircraftName || "Preview Aircraft",
    manufacturer: values.manufacturer || "Preview Manufacturer",
    aircraftType: values.aircraftType || "Preview Type"
  };
  const errors = validateAircraft(previewValues, { allowBlankText: true });

  if (errors.length) {
    liveMetrics.innerHTML = `
      ${metricMarkup("Glide Ratio", "--", "calculated")}
      ${metricMarkup("Aspect Ratio", "--", "calculated")}
      ${metricMarkup("Wing Loading", "--", "lb/ft²")}
      ${metricMarkup("Active Passengers", "--", "calculated")}
      ${metricMarkup("Fuel / Passenger", "--", "gallons")}
      ${metricMarkup("Fuel / Passenger-Mile", "--", "gal / passenger-mile")}
      ${metricMarkup("CO₂ / Passenger", "--", "kg")}
      ${metricMarkup("CO₂ / Passenger-Mile", "--", "kg / passenger-mile")}
    `;
    return;
  }

  const derived = calculateDerivedMetrics(previewValues);
  liveMetrics.innerHTML = `
    ${metricMarkup("Glide Ratio", formatNumber(derived.glideRatio, 2), "lift-to-drag")}
    ${metricMarkup("Aspect Ratio", formatNumber(derived.aspectRatio, 2), "wing geometry")}
    ${metricMarkup("Wing Loading", formatNumber(derived.wingLoading, 2), "lb/ft²")}
    ${metricMarkup("Active Passengers", formatNumber(derived.activePassengers, 0), "load factor adjusted")}
    ${metricMarkup("Fuel / Passenger", formatNumber(derived.fuelPerPassenger, 2), "gallons")}
    ${metricMarkup("Fuel / Passenger-Mile", formatNumber(derived.fuelPerPassengerMile, 5), "gal / passenger-mile")}
    ${metricMarkup("CO₂ / Passenger", formatNumber(derived.co2PerPassenger, 2), "kg")}
    ${metricMarkup("CO₂ / Passenger-Mile", formatNumber(derived.co2PerPassengerMile, 5), "kg / passenger-mile")}
  `;
}

function metricMarkup(label, value, unit) {
  return `
    <div class="metric-item">
      <span>${label}</span>
      <strong>${value}</strong>
      <em>${unit}</em>
    </div>
  `;
}

function calculateDerivedMetrics(item) {
  const activePassengers = item.passengerCapacity * (item.averageLoadFactor / 100);
  const passengerMiles = activePassengers * item.flightDistance;
  const glideRatio = item.liftCoefficient / item.dragCoefficient;
  const aspectRatio = Math.pow(item.wingspan, 2) / item.wingArea;
  const wingLoading = item.aircraftWeight / item.wingArea;
  const fuelPerPassenger = item.totalFuelBurn / activePassengers;
  const fuelPerMile = item.totalFuelBurn / item.flightDistance;
  const fuelPerPassengerMile = item.totalFuelBurn / passengerMiles;
  const co2PerPassenger = item.totalCo2Output / activePassengers;
  const co2PerMile = item.totalCo2Output / item.flightDistance;
  const co2PerPassengerMile = item.totalCo2Output / passengerMiles;

  return {
    activePassengers,
    passengerMiles,
    glideRatio,
    aspectRatio,
    wingLoading,
    fuelPerPassenger,
    fuelPerMile,
    fuelPerPassengerMile,
    co2PerPassenger,
    co2PerMile,
    co2PerPassengerMile
  };
}

function scoreAircraftList(list) {
  const prepared = list.map((item) => ({
    ...item,
    derived: calculateDerivedMetrics(item)
  }));
  const baselines = calculateBaselines(prepared);
  const scored = prepared.map((item) => {
    const scores = calculateScores(item, baselines);
    return { ...item, scores };
  });

  return {
    rows: scored.sort((a, b) => b.scores.finalScore - a.scores.finalScore),
    baselines
  };
}

function calculateBaselines(rows) {
  const positive = (accessor) => rows.map(accessor).filter((value) => Number.isFinite(value) && value > 0);
  const max = (accessor) => {
    const values = positive(accessor);
    return values.length ? Math.max(...values) : 1;
  };
  const min = (accessor) => {
    const values = positive(accessor);
    return values.length ? Math.min(...values) : 1;
  };

  return {
    bestGlideRatio: max((item) => item.derived.glideRatio),
    bestAspectRatio: max((item) => item.derived.aspectRatio),
    bestMaximumRange: max((item) => item.maximumRange),
    bestCruiseSpeed: max((item) => item.cruiseSpeed),
    bestActivePassengers: max((item) => item.derived.activePassengers),
    bestFuelPerPassengerMile: min((item) => item.derived.fuelPerPassengerMile),
    bestCo2PerPassengerMile: min((item) => item.derived.co2PerPassengerMile),
    bestWingLoading: min((item) => item.derived.wingLoading)
  };
}

function calculateScores(item, baselines) {
  const n = {
    glide: ratio(item.derived.glideRatio, baselines.bestGlideRatio),
    aspect: ratio(item.derived.aspectRatio, baselines.bestAspectRatio),
    range: ratio(item.maximumRange, baselines.bestMaximumRange),
    speed: ratio(item.cruiseSpeed, baselines.bestCruiseSpeed),
    passengers: ratio(item.derived.activePassengers, baselines.bestActivePassengers),
    fuel: inverseRatio(item.derived.fuelPerPassengerMile, baselines.bestFuelPerPassengerMile),
    co2: inverseRatio(item.derived.co2PerPassengerMile, baselines.bestCo2PerPassengerMile),
    wing: inverseRatio(item.derived.wingLoading, baselines.bestWingLoading)
  };

  const contributions = {
    "Glide ratio": 0.20 * Math.pow(n.glide, 1.35),
    "Fuel efficiency": 0.20 * Math.pow(n.fuel, 1.4),
    "CO₂ efficiency": 0.18 * Math.pow(n.co2, 1.4),
    "Range performance": 0.14 * n.range,
    "Wing loading": 0.12 * Math.pow(n.wing, 1.25),
    "Aspect ratio": 0.08 * n.aspect,
    "Passenger utilization": 0.05 * n.passengers,
    "Cruise performance": 0.03 * n.speed
  };

  const compositeScore = clamp(Object.values(contributions).reduce((sum, value) => sum + value, 0) * 100, 0, 100);
  const performanceSeparationScore = clamp(100 * Math.pow(compositeScore / 100, 1.65), 0, 100);
  const finalScore = clamp((0.72 * compositeScore) + (0.28 * performanceSeparationScore), 0, 100);

  return {
    normalized: n,
    contributions,
    compositeScore,
    performanceSeparationScore,
    finalScore
  };
}

function renderScoreStage(rows) {
  if (!rows.length) {
    scoreSummary.innerHTML = `
      <span class="section-kicker">Final Output</span>
      <h2>Final Pristine Skies Score</h2>
      <div class="empty-state">No aircraft data available yet.</div>
    `;
    scoreBreakdown.innerHTML = "";
    return;
  }

  const top = rows[0];
  scoreSummary.innerHTML = `
    <span class="section-kicker">Final Output</span>
    <h2>Final Pristine Skies Score</h2>
    <div class="score-aircraft">${escapeHtml(top.aircraftName)}</div>
    <div class="final-score">${formatNumber(top.scores.finalScore, 1)}</div>
    <p>${escapeHtml(top.manufacturer)} ${escapeHtml(top.aircraftType)} leads the current fleet ranking based on sustainability, efficiency, and performance separation.</p>
  `;

  const breakdown = [
    ["Composite Aerospace Score", top.scores.compositeScore],
    ["Performance Separation Score", top.scores.performanceSeparationScore],
    ["Glide Ratio", top.derived.glideRatio],
    ["Fuel / Passenger-Mile", top.derived.fuelPerPassengerMile],
    ["CO₂ / Passenger-Mile", top.derived.co2PerPassengerMile],
    ["Wing Loading", top.derived.wingLoading]
  ];

  scoreBreakdown.innerHTML = `
    <h3>Score Breakdown</h3>
    ${breakdown.map(([label, value], index) => `
      <div class="breakdown-row">
        <span>${label}</span>
        <div class="bar-track"><div style="width: ${breakdownWidth(label, value, top)}%"></div></div>
        <strong>${formatBreakdownValue(label, value)}</strong>
      </div>
    `).join("")}
  `;
}

function breakdownWidth(label, value, top) {
  if (label.includes("Score")) return clamp(value, 0, 100);
  if (label === "Glide Ratio") return clamp((top.scores.normalized.glide || 0) * 100, 0, 100);
  if (label.includes("Fuel")) return clamp((top.scores.normalized.fuel || 0) * 100, 0, 100);
  if (label.includes("CO₂")) return clamp((top.scores.normalized.co2 || 0) * 100, 0, 100);
  return clamp((top.scores.normalized.wing || 0) * 100, 0, 100);
}

function formatBreakdownValue(label, value) {
  if (label.includes("Score")) return formatNumber(value, 1);
  if (label.includes("Passenger-Mile")) return formatNumber(value, 5);
  return formatNumber(value, 2);
}

function renderTable(rows) {
  if (!rows.length) {
    aircraftTableBody.innerHTML = `<tr><td colspan="12">No aircraft data available yet.</td></tr>`;
    return;
  }

  aircraftTableBody.innerHTML = rows.map((row, index) => `
    <tr>
      <td class="rank-cell">${index + 1}</td>
      <td class="name-cell">
        <strong>${escapeHtml(row.aircraftName)}</strong>
        <span>${escapeHtml(row.manufacturer)} · ${escapeHtml(row.aircraftType)}</span>
      </td>
      <td>${formatNumber(row.derived.glideRatio, 2)}</td>
      <td>${formatNumber(row.derived.aspectRatio, 2)}</td>
      <td>${formatNumber(row.derived.wingLoading, 2)} lb/ft²</td>
      <td>${formatNumber(row.derived.fuelPerPassengerMile, 5)}</td>
      <td>${formatNumber(row.derived.co2PerPassengerMile, 5)}</td>
      <td>${formatNumber(row.maximumRange, 0)} mi</td>
      <td>${formatNumber(row.scores.compositeScore, 1)}</td>
      <td>${formatNumber(row.scores.performanceSeparationScore, 1)}</td>
      <td class="score-cell">${formatNumber(row.scores.finalScore, 1)}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-action="edit" data-id="${row.id}">Edit</button>
          <button type="button" data-action="delete" data-id="${row.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");

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

  fieldIds.forEach((field) => {
    document.getElementById(field).value = item[field];
  });
  editingId = id;
  submitButton.textContent = "Update Aircraft";
  cancelEditButton.hidden = false;
  hideErrors();
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

function renderInsights(rows, baselines) {
  if (!rows.length) {
    insightsList.innerHTML = `<div class="empty-state">No aircraft data available yet.</div>`;
    return;
  }

  const top = rows[0];
  const insights = buildInsights(top, rows, baselines);

  insightsList.innerHTML = insights.map((insight, index) => `
    <article>
      <span>${String(index + 1).padStart(2, "0")}</span>
      <p>${escapeHtml(insight)}</p>
    </article>
  `).join("");
}

function buildInsights(top, rows) {
  const sortedContributions = Object.entries(top.scores.contributions)
    .sort((a, b) => b[1] - a[1]);
  const strongest = sortedContributions[0]?.[0] || "Composite efficiency";
  const fuelDelta = estimateFuelReductionImpact(top);
  const averageWingLoading = average(rows, (item) => item.derived.wingLoading);
  const averageCo2 = average(rows, (item) => item.derived.co2PerPassengerMile);

  const insights = [
    `${strongest} is the largest contributor to ${top.aircraftName}'s score.`,
    `Reducing fuel burn by 10% could improve the Final Pristine Skies Score by approximately ${formatNumber(fuelDelta, 1)} points.`
  ];

  if (top.derived.co2PerPassengerMile > averageCo2 && rows.length > 1) {
    insights.push("CO₂ emissions are limiting overall sustainability performance.");
  } else {
    insights.push("CO₂ efficiency is supporting the aircraft's sustainability profile.");
  }

  if (top.derived.wingLoading > averageWingLoading && rows.length > 1) {
    insights.push("Wing loading is above the fleet average.");
  } else {
    insights.push("Wing loading is competitive against the current fleet average.");
  }

  if (rows.length === 1) {
    insights.push("Add more aircraft to strengthen relative ranking and performance differentiation.");
  } else {
    const spread = rows[0].scores.finalScore - rows[rows.length - 1].scores.finalScore;
    insights.push(`The current fleet has a ${formatNumber(spread, 1)} point spread between first and last place.`);
  }

  return insights;
}

function estimateFuelReductionImpact(top) {
  const modified = {
    ...top,
    totalFuelBurn: top.totalFuelBurn * 0.9
  };
  const comparison = [top, modified].map((item) => ({
    ...item,
    derived: calculateDerivedMetrics(item)
  }));
  const baselines = calculateBaselines(comparison);
  const original = calculateScores(comparison[0], baselines).finalScore;
  const improved = calculateScores(comparison[1], baselines).finalScore;
  return Math.max(0, improved - original);
}

function drawCharts() {
  const rows = latestScored.rows;
  drawBarChart("finalScoreChart", rows, (item) => item.scores.finalScore);
  drawBarChart("compositeScoreChart", rows, (item) => item.scores.compositeScore);
  drawScatterChart("glideFuelChart", rows, (item) => item.derived.glideRatio, (item) => 1 / item.derived.fuelPerPassengerMile, "Glide Ratio", "Fuel Efficiency");
  drawScatterChart("wingFinalChart", rows, (item) => item.derived.wingLoading, (item) => item.scores.finalScore, "Wing Loading", "Final Score");
  drawScatterChart("co2FinalChart", rows, (item) => 1 / item.derived.co2PerPassengerMile, (item) => item.scores.finalScore, "CO₂ Efficiency", "Final Score");
}

function drawBarChart(canvasId, rows, accessor) {
  const canvas = document.getElementById(canvasId);
  const { ctx, width, height } = prepareCanvas(canvas);
  clearCanvas(ctx, width, height);

  if (!rows.length) {
    drawEmpty(ctx, width, height);
    return;
  }

  const margin = { top: 34, right: 26, bottom: 82, left: 58 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const gap = Math.max(12, chartWidth * 0.025);
  const barWidth = Math.max(18, (chartWidth - gap * (rows.length - 1)) / rows.length);

  drawGrid(ctx, margin, width, height, 0, 100);
  const gradient = ctx.createLinearGradient(0, margin.top, 0, margin.top + chartHeight);
  gradient.addColorStop(0, "#66f27e");
  gradient.addColorStop(1, "#35e9c2");

  rows.forEach((row, index) => {
    const value = clamp(accessor(row), 0, 100);
    const x = margin.left + index * (barWidth + gap);
    const h = (value / 100) * chartHeight;
    const y = margin.top + chartHeight - h;
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, h);
    ctx.fillStyle = "#f6fff8";
    ctx.font = "600 13px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(formatNumber(value, 1), x + barWidth / 2, y - 8);
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
    ctx.fillStyle = index === 0 ? "#66f27e" : "#35e9c2";
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
    "Glide Ratio",
    "Aspect Ratio",
    "Wing Loading",
    "Fuel Per Passenger-Mile",
    "CO2 Per Passenger-Mile",
    "Maximum Range",
    "Composite Score",
    "Performance Separation Score",
    "Final Pristine Skies Score"
  ];
  const rows = latestScored.rows.map((row, index) => [
    index + 1,
    row.aircraftName,
    row.derived.glideRatio,
    row.derived.aspectRatio,
    row.derived.wingLoading,
    row.derived.fuelPerPassengerMile,
    row.derived.co2PerPassengerMile,
    row.maximumRange,
    row.scores.compositeScore,
    row.scores.performanceSeparationScore,
    row.scores.finalScore
  ]);
  const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
  downloadFile("pristine-skies-results.csv", csv, "text/csv");
}

function downloadJson() {
  if (!latestScored.rows.length) return;
  downloadFile("pristine-skies-results.json", JSON.stringify({
    project: "Pristine Skies",
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
    return Array.isArray(saved) ? saved.filter(isModernAircraftRecord) : [];
  } catch {
    return [];
  }
}

function isModernAircraftRecord(item) {
  return item && fieldIds.every((field) => Object.prototype.hasOwnProperty.call(item, field));
}

function ratio(value, baseline) {
  return baseline > 0 ? clamp(value / baseline, 0, 1) : 0;
}

function inverseRatio(value, best) {
  return value > 0 ? clamp(best / value, 0, 1) : 0;
}

function average(rows, accessor) {
  if (!rows.length) return 0;
  return rows.reduce((sum, row) => sum + accessor(row), 0) / rows.length;
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

function formatNumber(value, decimals = 2) {
  if (!Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
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
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function debounce(callback, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => callback(...args), wait);
  };
}
