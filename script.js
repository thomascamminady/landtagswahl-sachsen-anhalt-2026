const PARTY_ORDER = ["AfD", "CDU", "Linke", "SPD", "Grüne", "BSW", "Sonstige"];
const NAMED_PARTIES = PARTY_ORDER.filter((p) => p !== "Sonstige");

const PARTY_COLORS = {
  AfD: "#469CDA",
  CDU: "#000000",
  Linke: "#EA33F7",
  SPD: "#EA3323",
  Grüne: "#377E22",
  BSW: "#712A4F",
  Sonstige: "#C0C0C0",
};

// CDU's party color is black, so darkening it for the uncertainty line would
// just give black-on-black with no visible contrast - use gray instead.
const UNCERTAINTY_COLOR_OVERRIDES = {
  CDU: "#9e9e9e",
};

const HUERDE = 5.0;
const AFD_MAJORITY_THRESHOLD = 50.0;
const AFD_MAJORITY_HIGHLIGHT_COLOR = "#fcff00";

const DEFAULT_SAMPLE_COUNT = 400;
let currentSampleCount = DEFAULT_SAMPLE_COUNT;

// dawum.de documents its own "Fehlertoleranz" (error tolerance) formula for
// these bars: 1 + sqrt(Umfragewert / 10). It's their own simplified,
// generalized heuristic for the statistical uncertainty of a poll result -
// conceptually closer to a standard error/margin of error on the estimate
// than a standard deviation of individual responses, and explicitly not a
// rigorous confidence interval. We use it as-is for the initial values.
const DEFAULT_POLL_DATA = {
  AfD: { value: 41.0, sigma: 3.0 },
  CDU: { value: 24.0, sigma: 2.5 },
  Linke: { value: 13.0, sigma: 2.1 },
  SPD: { value: 7.0, sigma: 1.8 },
  Grüne: { value: 5.0, sigma: 1.7 },
  BSW: { value: 4.0, sigma: 1.6 },
  Sonstige: { value: 6.0, sigma: 1.8 },
};

// pollData is mutated in place as sliders move, so it needs its own deep
// copy rather than referencing DEFAULT_POLL_DATA directly - otherwise the
// "reset to default" snapshot would drift along with live edits.
const pollData = PARTY_ORDER.reduce((acc, party) => {
  acc[party] = { ...DEFAULT_POLL_DATA[party] };
  return acc;
}, {});

function darkenColor(hex, factor = 0.55) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatPercent(value) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

// --- sum-to-100 percentage constraint -------------------------------------
//
// Sliders move independently and are allowed to sum to anything while being
// dragged - redistributing the other parties live made it hard to dial in
// an exact target value, since every other slider kept jumping around.
// Normalization (dividing everything by the current sum) only happens once,
// explicitly, when "Speichern" is clicked.

function updateSumIndicator() {
  const sum = PARTY_ORDER.reduce((s, p) => s + pollData[p].value, 0);
  const el = document.getElementById("sumIndicator");
  el.textContent = `Summe: ${sum.toFixed(1).replace(".", ",")} %`;
  el.classList.toggle("sum-warning", Math.abs(sum - 100) > 0.05);
}

function normalizeValues() {
  const sum = PARTY_ORDER.reduce((s, p) => s + pollData[p].value, 0);
  if (sum <= 0) return;
  PARTY_ORDER.forEach((p) => {
    pollData[p].value = (pollData[p].value / sum) * 100;
  });
}

// --- Dirichlet sampling (method-of-moments alpha + Marsaglia-Tsang gamma) --

