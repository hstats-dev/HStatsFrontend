import { escapeHtml } from "../utils/escapeHtml";

export function errorState(message) {
  return `
    <div class="surface border-red-200 bg-red-50">
      <div class="surface-body text-sm text-red-700">
        ${escapeHtml(message)}
      </div>
    </div>
  `;
}
