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

// restoreFocus: true when closing via keyboard (Escape, selecting an
// option) - the button is the sensible place for focus to land back on. Not
// used for mouse/outside-click closes, where moving focus would be
// surprising.
function closeMenu({ restoreFocus = false } = {}) {
  const btn = document.getElementById("pollToggleBtn");
  btn.setAttribute("aria-expanded", "false");
  document.getElementById("pollToggleMenu").classList.remove("open");
  if (restoreFocus) btn.focus();
}

function openMenu() {
  document.getElementById("pollToggleBtn").setAttribute("aria-expanded", "true");
  document.getElementById("pollToggleMenu").classList.add("open");
}

function toggleMenu() {
  const isOpen = document.getElementById("pollToggleBtn").getAttribute("aria-expanded") === "true";
  if (isOpen) closeMenu();
  else openMenu();
}

function menuItems() {
  return [...document.querySelectorAll("#pollToggleMenu li")];
}

// Options aren't in the page's normal tab order (tabindex="-1") - once the
// menu is open, arrow keys move focus among them instead, matching how a
// native <select>'s dropdown behaves. focus() still works on a -1 element
// when called programmatically, which is all this needs.
function focusMenuItem(index) {
  const items = menuItems();
  if (items.length === 0) return;
  items[(index + items.length) % items.length].focus();
}

function addMenuItem(preset) {
  const menu = document.getElementById("pollToggleMenu");
  const li = document.createElement("li");
  li.dataset.presetId = preset.meta.id;
  li.textContent = preset.meta.label;
  li.setAttribute("role", "option");
  li.setAttribute("tabindex", "-1");
  li.setAttribute("aria-selected", String(preset.meta.id === activePresetId));

  const select = () => {
    applyAndRender(preset.meta.id);
    closeMenu({ restoreFocus: true });
  };
  li.addEventListener("click", select);
  li.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focusMenuItem(menuItems().indexOf(li) + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusMenuItem(menuItems().indexOf(li) - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusMenuItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusMenuItem(menuItems().length - 1);
    }
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
  // Enter/Space on a <button> already triggers the click handler above via
  // native button semantics - only ArrowDown needs its own handling, to
  // jump straight to browsing options like a native <select> would.
  btn.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    openMenu();
    focusMenuItem(0);
  });
  document.addEventListener("click", (event) => {
    const wrapper = document.querySelector(".poll-toggle-wrapper");
    if (wrapper && !wrapper.contains(event.target)) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    // Only react if this menu is actually the thing open - otherwise
    // pressing Escape to close some unrelated overlay (settings panel,
    // help modal) would steal focus back to this button along the way.
    if (event.key === "Escape" && btn.getAttribute("aria-expanded") === "true") {
      closeMenu({ restoreFocus: true });
    }
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
