export function parsePluginAccess(pluginAccessString) {
  if (!pluginAccessString) return [];
  if (Array.isArray(pluginAccessString)) {
    return [...new Set(pluginAccessString.map((entry) => String(entry || "").trim()).filter(Boolean))];
  }

  return [...new Set(String(pluginAccessString).split(",").map((entry) => entry.trim()).filter(Boolean))];
}

export function pairPluginAccess(publicPluginAccess, privatePluginAccess) {
  const publicIds = parsePluginAccess(publicPluginAccess);
  const privateIds = parsePluginAccess(privatePluginAccess);

  return publicIds.map((publicUuid, index) => ({
    publicUuid,
    privateUuid: privateIds[index] || "",
  }));
}