function randomNormal() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function randomGamma(shape) {
  if (shape < 1) {
    const u = Math.random();
    return randomGamma(1 + shape) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x;
    let v;
    do {
      x = randomNormal();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function sampleDirichlet(alpha) {
  const gammas = alpha.map((a) => randomGamma(a));
  const sum = gammas.reduce((s, g) => s + g, 0);
  return gammas.map((g) => g / sum);
}

function computeAlpha() {
  const p = PARTY_ORDER.map((party) => pollData[party].value / 100);
  const variance = PARTY_ORDER.map((party) => (pollData[party].sigma / 100) ** 2);
  const alpha0Estimates = p.map((pi, i) => (pi * (1 - pi)) / variance[i] - 1);
  const alpha0 = alpha0Estimates.reduce((s, v) => s + v, 0) / alpha0Estimates.length;
  return p.map((pi) => pi * alpha0);
}

function sampleOutcomes(nSamples) {
  const alpha = computeAlpha();
  const outcomes = [];

  for (let i = 0; i < nSamples; i++) {
    const draw = sampleDirichlet(alpha).map((x) => x * 100);
    const named = NAMED_PARTIES.map((party) => draw[PARTY_ORDER.indexOf(party)]);
    const surviving = named.map((v) => (v >= HUERDE ? v : 0));
    const total = surviving.reduce((s, v) => s + v, 0);
    const renormalized = surviving.map((v) => (total > 0 ? (v / total) * 100 : 0));

    const outcome = {};
    NAMED_PARTIES.forEach((party, idx) => {
      outcome[party] = renormalized[idx];
    });
    outcomes.push(outcome);
  }
  return outcomes;
}

// --- poll chart (interactive) ----------------------------------------------

let pollChart = null;

// Drawing the +/-sigma error bar as a second stacked dataset (with a smaller
// barThickness than the mean bar) let Chart.js's stacked-bar layout center
// each dataset's rectangle independently, so the thin std segment visibly
// "floated" off the mean bar's row instead of sitting flush against it. A
// canvas plugin sidesteps that entirely - it reads back the exact same pixel
// row Chart.js placed the bar on (scales.y.getPixelForValue(i)) and draws the
// line at that same y, so it can never drift out of alignment.
const pollAnnotationsPlugin = {
  id: "pollAnnotations",
  beforeDatasetsDraw(chart) {
    if (pollData.AfD.value < AFD_MAJORITY_THRESHOLD) return;
    const { ctx, chartArea, scales } = chart;
    const afdIndex = PARTY_ORDER.indexOf("AfD");
    const rowHeight = Math.abs(scales.y.getPixelForValue(1) - scales.y.getPixelForValue(0));
    const yCenter = scales.y.getPixelForValue(afdIndex);

    ctx.save();
    ctx.fillStyle = AFD_MAJORITY_HIGHLIGHT_COLOR;
    ctx.fillRect(
      chartArea.left,
      yCenter - rowHeight / 2,
      chartArea.right - chartArea.left,
      rowHeight,
    );
    ctx.restore();
  },
  afterDatasetsDraw(chart) {
    const { ctx, scales } = chart;
    ctx.save();
    ctx.font = "400 12px Roboto, sans-serif";
    ctx.fillStyle = "#555555";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.lineCap = "butt";

    PARTY_ORDER.forEach((party, i) => {
      const { value, sigma } = pollData[party];
      const yPos = scales.y.getPixelForValue(i);
      const xLow = scales.x.getPixelForValue(Math.max(0, value - sigma));
      const xHigh = scales.x.getPixelForValue(value + sigma);

      // Whisker caps at both ends turn the line into a recognizable "error
      // bar" shape, making it visually obvious it's a range around the mean
      // bar rather than a second, unrelated bar segment.
      const capHalf = 4;
      ctx.strokeStyle = UNCERTAINTY_COLOR_OVERRIDES[party] ?? darkenColor(PARTY_COLORS[party]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xLow, yPos);
      ctx.lineTo(xHigh, yPos);
      ctx.moveTo(xLow, yPos - capHalf);
      ctx.lineTo(xLow, yPos + capHalf);
      ctx.moveTo(xHigh, yPos - capHalf);
      ctx.lineTo(xHigh, yPos + capHalf);
      ctx.stroke();

      const sigmaLabel = sigma.toFixed(1).replace(".", ",");
      ctx.fillText(`${formatPercent(value)} (±${sigmaLabel})`, xHigh + 8, yPos);
    });
    ctx.restore();
  },
};

function renderPollChart() {
  const labels = PARTY_ORDER;
  const meanData = PARTY_ORDER.map((p) => pollData[p].value);
  const stdData = PARTY_ORDER.map((p) => pollData[p].sigma);
  // The AfD bar is drawn fully opaque when its row gets the neon-yellow
  // majority background, so it reads as a solid bar sitting on top of the
  // highlight instead of blending into a muddy teal (translucent blue over
  // yellow).
  const meanColors = PARTY_ORDER.map((p) => {
    const alpha = p === "AfD" && pollData.AfD.value >= AFD_MAJORITY_THRESHOLD ? 1 : 0.85;
    return hexToRgba(PARTY_COLORS[p], alpha);
  });

  const maxX = Math.max(...meanData.map((v, i) => v + stdData[i])) + 12;

  if (pollChart) {
    pollChart.data.labels = labels;
    pollChart.data.datasets[0].data = meanData;
    pollChart.data.datasets[0].backgroundColor = meanColors;
    pollChart.options.scales.x.max = maxX;
    pollChart.update();
    return;
  }

  const ctx = document.getElementById("pollChart").getContext("2d");
  pollChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "mean",
          data: meanData,
          backgroundColor: meanColors,
          categoryPercentage: 0.85,
          barPercentage: 0.85,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 200 },
      layout: { padding: { right: 90 } },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        title: {
          display: true,
          text: "Sachsen-Anhalt – Infratest dimap – 30.07.2026",
          font: { size: 16, weight: "500" },
          color: "#000000",
          padding: { bottom: 12 },
        },
      },
      scales: {
        x: {
          min: 0,
          max: maxX,
          display: false,
          grid: { display: false },
        },
        y: {
          grid: { display: true, color: "#e0e0e0" },
          ticks: {
            color: "#000000",
            font: { weight: "400", size: 13 },
          },
        },
      },
    },
    plugins: [pollAnnotationsPlugin],
  });
}

