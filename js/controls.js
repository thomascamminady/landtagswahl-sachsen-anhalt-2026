import { PARTY_ORDER, DEFAULT_SAMPLE_COUNT, PARTY_COLORS } from "./constants.js";
import { pollData, resetPollDataToDefaults } from "./pollState.js";
import { renderPollChart } from "./pollChart.js";
import { simulate } from "./grid.js";

export function renderControls() {
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
    });

    row.appendChild(label);
    row.appendChild(valueSlider);
    row.appendChild(valueReadout);
    row.appendChild(sigmaSlider);
    row.appendChild(sigmaReadout);
    container.appendChild(row);
  });
}

export function syncControlValues() {
  document.querySelectorAll(".control-row").forEach((row) => {
    const party = row.dataset.party;
    row.querySelector(".value-slider").value = pollData[party].value;
    row.querySelector(".value-readout").textContent = `${pollData[party].value.toFixed(1)}%`;
    row.querySelector(".sigma-slider").value = pollData[party].sigma;
    row.querySelector(".sigma-readout").textContent = `±${pollData[party].sigma.toFixed(1)}`;
  });
}

export function updateSumIndicator() {
  const sum = PARTY_ORDER.reduce((s, p) => s + pollData[p].value, 0);
  const el = document.getElementById("sumIndicator");
  el.textContent = `Summe: ${sum.toFixed(1).replace(".", ",")} %`;
  el.classList.toggle("sum-warning", Math.abs(sum - 100) > 0.05);
}

export function resetToDefaults() {
  resetPollDataToDefaults();
  document.getElementById("sampleSlider").value = DEFAULT_SAMPLE_COUNT;
  document.getElementById("sampleReadout").textContent = DEFAULT_SAMPLE_COUNT;

  syncControlValues();
  updateSumIndicator();
  renderPollChart();
  simulate();
}
