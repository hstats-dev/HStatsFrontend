export function formatNumber(value) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num.toLocaleString() : "0";
}

export function formatDateLabel(dateText) {
  if (!dateText) return "Unknown";
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return String(dateText);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatTimestamp(date = new Date()) {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
