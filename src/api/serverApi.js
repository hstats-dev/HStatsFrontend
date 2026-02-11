import { apiRequest } from "./client";

export function getGlobalStats(signal) {
  return apiRequest("/server-data", { signal });
}

export function getRecentActivity(signal) {
  return apiRequest("/recent-activity", { signal });
}
