import { NAMED_PARTIES, PARTY_COLORS } from "./constants.js";
import { formatPercent } from "./format.js";

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

export function showHoverPreview(outcome) {
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

export function clearHoverPreview() {
  const chart = getHoverChart();
  chart.data.labels = [];
  chart.data.datasets[0].data = [];
  chart.data.datasets[0].backgroundColor = [];
  chart.update();
  document.getElementById("hoverLabels").innerHTML = "";
}
