import Chart from "chart.js/auto";

const DEFAULT_PALETTE = [
  "#40e6ff", "#0ed4fc", "#00c2f8", "#00b0f1", "#009de8", "#008ddf", "#007dd6", "#006dcb", "#005cc0", "#004bb4", "#003aa7", "#002799"
];

export function sortedCountEntries(source) {
  if (!source || typeof source !== "object") return [];
  return Object.entries(source)
    .map(([label, value]) => [label, Number(value) || 0])
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);
}

export function paletteFor(count) {
  if (count <= DEFAULT_PALETTE.length) {
    return DEFAULT_PALETTE.slice(0, count);
  }

  return Array.from({ length: count }, (_, index) => DEFAULT_PALETTE[index % DEFAULT_PALETTE.length]);
}

export function createChart(canvas, config) {
  return new Chart(canvas, {
    ...config,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 12,
            boxHeight: 12,
            usePointStyle: true,
          },
        },
      },
      ...config.options,
    },
  });
}
