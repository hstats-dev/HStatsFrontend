import { apiRequest } from "./client";

export function registerAccount(email, password, recaptchaToken = "") {
  const body = { email, password };
  if (recaptchaToken) {
    body.recaptcha_token = recaptchaToken;
    body["g-recaptcha-response"] = recaptchaToken;
  }

  return apiRequest("/account/register", {
    method: "POST",
    body,
  });
}

export function loginAccount(email, password) {
  return apiRequest("/account/login", {
    method: "POST",
    body: { email, password },
  });
}

export function getCurrentAccount() {
  return apiRequest("/account/me");
}

export function logoutAccount() {
  return apiRequest("/account/logout", { method: "POST" });
}

export function applyGithubLink(githubLink) {
  return apiRequest("/account/apply-github-link", {
    method: "POST",
    body: {
      github_link: githubLink,
    },
  });
}

export function applyCurseforgeLink(curseforgeLink) {
  return apiRequest("/account/apply-curseforge-link", {
    method: "POST",
    body: {
      curseforge_link: curseforgeLink,
    },
  });
}

export function changePassword(currentPassword, newPassword) {
  return apiRequest("/account/change-password", {
    method: "POST",
    body: {
      current_password: currentPassword,
      new_password: newPassword,
    },
  });
}

export function getPluginOwnership(pluginUuid, signal) {
  return apiRequest(`/account/get-plugin-ownership/${encodeURIComponent(pluginUuid)}`, {
    signal,
  });
}
