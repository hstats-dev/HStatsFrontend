function navLink(path, currentPath, label) {
  const isActive = path === "/" ? currentPath === "/" : currentPath.startsWith(path);
  const activeClasses = isActive ? "bg-sky-100 text-brand-700" : "text-slate-700 hover:bg-sky-50";

  return `
    <a
      href="${path}"
      data-link
      class="rounded-md px-3 py-2 text-sm font-semibold transition ${activeClasses}"
    >
      ${label}
    </a>
  `;
}

export function renderLayout(rootElement, { currentPath, account }) {
  rootElement.innerHTML = `
    <div class="min-h-screen">
      <header class="sticky top-0 z-30 border-b border-sky-100 bg-white/95 backdrop-blur">
        <div class="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <a href="/" data-link class="text-xl font-extrabold tracking-tight text-slate-900">
            HStats.dev
          </a>
          <nav class="flex flex-wrap items-center gap-1">
            ${navLink("/", currentPath, "Home")}
            ${navLink("/overall-stats", currentPath, "Overall Stats")}
            ${navLink("/mods", currentPath, "Mods")}
            ${navLink("/docs", currentPath, "Documentation")}
          </nav>
          <div class="flex items-center gap-2">
            ${
              account
                ? `
                  <a href="/dashboard" data-link class="btn-secondary">Dashboard</a>
                `
                : `
                  <a href="/auth" data-link class="btn-primary">Login / Register</a>
                `
            }
          </div>
        </div>
      </header>
      <main id="app-content" class="page-shell"></main>
      <footer class="border-t border-sky-100 bg-white">
        <div class="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm text-slate-600 sm:px-6 lg:px-8">
          <p>HStats - live Hytale mod analytics. Created by Al3x</p>
          <div class="flex items-center gap-3">
            <a href="/tos" data-link>TOS</a>
            <a href="/privacy" data-link>Privacy Policy</a>
          </div>
        </div>
      </footer>
    </div>
  `;
}
