import { getDeveloperProfile } from "../api/accountApi";
import { getGlobalStats } from "../api/serverApi";
import { renderDeveloperButtons, renderDeveloperIconLinks } from "../components/developerLinks";
import { loadingState } from "../components/loadingState";
import { emptyState } from "../components/emptyState";
import { errorState } from "../components/errorState";
import { formatNumber } from "../utils/format";
import { escapeHtml } from "../utils/escapeHtml";
import { setPageSeo } from "../utils/seo";

function formatAddedOn(value) {
  if (!value) return "Unknown";
  const raw = String(value).trim();
  if (!raw) return "Unknown";

  const parsed = new Date(raw.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPercent(part, whole) {
  const numerator = Number(part) || 0;
  const denominator = Number(whole) || 0;
  if (denominator <= 0) return "0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

export async function mountDeveloperProfilePage({ container, params }) {
  const developerUuid = params?.developerUuid;
  if (!developerUuid) {
    container.innerHTML = errorState("Missing developer UUID.");
    return { cleanup: () => {} };
  }

  container.innerHTML = `
    <section class="space-y-6">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <a href="/mods" data-link class="btn-secondary">Back to Mods</a>
        <h1 id="developer-profile-title" class="section-title text-right">Profile</h1>
      </header>
      <div id="developer-profile-body">${loadingState("Loading developer profile...")}</div>
    </section>
  `;

  const body = container.querySelector("#developer-profile-body");
  const title = container.querySelector("#developer-profile-title");

  try {
    const [payload, globalStats] = await Promise.all([
      getDeveloperProfile(developerUuid),
      getGlobalStats().catch(() => null),
    ]);
    const developer = payload?.developer;
    if (!developer || typeof developer !== "object") {
      throw new Error("Developer profile data is missing.");
    }

    const developerName = String(developer.username || "").trim() || "No Name";
    const managedMods = Array.isArray(developer.mods_managed) ? developer.mods_managed : [];
    const managedCount = Number(developer.mods_managed_count) || managedMods.length;
    const totalServers = managedMods.reduce((sum, mod) => sum + (Number(mod?.servers_using) || 0), 0);
    const totalPlayers = managedMods.reduce((sum, mod) => sum + (Number(mod?.total_players) || 0), 0);
    const globalModCount = Number(globalStats?.plugin_count) || 0;
    const globalServers = Number(globalStats?.online_servers) || 0;
    const globalPlayers = Number(globalStats?.online_players) || 0;
    const modShare = formatPercent(managedCount, globalModCount);
    const serverShare = formatPercent(totalServers, globalServers);
    const playerShare = formatPercent(totalPlayers, globalPlayers);

    if (title) {
      title.textContent = `${developerName}'s Profile`;
    }

    setPageSeo({
      title: `${developerName} Profile`,
      description: `${developerName} manages ${managedCount} mod${managedCount === 1 ? "" : "s"} on HStats.`,
      path: `/developers/${encodeURIComponent(developerUuid)}`,
    });

    body.innerHTML = `
      <div class="space-y-6">
        <section class="surface">
          <div class="surface-body space-y-5">
            <div class="grid gap-3 md:grid-cols-3">
              <div class="rounded-xl border border-sky-100 bg-slate-50 px-4 py-3">
                <p class="text-[11px] uppercase tracking-wide text-slate-500">Total Servers</p>
                <p class="mt-2 text-2xl font-extrabold leading-none text-slate-900">${escapeHtml(formatNumber(totalServers))}</p>
                <p class="mt-1 text-xs text-slate-600">${escapeHtml(serverShare)} of all servers tracked on HStats</p>
                <p class="mt-1 text-xs text-slate-500">${escapeHtml(formatNumber(totalServers))} of ${escapeHtml(formatNumber(globalServers))} total tracked servers</p>
              </div>
              <div class="rounded-xl border border-sky-100 bg-slate-50 px-4 py-3">
                <p class="text-[11px] uppercase tracking-wide text-slate-500">Total Players</p>
                <p class="mt-2 text-2xl font-extrabold leading-none text-slate-900">${escapeHtml(formatNumber(totalPlayers))}</p>
                <p class="mt-1 text-xs text-slate-600">${escapeHtml(playerShare)} of all players tracked on HStats</p>
                <p class="mt-1 text-xs text-slate-500">${escapeHtml(formatNumber(totalPlayers))} of ${escapeHtml(formatNumber(globalPlayers))} total tracked players</p>
              </div>
              <div class="rounded-xl border border-sky-100 bg-slate-50 px-4 py-3">
                <p class="text-[11px] uppercase tracking-wide text-slate-500">Registered Mods</p>
                <p class="mt-2 text-2xl font-extrabold leading-none text-slate-900">${escapeHtml(formatNumber(managedCount))}</p>
                <p class="mt-1 text-xs text-slate-600">${escapeHtml(modShare)} of all mods registered on HStats</p>
                <p class="mt-1 text-xs text-slate-500">${escapeHtml(formatNumber(managedCount))} of ${escapeHtml(formatNumber(globalModCount))} total registered mods</p>
              </div>
            </div>
            <div class="rounded-xl border border-sky-100 bg-slate-50 px-4 py-3">
              <div class="flex flex-wrap items-center gap-3">
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Links</p>
                  ${renderDeveloperButtons({
                    github_link: developer.github_link,
                    curseforge_link: developer.curseforge_link,
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="surface">
          <div class="surface-body space-y-4">
            <div>
              <p class="text-sm font-semibold text-slate-800">Registered Mods</p>
              <p class="mt-1 text-sm text-slate-600">Sorted by active servers and total players.</p>
            </div>
            ${
              managedMods.length === 0
                ? emptyState("No mods listed", "This developer has no public managed mods.")
                : `
                  <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    ${managedMods
                      .map((mod) => {
                        const modUuid = String(mod?.uuid || "").trim();
                        const modName = String(mod?.name || "").trim() || "Unknown mod";
                        const serversUsing = Number(mod?.servers_using) || 0;
                        const totalPlayers = Number(mod?.total_players) || 0;
                        const addedOn = formatAddedOn(mod?.added_on);
                        const pluginLinks = mod?.links && typeof mod.links === "object" ? mod.links : {};

                        return `
                          <article class="rounded-xl border border-sky-100 bg-white p-4 transition hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/40">
                            <div class="flex items-start justify-between gap-3">
                              <a
                                href="/mods/${encodeURIComponent(modUuid)}"
                                data-link
                                class="text-base font-bold text-slate-900 transition hover:text-brand-700"
                              >
                                ${escapeHtml(modName)}
                              </a>
                              <p class="text-xs text-slate-600">Added: ${escapeHtml(addedOn)}</p>
                            </div>
                            <div class="mt-3 grid grid-cols-2 gap-3">
                              <div>
                                <p class="text-[11px] uppercase tracking-wide text-slate-500">Servers</p>
                                <p class="text-xl font-extrabold leading-none text-slate-900">${escapeHtml(formatNumber(serversUsing))}</p>
                              </div>
                              <div>
                                <p class="text-[11px] uppercase tracking-wide text-slate-500">Players</p>
                                <p class="text-xl font-extrabold leading-none text-slate-900">${escapeHtml(formatNumber(totalPlayers))}</p>
                              </div>
                            </div>
                            <div class="mt-3">
                              ${renderDeveloperIconLinks({ links: pluginLinks })}
                            </div>
                            <div class="mt-3">
                              <a
                                href="/mods/${encodeURIComponent(modUuid)}"
                                data-link
                                class="inline-flex items-center rounded-md border border-sky-200 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-sky-50"
                              >
                                View detailed stats
                              </a>
                            </div>
                          </article>
                        `;
                      })
                      .join("")}
                  </div>
                `
            }
          </div>
        </section>
      </div>
    `;

    return { cleanup: () => {} };
  } catch (error) {
    body.innerHTML = errorState(error.message || "Could not load developer profile.");
    return { cleanup: () => {} };
  }
}
