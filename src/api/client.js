import { API_ROOT } from "../config";

function buildUrl(path) {
  if (!path.startsWith("/")) {
    return `${API_ROOT}/${path}`;
  }
  return `${API_ROOT}${path}`;
}

export async function apiRequest(path, options = {}) {
  const { method = "GET", body, headers = {}, signal } = options;
  const requestHeaders = { Accept: "application/json", ...headers };

  const requestOptions = {
    method,
    credentials: "include",
    headers: requestHeaders,
    signal,
  };

  if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
    requestOptions.body = JSON.stringify(body);
  }

  const response = await fetch(buildUrl(path), requestOptions);

  let payload = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    payload = await response.text();
  }

  if (!response.ok) {
    const error = new Error(payload?.error || response.statusText || "Request failed");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}