// --- controls ----------------------------------------------------------

function renderControls() {
  const container = document.getElementById("controls");
  container.innerHTML = "";

  PARTY_ORDER.forEach((party) => {
    const row = document.createElement("div");
    row.className = "control-row";
    row.dataset.party = party;

    const label = document.createElement("div");
    label.className = "party-label";
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = PARTY_COLORS[party];
    label.appendChild(swatch);
    label.appendChild(document.createTextNode(party));

    const valueSlider = document.createElement("input");
    valueSlider.type = "range";
    valueSlider.min = "0";
    valueSlider.max = "100";
    valueSlider.step = "0.1";
    valueSlider.value = pollData[party].value;
    valueSlider.className = "value-slider";

    const valueReadout = document.createElement("div");
    valueReadout.className = "readout value-readout";
    valueReadout.textContent = `${pollData[party].value.toFixed(1)}%`;

    const sigmaSlider = document.createElement("input");
    sigmaSlider.type = "range";
    sigmaSlider.min = "0.1";
    sigmaSlider.max = "10";
    sigmaSlider.step = "0.1";
    sigmaSlider.value = pollData[party].sigma;
    sigmaSlider.className = "sigma-slider";

    const sigmaReadout = document.createElement("div");
    sigmaReadout.className = "readout sigma-readout";
    sigmaReadout.textContent = `±${pollData[party].sigma.toFixed(1)}`;

    valueSlider.addEventListener("input", () => {
      pollData[party].value = parseFloat(valueSlider.value);
      valueReadout.textContent = `${pollData[party].value.toFixed(1)}%`;
      updateSumIndicator();
      renderPollChart();
    });

    sigmaSlider.addEventListener("input", () => {
      pollData[party].sigma = parseFloat(sigmaSlider.value);
      sigmaReadout.textContent = `±${pollData[party].sigma.toFixed(1)}`;
      renderPollChart();
      scheduleSimulate();
    });

    row.appendChild(label);
    row.appendChild(valueSlider);
    row.appendChild(valueReadout);
    row.appendChild(sigmaSlider);
    row.appendChild(sigmaReadout);
    container.appendChild(row);
  });
}

function syncControlValues() {
  document.querySelectorAll(".control-row").forEach((row) => {
    const party = row.dataset.party;
    row.querySelector(".value-slider").value = pollData[party].value;
    row.querySelector(".value-readout").textContent = `${pollData[party].value.toFixed(1)}%`;
    row.querySelector(".sigma-slider").value = pollData[party].sigma;
    row.querySelector(".sigma-readout").textContent = `±${pollData[party].sigma.toFixed(1)}`;
  });
}

function resetToDefaults() {
  PARTY_ORDER.forEach((party) => {
    pollData[party].value = DEFAULT_POLL_DATA[party].value;
    pollData[party].sigma = DEFAULT_POLL_DATA[party].sigma;
  });
  currentSampleCount = DEFAULT_SAMPLE_COUNT;
  document.getElementById("sampleSlider").value = DEFAULT_SAMPLE_COUNT;
  document.getElementById("sampleReadout").textContent = DEFAULT_SAMPLE_COUNT;

  syncControlValues();
  updateSumIndicator();
  renderPollChart();
  simulate();
}

