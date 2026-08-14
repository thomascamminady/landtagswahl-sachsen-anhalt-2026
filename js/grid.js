import { NAMED_PARTIES, PARTY_COLORS, AFD_MAJORITY_THRESHOLD } from "./constants.js";
import { getSampleCount } from "./pollState.js";
import { sampleOutcomes } from "./dirichlet.js";

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
export function computeGridDims(n) {
  const container = document.getElementById("gridContainer");
  const rect = container.getBoundingClientRect();
  const fallbackAspect = 1100 / 380;
  const aspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : fallbackAspect;

  const cols = Math.max(1, Math.round(Math.sqrt(n * aspect)));
  const rows = Math.ceil(n / cols);
  return { cols, rows };
}

// Drawn directly on the canvas rather than through a Chart.js instance per
// cell: at up to 2000 simulated outcomes, that's 2000 live Chart.js objects
// (each with its own datasets/plugins/lifecycle) recreated on every
// "Speichern" - a few arcs on a 2D context do the same job for a fraction
// of the cost. Same visual result as the previous doughnut config (40%
// cutout, no border, parties drawn in PARTY_ORDER via NAMED_PARTIES): the
// cutout stays transparent so the pie-cell's own background (yellow for an
// AfD-majority outcome) shows through the hole exactly as it did before.
function drawPieCell(canvas, outcome) {
  const parties = NAMED_PARTIES.filter((p) => outcome[p] > 0);
  const total = parties.reduce((sum, p) => sum + outcome[p], 0);

  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  if (total <= 0) return;

  const cx = width / 2;
  const cy = height / 2;
  const outerRadius = Math.min(width, height) / 2;
  const innerRadius = outerRadius * 0.4;

  let angle = -Math.PI / 2; // 12 o'clock, matching Chart.js's default doughnut start
  parties.forEach((party) => {
    const nextAngle = angle + (outcome[party] / total) * Math.PI * 2;

    ctx.beginPath();
    ctx.arc(cx, cy, outerRadius, angle, nextAngle);
    ctx.arc(cx, cy, innerRadius, nextAngle, angle, true);
    ctx.closePath();
    ctx.fillStyle = PARTY_COLORS[party];
    ctx.fill();

    angle = nextAngle;
  });
}

export function renderGrid(outcomes) {
  const grid = document.getElementById("grid");

  grid.innerHTML = "";
  outcomeCells = [];

  const { cols, rows } = computeGridDims(outcomes.length);
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

  outcomes.forEach((outcome) => {
    const cell = document.createElement("div");
    cell.className = "pie-cell";
    cell._outcome = outcome;
    if (outcome.AfD >= AFD_MAJORITY_THRESHOLD) {
      cell.classList.add("majority");
    }

    const canvas = document.createElement("canvas");
    canvas.width = 50;
    canvas.height = 50;
    cell.appendChild(canvas);
    grid.appendChild(cell);

    drawPieCell(canvas, outcome);
    outcomeCells.push({ outcome, cell });
  });

  updateMajorityTitle(outcomes);
}

const SORT_LABEL = "⇅ Nach AfD-Anteil sortieren";
const RANDOMIZE_LABEL = "Zufällig mischen";

// The only thing that (re-)runs the simulation is "Speichern" (see
// controls.js) - percentage/sigma/sample-count edits in the settings panel
// are all staged until then, so there's exactly one, predictable moment
// where the grid changes. No separate "Simulieren" button and no
// auto-resimulate-on-drag, which used to fire independently for different
// sliders and felt inconsistent.
export function simulate() {
  const outcomes = sampleOutcomes(getSampleCount());
  renderGrid(outcomes);

  isSorted = false;
  document.getElementById("sortBtn").textContent = SORT_LABEL;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

let isSorted = false;

export function toggleSort() {
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

export function toggleHighlightWins() {
  const grid = document.getElementById("grid");
  const btn = document.getElementById("highlightWinsBtn");
  highlightWinsActive = !highlightWinsActive;
  grid.classList.toggle("dim-others", highlightWinsActive);
  btn.textContent = highlightWinsActive ? SHOW_ALL_LABEL : HIGHLIGHT_WINS_LABEL;
}
