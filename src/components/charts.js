import Chart from "chart.js/auto";

const DEFAULT_PALETTE = [
  "#0284c7",
  "#0ea5e9",
  "#38bdf8",
  "#7dd3fc",
  "#0369a1",
  "#22d3ee",
  "#06b6d4",
  "#2563eb",
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
