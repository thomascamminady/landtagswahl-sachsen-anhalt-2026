import { normalizeValues, setSampleCount, getSampleCount } from "./pollState.js";
import { renderPollChart } from "./pollChart.js";
import { renderControls, syncControlValues, updateSumIndicator, resetToDefaults } from "./controls.js";
import {
  simulate,
  scheduleSimulate,
  toggleSort,
  toggleHighlightWins,
} from "./grid.js";
import { showHoverPreview, clearHoverPreview } from "./hoverPreview.js";

// --- wiring ---------------------------------------------------------------

document.getElementById("simulateBtn").addEventListener("click", simulate);
document.getElementById("sortBtn").addEventListener("click", toggleSort);
document.getElementById("highlightWinsBtn").addEventListener("click", toggleHighlightWins);

const sampleSlider = document.getElementById("sampleSlider");
const sampleReadout = document.getElementById("sampleReadout");
sampleSlider.addEventListener("input", () => {
  setSampleCount(parseInt(sampleSlider.value, 10));
  sampleReadout.textContent = getSampleCount();
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
  // saveBtn lives inside settingsPanel, so the document-level outside-click
  // handler never sees it as "outside" and never closes the panel - close
  // it explicitly here instead of relying on that.
  settingsPanel.classList.remove("open");
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
