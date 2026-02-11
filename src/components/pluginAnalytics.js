import { createChart, paletteFor, sortedCountEntries } from "./charts";
import { statCard } from "./statCard";
import { emptyState } from "./emptyState";
import { renderDeveloperButtons } from "./developerLinks";
import { formatDateLabel, formatNumber } from "../utils/format";
import { escapeHtml } from "../utils/escapeHtml";

function renderCanvasOrEmpty(holderElement, canvasId, title, hasData) {
  if (!hasData) {
    holderElement.innerHTML = emptyState(title, "No data has been reported yet.");
    return null;
  }

  holderElement.innerHTML = `
    <div class="surface h-full">
      <div class="surface-body">
        <p class="text-sm font-semibold text-slate-800">${escapeHtml(title)}</p>
        <div class="mt-4 h-64">
          <canvas id="${canvasId}"></canvas>
        </div>
      </div>
    </div>
  `;
  return holderElement.querySelector("canvas");
}

export function renderPluginAnalytics(container, { pluginUuid, pluginInfo, developerInfo, showUuid = true }) {
  const history = Array.isArray(pluginInfo.history) ? pluginInfo.history : [];
  const countries = sortedCountEntries(pluginInfo.countries);
  const javaVersions = sortedCountEntries(pluginInfo.java_versions);
  const osNames = sortedCountEntries(pluginInfo.os_names);

  container.innerHTML = `
    <div class="space-y-6">
      <section class="grid gap-4 lg:grid-cols-2">
        <article class="surface">
          <div class="surface-body">
            <p class="text-sm font-semibold uppercase tracking-wide text-slate-500">Mod</p>
            <p class="mt-2 text-2xl font-extrabold text-slate-900">${escapeHtml(pluginInfo.name || "Unknown")}</p>
            ${
              showUuid
                ? `
                  <div class="mt-2 flex flex-wrap items-center gap-2">
                    <p class="font-mono text-[11px] text-slate-600">${escapeHtml(pluginUuid)}</p>
                    <button
                      class="btn-secondary px-3 py-1.5 text-xs"
                      data-action="copy-plugin-uuid"
                      data-uuid="${escapeHtml(pluginUuid)}"
                      type="button"
                    >
                      Copy UUID
                    </button>
                  </div>
                `
                : ""
            }
            ${
              developerInfo === undefined
                ? ""
                : `
                  <div class="mt-4">
                    <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Developer</p>
                    ${renderDeveloperButtons(developerInfo)}
                  </div>
                `
            }
          </div>
        </article>
        <div class="grid gap-4 sm:grid-cols-2">
          ${statCard({ label: "Active Servers", value: formatNumber(pluginInfo.total_servers) })}
          ${statCard({ label: "Total Players", value: formatNumber(pluginInfo.total_players) })}
        </div>
      </section>
      <section class="surface">
        <div class="surface-body">
          <p class="text-sm font-semibold text-slate-800">Known Versions</p>
          <div class="mt-3 flex flex-wrap gap-2">
            ${
              Array.isArray(pluginInfo.versions) && pluginInfo.versions.length > 0
                ? pluginInfo.versions
                    .map(
                      (version) => 
                        `<span class="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-brand-700">${escapeHtml(version)}</span>`,
                    )
                    .join("")
                : `<span class="text-sm text-slate-600">No versions reported yet.</span>`
            }
          </div>
        </div>
      </section>
      <section class="grid gap-4 lg:grid-cols-2">
        <div id="plugin-history-holder"></div>
        <div id="plugin-countries-holder"></div>
        <div id="plugin-java-holder"></div>
        <div id="plugin-os-holder"></div>
      </section>
    </div>
  `;

  const chartInstances = [];
  const historyCanvas = renderCanvasOrEmpty(
    container.querySelector("#plugin-history-holder"),
    "plugin-history-canvas",
    "Daily History",
    history.length > 0,
  );
  const countriesCanvas = renderCanvasOrEmpty(
    container.querySelector("#plugin-countries-holder"),
    "plugin-countries-canvas",
    "Countries",
    countries.length > 0,
  );
  const javaCanvas = renderCanvasOrEmpty(
    container.querySelector("#plugin-java-holder"),
    "plugin-java-canvas",
    "Java Versions",
    javaVersions.length > 0,
  );
  const osCanvas = renderCanvasOrEmpty(
    container.querySelector("#plugin-os-holder"),
    "plugin-os-canvas",
    "Operating Systems",
    osNames.length > 0,
  );

  if (historyCanvas) {
    chartInstances.push(
      createChart(historyCanvas, {
        type: "line",
        data: {
          labels: history.map((point) => formatDateLabel(point.day)),
          datasets: [
            {
              label: "Servers",
              data: history.map((point) => Number(point.servers_count) || 0),
              borderColor: "#0284c7",
              backgroundColor: "rgba(2, 132, 199, 0.16)",
              fill: true,
              tension: 0.35,
            },
            {
              label: "Players",
              data: history.map((point) => Number(point.players_count) || 0),
              borderColor: "#06b6d4",
              backgroundColor: "rgba(6, 182, 212, 0.16)",
              fill: true,
              tension: 0.35,
            },
          ],
        },
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
              backgroundColor: "#38bdf8",
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
              backgroundColor: "#0ea5e9",
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

  return () => {
    chartInstances.forEach((chart) => chart.destroy());
  };
}
