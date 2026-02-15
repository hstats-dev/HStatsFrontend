import { renderLayout } from "./components/layout";
import { setPageSeo } from "./utils/seo";
import { mountHomePage } from "./pages/homePage";
import { mountOverallStatsPage } from "./pages/overallStatsPage";
import { mountModsPage } from "./pages/modsPage";
import { mountModDetailsPage } from "./pages/modDetailsPage";
import { mountDocumentationPage } from "./pages/documentationPage";
import { mountDashboardPage } from "./pages/dashboardPage";
import { mountAuthPage } from "./pages/authPage";
import { mountTosPage } from "./pages/tosPage";
import { mountPrivacyPage } from "./pages/privacyPage";
import { mountNotFoundPage } from "./pages/notFoundPage";
import { toggleThemePreference } from "./utils/theme";

const SEO_HOME = {
  title: "Real-time Hytale Mod Analytics",
  description: "Track live Hytale mod usage across servers with privacy and developer-focused analytics.",
};

const SEO_OVERALL_STATS = {
  title: "Overall Network Stats",
  description: "View global HStats activity including online players, active servers, countries, and environment breakdowns.",
};

const SEO_MODS = {
  title: "Mods Directory",
  description: "Browse tracked Hytale mods, check active servers and players, and open detailed analytics for each mod.",
};

const SEO_MOD_DETAILS = {
  title: "Mod Analytics",
  description: "Detailed HStats analytics for a specific Hytale mod, including usage trends and live server activity.",
};

const SEO_DOCS = {
  title: "Documentation",
  description: "Integrate HStats into your Hytale mod and start reporting live usage metrics in minutes.",
};

const SEO_DASHBOARD = {
  title: "Developer Dashboard",
  description: "Manage your mods, profile links, and live analytics in your private HStats dashboard.",
  noIndex: true,
};

const SEO_AUTH = {
  title: "Login or Register",
  description: "Sign in to HStats to manage mods and access your private analytics dashboard.",
  noIndex: true,
};

const SEO_TOS = {
  title: "Terms of Service",
  description: "Read the HStats terms covering platform usage, account responsibilities, and acceptable behavior.",
};

const SEO_PRIVACY = {
  title: "Privacy Policy",
  description: "Review how HStats handles account data, aggregate telemetry, and privacy protections.",
};

const SEO_NOT_FOUND = {
  title: "Page Not Found",
  description: "The page you requested could not be found on HStats.",
  noIndex: true,
};

function resolveRoute(pathname) {
  if (pathname === "/") return { mount: mountHomePage, params: {}, requiresAuth: false, seo: SEO_HOME };
  if (pathname === "/overall-stats") return { mount: mountOverallStatsPage, params: {}, requiresAuth: false, seo: SEO_OVERALL_STATS };
  if (pathname === "/mods") return { mount: mountModsPage, params: {}, requiresAuth: false, seo: SEO_MODS };
  if (pathname === "/docs" || pathname === "/documentation") {
    return { mount: mountDocumentationPage, params: {}, requiresAuth: false, seo: SEO_DOCS };
  }
  if (pathname === "/dashboard") return { mount: mountDashboardPage, params: {}, requiresAuth: true, seo: SEO_DASHBOARD };
  if (pathname === "/auth") return { mount: mountAuthPage, params: {}, requiresAuth: false, seo: SEO_AUTH };
  if (pathname === "/login") return { mount: mountAuthPage, params: { mode: "login" }, requiresAuth: false, seo: SEO_AUTH };
  if (pathname === "/register") return { mount: mountAuthPage, params: { mode: "register" }, requiresAuth: false, seo: SEO_AUTH };
  if (pathname === "/tos") return { mount: mountTosPage, params: {}, requiresAuth: false, seo: SEO_TOS };
  if (pathname === "/privacy") return { mount: mountPrivacyPage, params: {}, requiresAuth: false, seo: SEO_PRIVACY };

  const modDetailsMatch = pathname.match(/^\/mods\/([^/]+)$/);
  if (modDetailsMatch) {
    try {
      const pluginUuid = decodeURIComponent(modDetailsMatch[1]);
      return {
        mount: mountModDetailsPage,
        params: { pluginUuid },
        requiresAuth: false,
        seo: SEO_MOD_DETAILS,
      };
    } catch {
      return { mount: mountNotFoundPage, params: {}, requiresAuth: false, seo: SEO_NOT_FOUND };
    }
  }

  return { mount: mountNotFoundPage, params: {}, requiresAuth: false, seo: SEO_NOT_FOUND };
}

