import { getGlobalHistory, getGlobalStats, getImportantDateMarkers, getRecentActivity } from "../api/serverApi";
import { OVERALL_STATS_REFRESH_MS } from "../config";
import {
  createChart,
  createTimeSeriesChart,
  formatDateTimeLocalInputValue,
  normalizeImportantDateMarkers,
  parseDateTimeLocalInputValue,
  paletteFor,
  sortedCountEntries,
} from "../components/charts";
import { statCard } from "../components/statCard";
import { loadingState } from "../components/loadingState";
import { emptyState } from "../components/emptyState";
import { errorState } from "../components/errorState";
import { formatNumber } from "../utils/format";
import { escapeHtml } from "../utils/escapeHtml";

const RECENT_ACTIVITY_REFRESH_MS = 10_000;
const EASTERN_TIME_ZONE = "America/New_York";
const HAS_EXPLICIT_TIMEZONE = /(Z|[+-]\d{2}:\d{2})$/i;

function getTimeZoneOffsetMinutes(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  });
  const timeZoneName = formatter.formatToParts(date).find((part) => part.type === "timeZoneName")?.value || "";
  const offsetMatch = timeZoneName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!offsetMatch) return null;

  const sign = offsetMatch[1] === "-" ? -1 : 1;
  const hours = Number(offsetMatch[2]) || 0;
  const minutes = Number(offsetMatch[3]) || 0;
  return sign * (hours * 60 + minutes);
}

function parseEasternTimestampToUtc(rawTimestamp) {
  const match = rawTimestamp.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2})(?::(\d{2}))?(?::(\d{2}))?(?:\.(\d{1,3}))?$/,
  );
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5] || "0");
  const second = Number(match[6] || "0");
  const millisecond = Number((match[7] || "0").padEnd(3, "0"));

  const localAsUtc = Date.UTC(year, monthIndex, day, hour, minute, second, millisecond);
  const initialOffset = getTimeZoneOffsetMinutes(new Date(localAsUtc), EASTERN_TIME_ZONE);
  if (initialOffset === null) return null;

  let utcTimestamp = localAsUtc - initialOffset * 60_000;
  const adjustedOffset = getTimeZoneOffsetMinutes(new Date(utcTimestamp), EASTERN_TIME_ZONE);
  if (adjustedOffset !== null && adjustedOffset !== initialOffset) {
    utcTimestamp = localAsUtc - adjustedOffset * 60_000;
  }

  return utcTimestamp;
}

function parseStatsTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const raw = String(value).trim();
  if (!raw) return null;

  if (HAS_EXPLICIT_TIMEZONE.test(raw)) {
    const parsed = new Date(raw).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }

  const easternParsed = parseEasternTimestampToUtc(raw);
  if (easternParsed !== null) return easternParsed;

  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPeakTimestamp(value) {
  const parsed = parseStatsTimestamp(value);
  if (parsed === null) return "";
  return new Date(parsed).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPeakDetail(peak) {
  if (!peak || typeof peak !== "object") return "";
  const count = Number(peak.count) || 0;
  const atText = formatPeakTimestamp(peak.at);
  return atText
    ? `All-time peak: ${formatNumber(count)} at ${atText}`
    : `All-time peak: ${formatNumber(count)}`;
}

function normalizeGlobalHistory(payload) {
  const rawHistory =
    (Array.isArray(payload) && payload) ||
    (Array.isArray(payload?.history) && payload.history) ||
    (Array.isArray(payload?.server_history) && payload.server_history) ||
    (Array.isArray(payload?.hourly_history) && payload.hourly_history) ||
    [];

  return rawHistory
    .map((point, index) => {
      const timestampSource = point?.hour_start || point?.day || point?.at || "";
      const timestamp = parseStatsTimestamp(timestampSource);
      return {
        _index: index,
        _timestamp: timestamp,
        servers: Number(point?.servers_count ?? point?.servers ?? 0) || 0,
        players: Number(point?.players_count ?? point?.players ?? 0) || 0,
      };
    })
    .sort((a, b) => {
      if (a._timestamp === null && b._timestamp === null) return a._index - b._index;
      if (a._timestamp === null) return 1;
      if (b._timestamp === null) return -1;
      return a._timestamp - b._timestamp;
    });
}

function normalizeRecentActivity(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.recentActivity)) return payload.recentActivity;
  if (Array.isArray(payload?.activity)) return payload.activity;
  if (Array.isArray(payload?.activities)) return payload.activities;
  return [];
}

