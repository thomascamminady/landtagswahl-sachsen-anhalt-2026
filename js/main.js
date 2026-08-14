import { normalizeValues, setSampleCount, getSampleCount } from "./pollState.js";
import { renderPollChart } from "./pollChart.js";
import { renderControls, syncControlValues, updateSumIndicator, resetToDefaults } from "./controls.js";
import { simulate, toggleSort, toggleHighlightWins } from "./grid.js";
import { showHoverPreview, clearHoverPreview } from "./hoverPreview.js";
import { initPollPresets, resetPollPresetSelection } from "./pollPresets.js";

// --- wiring ---------------------------------------------------------------

document.getElementById("sortBtn").addEventListener("click", toggleSort);
document.getElementById("highlightWinsBtn").addEventListener("click", toggleHighlightWins);

// Sample count is staged like every other settings-panel value - it only
// takes effect when "Speichern" is clicked (see below), same as percentages
// and sigmas. No separate auto-resimulate here.
const sampleSlider = document.getElementById("sampleSlider");
const sampleReadout = document.getElementById("sampleReadout");
sampleSlider.addEventListener("input", () => {
  setSampleCount(parseInt(sampleSlider.value, 10));
  sampleReadout.textContent = getSampleCount();
});

const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");

settingsBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  settingsPanel.classList.toggle("open");
});

// mousedown rather than click: dragging the sample-count slider to either
// end of its track easily releases the mouse outside the (fairly narrow)
// panel, so a click-based check saw that release as an "outside click" and
// closed the panel mid-drag. mousedown always fires on the slider itself,
// right where the drag started, regardless of where it ends.
document.addEventListener("mousedown", (event) => {
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

document.getElementById("resetBtn").addEventListener("click", () => {
  resetToDefaults();
  resetPollPresetSelection();
});

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
initPollPresets();
