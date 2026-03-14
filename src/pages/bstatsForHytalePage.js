const ARTICLE_SCHEMA_ID = "hstats-bstats-hytale-schema";

function upsertArticleSchema() {
  const existing = document.getElementById(ARTICLE_SCHEMA_ID);
  if (existing) existing.remove();

  const script = document.createElement("script");
  script.id = ARTICLE_SCHEMA_ID;
  script.type = "application/ld+json";
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "bStats for Hytale: HStats Explained",
    description: "HStats is bStats-style analytics for Hytale mods, with anonymous server metrics and simple integration.",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${window.location.origin}/bstats-for-hytale`,
    },
    publisher: {
      "@type": "Organization",
      name: "HStats",
      url: window.location.origin,
    },
    author: {
      "@type": "Person",
      name: "Al3x",
    },
    about: ["Hytale mod analytics", "bStats alternative for Hytale", "anonymous server telemetry"],
  });

  document.head.appendChild(script);
}

export async function mountBstatsForHytalePage({ container }) {
  upsertArticleSchema();

  container.innerHTML = `
    <article class="space-y-6">
      <header class="surface overflow-hidden">
        <div class="surface-body bg-gradient-to-br from-sky-50 via-white to-slate-50">
          <p class="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Guide / Article</p>
          <h1 class="section-title mt-2">bStats for Hytale: Why HStats Exists</h1>
          <p class="mt-3 max-w-4xl text-sm text-slate-700 sm:text-base">
            If you are searching for <strong>bStats for Hytale</strong>, the direct answer is
            <strong>HStats</strong>. It follows the same goal and workflow: simple integration,
            lightweight reporting, and anonymous usage metrics for mod developers.
          </p>
        </div>
      </header>

      <section class="surface">
        <div class="surface-body space-y-4">
          <h2 class="text-xl font-extrabold tracking-tight text-slate-900">What is bStats for Hytale?</h2>
          <p class="text-sm text-slate-700 sm:text-base">
            bStats is widely known in Minecraft plugin development. Hytale needed the same style of
            analytics platform, built for Hytale mods and Hytale server environments. HStats is that platform.
          </p>
          <p class="text-sm text-slate-700 sm:text-base">
            In practical terms, HStats is <strong>bStats but for Hytale</strong>: it gives developers a clean way
            to measure real usage without collecting personal player data.
          </p>
        </div>
      </section>

      <section class="surface">
        <div class="surface-body space-y-4">
          <h2 class="text-xl font-extrabold tracking-tight text-slate-900">How HStats Matches the bStats Model</h2>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-lg border border-sky-100 bg-white p-4">
              <h3 class="text-base font-bold text-slate-900">Simple SDK Drop-in</h3>
              <p class="mt-1 text-sm text-slate-600">Add one class and initialize with your private server reporting key and version.</p>
            </div>
            <div class="rounded-lg border border-sky-100 bg-white p-4">
              <h3 class="text-base font-bold text-slate-900">Anonymous Metrics</h3>
              <p class="mt-1 text-sm text-slate-600">Server UUIDs and aggregate counts only. No player identity tracking.</p>
            </div>
            <div class="rounded-lg border border-sky-100 bg-white p-4">
              <h3 class="text-base font-bold text-slate-900">Environment Insights</h3>
              <p class="mt-1 text-sm text-slate-600">See Java version, OS data, core counts, and global country usage.</p>
            </div>
            <div class="rounded-lg border border-sky-100 bg-white p-4">
              <h3 class="text-base font-bold text-slate-900">Developer Dashboard</h3>
              <p class="mt-1 text-sm text-slate-600">Track per-mod players, servers, history trends, and version adoption.</p>
            </div>
          </div>
        </div>
      </section>

      <section class="surface">
        <div class="surface-body space-y-4">
          <h2 class="text-xl font-extrabold tracking-tight text-slate-900">Quick Setup (Same Spirit as bStats)</h2>
          <ol class="list-decimal space-y-2 pl-5 text-sm text-slate-700 sm:text-base">
            <li>Create your account and add your mod in the dashboard.</li>
            <li>Copy your private server reporting key from the dashboard.</li>
            <li>Drop the HStats class file into your mod source.</li>
            <li>Initialize HStats in your mod setup method.</li>
          </ol>
          <div class="flex flex-wrap gap-3 pt-1">
            <a href="/docs" data-link class="btn-primary">Read Integration Docs</a>
            <a href="/dashboard" data-link class="btn-secondary">Open Dashboard</a>
          </div>
        </div>
      </section>

      <section class="surface">
        <div class="surface-body space-y-4">
          <h2 class="text-xl font-extrabold tracking-tight text-slate-900">FAQ</h2>
          <div class="space-y-3 text-sm text-slate-700 sm:text-base">
            <div>
              <h3 class="font-bold text-slate-900">Is HStats official bStats?</h3>
              <p>No. HStats is an independent analytics service built specifically for the Hytale ecosystem.</p>
            </div>
            <div>
              <h3 class="font-bold text-slate-900">Is HStats basically bStats for Hytale?</h3>
              <p>Yes. Same practical concept: low-friction integration and anonymous aggregate analytics for mod developers.</p>
            </div>
            <div>
              <h3 class="font-bold text-slate-900">Can server owners disable HStats?</h3>
              <p>Yes. Server owners can disable metrics collection, and reported stats are anonymous by design.</p>
            </div>
          </div>
        </div>
      </section>
    </article>
  `;

  return {
    cleanup: () => {
      const schemaScript = document.getElementById(ARTICLE_SCHEMA_ID);
      if (schemaScript) schemaScript.remove();
    },
  };
}

