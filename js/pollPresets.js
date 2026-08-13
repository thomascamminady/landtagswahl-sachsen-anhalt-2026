import { DEFAULT_POLL_DATA, DEFAULT_POLL_META } from "./constants.js";
import { applyPollPreset } from "./pollState.js";
import { syncControlValues, updateSumIndicator } from "./controls.js";
import { renderPollChart } from "./pollChart.js";
import { simulate } from "./grid.js";
import { fetchDawumPresets } from "./dawum.js";

// Keyed by <option value>, so the change handler can look presets back up
// without re-fetching or re-deriving sigmas.
const presetsById = { [DEFAULT_POLL_META.id]: { meta: DEFAULT_POLL_META, data: DEFAULT_POLL_DATA } };

function applyAndRender(presetId) {
  const preset = presetsById[presetId];
  if (!preset) return;

  applyPollPreset(preset.meta, preset.data);
  syncControlValues();
  updateSumIndicator();
  renderPollChart();
  simulate();
  updateSourceLinks(preset.meta);
}

function updateSourceLinks(meta) {
  const footerLink = document.getElementById("footerSourceLink");
  footerLink.href = meta.sourceUrl;
  footerLink.textContent = `dawum.de – ${meta.label}, Sachsen-Anhalt`;

  document.getElementById("helpSourceLink").href = meta.sourceUrl;
  document.getElementById("helpSourceLabel").textContent = `${meta.label} für Sachsen-Anhalt`;
}

function setStatus(text, isError) {
  const status = document.getElementById("pollPresetStatus");
  status.textContent = text;
  status.classList.toggle("error", Boolean(isError));
}

// Called from the "Zurücksetzen" handler (see main.js), which already
// resets pollData itself via resetToDefaults() - this just brings the
// dropdown and source links back in sync with that.
export function resetPollPresetSelection() {
  document.getElementById("pollPresetSelect").value = DEFAULT_POLL_META.id;
  updateSourceLinks(DEFAULT_POLL_META);
}

export function initPollPresets() {
  const select = document.getElementById("pollPresetSelect");

  select.addEventListener("change", () => applyAndRender(select.value));

  setStatus("Lade aktuelle Umfragen von dawum.de …", false);

  fetchDawumPresets()
    .then((presets) => {
      if (presets.length === 0) {
        setStatus("Keine aktuellen Umfragen von dawum.de gefunden.", false);
        return;
      }
      // The live feed's own "Infratest dimap - 30.07.2026" entry is the
      // same survey the hardcoded "Standard" option already represents -
      // skip it so it doesn't show up twice with different ids.
      const newPresets = presets.filter((preset) => preset.label !== DEFAULT_POLL_META.label);
      newPresets.forEach((preset) => {
        presetsById[preset.id] = {
          meta: { id: preset.id, label: preset.label, sourceUrl: preset.sourceUrl },
          data: preset.data,
        };
        const option = document.createElement("option");
        option.value = preset.id;
        option.textContent = preset.label;
        select.appendChild(option);
      });
      setStatus(`${newPresets.length} aktuelle Umfrage(n) von dawum.de geladen.`, false);
    })
    .catch((error) => {
      console.warn("dawum.de-Umfragen konnten nicht geladen werden:", error);
      setStatus("Live-Umfragen von dawum.de aktuell nicht verfügbar – Standardwert wird verwendet.", true);
    });
}
