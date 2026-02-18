import { getGlobalStats, getRecentActivity } from "../api/serverApi";
import { OVERALL_STATS_REFRESH_MS } from "../config";
import { createChart, paletteFor, sortedCountEntries } from "../components/charts";
import { statCard } from "../components/statCard";
import { loadingState } from "../components/loadingState";
import { emptyState } from "../components/emptyState";
import { errorState } from "../components/errorState";
import { formatNumber } from "../utils/format";
import { escapeHtml } from "../utils/escapeHtml";

const RECENT_ACTIVITY_REFRESH_MS = 10_000;

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
        <div class="mt-4 h-64">
          <canvas id="${canvasId}"></canvas>
        </div>
      </div>
    </div>
  `;

  return holder.querySelector("canvas");
}

function formatCoreLabel(label) {
  return `${String(label)} cores`;
}

export async function mountOverallStatsPage({ container }) {
  let chartInstances = [];
  let statsRefreshHandle = null;
  let activityRefreshHandle = null;
  let isDisposed = false;

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

  async function loadData() {
    try {
      const data = await getGlobalStats();
      if (isDisposed) return;

      const countries = sortedCountEntries(data.countries);
      const osNames = sortedCountEntries(data.os_names);
      const javaVersions = sortedCountEntries(data.java_versions);
      const coreCounts = sortedCountEntries(data.core_count);

      content.innerHTML = `
        <div class="space-y-8">
          <section class="grid gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
            ${statCard({ label: "Online Players", value: formatNumber(data.online_players) })}
            ${statCard({ label: "Online Servers", value: formatNumber(data.online_servers) })}
            ${statCard({ label: "Developers Signed Up", value: formatNumber(data.user_count || 0) })}
            ${statCard({ label: "Mods Tracked", value: formatNumber(data.plugin_count || 0) })}
            ${statCard({ label: "Countries", value: formatNumber(countries.length) })}
            ${statCard({ label: "OS Families", value: formatNumber(osNames.length) })}
            ${statCard({ label: "Core Buckets", value: formatNumber(coreCounts.length) })}
          </section>
          <section class="grid gap-6 lg:grid-cols-4">
            <div id="overall-countries"></div>
            <div id="overall-os"></div>
            <div id="overall-java"></div>
            <div id="overall-cores"></div>
          </section>
        </div>
      `;

      clearCharts();

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
