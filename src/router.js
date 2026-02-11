import { renderLayout } from "./components/layout";
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

function resolveRoute(pathname) {
  if (pathname === "/") return { mount: mountHomePage, params: {}, requiresAuth: false };
  if (pathname === "/overall-stats") return { mount: mountOverallStatsPage, params: {}, requiresAuth: false };
  if (pathname === "/mods") return { mount: mountModsPage, params: {}, requiresAuth: false };
  if (pathname === "/docs" || pathname === "/documentation") {
    return { mount: mountDocumentationPage, params: {}, requiresAuth: false };
  }
  if (pathname === "/dashboard") return { mount: mountDashboardPage, params: {}, requiresAuth: true };
  if (pathname === "/auth") return { mount: mountAuthPage, params: {}, requiresAuth: false };
  if (pathname === "/login") return { mount: mountAuthPage, params: { mode: "login" }, requiresAuth: false };
  if (pathname === "/register") return { mount: mountAuthPage, params: { mode: "register" }, requiresAuth: false };
  if (pathname === "/tos") return { mount: mountTosPage, params: {}, requiresAuth: false };
  if (pathname === "/privacy") return { mount: mountPrivacyPage, params: {}, requiresAuth: false };

  const modDetailsMatch = pathname.match(/^\/mods\/([^/]+)$/);
  if (modDetailsMatch) {
    return {
      mount: mountModDetailsPage,
      params: { pluginUuid: decodeURIComponent(modDetailsMatch[1]) },
      requiresAuth: false,
    };
  }

  return { mount: mountNotFoundPage, params: {}, requiresAuth: false };
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
    const destination = path.startsWith("/") ? path : `/${path}`;
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
    const route = resolveRoute(url.pathname);

    if (route.requiresAuth && !state.account) {
      const redirect = encodeURIComponent(`${url.pathname}${url.search}`);
      navigate(`/auth?redirect=${redirect}`, { replace: true });
      return;
    }

    currentCleanup();
    currentCleanup = () => {};

    renderLayout(root, { currentPath: url.pathname, account: state.account });
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
