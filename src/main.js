import "./style.css";
import { getCurrentAccount } from "./api/accountApi";
import { createRouter } from "./router";

const root = document.querySelector("#app");
const state = {
  account: null,
};

console.log("API Root: ", import.meta.env.VITE_API_BASE_URL);

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
