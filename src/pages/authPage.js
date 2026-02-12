import { loginAccount, registerAccount } from "../api/accountApi";
import { escapeHtml } from "../utils/escapeHtml";

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "6Lf8qWksAAAAACTDKKp41MJNO0fR26u_nlEjhp22";

let recaptchaScriptPromise = null;

function waitForRecaptchaReady(timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    if (window.grecaptcha?.execute) {
      resolve(window.grecaptcha);
      return;
    }

    const startTime = Date.now();
    const intervalId = window.setInterval(() => {
      if (window.grecaptcha?.execute) {
        window.clearInterval(intervalId);
        resolve(window.grecaptcha);
        return;
      }

      if (Date.now() - startTime >= timeoutMs) {
        window.clearInterval(intervalId);
        reject(new Error("reCAPTCHA failed to initialize"));
      }
    }, 50);
  });
}

function loadRecaptchaScript() {
  if (window.grecaptcha?.execute) {
    return Promise.resolve(window.grecaptcha);
  }

  if (recaptchaScriptPromise) {
    return recaptchaScriptPromise;
  }

  recaptchaScriptPromise = new Promise((resolve, reject) => {
    const resolveWhenReady = () => {
      waitForRecaptchaReady().then(resolve).catch(reject);
    };

    const existingScript = document.querySelector('script[data-recaptcha="google-v3"]');
    if (existingScript) {
      resolveWhenReady();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(RECAPTCHA_SITE_KEY)}`;
    script.async = true;
    script.defer = true;
    script.dataset.recaptcha = "google-v3";
    script.onload = resolveWhenReady;
    script.onerror = () => reject(new Error("Failed to load reCAPTCHA script. Check network or blocker settings."));
    document.head.appendChild(script);
  }).catch((error) => {
    recaptchaScriptPromise = null;
    throw error;
  });

  return recaptchaScriptPromise;
}

async function getRecaptchaToken(action = "register") {
  const grecaptcha = await loadRecaptchaScript();
  return new Promise((resolve, reject) => {
    grecaptcha.ready(() => {
      grecaptcha
        .execute(RECAPTCHA_SITE_KEY, { action })
        .then(resolve)
        .catch(() => reject(new Error("Failed to verify reCAPTCHA")));
    });
  });
}

function getMode(query, params) {
  if (params?.mode === "register") return "register";
  if (params?.mode === "login") return "login";
  const queryMode = query.get("mode");
  return queryMode === "register" ? "register" : "login";
}

export async function mountAuthPage({ container, query, params, account, setAccount, navigate, refreshSession }) {
  const redirectPath = query.get("redirect") || "/dashboard";
  let mode = getMode(query, params);
  let isDisposed = false;

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
            <p id="auth-recaptcha-note" class="${mode === "register" ? "" : "hidden"} text-xs text-slate-500">
              This site is protected by reCAPTCHA v3.
            </p>
            <button class="btn-primary w-full" type="submit">${mode === "login" ? "Login" : "Register"}</button>
          </form>
          <p id="auth-status" class="text-sm text-slate-600"></p>
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
  const submitButton = form.querySelector("button[type='submit']");
  const recaptchaNote = container.querySelector("#auth-recaptcha-note");

  function updateTabStyles() {
    loginTab.className = `rounded-md px-4 py-2 text-sm font-semibold ${mode === "login" ? "bg-white text-brand-700 shadow" : "text-slate-700"}`;
    registerTab.className = `rounded-md px-4 py-2 text-sm font-semibold ${mode === "register" ? "bg-white text-brand-700 shadow" : "text-slate-700"}`;
    submitButton.textContent = mode === "login" ? "Login" : "Register";

    if (mode === "register") {
      recaptchaNote.classList.remove("hidden");
      void loadRecaptchaScript().catch((error) => {
        status.innerHTML = `<span class="text-red-700">${escapeHtml(error.message || "Failed to initialize reCAPTCHA")}</span>`;
      });
    } else {
      recaptchaNote.classList.add("hidden");
    }

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

  if (mode === "register") {
    void loadRecaptchaScript().catch((error) => {
      status.innerHTML = `<span class="text-red-700">${escapeHtml(error.message || "Failed to initialize reCAPTCHA")}</span>`;
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) return;

    submitButton.disabled = true;
    status.textContent = `${mode === "login" ? "Logging in" : "Creating account"}...`;

    try {
      let response;

      if (mode === "login") {
        response = await loginAccount(email, password);
      } else {
        const recaptchaToken = await getRecaptchaToken("register");

        if (!recaptchaToken) {
          submitButton.disabled = false;
          status.innerHTML = `<span class="text-red-700">Unable to verify reCAPTCHA. Please try again.</span>`;
          return;
        }

        response = await registerAccount(email, password, recaptchaToken);
      }

      setAccount(response.account);
      await refreshSession();
      status.innerHTML = `<span class="text-emerald-700">Success. Redirecting...</span>`;
      window.setTimeout(() => {
        navigate(redirectPath);
      }, 250);
    } catch (error) {
      status.innerHTML = `<span class="text-red-700">${escapeHtml(error.message || "Authentication failed")}</span>`;
    } finally {
      submitButton.disabled = false;
    }
  });

  return {
    cleanup: () => {
      isDisposed = true;
    },
  };
}
