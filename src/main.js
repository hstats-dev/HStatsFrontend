import "./style.css";
import { getCurrentAccount } from "./api/accountApi";
import { createRouter } from "./router";
import { initializeTheme } from "./utils/theme";

const root = document.querySelector("#app");
const state = {
  account: null,
};
const ROUTE_FALLBACK_PARAM = "__route";

function restoreRouteFromFallbackParam() {
  const url = new URL(window.location.href);
  const fallbackRoute = url.searchParams.get(ROUTE_FALLBACK_PARAM);
  if (!fallbackRoute || !fallbackRoute.startsWith("/") || fallbackRoute.startsWith("//")) return;
  window.history.replaceState({}, "", fallbackRoute);
}

async function refreshSession() {
  try {
    const response = await getCurrentAccount();
    state.account = response.account || null;
    return state.account;
  } catch (error) {
    if (error.status === 401) {
      state.account = null;
      return null;
    }
    throw error;
  }
}

function setAccount(account) {
  state.account = account;
}

initializeTheme();
restoreRouteFromFallbackParam();

try {
  await refreshSession();
} catch {
  state.account = null;
}

const router = createRouter({
  root,
  state,
  refreshSession,
  setAccount,
});

void router.start();
