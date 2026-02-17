import { getDiscordOAuthStartUrl, loginAccount, registerAccount } from "../api/accountApi";
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

function sanitizeInternalPath(path, fallback = "/dashboard") {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) return fallback;
  return path;
}

function buildDiscordReturnToPath(redirectPath) {
  const params = new URLSearchParams();
  params.set("redirect", redirectPath);
  return `/auth?${params.toString()}`;
}

function discordLogoIcon(sizeClass = "h-4 w-4") {
  return `
    <svg viewBox="0 0 127.14 96.36" aria-hidden="true" class="${sizeClass}" focusable="false">
      <path
        fill="currentColor"
        d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.27 8.09C2.79 32.65-1.71 56.61.54 80.24h.02a105.73 105.73 0 0 0 32.17 16.12 77.7 77.7 0 0 0 6.89-11.35 68.42 68.42 0 0 1-10.84-5.18c.91-.67 1.79-1.37 2.64-2.1a75.57 75.57 0 0 0 64.32 0c.85.73 1.73 1.43 2.64 2.1a68.68 68.68 0 0 1-10.86 5.19 77.25 77.25 0 0 0 6.89 11.34A105.25 105.25 0 0 0 126.58 80.24c2.64-27.4-4.5-51.14-18.88-72.17ZM42.45 65.69c-6.28 0-11.45-5.76-11.45-12.84 0-7.09 5.04-12.85 11.45-12.85 6.46 0 11.57 5.81 11.45 12.85 0 7.08-5.04 12.84-11.45 12.84Zm42.24 0c-6.28 0-11.45-5.76-11.45-12.84 0-7.09 5.04-12.85 11.45-12.85 6.46 0 11.57 5.81 11.45 12.85 0 7.08-5.04 12.84-11.45 12.84Z"
      />
    </svg>
  `;
}
function resolveDiscordOAuthErrorMessage(errorCode) {
  if (!errorCode) return "Discord login failed. Please try again.";

  const normalized = String(errorCode).trim().toLowerCase();
  if (normalized === "access_denied") return "Discord login was cancelled.";
  if (normalized === "state_mismatch" || normalized === "invalid_state") return "OAuth verification failed. Please try again.";
  if (normalized === "email_not_verified") return "Your Discord email is not verified. Please verify it and try again.";

  return `Discord login failed (${escapeHtml(errorCode)}).`;
}

