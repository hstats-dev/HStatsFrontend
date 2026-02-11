import { escapeHtml } from "../utils/escapeHtml";

export function statCard({ label, value, detail = "" }) {
  return `
    <article class="surface">
      <div class="surface-body">
        <p class="text-sm font-semibold uppercase tracking-wide text-slate-500">${escapeHtml(label)}</p>
        <p class="mt-2 text-2xl font-extrabold text-slate-900">${escapeHtml(value)}</p>
        ${detail ? `<p class="mt-1 text-sm text-slate-600">${escapeHtml(detail)}</p>` : ""}
      </div>
    </article>
  `;
}
