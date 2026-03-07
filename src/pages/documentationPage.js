export async function mountDocumentationPage({ container }) {
  container.innerHTML = `
    <section class="space-y-6">
      <header>
        <h1 class="section-title">Documentation</h1>
        <p class="muted mt-1">Integrate HStats in your Hytale mod and start reporting live usage.</p>
      </header>

      <section class="surface">
        <div class="surface-body space-y-4">
          <h2 class="text-lg font-bold text-slate-900">1. Add the HStats class file</h2>
          <p class="text-sm text-slate-700">
            Download the <code>HStats</code> class and place it in your mod source tree.
          </p>
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
          <h2 class="text-lg font-bold text-slate-900">2. Create HStats in your setup</h2>
          <p class="text-sm text-slate-700">
            Use your mod UUID from the dashboard plus your mod version.
          </p>
          <pre class="code-block"><code><span class="code-token-keyword">new</span> <span class="code-token-type">HStats</span>(<span class="code-token-string">"YOUR-MOD-UUID"</span>, <span class="code-token-string">"1.0.0"</span>);</code></pre>
          <pre class="code-block"><code><span class="code-token-annotation">@Override</span>
<span class="code-token-keyword">protected</span> <span class="code-token-type">void</span> <span class="code-token-function">setup</span>() {
  <span class="code-token-keyword">super</span>.<span class="code-token-function">setup</span>();
  <span class="code-token-keyword">new</span> <span class="code-token-type">HStats</span>(<span class="code-token-string">"c34a2b2a-afd8-4d6a-821e-7a63e12c5ea6"</span>, <span class="code-token-string">"1.0.0"</span>);
}</code></pre>
        </div>
      </section>

      <section class="surface border-amber-200 bg-amber-50">
        <div class="surface-body space-y-2">
          <h2 class="text-lg font-bold text-amber-900">Important Policy Notice</h2>
          <p class="text-sm text-amber-800">
            Modifying the HStats class file, except changing the package name, is not allowed.
            Doing so may result in a ban of your account and mod from HStats.
          </p>
          <p class="text-sm text-amber-800">
            It also harms your own analytics quality, since HStats exists to help you understand real mod usage.
          </p>
        </div>
      </section>

      <section class="surface">
        <div class="surface-body space-y-2">
          <h2 class="text-lg font-bold text-slate-900">Looking for bStats for Hytale?</h2>
          <p class="text-sm text-slate-700">
            Read the full article explaining why HStats is the bStats-style analytics platform for Hytale mods.
          </p>
          <a href="/bstats-for-hytale" data-link class="inline-flex items-center rounded-md border border-sky-200 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-sky-50">
            Open bStats for Hytale Article
          </a>
        </div>
      </section>
    </section>
  `;

  return { cleanup: () => {} };
}

