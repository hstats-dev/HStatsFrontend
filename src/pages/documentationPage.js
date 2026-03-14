import { escapeHtml } from "../utils/escapeHtml";

const PUBLIC_API_BASE = "https://api.hstats.dev/api";
const PUBLIC_API_BASE_DISPLAY = "api.hstats.dev/api";
const RATE_LIMITS = {
  PUBLIC_GET: "120/min/IP",
  HEAVY_GET: "45/min/IP",
  EMBED_GET: "240/min/IP",
};

const API_ENDPOINTS = [
  {
    id: "server-data",
    route: "GET /server-data",
    summary: "Latest global snapshot with counts, distributions, and all-time peaks.",
    params: [],
    rateLimit: "PUBLIC_GET",
    curl: `${PUBLIC_API_BASE}/server-data`,
    json: {
      online_players: 0,
      online_servers: 0,
      plugin_count: 0,
      user_count: 0,
      countries: {},
      java_versions: {},
      os_names: {},
      core_count: {},
      all_time_peak: {
        servers: { count: 0, at: null },
        players: { count: 0, at: null },
      },
    },
  },
  {
    id: "server-history",
    route: "GET /server-history",
    summary: "Hourly global server and player history, either recent, ranged, or full history.",
    params: ["days", "all", "limit", "from", "to"],
    rateLimit: "HEAVY_GET",
    notes: [
      "`days=30` for a recent rolling window",
      "`all=true` for the full dataset, optionally with `limit`",
      "`from` and `to` support dates or hour-level ISO timestamps",
    ],
    curl: `${PUBLIC_API_BASE}/server-history?days=30`,
    json: {
      history: [
        {
          hour_start: "2026-03-12T10:00:00Z",
          servers_count: 12,
          players_count: 348,
        },
      ],
    },
  },
  {
    id: "list-mods",
    route: "GET /plugin/list-plugins",
    summary: "Public directory listing for mods, ranked globally by active servers before pagination.",
    params: ["search", "page", "max"],
    rateLimit: "HEAVY_GET",
    curl: `${PUBLIC_API_BASE}/plugin/list-plugins?search=combat&page=1&max=50`,
    json: {
      plugins: {
        MOD_UUID: {
          plugin_info: {
            uuid: "MOD_UUID",
            name: "CombatEnhancer",
            github_link: "",
            curseforge_link: "",
          },
          servers_using: 42,
          total_players: 912,
          daily_stats: [],
          developer_info: {
            github_link: "",
            curseforge_link: "",
          },
          pages: 3,
        },
      },
    },
  },
  {
    id: "mod-info",
    route: "GET /plugin/plugin-info/:plugin_uuid",
    summary: "Full analytics payload for one mod using its public Mod ID.",
    params: [],
    rateLimit: "HEAVY_GET",
    curl: `${PUBLIC_API_BASE}/plugin/plugin-info/MOD_UUID`,
    json: {
      name: "CombatEnhancer",
      total_servers: 42,
      total_players: 912,
      countries: {},
      java_versions: {},
      os_names: {},
      core_count: {},
      links: {
        github_link: "",
        curseforge_link: "",
      },
      versions: {
        "1.7.5": 20,
        "1.7.4-BETA": 4,
      },
      history: [
        {
          hour_start: "2026-03-12T10:00:00Z",
          servers_count: 12,
          players_count: 348,
        },
      ],
      all_time_peak: {
        servers: { count: 30, at: "2026-03-12T10:00:00Z" },
        players: { count: 700, at: "2026-03-12T10:00:00Z" },
      },
      co_plugins: [
        { name: "OtherMod", uuid: "OTHER_UUID", times_seen: 18 },
      ],
    },
  },
  {
    id: "mod-ownership",
    route: "GET /account/get-plugin-ownership/:plugin_uuid",
    summary: "Public ownership metadata for a mod, including developer profile links when available.",
    params: [],
    rateLimit: "PUBLIC_GET",
    curl: `${PUBLIC_API_BASE}/account/get-plugin-ownership/MOD_UUID`,
    json: {
      id: "developer-uuid",
      github_link: "https://github.com/example",
      curseforge_link: "https://www.curseforge.com/members/example",
    },
  },
  {
    id: "developer-profile",
    route: "GET /account/developer/:developer_uuid",
    summary: "Public developer profile with username, links, and all public managed mods.",
    params: [],
    rateLimit: "PUBLIC_GET",
    curl: `${PUBLIC_API_BASE}/account/developer/DEVELOPER_UUID`,
    json: {
      developer: {
        id: "developer-uuid",
        username: "No Name",
        github_link: "",
        curseforge_link: "",
        mods_managed_count: 1,
        mods_managed: [
          {
            uuid: "MOD_UUID",
            name: "CombatEnhancer",
            added_on: "2026-03-12 10:30:00",
            links: {
              github_link: "",
              curseforge_link: "",
            },
            servers_using: 42,
            total_players: 912,
          },
        ],
      },
    },
  },
  {
    id: "embed-card",
    route: "GET /embed/:mod/card.svg",
    summary: "Shareable SVG analytics card for a public Mod ID.",
    params: ["theme", "layout", "size", "dark"],
    rateLimit: "EMBED_GET",
    notes: [
      "Layouts: `compact`, `stacked`, `history`",
      "Response includes `X-Embed-Cache: HIT|MISS`",
    ],
    curl: `${PUBLIC_API_BASE}/embed/MOD_UUID/card.svg?layout=history&theme=dark&size=md`,
    extraLabel: "Usage Example",
    extraCode: "html",
    extraSnippet: `${PUBLIC_API_BASE}/embed/MOD_UUID/card.svg?layout=compact&theme=light&size=md`,
  },
  {
    id: "recent-activity",
    route: "GET /recent-activity",
    summary: "Recent telemetry activity feed for dashboards, overlays, or status pages.",
    params: [],
    rateLimit: "PUBLIC_GET",
    deprecated: true,
    curl: `${PUBLIC_API_BASE}/recent-activity`,
    json: {
      recentActivity: [
        {
          message: "Server Heartbeat: 12 players online (ID: abc123)",
          timestamp: 1770840102407,
        },
      ],
    },
  },
];