function normalizePathname(pathname) {
  if (!pathname || pathname === "/") return "/";

  let normalized = pathname;
  if (normalized.toLowerCase().endsWith("/index.html")) {
    normalized = normalized.slice(0, -"/index.html".length) || "/";
  }

  normalized = normalized.replace(/\/{2,}/g, "/");
  if (normalized.length > 1) {
    normalized = normalized.replace(/\/+$/, "");
  }

  return normalized || "/";
}

function normalizeDestination(path) {
  const rawPath = path.startsWith("/") ? path : `/${path}`;

  try {
    const destinationUrl = new URL(rawPath, window.location.origin);
    const normalizedPath = normalizePathname(destinationUrl.pathname);
    return `${normalizedPath}${destinationUrl.search}${destinationUrl.hash}`;
  } catch {
    return rawPath;
  }
}

function isInternalLinkAnchor(anchor) {
  const href = anchor.getAttribute("href");
  if (!href) return false;
  if (href.startsWith("http://") || href.startsWith("https://")) return false;
  if (href.startsWith("mailto:") || href.startsWith("tel:")) return false;
  return true;
}

export function createRouter({ root, state, refreshSession, setAccount }) {
  let currentCleanup = () => {};
  let renderToken = 0;

  const navigate = (path, { replace = false } = {}) => {
    const destination = normalizeDestination(path);
    if (replace) {
      window.history.replaceState({}, "", destination);
    } else {
      window.history.pushState({}, "", destination);
    }
    void render();
  };

  const render = async () => {
    const token = ++renderToken;
    const url = new URL(window.location.href);
    const normalizedPath = normalizePathname(url.pathname);

    if (normalizedPath !== url.pathname) {
      window.history.replaceState({}, "", `${normalizedPath}${url.search}${url.hash}`);
    }

    const route = resolveRoute(normalizedPath);

    if (route.requiresAuth && !state.account) {
      const redirect = encodeURIComponent(`${normalizedPath}${url.search}`);
      navigate(`/auth?redirect=${redirect}`, { replace: true });
      return;
    }

    setPageSeo({
      ...(route.seo || SEO_NOT_FOUND),
      path: `${normalizedPath}${url.search}`,
    });

    currentCleanup();
    currentCleanup = () => {};

    renderLayout(root, { currentPath: normalizedPath, account: state.account });
    const container = root.querySelector("#app-content");

    const context = {
      container,
      params: route.params,
      query: url.searchParams,
      account: state.account,
      navigate,
      setAccount,
      refreshSession,
    };

    try {
      const mounted = await route.mount(context);
      if (token !== renderToken) {
        mounted?.cleanup?.();
        return;
      }

      currentCleanup = mounted?.cleanup || (() => {});
    } catch (error) {
      console.error(error);
      container.innerHTML = `
        <div class="surface border-red-200 bg-red-50">
          <div class="surface-body text-sm text-red-700">
            Unexpected error while rendering this page.
          </div>
        </div>
      `;
      currentCleanup = () => {};
    }
  };

  const onLinkClick = (event) => {
    const themeToggleButton = event.target.closest("button[data-theme-toggle]");
    if (themeToggleButton) {
      event.preventDefault();
      toggleThemePreference();
      void render();
      return;
    }

    const anchor = event.target.closest("a[data-link]");
    if (!anchor || !isInternalLinkAnchor(anchor)) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(anchor.getAttribute("href"));
  };

  document.addEventListener("click", onLinkClick);
  window.addEventListener("popstate", render);

  return {
    start: render,
    navigate,
    destroy: () => {
      currentCleanup();
      document.removeEventListener("click", onLinkClick);
      window.removeEventListener("popstate", render);
    },
  };
}