// --- simulated outcomes grid ---------------------------------------------

let outcomeCells = [];

function updateMajorityTitle(outcomes) {
  const majorityCount = outcomes.filter((o) => o.AfD >= AFD_MAJORITY_THRESHOLD).length;
  const majorityPct = Math.round((majorityCount / outcomes.length) * 100);
  document.getElementById("majorityTitle").textContent =
    `${majorityPct} % Chance, dass die AfD die absolute Mehrheit hat`;
}

// Keeps the total area given to the pie grid constant regardless of how many
// pies it holds - the container's own size never changes, only how many
// columns/rows script.js divides it into, so each pie shrinks as the sample
// count grows instead of the page growing taller.
function computeGridDims(n) {
  const container = document.getElementById("gridContainer");
  const rect = container.getBoundingClientRect();
  const fallbackAspect = 1100 / 380;
  const aspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : fallbackAspect;

  const cols = Math.max(1, Math.round(Math.sqrt(n * aspect)));
  const rows = Math.ceil(n / cols);
  return { cols, rows };
}

function buildPieChart(canvas, outcome) {
  const parties = NAMED_PARTIES.filter((p) => outcome[p] > 0);
  const data = parties.map((p) => outcome[p]);
  const colors = parties.map((p) => PARTY_COLORS[p]);

  // A doughnut rather than a full pie: the cutout is transparent, so the
  // pie-cell's own background (yellow for an AfD-majority outcome) shows
  // through the hole too, exactly like it already shows through the square
  // corners around the circle - no extra work needed to color the hole.
  return new Chart(canvas.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: parties,
      datasets: [{ data, backgroundColor: colors, borderWidth: 0 }],
    },
    options: {
      responsive: false,
      animation: false,
      cutout: "40%",
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
    },
  });
}

// --- hover preview -------------------------------------------------------
//
// Recreating a Chart.js instance on every hovered cell would be wasteful
// (mouseover fires constantly while the pointer crosses a dense grid), so a
// single doughnut chart is built once and its data is swapped in-place on
// hover instead. The preview never gets the yellow majority background,
// regardless of the hovered outcome, since it's meant as a neutral detail
// view rather than a repeat of the highlight.

let hoverChart = null;

function getHoverChart() {
  if (hoverChart) return hoverChart;
  const ctx = document.getElementById("hoverCanvas").getContext("2d");
  hoverChart = new Chart(ctx, {
    type: "doughnut",
    data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 0 }] },
    options: {
      responsive: false,
      animation: false,
      cutout: "40%",
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
    },
  });
  return hoverChart;
}

function showHoverPreview(outcome) {
  const parties = NAMED_PARTIES.filter((p) => outcome[p] > 0).sort((a, b) => outcome[b] - outcome[a]);

  const chart = getHoverChart();
  chart.data.labels = parties;
  chart.data.datasets[0].data = parties.map((p) => outcome[p]);
  chart.data.datasets[0].backgroundColor = parties.map((p) => PARTY_COLORS[p]);
  chart.update();

  const labelsContainer = document.getElementById("hoverLabels");
  labelsContainer.innerHTML = "";
  parties.forEach((party) => {
    const row = document.createElement("div");
    row.className = "hover-label-row";

    const name = document.createElement("span");
    name.className = "hover-name";
    const swatch = document.createElement("span");
    swatch.className = "hover-swatch";
    swatch.style.background = PARTY_COLORS[party];
    name.appendChild(swatch);
    name.appendChild(document.createTextNode(party));

    const pct = document.createElement("span");
    pct.className = "hover-pct";
    pct.textContent = formatPercent(outcome[party]);

    row.appendChild(name);
    row.appendChild(pct);
    labelsContainer.appendChild(row);
  });
}

function clearHoverPreview() {
  const chart = getHoverChart();
  chart.data.labels = [];
  chart.data.datasets[0].data = [];
  chart.data.datasets[0].backgroundColor = [];
  chart.update();
  document.getElementById("hoverLabels").innerHTML = "";
}

