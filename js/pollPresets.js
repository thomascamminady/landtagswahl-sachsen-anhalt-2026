import { DEFAULT_POLL_DATA, DEFAULT_POLL_META } from "./constants.js";
import { applyPollPreset } from "./pollState.js";
import { syncControlValues, updateSumIndicator } from "./controls.js";
import { renderPollChart } from "./pollChart.js";
import { simulate } from "./grid.js";
import { fetchDawumPresets } from "./dawum.js";

// Keyed by preset id, so the menu's click handler can look presets back up
// without re-fetching or re-deriving sigmas.
const presetsById = { [DEFAULT_POLL_META.id]: { meta: DEFAULT_POLL_META, data: DEFAULT_POLL_DATA } };
let activePresetId = DEFAULT_POLL_META.id;

function applyAndRender(presetId) {
  const preset = presetsById[presetId];
  if (!preset) return;

  activePresetId = presetId;
  applyPollPreset(preset.data);
  syncControlValues();
  updateSumIndicator();
  renderPollChart();
  simulate();
  updateToggleUI(preset.meta);
}

function updateToggleUI(meta) {
  document.getElementById("pollToggleLabel").textContent = meta.label;

  document.querySelectorAll("#pollToggleMenu li").forEach((li) => {
    li.setAttribute("aria-selected", String(li.dataset.presetId === activePresetId));
  });

  const footerLink = document.getElementById("footerSourceLink");
  footerLink.href = meta.sourceUrl;
  footerLink.textContent = `dawum.de – ${meta.label}, Sachsen-Anhalt`;

  document.getElementById("helpSourceLink").href = meta.sourceUrl;
  document.getElementById("helpSourceLabel").textContent = `${meta.label} für Sachsen-Anhalt`;
}

function setStatus(text) {
  document.getElementById("pollToggleStatus").textContent = text;
}

function closeMenu() {
  document.getElementById("pollToggleBtn").setAttribute("aria-expanded", "false");
  document.getElementById("pollToggleMenu").classList.remove("open");
}

function toggleMenu() {
  const btn = document.getElementById("pollToggleBtn");
  const isOpen = btn.getAttribute("aria-expanded") === "true";
  btn.setAttribute("aria-expanded", String(!isOpen));
  document.getElementById("pollToggleMenu").classList.toggle("open", !isOpen);
}

function addMenuItem(preset) {
  const menu = document.getElementById("pollToggleMenu");
  const li = document.createElement("li");
  li.dataset.presetId = preset.meta.id;
  li.textContent = preset.meta.label;
  li.setAttribute("role", "option");
  li.setAttribute("aria-selected", String(preset.meta.id === activePresetId));
  li.addEventListener("click", () => {
    applyAndRender(preset.meta.id);
    closeMenu();
  });
  menu.appendChild(li);
}

// Called from the "Zurücksetzen" handler (see main.js), which already
// resets pollData itself via resetToDefaults() - this just brings the
// toggle back in sync with that.
export function resetPollPresetSelection() {
  activePresetId = DEFAULT_POLL_META.id;
  updateToggleUI(DEFAULT_POLL_META);
}

export function initPollPresets() {
  const btn = document.getElementById("pollToggleBtn");
  addMenuItem(presetsById[DEFAULT_POLL_META.id]);

  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMenu();
  });
  document.addEventListener("click", (event) => {
    const wrapper = document.querySelector(".poll-toggle-wrapper");
    if (wrapper && !wrapper.contains(event.target)) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  fetchDawumPresets()
    .then((presets) => {
      // The live feed's own "Infratest dimap - 30.07.2026" entry is the
      // same survey the hardcoded "Standard" option already represents -
      // skip it so it doesn't show up twice with different ids.
      presets
        .filter((preset) => preset.label !== DEFAULT_POLL_META.label)
        .forEach((preset) => {
          const entry = {
            meta: { id: preset.id, label: preset.label, sourceUrl: preset.sourceUrl },
            data: preset.data,
          };
          presetsById[preset.id] = entry;
          addMenuItem(entry);
        });
    })
    .catch((error) => {
      console.warn("dawum.de-Umfragen konnten nicht geladen werden:", error);
      setStatus("Live-Umfragen von dawum.de aktuell nicht verfügbar.");
    });
}