function highlightJson(value) {
  const json = JSON.stringify(value, null, 2);
  const escaped = escapeHtml(json);

  return escaped.replace(
    /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      if (match.endsWith(":")) {
        return `<span class="code-token-type">${match}</span>`;
      }
      if (match.startsWith('"')) {
        return `<span class="code-token-string">${match}</span>`;
      }
      if (match === "true" || match === "false" || match === "null") {
        return `<span class="code-token-keyword">${match}</span>`;
      }
      return `<span class="code-token-number">${match}</span>`;
    },
  );
}

function renderCurlSnippet(url) {
  return `
    <pre class="code-block"><code><span class="code-token-keyword">curl</span> <span class="code-token-string">"${escapeHtml(url)}"</span></code></pre>
  `;
}

function renderJsonSnippet(value) {
  return `
    <pre class="code-block"><code>${highlightJson(value)}</code></pre>
  `;
}

function renderEmbedImgSnippet(url) {
  const safeUrl = escapeHtml(url);
  return `
    <pre class="code-block"><code><span class="code-token-keyword">&lt;img</span> <span class="code-token-type">src=</span><span class="code-token-string">"${safeUrl}"</span> <span class="code-token-type">alt=</span><span class="code-token-string">"HStats embed card"</span> <span class="code-token-keyword">/&gt;</span></code></pre>
  `;
}