function renderGrid(outcomes) {
  const grid = document.getElementById("grid");

  outcomeCells.forEach(({ chart }) => chart.destroy());
  grid.innerHTML = "";
  outcomeCells = [];

  const { cols, rows } = computeGridDims(outcomes.length);
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

  outcomes.forEach((outcome) => {
    const cell = document.createElement("div");
    cell.className = "pie-cell";
    cell.dataset.afd = outcome.AfD.toFixed(6);
    cell._outcome = outcome;
    if (outcome.AfD >= AFD_MAJORITY_THRESHOLD) {
      cell.classList.add("majority");
    }

    const canvas = document.createElement("canvas");
    canvas.width = 50;
    canvas.height = 50;
    cell.appendChild(canvas);
    grid.appendChild(cell);

    const chart = buildPieChart(canvas, outcome);
    outcomeCells.push({ outcome, cell, chart });
  });

  updateMajorityTitle(outcomes);
}

const SORT_LABEL = "⇅ Nach AfD sortieren";
const RANDOMIZE_LABEL = "🔀 Zufällig mischen";

function simulate() {
  const outcomes = sampleOutcomes(currentSampleCount);
  renderGrid(outcomes);

  isSorted = false;
  document.getElementById("sortBtn").textContent = SORT_LABEL;
}

// Slider drags fire "input" continuously; rebuilding up to 1000 Chart.js pies
// on every tick would be janky, so re-simulating after a drag is debounced
// instead of running on every event.
let simulateDebounceTimer = null;
function scheduleSimulate(delay = 150) {
  clearTimeout(simulateDebounceTimer);
  simulateDebounceTimer = setTimeout(simulate, delay);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

let isSorted = false;

function toggleSort() {
  const grid = document.getElementById("grid");
  const sortBtn = document.getElementById("sortBtn");

  if (!isSorted) {
    outcomeCells.sort((a, b) => b.outcome.AfD - a.outcome.AfD);
    sortBtn.textContent = RANDOMIZE_LABEL;
  } else {
    shuffle(outcomeCells);
    sortBtn.textContent = SORT_LABEL;
  }
  outcomeCells.forEach(({ cell }) => grid.appendChild(cell));
  isSorted = !isSorted;
}

const HIGHLIGHT_WINS_LABEL = "AfD-Siege hervorheben";
const SHOW_ALL_LABEL = "Alle anzeigen";
let highlightWinsActive = false;

function toggleHighlightWins() {
  const grid = document.getElementById("grid");
  const btn = document.getElementById("highlightWinsBtn");
  highlightWinsActive = !highlightWinsActive;
  grid.classList.toggle("dim-others", highlightWinsActive);
  btn.textContent = highlightWinsActive ? SHOW_ALL_LABEL : HIGHLIGHT_WINS_LABEL;
}

// --- wiring ---------------------------------------------------------------

document.getElementById("simulateBtn").addEventListener("click", simulate);
document.getElementById("sortBtn").addEventListener("click", toggleSort);
document.getElementById("highlightWinsBtn").addEventListener("click", toggleHighlightWins);

const sampleSlider = document.getElementById("sampleSlider");
const sampleReadout = document.getElementById("sampleReadout");
sampleSlider.addEventListener("input", () => {
  currentSampleCount = parseInt(sampleSlider.value, 10);
  sampleReadout.textContent = currentSampleCount;
  scheduleSimulate();
});

const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");

settingsBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  settingsPanel.classList.toggle("open");
});

document.addEventListener("click", (event) => {
  if (!settingsPanel.contains(event.target) && event.target !== settingsBtn) {
    settingsPanel.classList.remove("open");
  }
});

const helpBtn = document.getElementById("helpBtn");
const helpModal = document.getElementById("helpModal");
const helpCloseBtn = document.getElementById("helpCloseBtn");

helpBtn.addEventListener("click", () => helpModal.classList.add("open"));
helpCloseBtn.addEventListener("click", () => helpModal.classList.remove("open"));
helpModal.addEventListener("click", (event) => {
  if (event.target === helpModal) helpModal.classList.remove("open");
});

document.getElementById("saveBtn").addEventListener("click", () => {
  normalizeValues();
  syncControlValues();
  updateSumIndicator();
  renderPollChart();
  simulate();
});

document.getElementById("resetBtn").addEventListener("click", resetToDefaults);

const gridEl = document.getElementById("grid");
gridEl.addEventListener("mouseover", (event) => {
  const cell = event.target.closest(".pie-cell");
  if (cell && cell._outcome) showHoverPreview(cell._outcome);
});
gridEl.addEventListener("mouseleave", clearHoverPreview);

renderControls();
updateSumIndicator();
renderPollChart();
clearHoverPreview();
simulate();
