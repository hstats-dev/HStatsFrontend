export async function mountPrivacyPage({ container }) {
  container.innerHTML = `
    <section class="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 class="section-title">Privacy Policy</h1>
        <p class="muted mt-1">Effective date: July 12, 2026</p>
      </header>
      <article class="surface">
        <div class="surface-body space-y-4 text-sm text-slate-700">
          <p>
            HStats stores account credentials securely, tracks mod usage metrics, and keeps session data for authentication.
          </p>
          <p>
            When you sign in with Hytale, HStats stores a protected lookup derived from Hytale's application-specific account identifier and the public UUID and username of the game profile you select. HStats does not receive your Hytale email address. Access tokens are used transiently to retrieve your selected profile and are not stored.
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