function renderInlineCodeText(text) {
  return escapeHtml(String(text || "")).replace(/`([^`]+)`/g, "<code>$1</code>");
}

function renderParamsSentence(endpoint) {
  if (!endpoint.params?.length) {
    return "No query parameters are required for this endpoint.";
  }

  return `Supported query parameters: ${endpoint.params.map((param) => `\`${param}\``).join(", ")}.`;
}

function renderRateLimitSentence(endpoint) {
  if (!endpoint.rateLimit || !RATE_LIMITS[endpoint.rateLimit]) {
    return "";
  }

  return `Rate limit: ${RATE_LIMITS[endpoint.rateLimit]}.`;
}

function renderIntegrationTab() {
  return `
    <div id="docs-tab-integration" class="space-y-6">
      <section class="surface overflow-hidden">
        <div class="surface-body bg-gradient-to-br from-sky-50 via-white to-slate-50">
          <div class="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div class="space-y-4">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">HStats Class API</p>
                <h2 class="mt-2 text-2xl font-extrabold text-slate-900">Add HStats to your mod</h2>
                <p class="mt-2 text-sm text-slate-700 sm:text-base">
                  This tab is for integrating the bundled <code>HStats</code> class into your mod. Use the private server reporting key in code, and keep the public Mod ID for pages, embeds, and public lookups.
                </p>
              </div>
            </div>
            <div class="rounded-2xl border border-sky-100 bg-white/90 p-4 shadow-soft">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick Start</p>
              <ol class="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
                <li>Download the <code>HStats</code> class file.</li>
                <li>Create a mod in the dashboard.</li>
                <li>Copy the private server reporting key.</li>
                <li>Initialize <code>HStats</code> in your setup method.</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section class="space-y-4">
        <section class="surface">
          <div class="surface-body space-y-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 1</p>
              <h3 class="mt-1 text-lg font-bold text-slate-900">Add the class file</h3>
              <p class="mt-2 text-sm text-slate-700">
                Download the <code>HStats</code> class and place it in your mod source tree.
              </p>
            </div>
            <a
              href="https://github.com/al3xwarrior/HStatsExamplePlugin/blob/main/src/main/java/com/al3x/HStats.java"
              target="_blank"
              rel="noreferrer"
              class="inline-flex items-center rounded-md border border-sky-200 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-sky-50"
            >
              Open HStats Class on GitHub
            </a>
          </div>
        </section>

        <section class="surface">
          <div class="surface-body space-y-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 2</p>
              <h3 class="mt-1 text-lg font-bold text-slate-900">Initialize it in setup</h3>
              <p class="mt-2 text-sm text-slate-700">
                Use the private server reporting key from your dashboard plus your mod version. The public Mod ID is for pages, embeds, and API lookups.
              </p>
            </div>
            <pre class="code-block"><code><span class="code-token-keyword">new</span> <span class="code-token-type">HStats</span>(<span class="code-token-string">"YOUR-PRIVATE-REPORTING-KEY"</span>, <span class="code-token-string">"1.0.0"</span>);</code></pre>
            <pre class="code-block"><code><span class="code-token-annotation">@Override</span>
