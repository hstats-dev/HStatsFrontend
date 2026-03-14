import { API_ROOT } from "../config";
import { applyPluginLinks } from "../api/pluginApi";
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
const VERSION_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
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

  // Recalculate once after adjustment to handle DST boundaries accurately.
  const adjustedOffset = getTimeZoneOffsetMinutes(new Date(utcTimestamp), EASTERN_TIME_ZONE);
  if (adjustedOffset !== null && adjustedOffset !== initialOffset) {
    utcTimestamp = localAsUtc - adjustedOffset * 60_000;
  }

  return utcTimestamp;
}

function parseHistoryTimestamp(value) {
  if (!value) return null;
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

function normalizePluginHistory(history) {
  return history
    .map((point, index) => {
      const timestampSource = point?.hour_start || point?.day || "";
      const parsedTimestamp = parseHistoryTimestamp(timestampSource);
      return {
        ...point,
        _index: index,
        _timestamp: parsedTimestamp,
        _timestampSource: timestampSource,
      };
    })
    .sort((a, b) => {
      if (a._timestamp === null && b._timestamp === null) return a._index - b._index;
      if (a._timestamp === null) return 1;
      if (b._timestamp === null) return -1;
      return a._timestamp - b._timestamp;
    });
}

function formatHistoryLabel(point) {
  if (point?._timestamp !== null) {
    return new Date(point._timestamp).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return formatDateLabel(point?.day || point?._timestampSource || "");
}

function normalizeVersionEntries(versions) {
  if (Array.isArray(versions)) {
    return versions
      .map((version) => [String(version || "").trim(), null])
      .filter(([version]) => version);
  }

  if (versions && typeof versions === "object") {
    return Object.entries(versions)
      .map(([version, count]) => [String(version || "").trim(), Number(count) || 0])
      .filter(([version, count]) => version && count > 0)
      .sort((a, b) => b[1] - a[1]);
  }

  return [];
}

function normalizeCoPlugins(coPlugins, currentPluginUuid) {
  if (!Array.isArray(coPlugins)) return [];

  return coPlugins
    .map((item) => ({
      name: String(item?.name || "").trim() || "Unknown mod",
      uuid: String(item?.uuid || "").trim(),
      timesSeen: Number(item?.times_seen) || 0,
    }))
    .filter((item) => item.uuid && item.uuid !== currentPluginUuid);
}

function renderCoPluginItem(item) {
  return `
    <a
      href="/mods/${encodeURIComponent(item.uuid)}"
      data-link
      class="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-800 transition hover:border-sky-300 hover:bg-sky-50"
    >
      <span class="text-brand-700">${escapeHtml(item.name)}</span>
      <span class="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-brand-700">${escapeHtml(formatNumber(item.timesSeen))}</span>
    </a>
  `;
}

function resolveDeveloperId(developerInfo) {
  const accountId = developerInfo?.account?.id;
  const directId = developerInfo?.id;
  const idValue = accountId || directId;
  if (!idValue) return "";
  return String(idValue).trim();
}

function compareVersionsDesc(a, b) {
  return VERSION_COLLATOR.compare(String(b || ""), String(a || ""));
}

function sortVersionEntries(entries, mode = "count") {
  const sorted = [...entries];
  if (mode === "version") {
    sorted.sort((a, b) => {
      const byVersion = compareVersionsDesc(a[0], b[0]);
      if (byVersion !== 0) return byVersion;
      return (Number(b[1]) || 0) - (Number(a[1]) || 0);
    });
    return sorted;
  }

  sorted.sort((a, b) => {
    const aCount = Number(a[1]);
    const bCount = Number(b[1]);
    const aHasCount = Number.isFinite(aCount) && a[1] !== null;
    const bHasCount = Number.isFinite(bCount) && b[1] !== null;

    if (aHasCount && bHasCount && aCount !== bCount) {
      return bCount - aCount;
    }
    if (aHasCount !== bHasCount) {
      return aHasCount ? -1 : 1;
    }
    return compareVersionsDesc(a[0], b[0]);
  });

  return sorted;
}

function renderVersionBadge([version, count]) {
  if (count === null) {
    return `<span class="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-brand-700">${escapeHtml(version)}</span>`;
  }

  return `
    <span class="inline-flex items-center overflow-hidden rounded-full border border-sky-200 text-xs font-semibold">
      <span class="bg-sky-100 px-3 py-1 text-brand-700">${escapeHtml(version)}</span>
      <span class="bg-lime-100 px-2.5 py-1 text-lime-800">${escapeHtml(formatNumber(count))}</span>
    </span>
  `;
}

function formatCoreLabel(label) {
  return `${String(label)} cores`;
}

function formatPeakTimestamp(value) {
  const parsed = parseHistoryTimestamp(value);
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
              <option value="history">History</option>
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

export function renderPluginAnalytics(
  container,
  {
    pluginUuid,
    privatePluginUuid = "",
    pluginInfo,
    developerInfo,
    showUuid = true,
    editablePluginLinks = false,
    onPluginLinksSaved = null,
    onNotify = null,
  },
) {
  const history = normalizePluginHistory(Array.isArray(pluginInfo.history) ? pluginInfo.history : []);
  const countries = sortedCountEntries(pluginInfo.countries);
  const javaVersions = sortedCountEntries(pluginInfo.java_versions);
  const osNames = sortedCountEntries(pluginInfo.os_names);
  const coreCounts = sortedCountEntries(pluginInfo.core_count || pluginInfo.core_counts);
  const versionEntries = normalizeVersionEntries(pluginInfo.versions);
  const coPlugins = normalizeCoPlugins(pluginInfo.co_plugins, pluginUuid);
  const developerId = resolveDeveloperId(developerInfo);
  const allTimePeak = pluginInfo.all_time_peak || {};
  const pluginName = pluginInfo.name || "Unknown";
  const pluginLinks = pluginInfo.links && typeof pluginInfo.links === "object"
    ? pluginInfo.links
    : {
        github_link: pluginInfo.github_link || "",
        curseforge_link: pluginInfo.curseforge_link || "",
      };
  const linkDisplayInfo = {
    ...(developerInfo || {}),
    links: pluginLinks,
  };
  const dashboardSettingsMarkup = `
    <section class="surface">
      <div class="surface-body space-y-4">
        <div>
          <p class="text-sm font-semibold uppercase tracking-wide text-slate-500">Mod Settings</p>
          <p class="mt-2 text-2xl font-extrabold text-slate-900">${escapeHtml(pluginName)}</p>
        </div>
        <div class="space-y-3 rounded-xl border border-sky-100 bg-slate-50 p-3">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Mod ID</span>
            <p class="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-700">${escapeHtml(pluginUuid)}</p>
            <button
              class="btn-secondary px-3 py-1.5 text-xs"
              data-copy-value="${escapeHtml(pluginUuid)}"
              data-copy-label="Mod ID"
              type="button"
            >
              Copy Mod ID
            </button>
          </div>
          ${
            privatePluginUuid
              ? `
                <div class="rounded-lg border border-red-300/70 bg-slate-900/[0.03] p-2.5">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-[11px] font-semibold uppercase tracking-wide text-red-700">Server Reporting Key (Private)</span>
                    <button
                      class="rounded-lg border border-red-300/70 bg-slate-900/[0.04] px-2.5 py-1 text-[11px] font-semibold text-red-700 transition hover:bg-slate-900/[0.08]"
                      data-copy-value="${escapeHtml(privatePluginUuid)}"
                      data-copy-label="Server Reporting Key"
                      type="button"
                    >
                      Copy
                    </button>
                    <span class="text-[11px] text-slate-600">Keep this private. Used in your mod's code to report stats.</span>
                  </div>
                  <div
                    data-private-plugin-uuid
                    role="button"
                    tabindex="0"
                    aria-expanded="false"
                    class="mt-2 overflow-x-auto whitespace-nowrap rounded-md border border-red-200/70 bg-slate-900/[0.05] px-2 py-1.5 font-mono text-[11px] text-slate-700 blur-[4px] select-none transition cursor-pointer"
                  >${escapeHtml(privatePluginUuid)}</div>
                </div>
              `
              : ""
          }
        </div>
        <div class="rounded-xl border border-sky-100 bg-slate-50 p-3">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Mod Links</p>
              <p class="mt-1 text-xs text-slate-600">These links appear on the mod page and in public listings.</p>
            </div>
            <button id="plugin-links-submit" type="submit" form="plugin-links-form" class="btn-secondary self-start">Save</button>
          </div>
          <form id="plugin-links-form" class="mt-3 grid gap-2">
            <label class="grid gap-1 text-xs font-semibold text-slate-600">
              GitHub Link
              <input
                id="plugin-github-link"
                type="url"
                class="input-base"
                placeholder="https://github.com/example/repo"
                value="${escapeHtml(pluginLinks.github_link || "")}"
              />
            </label>
            <label class="grid gap-1 text-xs font-semibold text-slate-600">
              CurseForge Link
              <input
                id="plugin-curseforge-link"
                type="url"
                class="input-base"
                placeholder="https://www.curseforge.com/hytale/mods/example"
                value="${escapeHtml(pluginLinks.curseforge_link || "")}"
              />
            </label>
          </form>
        </div>
      </div>
    </section>
  `;
  const dashboardStatsMarkup = `
    <section class="surface">
      <div class="surface-body space-y-4">
        <div>
          <p class="text-sm font-semibold uppercase tracking-wide text-slate-500">Stats</p>
          <p class="mt-1 text-sm text-slate-600">Current totals and all-time peaks for this mod.</p>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          ${statCard({
            label: "Active Servers",
            value: formatNumber(pluginInfo.total_servers),
            detail: formatPeakDetail(allTimePeak.servers),
          })}
          ${statCard({
            label: "Total Players",
            value: formatNumber(pluginInfo.total_players),
            detail: formatPeakDetail(allTimePeak.players),
          })}
        </div>
      </div>
    </section>
  `;

  container.innerHTML = `
    <div class="space-y-6">
      ${
        editablePluginLinks
          ? `${dashboardSettingsMarkup}${dashboardStatsMarkup}`
          : `
            <section class="grid items-start gap-4 lg:grid-cols-2">
              <article class="surface">
                <div class="surface-body">
                  <p class="text-sm font-semibold uppercase tracking-wide text-slate-500">Mod</p>
                  <p class="mt-2 text-2xl font-extrabold text-slate-900">${escapeHtml(pluginName)}</p>
                  ${
                    showUuid
                      ? `
                        <div class="mt-3 space-y-2 rounded-xl border border-sky-100 bg-slate-50 p-3">
                          <div class="flex flex-wrap items-center gap-2">
                            <span class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Mod ID</span>
                            <p class="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-700">${escapeHtml(pluginUuid)}</p>
                            <button
                              class="btn-secondary px-3 py-1.5 text-xs"
                              data-copy-value="${escapeHtml(pluginUuid)}"
                              data-copy-label="Mod ID"
                              type="button"
                            >
                              Copy Mod ID
                            </button>
                          </div>
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
                          ${
                            developerId
                              ? `
                                <a
                                  href="/developers/${encodeURIComponent(developerId)}"
                                  data-link
                                  class="mt-2 inline-flex items-center gap-2 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-soft transition hover:bg-brand-700 hover:text-white"
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true" class="h-3.5 w-3.5" fill="none">
                                    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" stroke-width="2" />
                                    <path d="M4 20a8 8 0 0 1 16 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                                  </svg>
                                  <span>View Developer Profile</span>
                                </a>
                              `
                              : ""
                          }
                          ${renderDeveloperButtons(linkDisplayInfo)}
                        </div>
                      `
                  }
                </div>
              </article>
              <div class="grid self-start gap-4">
                ${statCard({
                  label: "Active Servers",
                  value: formatNumber(pluginInfo.total_servers),
                  detail: formatPeakDetail(allTimePeak.servers),
                })}
                ${statCard({
                  label: "Total Players",
                  value: formatNumber(pluginInfo.total_players),
                  detail: formatPeakDetail(allTimePeak.players),
                })}
              </div>
            </section>
          `
      }

      <section class="surface">
        <div class="surface-body">
          <div class="inline-flex rounded-lg border border-sky-200 bg-sky-50 p-1">
            <button
              type="button"
              data-version-sort="count"
              class="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 shadow-sm"
              aria-pressed="true"
              ${versionEntries.length === 0 ? "disabled" : ""}
            >
              By Usage
            </button>
            <button
              type="button"
              data-version-sort="version"
              class="rounded-md px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:text-slate-900"
              aria-pressed="false"
              ${versionEntries.length === 0 ? "disabled" : ""}
            >
              By Version
            </button>
          </div>
          <p class="mt-3 text-sm font-semibold text-slate-800">Known Versions</p>
          <div id="plugin-versions-list" class="mt-3 flex flex-wrap gap-2"></div>
        </div>
      </section>

      <section class="surface">
        <div class="surface-body">
          <p class="text-sm font-semibold text-slate-800">Mods Installed Together</p>
          <div id="plugin-co-plugins-list" class="mt-3 flex flex-wrap gap-2">
          </div>
          <div class="mt-3">
            <button
              type="button"
              data-action="toggle-co-plugins"
              class="hidden rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-sky-100"
              aria-expanded="false"
            >
              Show More
            </button>
          </div>
        </div>
      </section>
      <section class="grid gap-4 lg:grid-cols-2">
        <div id="plugin-history-holder"></div>
        <div id="plugin-countries-holder"></div>
        <div id="plugin-java-holder"></div>
        <div id="plugin-os-holder"></div>
        <div id="plugin-cores-holder"></div>
      </section>

      ${renderEmbedCardControls(pluginUuid, pluginName)}
    </div>
  `;

  const chartInstances = [];
  const listenersCleanup = [];
  let copyStatusTimeout = null;
  let versionSortMode = "count";
  let coPluginsExpanded = false;

  const historyCanvas = renderCanvasOrEmpty(
    container.querySelector("#plugin-history-holder"),
    "plugin-history-canvas",
    "Server and Player History",
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
  const coreCanvas = renderCanvasOrEmpty(
    container.querySelector("#plugin-cores-holder"),
    "plugin-cores-canvas",
    "CPU Core Distribution",
    coreCounts.length > 0,
  );

  const themeSelect = container.querySelector("#embed-theme");
  const layoutSelect = container.querySelector("#embed-layout");
  const sizeSelect = container.querySelector("#embed-size");
  const darkAliasInput = container.querySelector("#embed-dark-alias");
  const previewImage = container.querySelector("#embed-preview-image");
  const urlOutput = container.querySelector("#embed-url-output");
  const copyUrlButton = container.querySelector("#embed-copy-url");
  const copyStatus = container.querySelector("#embed-copy-status");
  const versionsList = container.querySelector("#plugin-versions-list");
  const versionSortButtons = Array.from(container.querySelectorAll("button[data-version-sort]"));
  const privatePluginKey = container.querySelector("[data-private-plugin-uuid]");
  const coPluginsList = container.querySelector("#plugin-co-plugins-list");
  const coPluginsToggle = container.querySelector('button[data-action="toggle-co-plugins"]');
  const pluginLinksForm = container.querySelector("#plugin-links-form");
  const pluginGithubLinkInput = container.querySelector("#plugin-github-link");
  const pluginCurseforgeLinkInput = container.querySelector("#plugin-curseforge-link");
  const pluginLinksSubmit = container.querySelector("#plugin-links-submit");

  const bindListener = (element, eventName, handler) => {
    if (!element) return;
    element.addEventListener(eventName, handler);
    listenersCleanup.push(() => element.removeEventListener(eventName, handler));
  };

  const renderVersions = () => {
    if (!versionsList) return;

    if (versionEntries.length === 0) {
      versionsList.innerHTML = `<span class="text-sm text-slate-600">No versions reported yet.</span>`;
      return;
    }

    const sortedEntries = sortVersionEntries(versionEntries, versionSortMode);
    versionsList.innerHTML = sortedEntries.map((entry) => renderVersionBadge(entry)).join("");

    versionSortButtons.forEach((button) => {
      const mode = button.getAttribute("data-version-sort");
      const isActive = mode === versionSortMode;
      button.className = isActive
        ? "rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 shadow-sm"
        : "rounded-md px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:text-slate-900";
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  const renderCoPlugins = () => {
    if (!coPluginsList) return;

    if (coPlugins.length === 0) {
      coPluginsList.innerHTML = `<span class="text-sm text-slate-600">No co-install data reported yet.</span>`;
      if (coPluginsToggle) coPluginsToggle.classList.add("hidden");
      return;
    }

    const visibleItems = coPluginsExpanded ? coPlugins : coPlugins.slice(0, 10);
    coPluginsList.innerHTML = visibleItems.map((item) => renderCoPluginItem(item)).join("");

    if (!coPluginsToggle) return;
    const remainingCount = Math.max(0, coPlugins.length - 10);
    if (remainingCount === 0) {
      coPluginsToggle.classList.add("hidden");
      return;
    }

    coPluginsToggle.classList.remove("hidden");
    coPluginsToggle.textContent = coPluginsExpanded ? "Show Less" : `Show ${remainingCount} More`;
    coPluginsToggle.setAttribute("aria-expanded", coPluginsExpanded ? "true" : "false");
  };

  versionSortButtons.forEach((button) => {
    bindListener(button, "click", () => {
      const mode = button.getAttribute("data-version-sort");
      if (!mode || mode === versionSortMode) return;
      versionSortMode = mode === "version" ? "version" : "count";
      renderVersions();
    });
  });
  renderVersions();
  renderCoPlugins();

  if (privatePluginKey) {
    const togglePrivatePluginKey = () => {
      const isRevealed = privatePluginKey.getAttribute("aria-expanded") === "true";
      privatePluginKey.setAttribute("aria-expanded", isRevealed ? "false" : "true");
      privatePluginKey.classList.toggle("blur-[4px]", isRevealed);
      privatePluginKey.classList.toggle("select-none", isRevealed);
    };

    bindListener(privatePluginKey, "click", togglePrivatePluginKey);
    bindListener(privatePluginKey, "keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      togglePrivatePluginKey();
    });
  }

  if (coPluginsToggle) {
    bindListener(coPluginsToggle, "click", () => {
      coPluginsExpanded = !coPluginsExpanded;
      renderCoPlugins();
    });
  }

  if (
    pluginLinksForm &&
    pluginGithubLinkInput &&
    pluginCurseforgeLinkInput &&
    pluginLinksSubmit &&
    editablePluginLinks
  ) {
    bindListener(pluginLinksForm, "submit", async (event) => {
      event.preventDefault();
      const githubLink = pluginGithubLinkInput.value.trim();
      const curseforgeLink = pluginCurseforgeLinkInput.value.trim();

      pluginLinksSubmit.disabled = true;
      pluginLinksSubmit.textContent = "Saving...";

      try {
        await applyPluginLinks(pluginUuid, githubLink, curseforgeLink);
        if (typeof onNotify === "function") {
          onNotify("Mod links saved.", "success", pluginLinksForm);
        }
        if (typeof onPluginLinksSaved === "function") {
          await onPluginLinksSaved();
        }
      } catch (error) {
        if (typeof onNotify === "function") {
          onNotify(error.message || "Failed to save mod links.", "error", pluginLinksForm);
        }
      } finally {
        pluginLinksSubmit.disabled = false;
        pluginLinksSubmit.textContent = "Save";
      }
    });
  }

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
          labels: history.map((point) => formatHistoryLabel(point)),
          datasets: [
            {
              label: "Servers",
              data: history.map((point) => Number(point.servers_count) || 0),
              borderColor: "#ff2d2d",
              backgroundColor: "rgba(255, 45, 45, 0.2)",
              fill: true,
              tension: 0.35,
            },
            {
              label: "Players",
              data: history.map((point) => Number(point.players_count) || 0),
              borderColor: "#79ea00",
              backgroundColor: "rgba(132, 255, 0, 0.2)",
              fill: true,
              tension: 0.35,
            },
          ],
        },
        options: {
          scales: {
            x: {
              ticks: {
                autoSkip: true,
                maxTicksLimit: 9,
              },
            },
          },
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

  return () => {
    chartInstances.forEach((chart) => chart.destroy());
    listenersCleanup.forEach((cleanup) => cleanup());
    if (copyStatusTimeout) {
      window.clearTimeout(copyStatusTimeout);
    }
  };
}

