import { formatNumber } from "../utils/format";
import { escapeHtml } from "../utils/escapeHtml";
import { renderDeveloperIconLinks } from "./developerLinks";

export function modCard({ uuid, name, developerInfo, links, totalServers, totalPlayers, isUnlisted = false }) {
  return `
    <article class="surface transition hover:-translate-y-0.5 hover:border-sky-200">
      <div class="p-4 space-y-3">
        <div class="flex items-start justify-between gap-2">
          <h3 class="line-clamp-2 min-w-0 text-base font-bold leading-tight text-slate-900">${escapeHtml(name)}</h3>
          ${
            isUnlisted
              ? `<span class="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">Unlisted</span>`
              : ""
          }
        </div>
        <div class="flex items-end justify-between gap-3">
          <div>
            <p class="text-[11px] uppercase tracking-wide text-slate-500">Developer</p>
            ${renderDeveloperIconLinks({ ...developerInfo, links })}
          </div>
          <div class="grid grid-cols-2 gap-3 text-right">
            <div>
              <p class="text-[11px] uppercase tracking-wide text-slate-500">Servers</p>
              <p class="text-2xl font-extrabold leading-none text-slate-900">${formatNumber(totalServers)}</p>
            </div>
            <div>
              <p class="text-[11px] uppercase tracking-wide text-slate-500">Players</p>
              <p class="text-2xl font-extrabold leading-none text-slate-900">${formatNumber(totalPlayers)}</p>
            </div>
          </div>
        </div>
        <a
          href="/mods/${encodeURIComponent(uuid)}"
          data-link
          class="inline-flex items-center rounded-md border border-sky-200 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-sky-50"
        >
          View detailed stats
        </a>
      </div>
    </article>
  `;
}
