import {
  PARTY_ORDER,
  PARTY_COLORS,
  UNCERTAINTY_COLOR_OVERRIDES,
  AFD_MAJORITY_THRESHOLD,
  AFD_MAJORITY_HIGHLIGHT_COLOR,
} from "./constants.js";
import { pollData } from "./pollState.js";
import { darkenColor, hexToRgba, formatPercent } from "./format.js";

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

export function renderPollChart() {
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
