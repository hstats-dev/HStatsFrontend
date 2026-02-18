import Chart from "chart.js/auto";

const DEFAULT_PALETTE = [
  "#ff1744", "#ff6d00", "#ffd600", "#76ff03", "#00e676", "#1de9b6", "#00e5ff", "#00b0ff", "#2979ff", "#651fff", "#d500f9", "#ff4081", "#ff5252", "#ff9100", "#c6ff00", "#69f0ae", "#18ffff", "#7c4dff"
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