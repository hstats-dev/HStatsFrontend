import { apiRequest } from "./client";

export function addPlugin(name, version = "1.0.0") {
  return apiRequest("/plugin/add-plugin", {
    method: "POST",
    body: { name, version },
  });
}

export function deletePlugin(uuid) {
  return apiRequest("/plugin/delete-plugin", {
    method: "POST",
    body: { uuid },
  });
}

export function getPluginInfo(pluginUuid, signal) {
  return apiRequest(`/plugin/plugin-info/${encodeURIComponent(pluginUuid)}`, {
    signal,
  });
}

export function applyPluginLinks(pluginUuid, githubLink, curseforgeLink) {
  return apiRequest("/plugin/apply-plugin-links", {
    method: "POST",
    body: {
      plugin_uuid: pluginUuid,
      github_link: githubLink,
      curseforge_link: curseforgeLink,
    },
  });
}

export function listPlugins(searchOrOptions = "", signal) {
  let search = "";
  let page = 1;
  let max = 50;
  let requestSignal = signal;

  if (typeof searchOrOptions === "object" && searchOrOptions !== null) {
    search = searchOrOptions.search || "";
    page = searchOrOptions.page || 1;
    max = searchOrOptions.max || 50;
    requestSignal = searchOrOptions.signal;
  } else {
    search = searchOrOptions;
  }

  const params = new URLSearchParams();
  if (search.trim()) {
    params.set("search", search.trim());
  }
  params.set("page", String(Math.max(1, Number(page) || 1)));
  params.set("max", String(Math.max(1, Math.min(50, Number(max) || 50))));

  const query = params.toString();
  const path = query ? `/plugin/list-plugins?${query}` : "/plugin/list-plugins";
  return apiRequest(path, { signal: requestSignal });
}
