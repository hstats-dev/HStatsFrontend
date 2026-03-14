import { getPluginOwnership } from "../api/accountApi";
import { getPluginInfo, listPlugins } from "../api/pluginApi";
import { modCard } from "../components/modCard";
import { loadingState } from "../components/loadingState";
import { emptyState } from "../components/emptyState";
import { errorState } from "../components/errorState";

export async function mountModsPage({ container }) {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const pageSize = 50;

  let searchToken = 0;
  let visibleMods = [];
  let currentQuery = "";
  let currentPage = 1;
  let totalPages = 1;
  let isDirectLookup = false;
  let isDisposed = false;

  container.innerHTML = `
    <section class="space-y-6">
      <header>
        <h1 class="section-title">Mods Directory</h1>
        <p class="muted mt-1">
          Search by mod name. You can also enter a full UUID for a direct mod lookup.
        </p>
      </header>
      <section class="surface">
        <div class="surface-body space-y-4">
          <form id="mod-search-form" class="grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              id="mod-search-input"
              type="text"
              class="input-base"
              placeholder="Search mods by name"
            />
            <button class="btn-primary" type="submit">Search</button>
          </form>
          <p id="mod-status" class="text-sm text-slate-600"></p>
        </div>
      </section>
      <div id="mod-list"></div>
    </section>
  `;

  const form = container.querySelector("#mod-search-form");
  const searchInput = container.querySelector("#mod-search-input");
  const status = container.querySelector("#mod-status");
  const list = container.querySelector("#mod-list");

  function normalizePluginsResponse(payload) {
    const plugins = payload?.plugins;
    if (!plugins || typeof plugins !== "object") return [];

    return Object.entries(plugins)
      .map(([uuid, value]) => {
        const plugin = value?.plugin_info || {};
        return {
          uuid: plugin.uuid || uuid,
          name: plugin.name || "Unknown",
          developerInfo: value?.developer_info || null,
          links: {
            github_link: plugin.github_link || "",
            curseforge_link: plugin.curseforge_link || "",
          },
          totalServers: value?.servers_using || 0,
          totalPlayers: value?.total_players || 0,
        };
      });
  }

  function normalizeTotalPages(payload) {
    const value = Number(payload?.pages);
    if (Number.isFinite(value) && value >= 1) return Math.floor(value);

    const plugins = payload?.plugins;
    if (plugins && typeof plugins === "object") {
      const entryPages = Object.values(plugins)
        .map((entry) => Number(entry?.pages))
        .find((pages) => Number.isFinite(pages) && pages >= 1);
      if (Number.isFinite(entryPages)) return Math.floor(entryPages);
    }

    return 1;
  }

  function getVisiblePageNumbers(page, pages) {
    let start = Math.max(1, page - 2);
    let end = Math.min(pages, start + 4);
    start = Math.max(1, end - 4);
    const items = [];
    for (let i = start; i <= end; i += 1) {
      items.push(i);
    }
    return items;
  }

  function renderPagination() {
    if (isDirectLookup || totalPages <= 1) return "";

    const pageNumbers = getVisiblePageNumbers(currentPage, totalPages);
    const hasLeadingGap = pageNumbers.length > 0 && pageNumbers[0] > 1;
    const hasTrailingGap = pageNumbers.length > 0 && pageNumbers[pageNumbers.length - 1] < totalPages;

    return `
      <nav class="mt-4 flex flex-wrap items-center justify-center gap-2" aria-label="Mods pagination">
        <button
          type="button"
          class="btn-secondary px-3 py-1.5 text-xs"
          data-page="${currentPage - 1}"
          ${currentPage <= 1 ? "disabled" : ""}
        >
          Previous
        </button>
        ${
          hasLeadingGap
            ? `<button type="button" class="btn-secondary px-3 py-1.5 text-xs" data-page="1">1</button><span class="px-1 text-xs text-slate-500">...</span>`
            : ""
        }
        ${pageNumbers
          .map(
            (pageNumber) => `
              <button
                type="button"
                data-page="${pageNumber}"
                class="${
                  pageNumber === currentPage
                    ? "rounded-lg border border-brand-500 bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white"
                    : "btn-secondary px-3 py-1.5 text-xs"
                }"
                ${pageNumber === currentPage ? "aria-current=\"page\"" : ""}
              >
                ${pageNumber}
              </button>
            `,
          )
          .join("")}
        ${
          hasTrailingGap
            ? `<span class="px-1 text-xs text-slate-500">...</span><button type="button" class="btn-secondary px-3 py-1.5 text-xs" data-page="${totalPages}">${totalPages}</button>`
            : ""
        }
        <button
          type="button"
          class="btn-secondary px-3 py-1.5 text-xs"
          data-page="${currentPage + 1}"
          ${currentPage >= totalPages ? "disabled" : ""}
        >
          Next
        </button>
      </nav>
    `;
  }

  function renderList() {
    if (visibleMods.length === 0) {
      if (searchInput.value.trim()) {
        list.innerHTML = emptyState(
          "No matching mods",
          "Try a different mod name.",
        );
        return;
      }

      list.innerHTML = emptyState(
        "No mods found",
        "No tracked mods are available yet.",
      );
      return;
    }

    list.innerHTML = `
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        ${visibleMods.map((mod) => modCard(mod)).join("")}
      </div>
      ${renderPagination()}
    `;
  }

  async function runListSearch(query, page = 1) {
    const token = ++searchToken;
    currentQuery = query;
    currentPage = Math.max(1, Number(page) || 1);
    isDirectLookup = false;

    list.innerHTML = loadingState(query ? `Searching mods for "${query}"...` : "Loading mods...");
    status.textContent = "";

    try {
      const response = await listPlugins({
        search: currentQuery,
        page: currentPage,
        max: pageSize,
      });
      if (isDisposed || token !== searchToken) return;

      totalPages = normalizeTotalPages(response);
      if (currentPage > totalPages) {
        currentPage = totalPages;
      }
      visibleMods = normalizePluginsResponse(response);

      status.textContent = currentQuery
        ? `Showing page ${currentPage} of ${totalPages} for "${currentQuery}" (${visibleMods.length} mod${visibleMods.length === 1 ? "" : "s"} on this page).`
        : `Showing page ${currentPage} of ${totalPages} (${visibleMods.length} mod${visibleMods.length === 1 ? "" : "s"} on this page).`;
      renderList();
    } catch (error) {
      if (isDisposed || token !== searchToken) return;
      list.innerHTML = errorState(error.message || "Failed to load mods.");
      status.textContent = "";
    }
  }

  async function loadPluginByUuid(pluginUuid) {
    const token = ++searchToken;
    isDirectLookup = true;
    totalPages = 1;
    currentPage = 1;

    list.innerHTML = loadingState(`Loading mod ${pluginUuid}...`);
    status.textContent = "";

    try {
      const [pluginInfo, ownershipInfo] = await Promise.all([
        getPluginInfo(pluginUuid),
        getPluginOwnership(pluginUuid).catch(() => null),
      ]);
      if (isDisposed || token !== searchToken) return;

      visibleMods = [
        {
          uuid: pluginUuid,
          name: pluginInfo.name || "Unknown",
          developerInfo: ownershipInfo,
          links: pluginInfo.links || {
            github_link: pluginInfo.github_link || "",
            curseforge_link: pluginInfo.curseforge_link || "",
          },
          totalServers: pluginInfo.total_servers || 0,
          totalPlayers: pluginInfo.total_players || 0,
        },
      ];

      status.textContent = `Loaded mod ${pluginInfo.name || pluginUuid}.`;
      renderList();
    } catch (error) {
      if (isDisposed || token !== searchToken) return;
      list.innerHTML = errorState(error.message || "Failed to load mod.");
      status.textContent = "";
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = searchInput.value.trim();
    if (uuidPattern.test(query)) {
      await loadPluginByUuid(query);
      return;
    }

    await runListSearch(query, 1);
  });

  list.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-page]");
    if (!button) return;

    const requestedPage = Number(button.dataset.page);
    if (!Number.isInteger(requestedPage)) return;
    if (requestedPage < 1 || requestedPage > totalPages) return;
    if (requestedPage === currentPage) return;

    await runListSearch(currentQuery, requestedPage);
  });

  searchInput.addEventListener("input", () => {
    status.textContent = "";
  });

  await runListSearch("", 1);

  return {
    cleanup: () => {
      isDisposed = true;
    },
  };
}
