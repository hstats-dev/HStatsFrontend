import { escapeHtml } from "../utils/escapeHtml";

export function loadingState(message = "Loading...") {
  return `
    <div class="surface">
      <div class="surface-body flex items-center gap-3 text-sm text-slate-600">
        <span class="h-4 w-4 animate-spin rounded-full border-2 border-sky-200 border-t-brand-600"></span>
        <span>${escapeHtml(message)}</span>
      </div>
    </div>
  `;
}
