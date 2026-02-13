import { getPluginOwnership } from "../api/accountApi";
import { getPluginInfo } from "../api/pluginApi";
import { loadingState } from "../components/loadingState";
import { errorState } from "../components/errorState";
import { renderPluginAnalytics } from "../components/pluginAnalytics";
import { setPageSeo } from "../utils/seo";

export async function mountModDetailsPage({ container, params }) {
  const pluginUuid = params.pluginUuid;
  if (!pluginUuid) {
    container.innerHTML = errorState("Missing mod UUID.");
    return { cleanup: () => {} };
  }

  container.innerHTML = `
    <section class="space-y-6">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brand-700">Mod Details</p>
          <h1 class="section-title mt-1">Detailed Stats</h1>
        </div>
        <a href="/mods" data-link class="btn-secondary">Back to Mods</a>
      </header>
      <div id="mod-detail-body">${loadingState("Loading mod analytics...")}</div>
    </section>
  `;

  const body = container.querySelector("#mod-detail-body");

  try {
    const [pluginInfo, ownershipInfo] = await Promise.all([
      getPluginInfo(pluginUuid),
      getPluginOwnership(pluginUuid).catch(() => null),
    ]);

    const pluginName = String(pluginInfo.name || "Mod").trim() || "Mod";
    setPageSeo({
      title: `${pluginName} Analytics`,
      description: `Live analytics for ${pluginName} on HStats, including active servers, player counts, and usage trends.`,
      path: `/mods/${encodeURIComponent(pluginUuid)}`,
    });

    const destroyCharts = renderPluginAnalytics(body, {
      pluginUuid,
      pluginInfo,
      developerInfo: ownershipInfo,
      showUuid: false,
    });
    return { cleanup: destroyCharts };
  } catch (error) {
    body.innerHTML = errorState(error.message || "Could not load mod analytics.");
    return { cleanup: () => {} };
  }
}
