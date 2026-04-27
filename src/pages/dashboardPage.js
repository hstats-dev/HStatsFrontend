import { addPlugin, deletePlugin, getPluginInfo } from "../api/pluginApi";
import { applyCurseforgeLink, applyGithubLink, applyUsername, logoutAccount } from "../api/accountApi";
import { getImportantDateMarkers } from "../api/serverApi";
import { API_ROOT, DASHBOARD_REFRESH_MS } from "../config";
import { pairPluginAccess } from "../utils/pluginAccess";
import { formatNumber, formatTimestamp } from "../utils/format";
import { loadingState } from "../components/loadingState";
import { emptyState } from "../components/emptyState";
import { errorState } from "../components/errorState";
import { normalizeImportantDateMarkers } from "../components/charts";
import { renderPluginAnalytics } from "../components/pluginAnalytics";
import { escapeHtml } from "../utils/escapeHtml";
import { mountKofiOverlay, removeKofiOverlay } from "../utils/kofi";

const DEFAULT_PROFILE_EMBED_OPTIONS = {
  theme: "light",
  layout: "compact",
  size: "md",
  dark: false,
};

function buildDeveloperEmbedUrl(developerUuid, options, { cacheBust = false } = {}) {
  const safeUuid = encodeURIComponent(developerUuid || "");
  const params = new URLSearchParams();

  params.set("theme", options.theme);
  params.set("layout", options.layout);
  params.set("size", options.size);
  params.set("dark", String(options.dark));

  if (cacheBust) {
    params.set("t", String(Date.now()));
  }

  return `${API_ROOT}/embed/developer/${safeUuid}/card.svg?${params.toString()}`;
}

