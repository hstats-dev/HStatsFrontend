export function parsePluginAccess(pluginAccessString) {
  if (!pluginAccessString) return [];
  return [...new Set(String(pluginAccessString).split(",").map((entry) => entry.trim()).filter(Boolean))];
}