<span class="code-token-keyword">protected</span> <span class="code-token-type">void</span> <span class="code-token-function">setup</span>() {
  <span class="code-token-keyword">super</span>.<span class="code-token-function">setup</span>();
  <span class="code-token-keyword">new</span> <span class="code-token-type">HStats</span>(<span class="code-token-string">"1c7b9d7b-55cf-438f-91b1-cc3db640b7dc"</span>, <span class="code-token-string">"1.0.0"</span>);
}</code></pre>
          </div>
        </section>

        <section class="surface">
          <div class="surface-body space-y-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 3</p>
              <h3 class="mt-1 text-lg font-bold text-slate-900">View your stats in the dashboard</h3>
              <p class="mt-2 text-sm text-slate-700">
                Once your mod starts reporting, open the dashboard to view live analytics, version usage, co-installed mods, and embed options.
              </p>
            </div>
            <div class="pt-1">
              <a href="/dashboard" data-link class="btn-primary">Open Dashboard</a>
            </div>
          </div>
        </section>
      </section>

      <section class="surface border-red-200 bg-red-50">
        <div class="surface-body space-y-2">
          <h3 class="text-lg font-bold text-red-900">Private Key Reminder</h3>
          <p class="text-sm text-red-800">
            Keep the server reporting key private. It is used by your server to submit stats and should not be shared in public pages or repositories.
          </p>
        </div>
      </section>

      <section class="surface border-amber-200 bg-amber-50">
        <div class="surface-body space-y-2">
          <h3 class="text-lg font-bold text-amber-900">Important Policy Notice</h3>
          <p class="text-sm text-amber-800">
            Modifying the HStats class file, except changing the package name, is not allowed. Doing so may result in a ban of your account and mod from HStats.
          </p>
          <p class="text-sm text-amber-800">
            It also harms your own analytics quality, since HStats exists to help you understand real mod usage.
          </p>
        </div>
      </section>
    </div>
  `;
}

function renderEndpointSummaryCard(endpoint) {
  return `
    <button
      type="button"
      data-action="jump-endpoint"
      data-target="endpoint-${endpoint.id}"
      class="group rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-slate-50 to-sky-50 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-soft"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">${escapeHtml(endpoint.route)}</p>
          <p class="mt-2 text-sm font-semibold text-slate-900">${escapeHtml(endpoint.summary)}</p>
          <p class="mt-2 text-xs text-slate-600">${renderInlineCodeText(renderParamsSentence(endpoint))}</p>
          <p class="mt-1 text-xs font-medium text-slate-500">${escapeHtml(renderRateLimitSentence(endpoint))}</p>
        </div>
        <div class="flex items-center gap-1 pt-0.5">
          ${endpoint.deprecated ? `<span class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">Deprecated</span>` : ""}
          <span class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-200 bg-white text-brand-700 transition group-hover:border-sky-300 group-hover:bg-sky-50">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" class="h-4 w-4">
              <path d="M7 12h10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              <path d="m13 6 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </div>
      </div>
    </button>
  `;
}

function renderEndpointCard(endpoint) {
  const notesMarkup = endpoint.notes?.length
    ? `
      <ul class="mt-3 space-y-1 text-sm text-slate-600">
        ${endpoint.notes.map((note) => `<li>${renderInlineCodeText(note)}</li>`).join("")}
      </ul>
    `
    : "";

  const exampleMarkup = endpoint.json
    ? renderJsonSnippet(endpoint.json)
    : endpoint.extraCode === "html"
      ? renderEmbedImgSnippet(endpoint.extraSnippet)
      : "";

  return `
    <section id="endpoint-${endpoint.id}" class="surface">
      <div class="surface-body space-y-4">
        <div class="space-y-2">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-base font-bold text-slate-900"><code>${escapeHtml(endpoint.route)}</code></h3>
              ${endpoint.deprecated ? `<span class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">Deprecated</span>` : ""}
              ${endpoint.rateLimit ? `<span class="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">${escapeHtml(RATE_LIMITS[endpoint.rateLimit])}</span>` : ""}
            </div>
            <p class="mt-2 text-sm text-slate-700">${escapeHtml(endpoint.summary)}</p>
            <p class="mt-2 text-sm text-slate-600">${renderInlineCodeText(renderParamsSentence(endpoint))}</p>
            ${
              endpoint.deprecated
                ? `<p class="mt-2 text-sm font-medium text-amber-800">This endpoint is deprecated and will be removed in a future update. Avoid building new integrations around it.</p>`
                : ""
            }
          </div>
        </div>
        ${notesMarkup}
        ${renderCurlSnippet(endpoint.curl)}
        <div class="rounded-xl border border-sky-100 bg-slate-50 p-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">${escapeHtml(endpoint.json ? "JSON Example" : endpoint.extraLabel || "Example")}</p>
            <button
              type="button"
              data-action="toggle-example"
              data-target="example-${endpoint.id}"
              class="rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-sky-50"
              aria-expanded="false"
            >
              Show ${escapeHtml(endpoint.json ? "JSON" : endpoint.extraLabel || "Example")}
            </button>
          </div>
          <div id="example-${endpoint.id}" class="mt-3 hidden">
            ${exampleMarkup}
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderStatsApiTab() {
  return `
    <div id="docs-tab-stats" class="hidden space-y-6">
      <section class="surface overflow-hidden">
        <div class="surface-body bg-gradient-to-br from-white via-slate-50 to-sky-50">
          <div class="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">HStats Stats API</p>
              <h2 class="mt-2 text-2xl font-extrabold text-slate-900">Public read-only endpoints</h2>
              <p class="mt-2 text-sm text-slate-700 sm:text-base">
                Use these endpoints to power custom sites, overlays, bots, or dashboards with HStats network and mod analytics.
              </p>
            </div>
            <div class="rounded-2xl border border-sky-100 bg-white/90 p-4 shadow-soft">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Base URL</p>
              <p class="mt-2 font-mono text-sm font-bold text-slate-900">${PUBLIC_API_BASE_DISPLAY}</p>
              <p class="mt-2 text-sm text-slate-600">All endpoints in this section are public GET requests.</p>
            </div>
          </div>
        </div>
      </section>

      <section class="surface">
        <div class="surface-body space-y-4">
          <div>
            <p class="text-sm font-semibold text-slate-900">Endpoint List</p>
            <p class="mt-1 text-sm text-slate-600">Start here if you just need a quick map of what the stats API exposes.</p>
          </div>
          <div class="grid gap-3 lg:grid-cols-2">
            ${API_ENDPOINTS.map((endpoint) => renderEndpointSummaryCard(endpoint)).join("")}
          </div>
        </div>
      </section>

      <div class="space-y-4">
        ${API_ENDPOINTS.map((endpoint) => renderEndpointCard(endpoint)).join("")}
      </div>
    </div>
  `;
}

