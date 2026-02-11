import { getGlobalStats } from "../api/serverApi";
import { errorState } from "../components/errorState";
import { formatNumber } from "../utils/format";

export async function mountHomePage({ container }) {
  let isDisposed = false;
  let refreshTimer = null;

  container.innerHTML = `
    <section class="space-y-8">
      <header class="surface overflow-hidden">
        <div class="surface-body bg-gradient-to-br from-sky-50/70 via-white to-slate-50">
          <div class="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-stretch">
            <div>
              <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brand-700">HStats Live Network</p>
              <h1 class="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Real-time analytics for Hytale Mods
              </h1>
              <p class="mt-4 max-w-3xl text-slate-700">
                See how many servers run your mod, where they're located, and how usage trends over time without collecting player data.
              </p>
              <div class="mt-4">
                <div class="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
                  <span class="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500"></span>
                  <span id="home-live-strip">Connecting to live network...</span>
                </div>
              </div>
              <div class="mt-6 flex flex-wrap gap-3">
                <a
                  href="/dashboard"
                  data-link
                  class="inline-flex items-center rounded-xl bg-brand-600 px-6 py-3 text-base font-extrabold text-white shadow-lg shadow-sky-200/80 transition hover:-translate-y-0.5 hover:bg-brand-700 hover:text-white"
                >
                  Open Dashboard
                </a>
                <a
                  href="/docs"
                  data-link
                  class="inline-flex items-center rounded-xl border border-sky-200 bg-white px-6 py-3 text-base font-extrabold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50"
                >
                  Documentation
                </a>
              </div>
            </div>
            <aside id="home-community-stats" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:h-full">
              <article class="h-full rounded-xl border border-sky-200 bg-white">
                <div class="flex h-full flex-col justify-center p-4">
                  <p class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Developers</p>
                  <p id="home-developers-count" class="mt-2 text-3xl font-black text-slate-900">--</p>
                </div>
              </article>
              <article class="h-full rounded-xl border border-sky-200 bg-white">
                <div class="flex h-full flex-col justify-center p-4">
                  <p class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Mods Tracked</p>
                  <p id="home-mods-count" class="mt-2 text-3xl font-black text-slate-900">--</p>
                </div>
              </article>
            </aside>
          </div>
        </div>
      </header>

      <section class="surface">
        <div class="surface-body">
          <h2 class="section-title text-xl">How It Works</h2>
          <p class="muted mt-1">Three steps from install to insight.</p>
          <div class="mt-4 grid gap-3 md:grid-cols-3">
            <div class="rounded-lg border border-sky-100 bg-slate-50/70 p-3">
              <p class="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">Step 1</p>
              <p class="mt-1 text-sm font-semibold text-slate-900">Add the HStats API to your mod</p>
            </div>
            <div class="rounded-lg border border-sky-100 bg-slate-50/70 p-3">
              <p class="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">Step 2</p>
              <p class="mt-1 text-sm font-semibold text-slate-900">Servers report anonymous stats</p>
            </div>
            <div class="rounded-lg border border-sky-100 bg-slate-50/70 p-3">
              <p class="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">Step 3</p>
              <p class="mt-1 text-sm font-semibold text-slate-900">View live analytics in your dashboard</p>
            </div>
          </div>
        </div>
      </section>

      <section class="surface">
        <div class="surface-body">
          <h2 class="section-title text-xl">Built for Privacy and Trust</h2>
          <div class="mt-4 grid gap-3 md:grid-cols-3">
            <div class="rounded-lg border border-sky-100 bg-white p-3">
              <p class="text-sm font-bold text-slate-900">Open Source SDK</p>
              <p class="mt-1 text-sm text-slate-600">Inspectable integration code so developers can verify behavior.</p>
            </div>
            <div class="rounded-lg border border-sky-100 bg-white p-3">
              <p class="text-sm font-bold text-slate-900">Privacy-first</p>
              <p class="mt-1 text-sm text-slate-600">No IP storage. No player identifiers. No personal data.</p>
            </div>
            <div class="rounded-lg border border-sky-100 bg-white p-3">
              <p class="text-sm font-bold text-slate-900">Anonymous Tracking IDs</p>
              <p class="mt-1 text-sm text-slate-600">Random UUIDs identify servers without exposing identity.</p>
            </div>
          </div>
        </div>
      </section>
    </section>
  `;

  const heroStripElement = container.querySelector("#home-live-strip");
  const developersCountElement = container.querySelector("#home-developers-count");
  const modsCountElement = container.querySelector("#home-mods-count");
  const communityStatsElement = container.querySelector("#home-community-stats");

  function renderHeroStrip(data) {
    const serverCount = formatNumber(data?.online_servers || 0);
    const playerCount = formatNumber(data?.online_players || 0);
    const countryCount = formatNumber(Object.keys(data?.countries || {}).length);
    heroStripElement.textContent = `Live network: ${serverCount} servers | ${playerCount} players | ${countryCount} countries`;
  }

  function renderCommunityStats(data) {
    developersCountElement.textContent = formatNumber(data?.user_count || 0);
    modsCountElement.textContent = formatNumber(data?.plugin_count || 0);
  }

  async function refreshGlobalData({ initial = false } = {}) {
    try {
      const data = await getGlobalStats();
      if (isDisposed) return;

      renderHeroStrip(data);
      renderCommunityStats(data);
    } catch (error) {
      if (isDisposed) return;
      if (initial) {
        communityStatsElement.innerHTML = errorState(error.message || "Failed to load community metrics.");
        heroStripElement.textContent = "Live network data is temporarily unavailable.";
      }
    }
  }

  await refreshGlobalData({ initial: true });
  refreshTimer = window.setInterval(() => {
    if (isDisposed) return;
    void refreshGlobalData();
  }, 15000);

  return {
    cleanup: () => {
      isDisposed = true;
      if (refreshTimer) window.clearInterval(refreshTimer);
    },
  };
}
