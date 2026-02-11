import { addPlugin, deletePlugin, getPluginInfo } from "../api/pluginApi";
import { applyCurseforgeLink, applyGithubLink, logoutAccount } from "../api/accountApi";
import { DASHBOARD_REFRESH_MS } from "../config";
import { parsePluginAccess } from "../utils/pluginAccess";
import { formatTimestamp } from "../utils/format";
import { loadingState } from "../components/loadingState";
import { emptyState } from "../components/emptyState";
import { errorState } from "../components/errorState";
import { renderPluginAnalytics } from "../components/pluginAnalytics";
import { escapeHtml } from "../utils/escapeHtml";

export async function mountDashboardPage({ container, account, refreshSession, setAccount, navigate }) {
  if (!account) {
    container.innerHTML = errorState("You must be logged in to view the dashboard.");
    return { cleanup: () => {} };
  }

  let pluginItems = [];
  let activePluginUuid = null;
  let analyticsCleanup = () => {};
  let pollHandle = null;
  let disposed = false;

  container.innerHTML = `
    <section class="space-y-6">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="section-title">Dashboard</h1>
          <p class="muted mt-1">Manage your mods and monitor live stats every 15 seconds.</p>
        </div>
        <a href="/docs" data-link class="btn-secondary">View Documentation</a>
      </header>

      <div class="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <section class="surface">
          <div class="surface-body space-y-4">
            <div>
              <h2 class="text-lg font-bold text-slate-900">Mod Management</h2>
              <p class="muted mt-1">Add, select, and manage your mods.</p>
            </div>

            <form id="dashboard-add-plugin-form" class="space-y-3">
              <input id="dashboard-plugin-name" class="input-base" type="text" placeholder="Mod name" required />
              <button type="submit" class="btn-primary w-full">Add Mod</button>
            </form>

            <div id="dashboard-plugin-list"></div>
            <section class="rounded-lg border border-sky-100 bg-sky-50/40 p-3 space-y-3">
              <h3 class="text-sm font-bold uppercase tracking-wide text-slate-700">Profile Links</h3>
              <form id="dashboard-github-link-form" class="grid gap-2">
                <label for="dashboard-github-link" class="text-xs font-semibold text-slate-600">GitHub Link</label>
                <div class="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    id="dashboard-github-link"
                    type="url"
                    class="input-base"
                    placeholder="https://github.com/your-name"
                    value="${escapeHtml(account.github_link || "")}"
                  />
                  <button id="dashboard-github-link-submit" type="submit" class="btn-secondary">Save</button>
                </div>
              </form>
              <form id="dashboard-curseforge-link-form" class="grid gap-2">
                <label for="dashboard-curseforge-link" class="text-xs font-semibold text-slate-600">CurseForge Link</label>
                <div class="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    id="dashboard-curseforge-link"
                    type="url"
                    class="input-base"
                    placeholder="https://www.curseforge.com/minecraft/mc-mods/your-mod"
                    value="${escapeHtml(account.curseforge_link || "")}"
                  />
                  <button id="dashboard-curseforge-link-submit" type="submit" class="btn-secondary">Save</button>
                </div>
              </form>
            </section>
            <div class="border-t border-sky-100 pt-2">
              <button id="dashboard-logout-button" class="w-full rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50">
                Logout
              </button>
            </div>
          </div>
        </section>

        <section class="space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div id="dashboard-live-status" class="text-sm text-slate-600"></div>
            <button id="dashboard-manual-refresh" class="btn-secondary">Refresh</button>
          </div>
          <div id="dashboard-live-content"></div>
        </section>
      </div>
      <div id="dashboard-toast-stack" class="toast-stack"></div>
    </section>
  `;

  const addForm = container.querySelector("#dashboard-add-plugin-form");
  const nameInput = container.querySelector("#dashboard-plugin-name");
  const addSubmitButton = addForm.querySelector('button[type="submit"]');
  const githubLinkForm = container.querySelector("#dashboard-github-link-form");
  const githubLinkInput = container.querySelector("#dashboard-github-link");
  const githubLinkSubmit = container.querySelector("#dashboard-github-link-submit");
  const curseforgeLinkForm = container.querySelector("#dashboard-curseforge-link-form");
  const curseforgeLinkInput = container.querySelector("#dashboard-curseforge-link");
  const curseforgeLinkSubmit = container.querySelector("#dashboard-curseforge-link-submit");
  const pluginList = container.querySelector("#dashboard-plugin-list");
  const logoutButton = container.querySelector("#dashboard-logout-button");
  const liveStatus = container.querySelector("#dashboard-live-status");
  const liveContent = container.querySelector("#dashboard-live-content");
  const refreshButton = container.querySelector("#dashboard-manual-refresh");
  const toastStack = container.querySelector("#dashboard-toast-stack");

  function stopPolling() {
    if (pollHandle) {
      window.clearInterval(pollHandle);
      pollHandle = null;
    }
  }

  function destroyAnalytics() {
    analyticsCleanup();
    analyticsCleanup = () => {};
  }

  function pulseElement(element) {
    if (!element) return;
    element.classList.remove("dashboard-feedback-pulse");
    // Restart animation if multiple actions occur quickly.
    void element.offsetWidth;
    element.classList.add("dashboard-feedback-pulse");
    window.setTimeout(() => element.classList.remove("dashboard-feedback-pulse"), 450);
  }

  function showFeedback(message, type = "success", pulseTarget = null) {
    const toast = document.createElement("div");
    toast.className = `app-toast ${type === "error" ? "app-toast-error" : "app-toast-success"}`;
    toast.textContent = message;
    toastStack.appendChild(toast);
    pulseElement(pulseTarget);

    window.setTimeout(() => {
      toast.remove();
    }, 3400);
  }

  function applyAccountLinksToInputs(currentAccount) {
    if (!currentAccount) return;
    githubLinkInput.value = currentAccount.github_link || "";
    curseforgeLinkInput.value = currentAccount.curseforge_link || "";
  }

  function renderPluginList() {
    if (pluginItems.length === 0) {
      pluginList.innerHTML = emptyState(
        "No mods yet",
        "Add your first mod using the form above to receive a mod UUID.",
      );
      return;
    }

    pluginList.innerHTML = `
      <div class="space-y-2">
        ${pluginItems
          .map(
            (plugin) => `
              <article class="rounded-lg border ${plugin.uuid === activePluginUuid ? "border-sky-300 bg-sky-50" : "border-sky-100 bg-white"} p-2">
                <div class="flex items-center gap-1.5">
                  <button
                    class="min-w-0 flex-1 rounded-md px-2 py-2 text-left transition hover:bg-sky-50"
                    data-action="select"
                    data-uuid="${escapeHtml(plugin.uuid)}"
                  >
                    <p class="truncate text-sm font-semibold text-slate-900">${escapeHtml(plugin.info.name || "Unknown mod")}</p>
                    <p class="truncate font-mono text-[11px] text-slate-600">${escapeHtml(plugin.uuid)}</p>
                  </button>
                  <button
                    class="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100"
                    data-action="copy"
                    data-uuid="${escapeHtml(plugin.uuid)}"
                    title="Copy UUID"
                    aria-label="Copy UUID"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" class="h-4 w-4">
                      <rect x="9" y="9" width="10" height="10" rx="2" stroke="currentColor" stroke-width="2" />
                      <path d="M5 15V7a2 2 0 0 1 2-2h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                    </svg>
                  </button>
                  <button
                    class="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-700 transition hover:bg-red-100"
                    data-action="delete"
                    data-uuid="${escapeHtml(plugin.uuid)}"
                    title="Delete mod"
                    aria-label="Delete mod"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" class="h-4 w-4">
                      <path d="M4 7h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                      <path d="M9 3h6l1 2H8l1-2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
                      <path d="M7 7l1 13h8l1-13" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
                      <path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                    </svg>
                  </button>
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    `;
  }

  async function refreshLiveStats(showLoader = false, { notifyOnSuccess = false } = {}) {
    if (!activePluginUuid) {
      destroyAnalytics();
      liveContent.innerHTML = emptyState(
        "No mod selected",
        "Select a mod to view its live usage charts.",
      );
      liveStatus.textContent = "";
      return;
    }

    if (showLoader) {
      liveContent.innerHTML = loadingState("Loading mod analytics...");
    }

    try {
      const pluginInfo = await getPluginInfo(activePluginUuid);
      if (disposed) return;
      const index = pluginItems.findIndex((item) => item.uuid === activePluginUuid);
      if (index >= 0) pluginItems[index] = { uuid: activePluginUuid, info: pluginInfo };

      destroyAnalytics();
      analyticsCleanup = renderPluginAnalytics(liveContent, { pluginUuid: activePluginUuid, pluginInfo });
      liveStatus.textContent = `Last updated at ${formatTimestamp(new Date())}`;
      renderPluginList();
      if (notifyOnSuccess) {
        showFeedback("Stats refreshed", "success", liveContent);
      }
    } catch (error) {
      if (disposed) return;
      destroyAnalytics();
      liveContent.innerHTML = errorState(error.message || "Failed to refresh mod stats.");
      liveStatus.textContent = "";
      if (notifyOnSuccess) {
        showFeedback("Refresh failed", "error", liveContent);
      }
    }
  }

  function startPolling() {
    stopPolling();
    pollHandle = window.setInterval(() => {
      refreshLiveStats(false);
    }, DASHBOARD_REFRESH_MS);
  }

  async function loadPlugins() {
    pluginList.innerHTML = loadingState("Loading your mods...");
    liveContent.innerHTML = loadingState("Preparing live analytics...");

    const latestAccount = (await refreshSession()) || account;
    const pluginUuids = parsePluginAccess(latestAccount?.plugin_access);
    if (pluginUuids.length === 0) {
      pluginItems = [];
      activePluginUuid = null;
      renderPluginList();
      await refreshLiveStats(false);
      stopPolling();
      return;
    }

    const pluginResults = await Promise.allSettled(pluginUuids.map((uuid) => getPluginInfo(uuid)));
    if (disposed) return;

    pluginItems = pluginResults
      .map((result, index) => {
        if (result.status !== "fulfilled") return null;
        return { uuid: pluginUuids[index], info: result.value };
      })
      .filter(Boolean);

    if (pluginItems.length === 0) {
      pluginList.innerHTML = errorState(
        "Your account has mod UUIDs, but none could be loaded. This may happen if deleted mods remain in your account access list.",
      );
      activePluginUuid = null;
      await refreshLiveStats(false);
      stopPolling();
      return;
    }

    if (!activePluginUuid || !pluginItems.some((item) => item.uuid === activePluginUuid)) {
      activePluginUuid = pluginItems[0].uuid;
    }

    renderPluginList();
    await refreshLiveStats(false);
    startPolling();
  }

  addForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return;

    addSubmitButton.disabled = true;
    addSubmitButton.textContent = "Adding...";
    try {
      const result = await addPlugin(name);
      showFeedback(`Mod created: ${result.plugin_uuid}`, "success", addForm);
      addForm.reset();
      await loadPlugins();
    } catch (error) {
      showFeedback(`Failed to add mod: ${error.message || "Unknown error"}`, "error", addForm);
    } finally {
      addSubmitButton.disabled = false;
      addSubmitButton.textContent = "Add Mod";
    }
  });

  githubLinkForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const link = githubLinkInput.value.trim();
    if (!link) {
      showFeedback("GitHub link cannot be empty", "error", githubLinkForm);
      return;
    }

    githubLinkSubmit.disabled = true;
    githubLinkSubmit.textContent = "Saving...";
    try {
      await applyGithubLink(link);
      const latestAccount = await refreshSession();
      setAccount(latestAccount || null);
      applyAccountLinksToInputs(latestAccount);
      showFeedback("GitHub link saved", "success", githubLinkForm);
    } catch (error) {
      showFeedback(`Failed to save GitHub link: ${error.message || "Unknown error"}`, "error", githubLinkForm);
    } finally {
      githubLinkSubmit.disabled = false;
      githubLinkSubmit.textContent = "Save";
    }
  });

  curseforgeLinkForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const link = curseforgeLinkInput.value.trim();
    if (!link) {
      showFeedback("CurseForge link cannot be empty", "error", curseforgeLinkForm);
      return;
    }

    curseforgeLinkSubmit.disabled = true;
    curseforgeLinkSubmit.textContent = "Saving...";
    try {
      await applyCurseforgeLink(link);
      const latestAccount = await refreshSession();
      setAccount(latestAccount || null);
      applyAccountLinksToInputs(latestAccount);
      showFeedback("CurseForge link saved", "success", curseforgeLinkForm);
    } catch (error) {
      showFeedback(`Failed to save CurseForge link: ${error.message || "Unknown error"}`, "error", curseforgeLinkForm);
    } finally {
      curseforgeLinkSubmit.disabled = false;
      curseforgeLinkSubmit.textContent = "Save";
    }
  });

  pluginList.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const action = button.getAttribute("data-action");
    const uuid = button.getAttribute("data-uuid");
    if (!action || !uuid) return;

    if (action === "copy") {
      try {
        await navigator.clipboard.writeText(uuid);
        showFeedback("UUID copied", "success", button);
      } catch {
        showFeedback(`Could not copy UUID automatically. UUID: ${uuid}`, "error", button);
      }
      return;
    }

    if (action === "select") {
      activePluginUuid = uuid;
      renderPluginList();
      showFeedback("Mod selected", "success", liveContent);
      await refreshLiveStats(true);
      return;
    }

    if (action === "delete") {
      const modEntry = pluginItems.find((item) => item.uuid === uuid);
      const modName = (modEntry?.info?.name || "").trim() || "Unknown mod";
      const confirmed = window.confirm(`Delete mod "${modName}"?`);
      if (!confirmed) return;
      try {
        await deletePlugin(uuid);
        showFeedback(`Deleted mod "${modName}"`, "success", pluginList);
        await loadPlugins();
      } catch (error) {
        showFeedback(`Failed to delete "${modName}": ${error.message || "Unknown error"}`, "error", pluginList);
      }
    }
  });

  liveContent.addEventListener("click", async (event) => {
    const button = event.target.closest('button[data-action="copy-plugin-uuid"]');
    if (!button) return;

    const uuid = button.getAttribute("data-uuid");
    if (!uuid) return;

    try {
      await navigator.clipboard.writeText(uuid);
      showFeedback("UUID copied", "success", button);
    } catch {
      showFeedback(`Could not copy UUID automatically. UUID: ${uuid}`, "error", button);
    }
  });

  refreshButton.addEventListener("click", () => {
    refreshLiveStats(true, { notifyOnSuccess: true });
  });

  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    try {
      await logoutAccount();
    } catch {
      // Ignore logout response errors and clear local session state either way.
    }
    setAccount(null);
    navigate("/", { replace: true });
  });

  await loadPlugins();

  return {
    cleanup: () => {
      disposed = true;
      stopPolling();
      destroyAnalytics();
    },
  };
}




