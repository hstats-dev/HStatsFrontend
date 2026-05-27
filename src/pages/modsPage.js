import { getPluginOwnership } from "../api/accountApi";
import { getPluginInfo, listPlugins } from "../api/pluginApi";
import { modCard } from "../components/modCard";
import { loadingState } from "../components/loadingState";
import { emptyState } from "../components/emptyState";
import { errorState } from "../components/errorState";

const DEFAULT_FILTERS = {
  sort: "popular",
  links: "any",
  minServers: "",
  maxServers: "",
  minPlayers: "",
  maxPlayers: "",
};

const SORT_LABELS = {
  popular: "Most popular",
  players: "Most players",
  newest: "Newest",
  name: "Name",
};

const LINK_LABELS = {
  any: "Any",
  with_any: "Any link",
  github: "GitHub",
  curseforge: "CurseForge",
  none: "No links",
};

function normalizeIntegerFilter(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return String(Math.floor(parsed));
}

function hasActiveFilters(filters) {
  return Object.entries(filters).some(([key, value]) => value !== DEFAULT_FILTERS[key]);
}

function filterSummary(filters) {
  const parts = [];
  if (filters.sort !== DEFAULT_FILTERS.sort) parts.push(`sorted by ${SORT_LABELS[filters.sort] || filters.sort}`);
  if (filters.links !== DEFAULT_FILTERS.links) parts.push(`links: ${LINK_LABELS[filters.links] || filters.links}`);
  if (filters.minServers) parts.push(`servers >= ${filters.minServers}`);
  if (filters.maxServers) parts.push(`servers <= ${filters.maxServers}`);
  if (filters.minPlayers) parts.push(`players >= ${filters.minPlayers}`);
  if (filters.maxPlayers) parts.push(`players <= ${filters.maxPlayers}`);
  return parts.join(", ");
}

