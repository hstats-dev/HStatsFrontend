export async function mountTosPage({ container }) {
  container.innerHTML = `
    <section class="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 class="section-title">Terms of Service</h1>
        <p class="muted mt-1">Effective date: February 9, 2026</p>
      </header>
      <article class="surface">
        <div class="surface-body space-y-4 text-sm text-slate-700">
          <p>
            By using HStats, you agree to provide accurate mod metadata, avoid abuse, and follow all applicable laws.
          </p>
          <p>
            You are responsible for your account security and for actions performed using your account, public Mod IDs, or private server reporting keys.
          </p>
          <p>
            Attempting to manipulate, tamper with, or reverse engineer the HStats data collection flow may lead to account and mod suspension.
          </p>
          <p>
            HStats is provided on an "as is" basis without guarantees of uninterrupted service.
          </p>
        </div>
      </article>
    </section>
  `;

  return { cleanup: () => {} };
}

