import { API_ROOT } from "../config";
import { createChart, paletteFor, sortedCountEntries } from "./charts";
import { statCard } from "./statCard";
import { emptyState } from "./emptyState";
import { renderDeveloperButtons } from "./developerLinks";
import { formatDateLabel, formatNumber } from "../utils/format";
import { escapeHtml } from "../utils/escapeHtml";

const DEFAULT_EMBED_OPTIONS = {
  theme: "light",
  layout: "compact",
  size: "md",
  dark: false,
};

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

function buildEmbedCardUrl(pluginUuid, options, { cacheBust = false } = {}) {
  const safeUuid = encodeURIComponent(pluginUuid || "");
  const params = new URLSearchParams();

  params.set("theme", options.theme);
  params.set("layout", options.layout);
  params.set("size", options.size);
  params.set("show_id", "true");
  params.set("dark", String(options.dark));

  if (cacheBust) {
    params.set("t", String(Date.now()));
  }

  return `${API_ROOT}/embed/${safeUuid}/card.svg?${params.toString()}`;
}

function renderEmbedCardControls(pluginUuid, pluginName) {
  const initialUrl = buildEmbedCardUrl(pluginUuid, DEFAULT_EMBED_OPTIONS);
  const initialPreviewUrl = buildEmbedCardUrl(pluginUuid, DEFAULT_EMBED_OPTIONS, { cacheBust: true });

  return `
    <section class="surface">
      <div class="surface-body space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p class="text-sm font-semibold text-slate-900">Embed Card</p>
            <p class="mt-1 text-sm text-slate-600">Configure and preview a shareable SVG card for this mod. Use the link to display on the description of your mod pages.</p>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label class="grid gap-1 text-xs font-semibold text-slate-600">
            Theme
            <select id="embed-theme" class="input-base py-2">
              <option value="light" selected>Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label class="grid gap-1 text-xs font-semibold text-slate-600">
            Layout
            <select id="embed-layout" class="input-base py-2">
              <option value="compact" selected>Compact</option>
              <option value="stacked">Stacked</option>
            </select>
          </label>
          <label class="grid gap-1 text-xs font-semibold text-slate-600">
            Size
            <select id="embed-size" class="input-base py-2">
              <option value="sm">Small</option>
              <option value="md" selected>Medium</option>
              <option value="lg">Large</option>
            </select>
          </label>
        </div>

        <label class="inline-flex items-center gap-2 rounded-lg border border-sky-100 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          <input id="embed-dark-alias" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
          Force dark (alias)
        </label>

        <div class="space-y-3">
          <div class="rounded-xl border border-sky-100 bg-slate-50 p-3">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p>
            <p class="mt-1 text-[11px] text-slate-500">Size changes are applied in the URL, but preview is scaled to fit this panel.</p>
            <div class="mt-2 overflow-hidden rounded-lg border border-sky-100 bg-white p-3">
              <img
                id="embed-preview-image"
                src="${escapeHtml(initialPreviewUrl)}"
                alt="Embed preview for ${escapeHtml(pluginName)}"
                loading="lazy"
                class="h-auto w-full rounded"
              />
            </div>
          </div>

          <div class="space-y-1">
            <label for="embed-url-output" class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Embed URL</label>
            <div class="flex flex-col gap-2 sm:flex-row">
              <input id="embed-url-output" type="text" readonly class="input-base w-full py-1.5 font-mono text-[10px]" value="${escapeHtml(initialUrl)}" />
              <button id="embed-copy-url" type="button" class="btn-secondary px-3 py-1.5 text-xs whitespace-nowrap">Copy URL</button>
            </div>
            <p id="embed-copy-status" class="text-[11px] text-slate-500"></p>
          </div>
        </div>
      </div>
    </section>
  `;
}

export function renderPluginAnalytics(container, { pluginUuid, pluginInfo, developerInfo, showUuid = true }) {
  const history = Array.isArray(pluginInfo.history) ? pluginInfo.history : [];
  const countries = sortedCountEntries(pluginInfo.countries);
  const javaVersions = sortedCountEntries(pluginInfo.java_versions);
  const osNames = sortedCountEntries(pluginInfo.os_names);
  const pluginName = pluginInfo.name || "Unknown";

  container.innerHTML = `
    <div class="space-y-6">
      <section class="grid gap-4 lg:grid-cols-2">
        <article class="surface">
          <div class="surface-body">
            <p class="text-sm font-semibold uppercase tracking-wide text-slate-500">Mod</p>
            <p class="mt-2 text-2xl font-extrabold text-slate-900">${escapeHtml(pluginName)}</p>
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

      ${renderEmbedCardControls(pluginUuid, pluginName)}
    </div>
  `;

  const chartInstances = [];
  const listenersCleanup = [];
  let copyStatusTimeout = null;

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

  const themeSelect = container.querySelector("#embed-theme");
  const layoutSelect = container.querySelector("#embed-layout");
  const sizeSelect = container.querySelector("#embed-size");
  const darkAliasInput = container.querySelector("#embed-dark-alias");
  const previewImage = container.querySelector("#embed-preview-image");
  const urlOutput = container.querySelector("#embed-url-output");
  const copyUrlButton = container.querySelector("#embed-copy-url");
  const copyStatus = container.querySelector("#embed-copy-status");

  const bindListener = (element, eventName, handler) => {
    if (!element) return;
    element.addEventListener(eventName, handler);
    listenersCleanup.push(() => element.removeEventListener(eventName, handler));
  };

  if (
    themeSelect &&
    layoutSelect &&
    sizeSelect &&
    darkAliasInput &&
    previewImage &&
    urlOutput &&
    copyUrlButton &&
    copyStatus
  ) {
    const readEmbedOptions = () => ({
      theme: themeSelect.value,
      layout: layoutSelect.value,
      size: sizeSelect.value,
      dark: darkAliasInput.checked,
    });

    const refreshEmbedPreview = () => {
      const options = readEmbedOptions();
      const finalUrl = buildEmbedCardUrl(pluginUuid, options);

      urlOutput.value = finalUrl;
      previewImage.src = buildEmbedCardUrl(pluginUuid, options, { cacheBust: true });
      copyStatus.textContent = "";
    };

    const onCopyUrlClick = async () => {
      try {
        await navigator.clipboard.writeText(urlOutput.value);
        copyStatus.textContent = "Embed URL copied.";
      } catch {
        copyStatus.textContent = "Copy failed. You can copy the URL field manually.";
      }

      if (copyStatusTimeout) {
        window.clearTimeout(copyStatusTimeout);
      }
      copyStatusTimeout = window.setTimeout(() => {
        copyStatus.textContent = "";
      }, 2600);
    };

    bindListener(themeSelect, "change", refreshEmbedPreview);
    bindListener(layoutSelect, "change", refreshEmbedPreview);
    bindListener(sizeSelect, "change", refreshEmbedPreview);
    bindListener(darkAliasInput, "change", refreshEmbedPreview);
    bindListener(copyUrlButton, "click", onCopyUrlClick);
  }

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
    listenersCleanup.forEach((cleanup) => cleanup());
    if (copyStatusTimeout) {
      window.clearTimeout(copyStatusTimeout);
    }
  };
}

