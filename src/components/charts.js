import "hammerjs";
import Chart from "chart.js/auto";
import annotationPlugin from "chartjs-plugin-annotation";
import zoomPlugin from "chartjs-plugin-zoom";
import { getActiveTheme } from "../utils/theme";

Chart.register(annotationPlugin, zoomPlugin);

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

export function formatChartTimestamp(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return "";
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTimeLocalInputValue(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return "";
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function parseDateTimeLocalInputValue(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatMarkerTimestamp(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return "";

  const date = new Date(timestamp);
  const hour = date.getHours();
  const minute = date.getMinutes();
  const isWholeDayMarker = hour === 0 && minute === 0;

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    ...(isWholeDayMarker ? {} : { hour: "2-digit", minute: "2-digit" }),
  });
}

export function normalizeImportantDateMarkers(payload) {
  const rawMarkers =
    (Array.isArray(payload) && payload) ||
    (Array.isArray(payload?.markers) && payload.markers) ||
    [];

  const normalized = rawMarkers
    .map((marker, index) => {
      const fromUnix = Number(marker?.unix);
      const fromDate = marker?.date ? new Date(marker.date).getTime() : null;
      const timestamp =
        Number.isFinite(fromUnix) && fromUnix > 0
          ? fromUnix * 1000
          : Number.isFinite(fromDate)
            ? fromDate
            : null;

      return {
        id: marker?.id ?? `marker-${index}`,
        timestamp,
        label: String(marker?.label || "").trim() || "Important Date",
        isPreview: false,
      };
      })
    .filter((marker) => marker.timestamp !== null)
    .sort((a, b) => a.timestamp - b.timestamp);

  return normalized;
}

function buildMarkerAnnotations(markers, isDarkTheme) {
  const lineColor = isDarkTheme ? "rgba(251, 191, 36, 0.9)" : "rgba(180, 83, 9, 0.9)";
  const labelBackground = isDarkTheme ? "rgba(120, 53, 15, 0.9)" : "rgba(255, 237, 213, 0.9)";
  const labelTextColor = isDarkTheme ? "#fef3c7" : "#9a3412";
  const previewLineColor = isDarkTheme ? "rgba(56, 189, 248, 0.9)" : "rgba(2, 132, 199, 0.9)";
  const previewBackground = isDarkTheme ? "rgba(12, 74, 110, 0.82)" : "rgba(224, 242, 254, 0.86)";
  const previewText = isDarkTheme ? "#e0f2fe" : "#075985";

  return Object.fromEntries(
    markers.map((marker, index) => {
      const isPreview = marker.isPreview === true;
      return [
        `important-marker-${index}`,
        {
          type: "line",
          xMin: marker.timestamp,
          xMax: marker.timestamp,
          borderColor: isPreview ? previewLineColor : lineColor,
          borderWidth: 2,
          borderDash: [6, 6],
          label: {
            display: true,
            drawTime: "afterDatasetsDraw",
            position: "start",
            xAdjust: 8,
            yAdjust: -18,
            backgroundColor: isPreview ? previewBackground : labelBackground,
            color: isPreview ? previewText : labelTextColor,
            padding: 6,
            borderRadius: 8,
            content: [formatMarkerTimestamp(marker.timestamp), marker.label],
            font: [
              { size: 10, weight: "700" },
              { size: 11, weight: "600" },
            ],
            textAlign: "left",
          },
        },
      ];
    }),
  );
}

export function createChart(canvas, config) {
  const isDarkTheme = getActiveTheme() === "dark";
  const defaultLegendLabelColor = isDarkTheme ? "#cbd5e1" : "#475569";
  const defaultPlugins = {
    legend: {
      position: "bottom",
      labels: {
        boxWidth: 12,
        boxHeight: 12,
        usePointStyle: true,
        color: defaultLegendLabelColor,
      },
    },
  };
  const customPlugins = config.options?.plugins || {};

  return new Chart(canvas, {
    ...config,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...config.options,
      plugins: {
        ...defaultPlugins,
        ...customPlugins,
        legend: {
          ...defaultPlugins.legend,
          ...(customPlugins.legend || {}),
          labels: {
            ...defaultPlugins.legend.labels,
            ...(customPlugins.legend?.labels || {}),
          },
        },
      },
    },
  });
}

export function createTimeSeriesChart(
  canvas,
  {
    datasets,
    min = undefined,
    max = undefined,
    maxTicksLimit = 10,
    yBeginAtZero = true,
    yPrecision = 0,
    markers = [],
    showMarkers = true,
  },
) {
  const isDarkTheme = getActiveTheme() === "dark";
  const gridColor = isDarkTheme ? "rgba(148, 163, 184, 0.16)" : "rgba(148, 163, 184, 0.12)";
  const tickColor = isDarkTheme ? "#cbd5e1" : "#64748b";
  const tooltipBackground = isDarkTheme ? "rgba(2, 6, 23, 0.96)" : "rgba(15, 23, 42, 0.96)";
  const tooltipTitle = "#f8fafc";
  const tooltipBody = isDarkTheme ? "#e2e8f0" : "#e2e8f0";
  const annotationConfig = showMarkers ? buildMarkerAnnotations(markers, isDarkTheme) : {};

  return createChart(canvas, {
    type: "line",
    data: {
      datasets: datasets.map((dataset) => ({
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4,
        parsing: false,
        ...dataset,
      })),
    },
    options: {
      interaction: {
        mode: "index",
        intersect: false,
      },
      scales: {
        x: {
          type: "linear",
          min,
          max,
          grid: {
            color: gridColor,
          },
          ticks: {
            autoSkip: true,
            maxTicksLimit,
            color: tickColor,
            callback: (value) => formatChartTimestamp(value),
          },
        },
        y: {
          beginAtZero: yBeginAtZero,
          grid: {
            color: gridColor,
          },
          ticks: {
            precision: yPrecision,
            color: tickColor,
          },
        },
      },
      plugins: {
        annotation: {
          annotations: annotationConfig,
        },
        tooltip: {
          backgroundColor: tooltipBackground,
          titleColor: tooltipTitle,
          bodyColor: tooltipBody,
          callbacks: {
            title: (items) => {
              const timestamp = items?.[0]?.parsed?.x;
              return formatChartTimestamp(timestamp);
            },
          },
        },
        zoom: {
          limits: {
            x: {
              minRange: 60 * 60 * 1000,
            },
          },
          zoom: {
            mode: "x",
            wheel: {
              enabled: true,
              modifierKey: "ctrl",
            },
            drag: {
              enabled: true,
              modifierKey: "shift",
              borderColor: "rgba(56, 189, 248, 0.9)",
              backgroundColor: "rgba(56, 189, 248, 0.15)",
              borderWidth: 1,
            },
            pinch: {
              enabled: true,
            },
          },
        },
      },
    },
  });
}
