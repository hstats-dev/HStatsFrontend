import { escapeHtml } from "../utils/escapeHtml";

export function emptyState(title, description) {
  return `
    <div class="surface border-dashed">
      <div class="surface-body text-center">
        <p class="text-lg font-semibold text-slate-900">${escapeHtml(title)}</p>
        <p class="mt-2 text-sm text-slate-600">${escapeHtml(description)}</p>
      </div>
    </div>
  `;
}
