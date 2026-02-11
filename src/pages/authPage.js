import { loginAccount, registerAccount } from "../api/accountApi";
import { escapeHtml } from "../utils/escapeHtml";

function getMode(query, params) {
  if (params?.mode === "register") return "register";
  if (params?.mode === "login") return "login";
  const queryMode = query.get("mode");
  return queryMode === "register" ? "register" : "login";
}

export async function mountAuthPage({ container, query, params, account, setAccount, navigate, refreshSession }) {
  const redirectPath = query.get("redirect") || "/dashboard";
  let mode = getMode(query, params);

  if (account) {
    container.innerHTML = `
      <section class="mx-auto max-w-xl space-y-4">
        <div class="surface">
          <div class="surface-body space-y-3">
            <h1 class="section-title">You are already logged in</h1>
            <p class="text-sm text-slate-700">Continue to your dashboard to manage mods and view live analytics.</p>
            <div class="flex flex-wrap gap-3">
              <a href="/dashboard" data-link class="btn-primary">Go to Dashboard</a>
              <a href="/" data-link class="btn-secondary">Back Home</a>
            </div>
          </div>
        </div>
      </section>
    `;
    return { cleanup: () => {} };
  }

  container.innerHTML = `
    <section class="mx-auto max-w-xl space-y-6">
      <header>
        <h1 class="section-title">Login / Register</h1>
        <p class="muted mt-1">Use your account to add mods and open your private dashboard.</p>
      </header>
      <div class="surface">
        <div class="surface-body space-y-5">
          <div class="inline-flex rounded-lg border border-sky-200 bg-sky-50 p-1">
            <button id="auth-login-tab" class="rounded-md px-4 py-2 text-sm font-semibold ${mode === "login" ? "bg-white text-brand-700 shadow" : "text-slate-700"}">Login</button>
            <button id="auth-register-tab" class="rounded-md px-4 py-2 text-sm font-semibold ${mode === "register" ? "bg-white text-brand-700 shadow" : "text-slate-700"}">Register</button>
          </div>
          <form id="auth-form" class="space-y-3">
            <input id="auth-email" class="input-base" type="email" required placeholder="Email address" />
            <input id="auth-password" class="input-base" type="password" required minlength="8" maxlength="128" placeholder="Password" />
            <button class="btn-primary w-full" type="submit">${mode === "login" ? "Login" : "Register"}</button>
          </form>
          <p id="auth-status" class="text-sm text-slate-600"></p>
          <p class="text-xs text-slate-500">
            Session auth uses secure cookies. Frontend requests include credentials automatically.
          </p>
        </div>
      </div>
    </section>
  `;

  const loginTab = container.querySelector("#auth-login-tab");
  const registerTab = container.querySelector("#auth-register-tab");
  const form = container.querySelector("#auth-form");
  const emailInput = container.querySelector("#auth-email");
  const passwordInput = container.querySelector("#auth-password");
  const status = container.querySelector("#auth-status");

  function updateTabStyles() {
    loginTab.className = `rounded-md px-4 py-2 text-sm font-semibold ${mode === "login" ? "bg-white text-brand-700 shadow" : "text-slate-700"}`;
    registerTab.className = `rounded-md px-4 py-2 text-sm font-semibold ${mode === "register" ? "bg-white text-brand-700 shadow" : "text-slate-700"}`;
    form.querySelector("button[type='submit']").textContent = mode === "login" ? "Login" : "Register";
    status.textContent = "";
  }

  loginTab.addEventListener("click", () => {
    mode = "login";
    updateTabStyles();
  });

  registerTab.addEventListener("click", () => {
    mode = "register";
    updateTabStyles();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) return;

    status.textContent = `${mode === "login" ? "Logging in" : "Creating account"}...`;
    try {
      const response =
        mode === "login" ? await loginAccount(email, password) : await registerAccount(email, password);

      setAccount(response.account);
      await refreshSession();
      status.innerHTML = `<span class="text-emerald-700">Success. Redirecting...</span>`;
      window.setTimeout(() => {
        navigate(redirectPath);
      }, 250);
    } catch (error) {
      status.innerHTML = `<span class="text-red-700">${escapeHtml(error.message || "Authentication failed")}</span>`;
    }
  });

  return { cleanup: () => {} };
}