function formatActivityTimestamp(timestamp) {
  if (!timestamp) return "--";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return String(timestamp);

  const now = new Date();
  const isSameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();

  if (isSameDay) {
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderRecentActivityRows(entries) {
  return entries
    .map(
      (entry) => `
        <li class="flex items-start justify-between gap-3 rounded-lg border border-sky-100 bg-slate-50/80 px-3 py-2">
          <p class="text-sm font-medium text-slate-800">${escapeHtml(entry.message || "No message")}</p>
          <span class="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">${escapeHtml(entry.age || "--")}</span>
        </li>
      `,
    )
    .join("");
}

function renderChartOrEmpty(holder, title, canvasId, hasData) {
  if (!hasData) {
    holder.innerHTML = emptyState(title, "No data points are available right now.");
    return null;
  }

  holder.innerHTML = `
    <div class="surface h-full">
      <div class="surface-body">
        <p class="text-sm font-semibold text-slate-800">${title}</p>
        <div class="chart-plot-surface mt-4">
          <div class="h-64">
          <canvas id="${canvasId}"></canvas>
          </div>
        </div>
      </div>
    </div>
  `;

  return holder.querySelector("canvas");
}

function renderMarkerToggleButton(showMarkers) {
  return `
    <button
      type="button"
      data-history-toggle-markers
      class="${
        showMarkers
          ? "rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
          : "btn-secondary px-3 py-1.5 text-xs"
      }"
      aria-pressed="${showMarkers ? "true" : "false"}"
    >
      ${showMarkers ? "Hide Markers" : "Show Markers"}
    </button>
  `;
}

function renderTimeChartCard(holder, { title, canvasId, hasFilteredData, fromValue, toValue, showMarkers }) {
  holder.innerHTML = `
    <div class="surface h-full">
      <div class="surface-body space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-sm font-semibold text-slate-800">${escapeHtml(title)}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            ${renderMarkerToggleButton(showMarkers)}
            <button type="button" data-history-range="24h" class="btn-secondary px-3 py-1.5 text-xs">24h</button>
            <button type="button" data-history-range="7d" class="btn-secondary px-3 py-1.5 text-xs">7d</button>
            <button type="button" data-history-range="30d" class="btn-secondary px-3 py-1.5 text-xs">30d</button>
            <button type="button" data-history-range="all" class="btn-secondary px-3 py-1.5 text-xs">All</button>
            <button type="button" data-history-reset-zoom class="btn-secondary px-3 py-1.5 text-xs">Reset Zoom</button>
          </div>
        </div>
        <div class="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <label class="grid gap-1 text-xs font-semibold text-slate-600">
            From
            <input id="overall-history-from" type="datetime-local" class="input-base py-2" value="${escapeHtml(fromValue)}" />
          </label>
          <label class="grid gap-1 text-xs font-semibold text-slate-600">
            To
            <input id="overall-history-to" type="datetime-local" class="input-base py-2" value="${escapeHtml(toValue)}" />
          </label>
          <div class="flex items-end">
            <button type="button" id="overall-history-apply" class="btn-secondary w-full">Apply Range</button>
          </div>
        </div>
        ${
          hasFilteredData
            ? `
              <div class="time-chart-surface h-80 sm:h-96">
                <canvas id="${canvasId}" class="h-full w-full"></canvas>
              </div>
            `
            : `
              <div class="time-chart-empty">
                No history points fall inside the selected time range.
              </div>
            `
        }
      </div>
    </div>
  `;

  return hasFilteredData ? holder.querySelector("canvas") : null;
}

function formatCoreLabel(label) {
  return `${String(label)} cores`;
}

export async function mountOverallStatsPage({ container }) {
  let chartInstances = [];
  let statsRefreshHandle = null;
  let activityRefreshHandle = null;
  let isDisposed = false;
  let historyRangeState = {
    mode: "recent",
    fromInput: "",
    toInput: "",
  };
  const historyMarkerState = {
    showMarkers: true,
  };
  let importantMarkers = [];
  let markersLoaded = false;

  container.innerHTML = `
    <section class="space-y-6">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="section-title">Overall Stats</h1>
          <p class="muted mt-1">
            Global usage metrics for HStats. Stats auto-refresh every 30 seconds.
          </p>
        </div>
        <button id="overall-refresh" class="btn-secondary">Refresh now</button>
      </header>
      <div id="overall-content">${loadingState("Loading global statistics...")}</div>
      <section class="surface">
        <div class="surface-body">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 class="section-title text-xl">Live Activity Feed</h2>
              <p class="muted mt-1">Recent telemetry events, refreshed every 10 seconds.</p>
            </div>
            <span class="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-brand-700">10s updates</span>
          </div>
          <ul id="overall-live-feed" class="mt-4 space-y-2">
            ${renderRecentActivityRows([{ message: "Loading recent activity...", age: "--" }])}
          </ul>
        </div>
      </section>
    </section>
  `;

  const content = container.querySelector("#overall-content");
  const refreshButton = container.querySelector("#overall-refresh");
  const activityList = container.querySelector("#overall-live-feed");

  const clearCharts = () => {
    chartInstances.forEach((chart) => chart.destroy());
    chartInstances = [];
  };

  async function ensureImportantMarkersLoaded() {
    if (markersLoaded) return;
    markersLoaded = true;
    try {
      const payload = await getImportantDateMarkers({ limit: 1000 });
      if (isDisposed) return;
      importantMarkers = normalizeImportantDateMarkers(payload);
    } catch {
      importantMarkers = normalizeImportantDateMarkers([]);
    }
  }

  async function loadData() {
    try {
      await ensureImportantMarkersLoaded();
      const historyRequest =
        historyRangeState.mode === "all"
          ? { all: true }
          : historyRangeState.fromInput || historyRangeState.toInput
            ? {
                from: historyRangeState.fromInput ? new Date(historyRangeState.fromInput).toISOString() : undefined,
                to: historyRangeState.toInput ? new Date(historyRangeState.toInput).toISOString() : undefined,
              }
            : { days: 30 };
      const [data, historyPayload] = await Promise.all([
        getGlobalStats(),
        getGlobalHistory(historyRequest).catch(() => ({ history: [] })),
      ]);
      if (isDisposed) return;

      const countries = sortedCountEntries(data.countries);
      const osNames = sortedCountEntries(data.os_names);
      const javaVersions = sortedCountEntries(data.java_versions);
      const coreCounts = sortedCountEntries(data.core_count);
      const allTimePeak = data.all_time_peak || {};
      const history = normalizeGlobalHistory(historyPayload);
      const historyTimestamps = history.map((point) => point._timestamp).filter((value) => value !== null);
      const historyMin = historyTimestamps.length > 0 ? historyTimestamps[0] : null;
      const historyMax = historyTimestamps.length > 0 ? historyTimestamps[historyTimestamps.length - 1] : null;

      if (
        historyRangeState.mode !== "all" &&
        !historyRangeState.fromInput &&
        !historyRangeState.toInput &&
        historyMin !== null &&
        historyMax !== null
      ) {
        historyRangeState.fromInput = formatDateTimeLocalInputValue(historyMin);
        historyRangeState.toInput = formatDateTimeLocalInputValue(historyMax);
      }
      const parsedHistoryFrom = parseDateTimeLocalInputValue(historyRangeState.fromInput);
      const parsedHistoryTo = parseDateTimeLocalInputValue(historyRangeState.toInput);

      content.innerHTML = `
        <div class="space-y-8">
          <section class="grid gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
            ${statCard({
              label: "Online Players",
              value: formatNumber(data.online_players),
              detail: formatPeakDetail(allTimePeak.players),
            })}
            ${statCard({
              label: "Online Servers",
              value: formatNumber(data.online_servers),
              detail: formatPeakDetail(allTimePeak.servers),
            })}
            ${statCard({ label: "Developers Signed Up", value: formatNumber(data.user_count || 0) })}
            ${statCard({ label: "Mods Tracked", value: formatNumber(data.plugin_count || 0) })}
            ${statCard({ label: "Countries", value: formatNumber(countries.length) })}
            ${statCard({ label: "OS Families", value: formatNumber(osNames.length) })}
          </section>
          <section class="space-y-6">
            <div id="overall-history"></div>
            <div class="grid gap-6 lg:grid-cols-4">
              <div id="overall-countries"></div>
              <div id="overall-os"></div>
              <div id="overall-java"></div>
              <div id="overall-cores"></div>
            </div>
          </section>
        </div>
      `;

      clearCharts();

      const timeHistoryCanvas = renderTimeChartCard(content.querySelector("#overall-history"), {
        title: "Global Servers and Players History (Hourly)",
        canvasId: "overall-history-canvas",
        hasFilteredData: history.length > 0,
        fromValue: historyRangeState.fromInput,
        toValue: historyRangeState.toInput,
        showMarkers: historyMarkerState.showMarkers,
      });
      const countriesCanvas = renderChartOrEmpty(
        content.querySelector("#overall-countries"),
        "Country Distribution",
        "overall-countries-canvas",
        countries.length > 0,
      );
      const osCanvas = renderChartOrEmpty(
        content.querySelector("#overall-os"),
        "Operating System Breakdown",
        "overall-os-canvas",
        osNames.length > 0,
      );
      const javaCanvas = renderChartOrEmpty(
        content.querySelector("#overall-java"),
        "Java Version Breakdown",
        "overall-java-canvas",
        javaVersions.length > 0,
      );
      const coreCanvas = renderChartOrEmpty(
        content.querySelector("#overall-cores"),
        "CPU Core Distribution",
        "overall-cores-canvas",
        coreCounts.length > 0,
      );

      if (timeHistoryCanvas) {
        chartInstances.push(
          createTimeSeriesChart(timeHistoryCanvas, {
            min: historyRangeState.mode === "all" ? undefined : parsedHistoryFrom ?? undefined,
            max: historyRangeState.mode === "all" ? undefined : parsedHistoryTo ?? undefined,
            datasets: [
              {
                label: "Servers",
                data: history
                  .filter((point) => point._timestamp !== null)
                  .map((point) => ({ x: point._timestamp, y: point.servers })),
                borderColor: "#ff2d2d",
                backgroundColor: "rgba(255, 45, 45, 0.2)",
              },
              {
                label: "Players",
                data: history
                  .filter((point) => point._timestamp !== null)
                  .map((point) => ({ x: point._timestamp, y: point.players })),
                borderColor: "#79ea00",
                backgroundColor: "rgba(132, 255, 0, 0.2)",
              },
            ],
            markers: importantMarkers,
            showMarkers: historyMarkerState.showMarkers,
            includeAllMarkers: historyRangeState.mode === "all",
          }),
        );
      }

      if (countriesCanvas) {
        chartInstances.push(
          createChart(countriesCanvas, {
            type: "pie",
            data: {
              labels: countries.map(([label]) => label),
              datasets: [
                {
                  data: countries.map(([, value]) => value),
                  backgroundColor: paletteFor(countries.length),
                },
              ],
            },
          }),
        );
      }

      if (osCanvas) {
        chartInstances.push(
          createChart(osCanvas, {
            type: "bar",
            data: {
              labels: osNames.map(([label]) => label),
              datasets: [
                {
                  label: "Servers",
                  data: osNames.map(([, value]) => value),
                  backgroundColor: paletteFor(osNames.length),
                  borderColor: paletteFor(osNames.length),
                  borderWidth: 1,
                },
              ],
            },
            options: {
              indexAxis: "y",
              scales: {
                x: { beginAtZero: true },
              },
            },
          }),
        );
      }

      if (javaCanvas) {
        chartInstances.push(
          createChart(javaCanvas, {
            type: "bar",
            data: {
              labels: javaVersions.map(([label]) => label),
              datasets: [
                {
                  label: "Servers",
                  data: javaVersions.map(([, value]) => value),
                  backgroundColor: paletteFor(javaVersions.length),
                  borderColor: paletteFor(javaVersions.length),
                  borderWidth: 1,
                },
              ],
            },
            options: {
              scales: {
                y: { beginAtZero: true },
              },
            },
          }),
        );
      }

      if (coreCanvas) {
        chartInstances.push(
          createChart(coreCanvas, {
            type: "pie",
            data: {
              labels: coreCounts.map(([label]) => formatCoreLabel(label)),
              datasets: [
                {
                  data: coreCounts.map(([, value]) => value),
                  backgroundColor: paletteFor(coreCounts.length),
                },
              ],
            },
          }),
        );
      }

      const overallHistoryFrom = content.querySelector("#overall-history-from");
      const overallHistoryTo = content.querySelector("#overall-history-to");
      const overallHistoryApply = content.querySelector("#overall-history-apply");
      const overallHistoryPresetButtons = Array.from(content.querySelectorAll("button[data-history-range]"));
      const overallHistoryResetZoom = content.querySelector("button[data-history-reset-zoom]");
      const overallHistoryToggleMarkers = content.querySelector("button[data-history-toggle-markers]");
      const currentHistoryChart = chartInstances[0] || null;

      overallHistoryToggleMarkers?.addEventListener("click", async () => {
        historyMarkerState.showMarkers = !historyMarkerState.showMarkers;
        await loadData();
      });

      overallHistoryApply?.addEventListener("click", async () => {
        const nextFrom = overallHistoryFrom?.value || "";
        const nextTo = overallHistoryTo?.value || "";
        const parsedFrom = parseDateTimeLocalInputValue(nextFrom);
        const parsedTo = parseDateTimeLocalInputValue(nextTo);

        if (parsedFrom !== null && parsedTo !== null && parsedFrom > parsedTo) {
          window.alert("The start time must be before the end time.");
          return;
        }

        historyRangeState = {
          mode: nextFrom || nextTo ? "range" : "recent",
          fromInput: nextFrom,
          toInput: nextTo,
        };
        await loadData();
      });

      overallHistoryPresetButtons.forEach((button) => {
        button.addEventListener("click", async () => {
          const preset = button.getAttribute("data-history-range");
          if (!preset) return;

          if (preset === "all") {
            historyRangeState = {
              mode: "all",
              fromInput: "",
              toInput: "",
            };
            await loadData();
            return;
          }

          const hours = preset === "24h" ? 24 : preset === "7d" ? 24 * 7 : 24 * 30;
          const end = Date.now();
          const start = end - hours * 60 * 60 * 1000;
          historyRangeState = {
            mode: "range",
            fromInput: formatDateTimeLocalInputValue(start),
            toInput: formatDateTimeLocalInputValue(end),
          };
          await loadData();
        });
      });

      overallHistoryResetZoom?.addEventListener("click", () => {
        currentHistoryChart?.resetZoom?.();
      });
    } catch (error) {
      if (isDisposed) return;
      clearCharts();
      content.innerHTML = errorState(error.message || "Failed to fetch overall stats.");
    }
  }

  async function loadRecentActivity({ initial = false } = {}) {
    try {
      const payload = await getRecentActivity();
      if (isDisposed) return;

      const items = normalizeRecentActivity(payload);
      if (!Array.isArray(items) || items.length === 0) {
        activityList.innerHTML = renderRecentActivityRows([{ message: "No recent activity yet.", age: "--" }]);
        return;
      }

      activityList.innerHTML = renderRecentActivityRows(
        items.slice(0, 10).map((item) => ({
          message: item?.message || "No message",
          age: formatActivityTimestamp(item?.timestamp),
        })),
      );
    } catch {
      if (isDisposed || !initial) return;
      activityList.innerHTML = renderRecentActivityRows([{ message: "Unable to load recent activity.", age: "--" }]);
    }
  }

  refreshButton.addEventListener("click", () => {
    content.innerHTML = loadingState("Refreshing global statistics...");
    void loadData();
    void loadRecentActivity();
  });

  await Promise.all([
    loadData(),
    loadRecentActivity({ initial: true }),
  ]);

  statsRefreshHandle = window.setInterval(loadData, OVERALL_STATS_REFRESH_MS);
  activityRefreshHandle = window.setInterval(() => {
    void loadRecentActivity();
  }, RECENT_ACTIVITY_REFRESH_MS);

  return {
    cleanup: () => {
      isDisposed = true;
      clearCharts();
      if (statsRefreshHandle) window.clearInterval(statsRefreshHandle);
      if (activityRefreshHandle) window.clearInterval(activityRefreshHandle);
    },
  };
}
