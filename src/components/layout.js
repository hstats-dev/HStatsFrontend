import { FOOTER_DISCORD_URL, FOOTER_GITHUB_URL } from "../config";
import { getActiveTheme } from "../utils/theme";

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
  const isDarkTheme = getActiveTheme() === "dark";
  const themeToggleAriaLabel = isDarkTheme ? "Switch to light mode" : "Switch to dark mode";
  const themeToggleIconSrc = isDarkTheme ? "/light-mode-icon.png" : "/dark-mode-icon.png";

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
            <button
              type="button"
              data-theme-toggle
              class="btn-secondary inline-flex h-10 w-10 items-center justify-center p-0"
              aria-label="${themeToggleAriaLabel}"
              title="${themeToggleAriaLabel}"
            >
              <img src="${themeToggleIconSrc}" alt="" class="h-5 w-5 object-contain" />
            </button>
          </div>
        </div>
      </header>
      <main id="app-content" class="page-shell"></main>
      <footer class="border-t border-sky-100 bg-white">
        <div class="mx-auto w-full max-w-6xl px-4 py-4 text-sm text-slate-600 sm:px-6 lg:px-8">
          <div class="grid gap-3 text-center sm:grid-cols-3 sm:items-center">
            <p class="sm:text-left">HStats - live Hytale mod analytics. Created by Al3x</p>
            <div class="flex items-center justify-center gap-4">
              <a class="btn-secondary px-3 py-1.5 text-xs sm:text-sm" href="${FOOTER_GITHUB_URL}" target="_blank" rel="noopener noreferrer">GitHub</a>
              <a class="btn-secondary px-3 py-1.5 text-xs sm:text-sm" href="${FOOTER_DISCORD_URL}" target="_blank" rel="noopener noreferrer">Discord</a>
            </div>
            <div class="flex items-center justify-center gap-3 sm:justify-end">
              <a href="/bstats-for-hytale" data-link>bStats for Hytale</a>
              <a href="/tos" data-link>TOS</a>
              <a href="/privacy" data-link>Privacy Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  `;
}