function renderDeveloperEmbedControls(account) {
  const developerUuid = String(account?.id || "").trim();
  if (!developerUuid) return "";

  const displayName = String(account?.username || "").trim() || "No Name";
  const initialUrl = buildDeveloperEmbedUrl(developerUuid, DEFAULT_PROFILE_EMBED_OPTIONS);
  const initialPreviewUrl = buildDeveloperEmbedUrl(developerUuid, DEFAULT_PROFILE_EMBED_OPTIONS, { cacheBust: true });

  return `
    <section class="surface overflow-hidden">
      <div class="surface-body space-y-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Profile Embed</p>
            <h2 class="mt-1 text-lg font-bold text-slate-900">Developer Profile Card</h2>
            <p class="muted mt-1 max-w-2xl">Configure and preview a shareable SVG card for your public developer profile. Use the generated URL anywhere an image embed is supported.</p>
          </div>
        </div>

        <div class="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_360px]">
          <div class="rounded-xl border border-sky-100 bg-slate-50 p-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p>
              <p class="text-[11px] text-slate-500">Preview is scaled to fit this panel. The final URL preserves the selected size.</p>
            </div>
            <div class="mt-3 overflow-hidden rounded-xl border border-sky-100 bg-white p-4">
              <img
                id="dashboard-developer-embed-preview"
                src="${escapeHtml(initialPreviewUrl)}"
                alt="Embed preview for ${escapeHtml(displayName)}"
                loading="lazy"
                class="mx-auto h-auto w-full max-w-[920px] rounded"
              />
            </div>
          </div>

          <div class="space-y-4 rounded-xl border border-sky-100 bg-slate-50 p-4">
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <label class="grid gap-1 text-xs font-semibold text-slate-600">
                Theme
                <select id="dashboard-developer-embed-theme" class="input-base py-2">
                  <option value="light" selected>Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
              <label class="grid gap-1 text-xs font-semibold text-slate-600">
                Layout
                <select id="dashboard-developer-embed-layout" class="input-base py-2">
                  <option value="compact" selected>Compact</option>
                  <option value="stacked">Stacked</option>
                  <option value="history">History</option>
                </select>
              </label>
              <label class="grid gap-1 text-xs font-semibold text-slate-600">
                Size
                <select id="dashboard-developer-embed-size" class="input-base py-2">
                  <option value="sm">Small</option>
                  <option value="md" selected>Medium</option>
                  <option value="lg">Large</option>
                </select>
              </label>
              <label class="inline-flex items-center gap-2 rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                <input id="dashboard-developer-embed-dark" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                Force dark (alias)
              </label>
            </div>

            <div class="space-y-2">
              <label for="dashboard-developer-embed-url" class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Embed URL</label>
              <input id="dashboard-developer-embed-url" type="text" readonly class="input-base w-full py-1.5 font-mono text-[10px]" value="${escapeHtml(initialUrl)}" />
              <div class="flex flex-wrap items-center gap-2">
                <button id="dashboard-developer-embed-copy" type="button" class="btn-secondary px-3 py-1.5 text-xs whitespace-nowrap">Copy URL</button>
                <p id="dashboard-developer-embed-copy-status" class="text-[11px] text-slate-500"></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

export async function mountDashboardPage({ container, account, refreshSession, setAccount, navigate }) {
  if (!account) {
    container.innerHTML = errorState("You must be logged in to view the dashboard.");
    return { cleanup: () => {} };
  }

  void mountKofiOverlay().catch(() => {});

  let pluginItems = [];
  let activePluginUuid = null;
  let analyticsCleanup = () => {};
  let pollHandle = null;
  let disposed = false;
  let currentAccount = account;
  let isEmailRevealed = false;
  let developerEmbedCopyStatusTimeout = null;
  const pluginHistoryRangeStates = new Map();
  const pluginMarkerStates = new Map();
  let importantMarkers = [];

  function normalizeEmailValue(email) {
    if (typeof email !== "string") return "";
    return email.trim();
  }

  function renderEmailValue(email, revealFullEmail = false) {
    const normalizedEmail = normalizeEmailValue(email);
    if (!normalizedEmail) {
      return `<span class="text-slate-500">No email available.</span>`;
    }

    if (revealFullEmail) {
      return `<span class="font-mono text-xs sm:text-sm">${escapeHtml(normalizedEmail)}</span>`;
    }

    const midpoint = Math.ceil(normalizedEmail.length / 6);
    const firstHalf = normalizedEmail.slice(0, midpoint);
    const secondHalf = normalizedEmail.slice(midpoint);

    return `
      <span class="font-mono text-xs sm:text-sm">
        ${escapeHtml(firstHalf)}<span class="inline-block align-middle blur-[5px] select-none">${escapeHtml(secondHalf)}</span>
      </span>
    `;
  }

  container.innerHTML = `
    <section class="space-y-6">
      <header class="surface overflow-hidden">
        <div class="dashboard-hero surface-body space-y-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Dashboard</p>
              <h1 class="section-title mt-2">Account and Mod Workspace</h1>
              <p class="muted mt-2 max-w-3xl">Register your mods, manage settings, and view live analytics organized in separate spaces.</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <a href="/docs" data-link class="btn-secondary">Documentation</a>
              <a
                id="dashboard-top-profile-link"
                href="${currentAccount?.id ? `/developers/${encodeURIComponent(currentAccount.id)}` : "#"}"
                data-link
                class="${currentAccount?.id ? "inline-flex" : "hidden"} btn-secondary items-center"
              >
                View Public Profile
              </a>
            </div>
          </div>
          <div class="grid gap-3 md:grid-cols-3">
            <div class="dashboard-hero-stat relative">
              <p class="dashboard-hero-label pr-10">Signed In As</p>
              <button
                id="dashboard-summary-edit-name"
                type="button"
                class="dashboard-hero-icon-button absolute right-4 top-3"
                title="Edit name"
                aria-label="Edit name"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" class="h-4 w-4">
                  <path d="M4 20h4l10-10-4-4L4 16v4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
                  <path d="m13 7 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
              </button>
              <p id="dashboard-summary-identity" class="dashboard-hero-value mt-2 truncate pr-10 text-lg font-extrabold"></p>
            </div>
            <div class="dashboard-hero-stat">
              <p class="dashboard-hero-label">Registered Mods</p>
              <p id="dashboard-summary-mod-count" class="dashboard-hero-value mt-2 text-2xl font-extrabold leading-none">0</p>
            </div>
            <div class="dashboard-hero-stat">
              <p class="dashboard-hero-label">Total Servers</p>
              <p id="dashboard-summary-server-count" class="dashboard-hero-value mt-2 text-2xl font-extrabold leading-none">0</p>
            </div>
          </div>
        </div>
      </header>
      <div class="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div class="space-y-6">
          <section id="dashboard-account-settings" class="surface">
            <div class="surface-body space-y-4">
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Mod Library</p>
                <h2 class="mt-1 text-lg font-bold text-slate-900">Your Mods</h2>
              </div>
              <form id="dashboard-add-plugin-form" class="rounded-xl border border-sky-100 bg-slate-50 p-3 space-y-3">
                <label for="dashboard-plugin-name" class="text-xs font-semibold uppercase tracking-wide text-slate-500">Create Mod</label>
                <input id="dashboard-plugin-name" class="input-base" type="text" placeholder="Mod name" required />
                <button type="submit" class="btn-primary w-full">Add Mod</button>
                <p id="dashboard-add-plugin-status" class="hidden text-xs font-semibold"></p>
              </form>
              <div id="dashboard-plugin-list"></div>
            </div>
          </section>

          <section class="surface">
            <div class="surface-body space-y-4">
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Account Center</p>
                <h2 class="mt-1 text-lg font-bold text-slate-900">Profile and Session</h2>
                <p class="muted mt-1">Update your public identity, developer links, and session settings.</p>
              </div>

              <section class="rounded-lg border border-sky-100 bg-sky-50/40 p-3 space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <h3 class="text-sm font-bold uppercase tracking-wide text-slate-700">Email</h3>
                  <button id="dashboard-account-email-toggle" type="button" class="btn-secondary px-2 py-1 text-xs">Reveal</button>
                </div>
                <p id="dashboard-account-email-value" class="break-all text-slate-700">
                  ${renderEmailValue(currentAccount?.email, isEmailRevealed)}
                </p>
              </section>

              <section class="rounded-lg border border-sky-100 bg-sky-50/40 p-3 space-y-3">
                <form id="dashboard-username-form" class="grid gap-2">
                  <label for="dashboard-username" class="text-xs font-semibold text-slate-600">Username</label>
                  <div class="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input
                      id="dashboard-username"
                      type="text"
                      class="input-base"
                      placeholder="Example Dev"
                      value="${escapeHtml(currentAccount.username || "")}"
                    />
                    <button id="dashboard-username-submit" type="submit" class="btn-secondary">Save</button>
                  </div>
                  <p class="text-[11px] text-slate-500">Shown on your public developer profile. Leave blank to clear it.</p>
                </form>
                <h3 class="text-sm font-bold uppercase tracking-wide text-slate-700">Profile Links</h3>
                <form id="dashboard-github-link-form" class="grid gap-2">
                  <label for="dashboard-github-link" class="text-xs font-semibold text-slate-600">GitHub Link</label>
                  <div class="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input
                      id="dashboard-github-link"
                      type="url"
                      class="input-base"
                      placeholder="https://github.com/your-name"
                      value="${escapeHtml(currentAccount.github_link || "")}"
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
                      placeholder="https://www.curseforge.com/hytale/mods/your-mod"
                      value="${escapeHtml(currentAccount.curseforge_link || "")}"
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
        </div>

        <section class="surface">
            <div class="surface-body space-y-5">
              <div class="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Mod Settings</p>
                  <h2 id="dashboard-workspace-title" class="mt-1 text-xl font-extrabold text-slate-900">Select a mod</h2>
                </div>
                <div class="flex items-center gap-2 md:justify-self-end">
                <div id="dashboard-live-status" class="text-sm text-slate-600"></div>
                <button id="dashboard-manual-refresh" class="btn-secondary">Refresh</button>
              </div>
            </div>
            <div id="dashboard-live-content"></div>
          </div>
        </section>
      </div>
      ${renderDeveloperEmbedControls(currentAccount)}
      <div id="dashboard-toast-stack" class="toast-stack"></div>
    </section>
  `;

  const addForm = container.querySelector("#dashboard-add-plugin-form");
  const nameInput = container.querySelector("#dashboard-plugin-name");
  const addStatus = container.querySelector("#dashboard-add-plugin-status");
  const addSubmitButton = addForm.querySelector('button[type="submit"]');
  const usernameForm = container.querySelector("#dashboard-username-form");
  const usernameInput = container.querySelector("#dashboard-username");
  const usernameSubmit = container.querySelector("#dashboard-username-submit");
  const githubLinkForm = container.querySelector("#dashboard-github-link-form");
  const githubLinkInput = container.querySelector("#dashboard-github-link");
  const githubLinkSubmit = container.querySelector("#dashboard-github-link-submit");
  const curseforgeLinkForm = container.querySelector("#dashboard-curseforge-link-form");
  const curseforgeLinkInput = container.querySelector("#dashboard-curseforge-link");
  const curseforgeLinkSubmit = container.querySelector("#dashboard-curseforge-link-submit");
  const topProfileLink = container.querySelector("#dashboard-top-profile-link");
  const summaryEditNameButton = container.querySelector("#dashboard-summary-edit-name");
  const summaryIdentity = container.querySelector("#dashboard-summary-identity");
  const summaryModCount = container.querySelector("#dashboard-summary-mod-count");
  const summaryServerCount = container.querySelector("#dashboard-summary-server-count");
  const workspaceTitle = container.querySelector("#dashboard-workspace-title");
  const accountSettingsSection = container.querySelector("#dashboard-account-settings");
  const accountEmailValue = container.querySelector("#dashboard-account-email-value");
  const accountEmailToggle = container.querySelector("#dashboard-account-email-toggle");
  const pluginList = container.querySelector("#dashboard-plugin-list");
  const logoutButton = container.querySelector("#dashboard-logout-button");
  const liveStatus = container.querySelector("#dashboard-live-status");
  const liveContent = container.querySelector("#dashboard-live-content");
  const refreshButton = container.querySelector("#dashboard-manual-refresh");
  const toastStack = container.querySelector("#dashboard-toast-stack");
  const developerEmbedTheme = container.querySelector("#dashboard-developer-embed-theme");
  const developerEmbedLayout = container.querySelector("#dashboard-developer-embed-layout");
  const developerEmbedSize = container.querySelector("#dashboard-developer-embed-size");
  const developerEmbedDark = container.querySelector("#dashboard-developer-embed-dark");
  const developerEmbedPreview = container.querySelector("#dashboard-developer-embed-preview");
  const developerEmbedUrl = container.querySelector("#dashboard-developer-embed-url");
  const developerEmbedCopy = container.querySelector("#dashboard-developer-embed-copy");
  const developerEmbedCopyStatus = container.querySelector("#dashboard-developer-embed-copy-status");

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

  function clearAddStatus() {
    addStatus.textContent = "";
    addStatus.classList.add("hidden");
    addStatus.classList.remove("text-red-700");
    addStatus.classList.remove("text-emerald-700");
  }

  function showAddStatus(message, type = "error") {
    addStatus.textContent = message;
    addStatus.classList.remove("hidden");
    addStatus.classList.remove("text-red-700");
    addStatus.classList.remove("text-emerald-700");
    addStatus.classList.add(type === "error" ? "text-red-700" : "text-emerald-700");
  }

  function resolveAddPluginError(error) {
    const errorCode = String(error?.payload?.error_code || "").trim().toLowerCase();
    const errorField = String(error?.payload?.field || "").trim().toLowerCase();

    if (error?.status === 400 && errorCode === "inappropriate_language" && errorField === "name") {
      return "That mod name is not allowed. Please choose a different name.";
    }
    if (error?.status === 400 && errorCode === "name_too_long" && errorField === "name") {
      const maxLengthValue = Number(error?.payload?.max_length);
      const maxLength = Number.isFinite(maxLengthValue) && maxLengthValue > 0 ? Math.floor(maxLengthValue) : 32;
      return `Mod name must be ${maxLength} characters or fewer.`;
    }
    if (errorCode === "plugin_limit_reached") {
      const maxPluginsValue = Number(error?.payload?.max_plugins);
      const maxPlugins = Number.isFinite(maxPluginsValue) && maxPluginsValue > 0 ? Math.floor(maxPluginsValue) : null;
      return maxPlugins
        ? `You have reached the maximum of ${maxPlugins} mods on your account.`
        : "You have reached the maximum number of mods allowed for your account.";
    }

    return error?.message || "Unknown error";
  }

  function renderAccountEmail() {
    const email = normalizeEmailValue(currentAccount?.email);
    accountEmailValue.innerHTML = renderEmailValue(email, isEmailRevealed);
    if (!email) {
      accountEmailToggle.disabled = true;
      accountEmailToggle.textContent = "Unavailable";
      return;
    }

    accountEmailToggle.disabled = false;
    accountEmailToggle.textContent = isEmailRevealed ? "Hide" : "Reveal";
  }

  function refreshDeveloperEmbedPreview() {
    const developerUuid = String(currentAccount?.id || "").trim();
    if (
      !developerUuid ||
      !developerEmbedTheme ||
      !developerEmbedLayout ||
      !developerEmbedSize ||
      !developerEmbedDark ||
      !developerEmbedPreview ||
      !developerEmbedUrl ||
      !developerEmbedCopyStatus
    ) {
      return;
    }

    const options = {
      theme: developerEmbedTheme.value,
      layout: developerEmbedLayout.value,
      size: developerEmbedSize.value,
      dark: developerEmbedDark.checked,
    };

    developerEmbedUrl.value = buildDeveloperEmbedUrl(developerUuid, options);
    developerEmbedPreview.src = buildDeveloperEmbedUrl(developerUuid, options, { cacheBust: true });
    developerEmbedCopyStatus.textContent = "";
  }

  function applyAccountDetails(nextAccount) {
    if (!nextAccount) return;
    currentAccount = nextAccount;
    usernameInput.value = currentAccount.username || "";
    githubLinkInput.value = currentAccount.github_link || "";
    curseforgeLinkInput.value = currentAccount.curseforge_link || "";
    if (topProfileLink) {
      if (currentAccount.id) {
        topProfileLink.href = `/developers/${encodeURIComponent(currentAccount.id)}`;
        topProfileLink.classList.remove("hidden");
        topProfileLink.classList.add("inline-flex");
      } else {
        topProfileLink.href = "#";
        topProfileLink.classList.add("hidden");
        topProfileLink.classList.remove("inline-flex");
      }
    }
    renderAccountEmail();
    refreshDeveloperEmbedPreview();
    updateDashboardSummary();
  }

  function updateDashboardSummary() {
    const identity = String(currentAccount?.username || "").trim() || "No Name";
    const activePlugin = pluginItems.find((item) => item.publicUuid === activePluginUuid);
    const activeModName = String(activePlugin?.info?.name || "").trim() || "No mod selected";
    const totalServers = pluginItems.reduce((sum, item) => sum + (Number(item?.info?.total_servers) || 0), 0);

    if (summaryIdentity) {
      summaryIdentity.textContent = identity;
    }
    if (summaryModCount) {
      summaryModCount.textContent = formatNumber(pluginItems.length);
    }
    if (summaryServerCount) {
      summaryServerCount.textContent = formatNumber(totalServers);
    }
    if (workspaceTitle) {
      workspaceTitle.textContent = activeModName;
    }
  }

  function renderPluginList() {
    if (pluginItems.length === 0) {
      pluginList.innerHTML = emptyState(
        "No mods yet",
        "Add your first mod using the form above to receive a public Mod ID and private server reporting key.",
      );
      updateDashboardSummary();
      return;
    }

    pluginList.innerHTML = `
      <div class="flex items-center justify-between gap-3 pb-1">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Registered Mods</p>
        <span class="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-brand-700">${escapeHtml(formatNumber(pluginItems.length))}</span>
      </div>
      <div class="space-y-2">
        ${pluginItems
          .map(
            (plugin) => `
              <article class="dashboard-mod-list-item ${plugin.publicUuid === activePluginUuid ? "dashboard-mod-list-item-selected" : ""} p-3 transition">
                <div class="flex items-start gap-2">
                  <button
                    class="dashboard-mod-list-select min-w-0 flex-1 rounded-lg px-2 py-2 text-left transition"
                    data-action="select"
                    data-uuid="${escapeHtml(plugin.publicUuid)}"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <p class="dashboard-mod-list-name truncate text-sm font-semibold">${escapeHtml(plugin.info.name || "Unknown mod")}</p>
                      ${plugin.publicUuid === activePluginUuid ? `<span class="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Selected</span>` : ""}
                    </div>
                    <p class="dashboard-mod-list-id mt-1 truncate font-mono text-[11px]">${escapeHtml(plugin.publicUuid)}</p>
                  </button>
                  <button
                    class="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100"
                    data-action="copy"
                    data-uuid="${escapeHtml(plugin.publicUuid)}"
                    title="Copy Mod ID"
                    aria-label="Copy Mod ID"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" class="h-4 w-4">
                      <rect x="9" y="9" width="10" height="10" rx="2" stroke="currentColor" stroke-width="2" />
                      <path d="M5 15V7a2 2 0 0 1 2-2h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                    </svg>
                  </button>
                  <button
                    class="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-700 transition hover:bg-red-100"
                    data-action="delete"
                    data-uuid="${escapeHtml(plugin.publicUuid)}"
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
    updateDashboardSummary();
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
      const index = pluginItems.findIndex((item) => item.publicUuid === activePluginUuid);
      if (index >= 0) pluginItems[index] = { ...pluginItems[index], info: pluginInfo };
      const activePlugin = index >= 0 ? pluginItems[index] : null;

      destroyAnalytics();
      analyticsCleanup = renderPluginAnalytics(liveContent, {
        pluginUuid: activePluginUuid,
        privatePluginUuid: activePlugin?.privateUuid || "",
        pluginInfo,
        developerInfo: {
          links: pluginInfo.links || {
            github_link: pluginInfo.github_link || "",
            curseforge_link: pluginInfo.curseforge_link || "",
          },
        },
        editablePluginLinks: true,
        historyRangeState:
          pluginHistoryRangeStates.get(activePluginUuid) ||
          (() => {
            const nextState = { mode: "all", fromInput: "", toInput: "" };
            pluginHistoryRangeStates.set(activePluginUuid, nextState);
            return nextState;
          })(),
        markerState:
          pluginMarkerStates.get(activePluginUuid) ||
          (() => {
            const nextState = { showMarkers: true };
            pluginMarkerStates.set(activePluginUuid, nextState);
            return nextState;
          })(),
        importantMarkers,
        onPluginLinksSaved: async () => {
          await refreshLiveStats(false);
        },
        onPrivatePluginUuidRefreshed: async () => {
          await loadPlugins(activePluginUuid);
        },
        onNotify: (message, type, target) => {
          showFeedback(message, type, target || liveContent);
        },
      });
      liveStatus.textContent = `Last updated at ${formatTimestamp(new Date())}`;
      renderPluginList();
      updateDashboardSummary();
      if (notifyOnSuccess) {
        showFeedback("Stats refreshed", "success", liveContent);
      }
    } catch (error) {
      if (disposed) return;
      destroyAnalytics();
      liveContent.innerHTML = errorState(error.message || "Failed to refresh mod stats.");
      liveStatus.textContent = "";
      updateDashboardSummary();
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

  async function loadPlugins(preferredActivePluginUuid = "") {
    pluginList.innerHTML = loadingState("Loading your mods...");
    liveContent.innerHTML = loadingState("Preparing live analytics...");

    const latestAccount = (await refreshSession()) || currentAccount;
    applyAccountDetails(latestAccount);
    const pluginAccessEntries = pairPluginAccess(latestAccount?.plugin_access, latestAccount?.private_plugin_access);
    if (pluginAccessEntries.length === 0) {
      pluginItems = [];
      activePluginUuid = null;
      renderPluginList();
      await refreshLiveStats(false);
      stopPolling();
      return;
    }

    const pluginResults = await Promise.allSettled(pluginAccessEntries.map((entry) => getPluginInfo(entry.publicUuid)));
    if (disposed) return;

    pluginItems = pluginResults
      .map((result, index) => {
        if (result.status !== "fulfilled") return null;
        return {
          publicUuid: pluginAccessEntries[index].publicUuid,
          privateUuid: pluginAccessEntries[index].privateUuid,
          info: result.value,
        };
      })
      .filter(Boolean);

    if (pluginItems.length === 0) {
      pluginList.innerHTML = errorState(
        "Your account has mod access entries, but none could be loaded. This may happen if deleted mods remain in your account access list.",
      );
      activePluginUuid = null;
      await refreshLiveStats(false);
      stopPolling();
      return;
    }

    if (preferredActivePluginUuid && pluginItems.some((item) => item.publicUuid === preferredActivePluginUuid)) {
      activePluginUuid = preferredActivePluginUuid;
    } else if (!activePluginUuid || !pluginItems.some((item) => item.publicUuid === activePluginUuid)) {
      activePluginUuid = pluginItems[0].publicUuid;
    }

    renderPluginList();
    await refreshLiveStats(false);
    startPolling();
  }

  addForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return;
    clearAddStatus();

    addSubmitButton.disabled = true;
    addSubmitButton.textContent = "Adding...";
    try {
      const result = await addPlugin(name);
      showFeedback(`Mod created: ${result.plugin_uuid}`, "success", addForm);
      showAddStatus("Mod created. Open its panel to copy the private server reporting key.", "success");
      addForm.reset();
      await loadPlugins(result.plugin_uuid);
    } catch (error) {
      const message = resolveAddPluginError(error);
      showAddStatus(message, "error");
      showFeedback(`Failed to add mod: ${message}`, "error", addForm);
    } finally {
      addSubmitButton.disabled = false;
      addSubmitButton.textContent = "Add Mod";
    }
  });

  nameInput.addEventListener("input", () => {
    clearAddStatus();
  });

  usernameForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = usernameInput.value.trim();

    usernameSubmit.disabled = true;
    usernameSubmit.textContent = "Saving...";
    try {
      await applyUsername(username);
      const latestAccount = await refreshSession();
      setAccount(latestAccount || null);
      applyAccountDetails(latestAccount);
      showFeedback(username ? "Username saved" : "Username cleared", "success", usernameForm);
    } catch (error) {
      showFeedback(`Failed to save username: ${error.message || "Unknown error"}`, "error", usernameForm);
    } finally {
      usernameSubmit.disabled = false;
      usernameSubmit.textContent = "Save";
    }
  });

  githubLinkForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const link = githubLinkInput.value.trim();
    // if (!link) {
    //   showFeedback("GitHub link cannot be empty", "error", githubLinkForm);
    //   return;
    // }

    githubLinkSubmit.disabled = true;
    githubLinkSubmit.textContent = "Saving...";
    try {
      await applyGithubLink(link);
      const latestAccount = await refreshSession();
      setAccount(latestAccount || null);
      applyAccountDetails(latestAccount);
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
    // if (!link) {
    //   showFeedback("CurseForge link cannot be empty", "error", curseforgeLinkForm);
    //   return;
    // }

    curseforgeLinkSubmit.disabled = true;
    curseforgeLinkSubmit.textContent = "Saving...";
    try {
      await applyCurseforgeLink(link);
      const latestAccount = await refreshSession();
      setAccount(latestAccount || null);
      applyAccountDetails(latestAccount);
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
        showFeedback("Mod ID copied", "success", button);
      } catch {
        showFeedback(`Could not copy Mod ID automatically. Mod ID: ${uuid}`, "error", button);
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
      const modEntry = pluginItems.find((item) => item.publicUuid === uuid);
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
    const button = event.target.closest("button[data-copy-value]");
    if (!button) return;

    const value = button.getAttribute("data-copy-value");
    const label = button.getAttribute("data-copy-label") || "Value";
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      showFeedback(`${label} copied`, "success", button);
    } catch {
      showFeedback(`Could not copy ${label} automatically. ${label}: ${value}`, "error", button);
    }
  });

  refreshButton.addEventListener("click", () => {
    refreshLiveStats(true, { notifyOnSuccess: true });
  });

  const onEditNameClick = () => {
    accountSettingsSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      usernameInput?.focus();
      usernameInput?.select();
    }, 250);
  };

  const onToggleEmail = () => {
    isEmailRevealed = !isEmailRevealed;
    renderAccountEmail();
  };

  summaryEditNameButton?.addEventListener("click", onEditNameClick);
  accountEmailToggle.addEventListener("click", onToggleEmail);

  developerEmbedTheme?.addEventListener("change", refreshDeveloperEmbedPreview);
  developerEmbedLayout?.addEventListener("change", refreshDeveloperEmbedPreview);
  developerEmbedSize?.addEventListener("change", refreshDeveloperEmbedPreview);
  developerEmbedDark?.addEventListener("change", refreshDeveloperEmbedPreview);
  developerEmbedCopy?.addEventListener("click", async () => {
    if (!developerEmbedUrl || !developerEmbedCopyStatus) return;
    try {
      await navigator.clipboard.writeText(developerEmbedUrl.value);
      developerEmbedCopyStatus.textContent = "Profile embed URL copied.";
    } catch {
      developerEmbedCopyStatus.textContent = "Copy failed. You can copy the URL field manually.";
    }

    if (developerEmbedCopyStatusTimeout) {
      window.clearTimeout(developerEmbedCopyStatusTimeout);
    }
    developerEmbedCopyStatusTimeout = window.setTimeout(() => {
      developerEmbedCopyStatus.textContent = "";
    }, 2600);
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

  try {
    const markerPayload = await getImportantDateMarkers({ limit: 1000 });
    importantMarkers = normalizeImportantDateMarkers(markerPayload);
  } catch {
    importantMarkers = normalizeImportantDateMarkers([]);
  }

  await loadPlugins();
  renderAccountEmail();
  refreshDeveloperEmbedPreview();
  updateDashboardSummary();

  return {
    cleanup: () => {
      disposed = true;
      stopPolling();
      destroyAnalytics();
      removeKofiOverlay();
      if (developerEmbedCopyStatusTimeout) {
        window.clearTimeout(developerEmbedCopyStatusTimeout);
      }
      summaryEditNameButton?.removeEventListener("click", onEditNameClick);
      accountEmailToggle.removeEventListener("click", onToggleEmail);
    },
  };
}




