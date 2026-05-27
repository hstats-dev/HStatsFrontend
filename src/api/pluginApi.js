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

export function applyPluginName(pluginUuid, name) {
  return apiRequest("/plugin/apply-plugin-name", {
    method: "POST",
    body: {
      plugin_uuid: pluginUuid,
      name,
    },
  });
}

export function applyPluginVisibility(pluginUuid, isUnlisted) {
  return apiRequest("/plugin/apply-plugin-visibility", {
    method: "POST",
    body: {
      plugin_uuid: pluginUuid,
      is_unlisted: isUnlisted,
    },
  });
}

export function refreshPrivatePluginUuid(pluginUuid) {
  return apiRequest("/plugin/refresh-private-plugin-uuid", {
    method: "POST",
    body: {
      plugin_uuid: pluginUuid,
    },
  });
}

export function listPlugins(searchOrOptions = "", signal) {
  let search = "";
  let page = 1;
  let max = 51;
  let sort = "popular";
  let links = "any";
  let developerUuid = "";
  let minServers = "";
  let maxServers = "";
  let minPlayers = "";
  let maxPlayers = "";
  let requestSignal = signal;

  if (typeof searchOrOptions === "object" && searchOrOptions !== null) {
    search = searchOrOptions.search || "";
    page = searchOrOptions.page || 1;
    max = searchOrOptions.max || 51;
    sort = searchOrOptions.sort || "popular";
    links = searchOrOptions.links || "any";
    developerUuid = searchOrOptions.developerUuid || searchOrOptions.developer_uuid || "";
    minServers = searchOrOptions.minServers ?? searchOrOptions.min_servers ?? "";
    maxServers = searchOrOptions.maxServers ?? searchOrOptions.max_servers ?? "";
    minPlayers = searchOrOptions.minPlayers ?? searchOrOptions.min_players ?? "";
    maxPlayers = searchOrOptions.maxPlayers ?? searchOrOptions.max_players ?? "";
    requestSignal = searchOrOptions.signal;
  } else {
    search = searchOrOptions;
  }

  const params = new URLSearchParams();
  if (search.trim()) {
    params.set("search", search.trim());
  }
  params.set("page", String(Math.max(1, Number(page) || 1)));
  params.set("max", String(Math.max(1, Math.min(51, Number(max) || 51))));
  params.set("sort", String(sort || "popular"));
  params.set("links", String(links || "any"));
  if (String(developerUuid).trim()) {
    params.set("developer_uuid", String(developerUuid).trim());
  }
  if (minServers !== "" && minServers !== null && minServers !== undefined) {
    params.set("min_servers", String(minServers));
  }
  if (maxServers !== "" && maxServers !== null && maxServers !== undefined) {
    params.set("max_servers", String(maxServers));
  }
  if (minPlayers !== "" && minPlayers !== null && minPlayers !== undefined) {
    params.set("min_players", String(minPlayers));
  }
  if (maxPlayers !== "" && maxPlayers !== null && maxPlayers !== undefined) {
    params.set("max_players", String(maxPlayers));
  }

  const query = params.toString();
  const path = query ? `/plugin/list-plugins?${query}` : "/plugin/list-plugins";
  return apiRequest(path, { signal: requestSignal });
}
