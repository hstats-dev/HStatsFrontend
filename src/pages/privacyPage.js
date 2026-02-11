export async function mountPrivacyPage({ container }) {
  container.innerHTML = `
    <section class="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 class="section-title">Privacy Policy</h1>
        <p class="muted mt-1">Effective date: February 9, 2026</p>
      </header>
      <article class="surface">
        <div class="surface-body space-y-4 text-sm text-slate-700">
          <p>
            HStats stores account credentials securely, tracks mod usage metrics, and keeps session data for authentication.
          </p>
          <p>
            Mod analytics may include aggregate server/player counts and generalized environment metadata (OS, Java version, country code).
          </p>
          <p>
            We use this information to provide analytics dashboards and platform operations. We do not sell account data.
          </p>
          <p>
            You may request account removal by contacting the project owner.
          </p>
        </div>
      </article>
    </section>
  `;

  return { cleanup: () => {} };
}

