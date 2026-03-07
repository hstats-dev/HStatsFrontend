import { apiRequest } from "./client";

export function getGlobalStats(signal) {
  return apiRequest("/server-data", { signal });
}

export function getGlobalHistory(options = {}, signal) {
  let requestOptions = options;
  let requestSignal = signal;

  if (options && typeof options === "object" && "signal" in options && signal === undefined) {
    requestSignal = options.signal;
    requestOptions = { ...options };
    delete requestOptions.signal;
  }

  const params = new URLSearchParams();
  const hasExplicitRange = Boolean(requestOptions?.from || requestOptions?.to);
  if (requestOptions?.all) {
    params.set("all", "true");
  } else if (!hasExplicitRange) {
    const days = Number(requestOptions?.days);
    params.set("days", String(Number.isFinite(days) && days > 0 ? Math.floor(days) : 30));
  }

  if (requestOptions?.limit !== undefined) {
    const limit = Number(requestOptions.limit);
    if (Number.isFinite(limit) && limit > 0) {
      params.set("limit", String(Math.floor(limit)));
    }
  }
  if (requestOptions?.from) params.set("from", String(requestOptions.from));
  if (requestOptions?.to) params.set("to", String(requestOptions.to));

  const query = params.toString();
  return apiRequest(query ? `/server-history?${query}` : "/server-history", { signal: requestSignal });
}

export function getRecentActivity(signal) {
  return apiRequest("/recent-activity", { signal });
}
