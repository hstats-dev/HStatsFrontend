import { getPluginOwnership } from "../api/accountApi";
import { getPluginInfo } from "../api/pluginApi";
import { getImportantDateMarkers } from "../api/serverApi";
import { normalizeImportantDateMarkers } from "../components/charts";
import { loadingState } from "../components/loadingState";
import { errorState } from "../components/errorState";
import { renderPluginAnalytics } from "../components/pluginAnalytics";
import { escapeHtml } from "../utils/escapeHtml";
import { setPageSeo } from "../utils/seo";

export async function mountModDetailsPage({ container, params, query }) {
  const pluginUuid = params.pluginUuid;
  const returnSearchValue = String(query?.get("from") || "");
  const returnSearch = returnSearchValue.startsWith("?") && !returnSearchValue.includes("#")
    ? returnSearchValue
    : "";
  const historyRangeState = { mode: "all", fromInput: "", toInput: "" };
  const markerState = { showMarkers: true };
  if (!pluginUuid) {
    container.innerHTML = errorState("Missing Mod ID.");
    return { cleanup: () => {} };
  }

  container.innerHTML = `
    <section class="space-y-6">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brand-700">Mod Details</p>
          <h1 id="mod-detail-title" class="section-title mt-1">Mod Analytics</h1>
        </div>
        <a href="/mods${escapeHtml(returnSearch)}" data-link class="btn-secondary">Back to Mods</a>
      </header>
      <div id="mod-detail-body">${loadingState("Loading mod analytics...")}</div>
    </section>
  `;

  const body = container.querySelector("#mod-detail-body");
  const title = container.querySelector("#mod-detail-title");

  try {
    const [pluginInfo, ownershipInfo, markerPayload] = await Promise.all([
      getPluginInfo(pluginUuid),
      getPluginOwnership(pluginUuid).catch(() => null),
      getImportantDateMarkers({ limit: 1000 }).catch(() => ({ markers: [] })),
    ]);
    const importantMarkers = normalizeImportantDateMarkers(markerPayload);

    const pluginName = String(pluginInfo.name || "Mod").trim() || "Mod";
    if (title) title.textContent = pluginName;
    setPageSeo({
      title: `${pluginName} Analytics`,
      description: `Live analytics for ${pluginName} on HStats, including active servers, player counts, and usage trends.`,
      path: `/mods/${encodeURIComponent(pluginUuid)}`,
    });

    const destroyCharts = renderPluginAnalytics(body, {
      pluginUuid,
      pluginInfo,
      developerInfo: {
        ...(ownershipInfo || {}),
        links: pluginInfo.links || {
          github_link: pluginInfo.github_link || "",
          curseforge_link: pluginInfo.curseforge_link || "",
        },
      },
      showUuid: false,
      historyRangeState,
      markerState,
      importantMarkers,
    });
    return { cleanup: destroyCharts };
  } catch (error) {
    body.innerHTML = errorState(error.message || "Could not load mod analytics.");
    return { cleanup: () => {} };
  }
}