export async function mountDocumentationPage({ container }) {
  container.innerHTML = `
    <section class="space-y-6">
      <header class="space-y-4">
        <div>
          <h1 class="section-title">Documentation</h1>
          <p class="muted mt-1">Use HStats inside your mod, or build against the public stats API.</p>
        </div>
        <div class="inline-flex rounded-xl border border-sky-200 bg-sky-50 p-1">
          <button
            type="button"
            data-docs-tab="integration"
            class="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-sm"
            aria-pressed="true"
          >
            HStats Class API
          </button>
          <button
            type="button"
            data-docs-tab="stats"
            class="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
            aria-pressed="false"
          >
            HStats Stats API
          </button>
        </div>
      </header>

      ${renderIntegrationTab()}
      ${renderStatsApiTab()}
    </section>
  `;

  const listeners = [];
  const integrationTab = container.querySelector("#docs-tab-integration");
  const statsTab = container.querySelector("#docs-tab-stats");
  const tabButtons = Array.from(container.querySelectorAll("button[data-docs-tab]"));
  const exampleButtons = Array.from(container.querySelectorAll("button[data-action='toggle-example']"));
  const endpointJumpButtons = Array.from(container.querySelectorAll("button[data-action='jump-endpoint']"));

  const bind = (element, eventName, handler) => {
    element.addEventListener(eventName, handler);
    listeners.push(() => element.removeEventListener(eventName, handler));
  };

  const setActiveTab = (tabName) => {
    const showIntegration = tabName !== "stats";
    integrationTab?.classList.toggle("hidden", !showIntegration);
    statsTab?.classList.toggle("hidden", showIntegration);

    tabButtons.forEach((button) => {
      const isActive = button.getAttribute("data-docs-tab") === (showIntegration ? "integration" : "stats");
      button.className = isActive
        ? "rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-sm"
        : "rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900";
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  tabButtons.forEach((button) => {
    bind(button, "click", () => {
      const tabName = button.getAttribute("data-docs-tab") || "integration";
      setActiveTab(tabName);
    });
  });

  exampleButtons.forEach((button) => {
    bind(button, "click", () => {
      const targetId = button.getAttribute("data-target");
      if (!targetId) return;
      const target = container.querySelector(`#${targetId}`);
      if (!target) return;

      const isExpanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", isExpanded ? "false" : "true");
      target.classList.toggle("hidden", isExpanded);

      const baseLabel = button.textContent?.replace(/^Hide /, "").replace(/^Show /, "") || "Example";
      button.textContent = `${isExpanded ? "Show" : "Hide"} ${baseLabel}`;
    });
  });

  endpointJumpButtons.forEach((button) => {
    bind(button, "click", () => {
      const targetId = button.getAttribute("data-target");
      if (!targetId) return;
      setActiveTab("stats");
      window.requestAnimationFrame(() => {
        const target = container.querySelector(`#${targetId}`);
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  });

  setActiveTab("integration");

  return {
    cleanup: () => {
      listeners.forEach((remove) => remove());
    },
  };
}