export async function mountAuthPage({ container, query, params, account, setAccount, navigate, refreshSession }) {
  const redirectPath = sanitizeInternalPath(query.get("redirect"), "/dashboard");
  let mode = getMode(query, params);
  let isDisposed = false;
  let oauthRedirectTimer = null;

  const oauthProvider = query.get("oauth_provider");
  const oauthStatus = query.get("oauth_status");
  const oauthError = query.get("oauth_error");

  if (oauthProvider === "discord" && oauthStatus) {
    const redirectQuery = encodeURIComponent(redirectPath);
    const returnToPath = buildDiscordReturnToPath(redirectPath);

    container.innerHTML = `
      <section class="mx-auto max-w-xl space-y-4">
        <div class="surface">
          <div class="surface-body space-y-3">
            <h1 class="section-title">Discord Login</h1>
            <p id="auth-oauth-status" class="text-sm text-slate-700">Processing Discord authentication...</p>
            <div id="auth-oauth-actions" class="hidden flex flex-wrap gap-3">
              <button id="auth-discord-retry" type="button" class="inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4752C4]">${discordLogoIcon()}<span>Try Discord Again</span></button>
              <a href="/auth?redirect=${redirectQuery}" data-link class="btn-secondary">Use Email/Password</a>
            </div>
          </div>
        </div>
      </section>
    `;

    const statusElement = container.querySelector("#auth-oauth-status");
    const actionsElement = container.querySelector("#auth-oauth-actions");
    const retryButton = container.querySelector("#auth-discord-retry");

    const startDiscordLogin = () => {
      window.location.assign(getDiscordOAuthStartUrl(returnToPath));
    };

    retryButton?.addEventListener("click", startDiscordLogin);

    if (oauthStatus === "success") {
      statusElement.textContent = "Discord login successful. Finalizing session...";
      try {
        const refreshedAccount = await refreshSession();
        if (isDisposed) {
          retryButton?.removeEventListener("click", startDiscordLogin);
          return { cleanup: () => {} };
        }

        setAccount(refreshedAccount || null);

        if (refreshedAccount) {
          statusElement.innerHTML = `<span class="text-emerald-700">Success. Redirecting...</span>`;
          oauthRedirectTimer = window.setTimeout(() => {
            navigate(redirectPath, { replace: true });
          }, 250);
        } else {
          statusElement.innerHTML = `<span class="text-red-700">Discord login completed, but session could not be loaded. Please try again.</span>`;
          actionsElement.classList.remove("hidden");
        }
      } catch (error) {
        statusElement.innerHTML = `<span class="text-red-700">${escapeHtml(error.message || "Failed to complete Discord login.")}</span>`;
        actionsElement.classList.remove("hidden");
      }
    } else {
      statusElement.innerHTML = `<span class="text-red-700">${resolveDiscordOAuthErrorMessage(oauthError)}</span>`;
      actionsElement.classList.remove("hidden");
    }

    return {
      cleanup: () => {
        isDisposed = true;
        if (oauthRedirectTimer) {
          window.clearTimeout(oauthRedirectTimer);
        }
        retryButton?.removeEventListener("click", startDiscordLogin);
      },
    };
  }

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
          <button id="auth-discord-button" class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4752C4]" type="button">${discordLogoIcon()}<span>Continue with Discord</span></button>
          <p class="text-xs text-slate-500">Or continue with email and password below.</p>
          <form id="auth-form" class="space-y-3">
            <input id="auth-email" class="input-base" type="email" required placeholder="Email address" />
            <input id="auth-password" class="input-base" type="password" required minlength="8" maxlength="128" placeholder="Password" />
            <div id="auth-confirm-password-wrap" class="${mode === "register" ? "" : "hidden"}">
              <input id="auth-confirm-password" class="input-base" type="password" minlength="8" maxlength="128" placeholder="Confirm password" ${mode === "register" ? "required" : ""} />
            </div>
            <label id="auth-show-password-wrap" class="${mode === "register" ? "inline-flex" : "hidden inline-flex"} items-center gap-2 text-xs font-medium text-slate-600">
              <input id="auth-show-password" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
              Show password
            </label>
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
  const discordButton = container.querySelector("#auth-discord-button");
  const form = container.querySelector("#auth-form");
  const emailInput = container.querySelector("#auth-email");
  const passwordInput = container.querySelector("#auth-password");
  const confirmPasswordWrap = container.querySelector("#auth-confirm-password-wrap");
  const confirmPasswordInput = container.querySelector("#auth-confirm-password");
  const showPasswordWrap = container.querySelector("#auth-show-password-wrap");
  const showPasswordInput = container.querySelector("#auth-show-password");
  const status = container.querySelector("#auth-status");
  const submitButton = form.querySelector("button[type='submit']");
  const recaptchaNote = container.querySelector("#auth-recaptcha-note");

  function updatePasswordVisibility() {
    const isRevealEnabled = mode === "register" && showPasswordInput.checked;
    const type = isRevealEnabled ? "text" : "password";
    passwordInput.type = type;
    confirmPasswordInput.type = type;
  }

  function updateTabStyles() {
    loginTab.className = `rounded-md px-4 py-2 text-sm font-semibold ${mode === "login" ? "bg-white text-brand-700 shadow" : "text-slate-700"}`;
    registerTab.className = `rounded-md px-4 py-2 text-sm font-semibold ${mode === "register" ? "bg-white text-brand-700 shadow" : "text-slate-700"}`;
    submitButton.textContent = mode === "login" ? "Login" : "Register";

    if (mode === "register") {
      confirmPasswordWrap.classList.remove("hidden");
      showPasswordWrap.classList.remove("hidden");
      confirmPasswordInput.required = true;
      recaptchaNote.classList.remove("hidden");
      void loadRecaptchaScript().catch((error) => {
        status.innerHTML = `<span class="text-red-700">${escapeHtml(error.message || "Failed to initialize reCAPTCHA")}</span>`;
      });
    } else {
      confirmPasswordWrap.classList.add("hidden");
      showPasswordWrap.classList.add("hidden");
      confirmPasswordInput.required = false;
      confirmPasswordInput.value = "";
      showPasswordInput.checked = false;
      recaptchaNote.classList.add("hidden");
    }

    updatePasswordVisibility();
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

  const startDiscordLogin = () => {
    status.textContent = "Redirecting to Discord...";
    const returnToPath = buildDiscordReturnToPath(redirectPath);
    window.location.assign(getDiscordOAuthStartUrl(returnToPath));
  };

  discordButton.addEventListener("click", startDiscordLogin);
  showPasswordInput.addEventListener("change", updatePasswordVisibility);

  if (mode === "register") {
    void loadRecaptchaScript().catch((error) => {
      status.innerHTML = `<span class="text-red-700">${escapeHtml(error.message || "Failed to initialize reCAPTCHA")}</span>`;
    });
  }
  updatePasswordVisibility();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) return;
    if (mode === "register") {
      const confirmPassword = confirmPasswordInput.value;
      if (!confirmPassword) {
        status.innerHTML = `<span class="text-red-700">Please confirm your password.</span>`;
        return;
      }
      if (password !== confirmPassword) {
        status.innerHTML = `<span class="text-red-700">Passwords do not match.</span>`;
        return;
      }
    }

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
      if (oauthRedirectTimer) {
        window.clearTimeout(oauthRedirectTimer);
      }
      discordButton.removeEventListener("click", startDiscordLogin);
      showPasswordInput.removeEventListener("change", updatePasswordVisibility);
    },
  };
}