export async function mountModsPage({ container }) {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const pageSize = 50;

  let searchToken = 0;
  let visibleMods = [];
  let currentQuery = "";
  let currentFilters = { ...DEFAULT_FILTERS };
  let currentPage = 1;
  let totalPages = 1;
  let totalPlugins = 0;
  let isDirectLookup = false;
  let isDisposed = false;
  let filterApplyHandle = null;

  container.innerHTML = `
    <section class="space-y-6">
      <header>
        <h1 class="section-title">Mods Directory</h1>
        <p class="muted mt-1">
          Search by mod name, filter public discovery results, or enter a full UUID for a direct mod lookup.
        </p>
      </header>
      <section class="surface">
        <div class="surface-body space-y-4">
          <form id="mod-search-form" class="space-y-4">
            <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
              <label class="grid gap-1 text-xs font-semibold text-slate-600">
                Search
                <input
                  id="mod-search-input"
                  type="text"
                  class="input-base"
                  placeholder="Search mods by name or paste a UUID"
                />
              </label>
              <label class="grid gap-1 text-xs font-semibold text-slate-600">
                Sort
                <select id="mod-sort-filter" class="input-base">
                  <option value="popular">Most popular</option>
                  <option value="players">Most players</option>
                  <option value="newest">Newest</option>
                  <option value="name">Name</option>
                </select>
              </label>
              <label class="grid gap-1 text-xs font-semibold text-slate-600">
                Links
                <select id="mod-links-filter" class="input-base">
                  <option value="any">Any</option>
                  <option value="with_any">Any link</option>
                  <option value="github">GitHub</option>
                  <option value="curseforge">CurseForge</option>
                  <option value="none">No links</option>
                </select>
              </label>
              <div class="flex items-end gap-2">
                <button id="mod-filter-reset" class="btn-secondary" type="button">Reset</button>
              </div>
            </div>
            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label class="grid gap-1 text-xs font-semibold text-slate-600">
                Min Servers
                <input id="mod-min-servers-filter" type="number" min="0" step="1" class="input-base" />
              </label>
              <label class="grid gap-1 text-xs font-semibold text-slate-600">
                Max Servers
                <input id="mod-max-servers-filter" type="number" min="0" step="1" class="input-base" />
              </label>
              <div class="grid grid-cols-2 gap-3">
                <label class="grid gap-1 text-xs font-semibold text-slate-600">
                  Min Players
                  <input id="mod-min-players-filter" type="number" min="0" step="1" class="input-base" />
                </label>
                <label class="grid gap-1 text-xs font-semibold text-slate-600">
                  Max Players
                  <input id="mod-max-players-filter" type="number" min="0" step="1" class="input-base" />
                </label>
              </div>
            </div>
          </form>
          <p id="mod-status" class="text-sm text-slate-600"></p>
        </div>
      </section>
      <div id="mod-list"></div>
    </section>
  `;

  const form = container.querySelector("#mod-search-form");
  const searchInput = container.querySelector("#mod-search-input");
  const sortFilter = container.querySelector("#mod-sort-filter");
  const linksFilter = container.querySelector("#mod-links-filter");
  const minServersFilter = container.querySelector("#mod-min-servers-filter");
  const maxServersFilter = container.querySelector("#mod-max-servers-filter");
  const minPlayersFilter = container.querySelector("#mod-min-players-filter");
  const maxPlayersFilter = container.querySelector("#mod-max-players-filter");
  const resetButton = container.querySelector("#mod-filter-reset");
  const status = container.querySelector("#mod-status");
  const list = container.querySelector("#mod-list");

  function readFilters() {
    const nextFilters = {
      sort: SORT_LABELS[sortFilter.value] ? sortFilter.value : DEFAULT_FILTERS.sort,
      links: LINK_LABELS[linksFilter.value] ? linksFilter.value : DEFAULT_FILTERS.links,
      minServers: normalizeIntegerFilter(minServersFilter.value),
      maxServers: normalizeIntegerFilter(maxServersFilter.value),
      minPlayers: normalizeIntegerFilter(minPlayersFilter.value),
      maxPlayers: normalizeIntegerFilter(maxPlayersFilter.value),
    };

    if ([nextFilters.minServers, nextFilters.maxServers, nextFilters.minPlayers, nextFilters.maxPlayers].includes(null)) {
      return { error: "Server and player filters must be non-negative whole numbers." };
    }
    if (nextFilters.minServers && nextFilters.maxServers && Number(nextFilters.minServers) > Number(nextFilters.maxServers)) {
      return { error: "Minimum servers cannot be greater than maximum servers." };
    }
    if (nextFilters.minPlayers && nextFilters.maxPlayers && Number(nextFilters.minPlayers) > Number(nextFilters.maxPlayers)) {
      return { error: "Minimum players cannot be greater than maximum players." };
    }

    return { filters: nextFilters };
  }

  function applyFiltersToForm(filters) {
    sortFilter.value = filters.sort;
    linksFilter.value = filters.links;
    minServersFilter.value = filters.minServers;
    maxServersFilter.value = filters.maxServers;
    minPlayersFilter.value = filters.minPlayers;
    maxPlayersFilter.value = filters.maxPlayers;
  }

  function normalizePluginsResponse(payload) {
    const plugins = payload?.plugins;
    if (!plugins || typeof plugins !== "object") return [];

    return Object.entries(plugins)
      .map(([uuid, value]) => {
        const plugin = value?.plugin_info || {};
        return {
          uuid: plugin.public_uuid || plugin.uuid || uuid,
          name: plugin.name || "Unknown",
          developerInfo: value?.developer_info || null,
          links: {
            github_link: plugin.github_link || "",
            curseforge_link: plugin.curseforge_link || "",
          },
          isUnlisted: plugin.is_unlisted === true,
          totalServers: value?.servers_using || 0,
          totalPlayers: value?.total_players || 0,
        };
      });
  }

  function normalizeTotalPages(payload) {
    const topLevelValue = Number(payload?.total_pages);
    if (Number.isFinite(topLevelValue) && topLevelValue >= 1) return Math.floor(topLevelValue);

    const legacyValue = Number(payload?.pages);
    if (Number.isFinite(legacyValue) && legacyValue >= 1) return Math.floor(legacyValue);

    const plugins = payload?.plugins;
    if (plugins && typeof plugins === "object") {
      const entryPages = Object.values(plugins)
        .map((entry) => Number(entry?.pages))
        .find((pages) => Number.isFinite(pages) && pages >= 1);
      if (Number.isFinite(entryPages)) return Math.floor(entryPages);
    }

    return 1;
  }

  function normalizeTotalPlugins(payload, fallbackCount) {
    const value = Number(payload?.total_plugins);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallbackCount;
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
      if (currentQuery || hasActiveFilters(currentFilters)) {
        list.innerHTML = emptyState(
          "No matching mods",
          "Try a different search term or loosen the filters.",
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

  async function runListSearch(query, page = 1, filters = currentFilters) {
    const token = ++searchToken;
    currentQuery = query;
    currentFilters = { ...DEFAULT_FILTERS, ...filters };
    currentPage = Math.max(1, Number(page) || 1);
    isDirectLookup = false;

    const summary = filterSummary(currentFilters);
    list.innerHTML = loadingState(query ? `Searching mods for "${query}"...` : "Loading mods...");
    status.textContent = summary ? `Applying filters: ${summary}.` : "";

    try {
      const response = await listPlugins({
        search: currentQuery,
        page: currentPage,
        max: pageSize,
        sort: currentFilters.sort,
        links: currentFilters.links,
        minServers: currentFilters.minServers,
        maxServers: currentFilters.maxServers,
        minPlayers: currentFilters.minPlayers,
        maxPlayers: currentFilters.maxPlayers,
      });
      if (isDisposed || token !== searchToken) return;

      totalPages = normalizeTotalPages(response);
      if (currentPage > totalPages) {
        currentPage = totalPages;
      }
      visibleMods = normalizePluginsResponse(response);
      totalPlugins = normalizeTotalPlugins(response, visibleMods.length);

      const resultCountText = `${totalPlugins} matching mod${totalPlugins === 1 ? "" : "s"}`;
      const pageText = `page ${currentPage} of ${totalPages}`;
      const queryText = currentQuery ? ` for "${currentQuery}"` : "";
      const filtersText = summary ? ` (${summary})` : "";
      status.textContent = `Showing ${pageText}${queryText}: ${resultCountText}${filtersText}.`;
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
    totalPlugins = 1;
    currentPage = 1;

    list.innerHTML = loadingState(`Loading mod ${pluginUuid}...`);
    status.textContent = "Direct UUID lookups ignore directory filters.";

    try {
      const [pluginInfo, ownershipInfo] = await Promise.all([
        getPluginInfo(pluginUuid),
        getPluginOwnership(pluginUuid).catch(() => null),
      ]);
      if (isDisposed || token !== searchToken) return;

      visibleMods = [
        {
          uuid: pluginInfo.public_uuid || pluginInfo.uuid || pluginUuid,
          name: pluginInfo.name || "Unknown",
          developerInfo: ownershipInfo,
          links: pluginInfo.links || {
            github_link: pluginInfo.github_link || "",
            curseforge_link: pluginInfo.curseforge_link || "",
          },
          isUnlisted: pluginInfo.is_unlisted === true,
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

  async function applyCurrentFilters() {
    if (isDisposed) return;
    const query = searchInput.value.trim();
    if (uuidPattern.test(query)) {
      await loadPluginByUuid(query);
      return;
    }

    const result = readFilters();
    if (result.error) {
      status.textContent = result.error;
      return;
    }

    await runListSearch(query, 1, result.filters);
  }

  function scheduleApplyCurrentFilters(delay = 350) {
    if (filterApplyHandle) {
      window.clearTimeout(filterApplyHandle);
    }

    filterApplyHandle = window.setTimeout(() => {
      filterApplyHandle = null;
      void applyCurrentFilters();
    }, delay);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (filterApplyHandle) {
      window.clearTimeout(filterApplyHandle);
      filterApplyHandle = null;
    }
    await applyCurrentFilters();
  });

  resetButton.addEventListener("click", async () => {
    if (filterApplyHandle) {
      window.clearTimeout(filterApplyHandle);
      filterApplyHandle = null;
    }
    searchInput.value = "";
    applyFiltersToForm(DEFAULT_FILTERS);
    await runListSearch("", 1, DEFAULT_FILTERS);
  });

  list.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-page]");
    if (!button) return;

    const requestedPage = Number(button.dataset.page);
    if (!Number.isInteger(requestedPage)) return;
    if (requestedPage < 1 || requestedPage > totalPages) return;
    if (requestedPage === currentPage) return;

    await runListSearch(currentQuery, requestedPage, currentFilters);
  });

  [
    searchInput,
    minServersFilter,
    maxServersFilter,
    minPlayersFilter,
    maxPlayersFilter,
  ].forEach((input) => {
    input.addEventListener("input", () => {
      status.textContent = "";
      scheduleApplyCurrentFilters();
    });
  });

  [sortFilter, linksFilter].forEach((input) => {
    input.addEventListener("change", () => {
      status.textContent = "";
      scheduleApplyCurrentFilters(0);
    });
  });

  await runListSearch("", 1, DEFAULT_FILTERS);

  return {
    cleanup: () => {
      isDisposed = true;
      if (filterApplyHandle) {
        window.clearTimeout(filterApplyHandle);
        filterApplyHandle = null;
      }
    },
  };
}
