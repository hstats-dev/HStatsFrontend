export async function mountNotFoundPage({ container }) {
  container.innerHTML = `
    <section class="mx-auto max-w-2xl">
      <div class="surface">
        <div class="surface-body space-y-3">
          <h1 class="section-title">Page not found</h1>
          <p class="text-sm text-slate-700">The route you requested does not exist.</p>
          <a href="/" data-link class="btn-primary inline-flex">Go Home</a>
        </div>
      </div>
    </section>
  `;

  return { cleanup: () => {} };
}
