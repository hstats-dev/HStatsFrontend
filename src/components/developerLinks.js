import { escapeHtml } from "../utils/escapeHtml";
import { formatNumber } from "../utils/format";

function sanitizeExternalUrl(rawUrl) {
  if (!rawUrl) return "";
  const trimmed = String(rawUrl).trim();
  if (!trimmed) return "";

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function resolveDeveloperLinks(developerInfo) {
  const nestedAccount = developerInfo?.account && typeof developerInfo.account === "object"
    ? developerInfo.account
    : {};

  return {
    githubLink: sanitizeExternalUrl(nestedAccount.github_link || developerInfo?.github_link),
    curseforgeLink: sanitizeExternalUrl(nestedAccount.curseforge_link || developerInfo?.curseforge_link),
  };
}

function resolveModLinks(links) {
  const value = links && typeof links === "object" ? links : {};
  return {
    githubLink: sanitizeExternalUrl(value.github_link),
    curseforgeLink: sanitizeExternalUrl(value.curseforge_link),
    modtaleLink: sanitizeExternalUrl(value.modtale_link),
    modifoldLink: sanitizeExternalUrl(value.modifold_link),
  };
}

function resolveDeveloperIdentity(developerInfo) {
  const account = developerInfo?.account && typeof developerInfo.account === "object"
    ? developerInfo.account
    : {};
  return {
    id: String(account.id || developerInfo?.id || "").trim(),
    username: String(account.username || developerInfo?.username || "").trim() || "No Name",
  };
}

function githubIcon() {
  return `
    <svg viewBox="0 0 24 24" class="h-4 w-4" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 0C5.373 0 0 5.373 0 12c0 5.302 3.438 9.8 8.205 11.386.6.111.82-.261.82-.579 0-.286-.011-1.231-.017-2.232-3.338.725-4.043-1.416-4.043-1.416-.546-1.387-1.333-1.757-1.333-1.757-1.089-.745.083-.729.083-.729 1.205.085 1.84 1.237 1.84 1.237 1.07 1.833 2.809 1.303 3.495.997.108-.775.418-1.303.762-1.603-2.665-.303-5.467-1.333-5.467-5.932 0-1.311.469-2.382 1.236-3.221-.124-.303-.535-1.523.118-3.176 0 0 1.008-.322 3.301 1.23A11.5 11.5 0 0 1 12 5.8c1.02.005 2.047.138 3.007.405 2.291-1.552 3.297-1.23 3.297-1.23.655 1.653.244 2.873.12 3.176.77.839 1.235 1.91 1.235 3.221 0 4.611-2.807 5.625-5.479 5.922.43.371.814 1.103.814 2.222 0 1.604-.015 2.896-.015 3.289 0 .321.216.694.825.576C20.565 21.796 24 17.3 24 12c0-6.627-5.373-12-12-12Z"
      />
    </svg>
  `;
}

function curseforgeIcon() {
  return `
    <svg viewBox="0 0 24 24" class="h-4 w-4" aria-hidden="true" focusable="false">
      <path
        fill="#F16436"
        d="M18.326 9.2145S23.2261 8.4418 24 6.1882h-7.5066V4.4H0l2.0318 2.3576V9.173s5.1267-.2665 7.1098 1.2372c2.7146 2.516-3.053 5.917-3.053 5.917L5.0995 19.6c1.5465-1.4726 4.494-3.3775 9.8983-3.2857-2.0565.65-4.1245 1.6651-5.7344 3.2857h10.9248l-1.0288-3.2726s-7.918-4.6688-.8336-7.1127z"
      />
    </svg>
  `;
}

function marketplaceIcon(src) {
  return `<img src="${escapeHtml(src)}" alt="" class="h-5 w-5 object-contain" aria-hidden="true" />`;
}

function iconLink({ href, label, icon, accentClass, compact = false }) {
  if (!href) return "";

  return `
    <a
      href="${escapeHtml(href)}"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex ${compact ? "h-8 min-w-8 px-1.5" : "h-11 min-w-11 px-2"} items-center justify-center rounded-lg border border-sky-200 bg-white text-slate-700 transition ${accentClass}"
      title="${escapeHtml(`Open ${label}`)}"
      aria-label="${escapeHtml(`Open ${label}`)}"
    >
      ${icon}
    </a>
  `;
}

function marketplaceIconLink({ href, label, logoSrc, count, compact = false }) {
  if (!href) return "";
  const normalizedCount = Number(count);
  const countMarkup = Number.isFinite(normalizedCount) && normalizedCount >= 0
    ? `<span class="download-count-badge rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-brand-700">${escapeHtml(formatNumber(normalizedCount))}</span>`
    : "";
  return `
    <a
      href="${escapeHtml(href)}"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex ${compact ? "h-8 min-w-8 px-1.5" : "min-h-11 px-3 py-2"} items-center gap-2 rounded-lg border border-sky-200 bg-white text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50"
      aria-label="Open ${escapeHtml(label)}${countMarkup ? `, ${escapeHtml(formatNumber(normalizedCount))} downloads` : ""}"
      title="${escapeHtml(`Open ${label}`)}"
    >
      ${marketplaceIcon(logoSrc)}
      ${countMarkup}
    </a>
  `;
}

export function renderDeveloperIdentityLink(developerInfo, { plain = false } = {}) {
  const { id, username } = resolveDeveloperIdentity(developerInfo);
  if (!id) {
    return `<span class="text-sm font-semibold text-slate-700">${escapeHtml(username)}</span>`;
  }
  return `
    <a
      href="/developers/${encodeURIComponent(id)}"
      data-link
      class="${
        plain
          ? "text-sm font-semibold text-brand-700 transition hover:text-brand-800 hover:underline"
          : "inline-flex min-h-11 items-center rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-brand-700 transition hover:border-sky-300 hover:bg-sky-50"
      }"
    >
      ${escapeHtml(username)}
    </a>
  `;
}

export function renderModIconLinks(links, { compact = false, showEmpty = true } = {}) {
  const { githubLink, curseforgeLink, modtaleLink, modifoldLink } = resolveModLinks(links);
  const items = [
    iconLink({ href: githubLink, label: "GitHub", icon: githubIcon(), accentClass: "hover:border-slate-400 hover:bg-slate-50", compact }),
    iconLink({ href: curseforgeLink, label: "CurseForge", icon: curseforgeIcon(), accentClass: "hover:border-orange-300 hover:bg-orange-50", compact }),
    marketplaceIconLink({ href: modtaleLink, label: "Modtale", logoSrc: "/modtale-logo.png", compact }),
    marketplaceIconLink({ href: modifoldLink, label: "Modifold", logoSrc: "/modifold-logo.png", compact }),
  ].filter(Boolean);

  if (items.length === 0) {
    return showEmpty ? `<p class="mt-1 text-xs font-medium text-slate-500">No mod links listed</p>` : "";
  }
  return `<div class="${compact ? "flex-nowrap gap-1" : "mt-1 flex-wrap gap-2"} flex items-center">${items.join("")}</div>`;
}

export function renderModButtons(links, downloads = {}) {
  const { githubLink, curseforgeLink, modtaleLink, modifoldLink } = resolveModLinks(links);
  const items = [
    textLink({ href: githubLink, label: "GitHub", icon: githubIcon(), accentClass: "hover:border-slate-400 hover:bg-slate-50" }),
    textLink({ href: curseforgeLink, label: "CurseForge", icon: curseforgeIcon(), accentClass: "hover:border-orange-300 hover:bg-orange-50", count: downloads?.curseforge }),
    textLink({ href: modtaleLink, label: "Modtale", icon: marketplaceIcon("/modtale-logo.png"), accentClass: "hover:border-sky-300 hover:bg-sky-50", count: downloads?.modtale }),
    textLink({ href: modifoldLink, label: "Modifold", icon: marketplaceIcon("/modifold-logo.png"), accentClass: "hover:border-sky-300 hover:bg-sky-50", count: downloads?.modifold }),
  ].filter(Boolean);

  if (items.length === 0) {
    return `<p class="mt-2 text-sm text-slate-500">No mod links provided.</p>`;
  }
  return `<div class="mt-2 flex flex-wrap items-center gap-2">${items.join("")}</div>`;
}

function textLink({ href, label, icon, accentClass, count }) {
  if (!href) return "";
  const normalizedCount = Number(count);
  const hasCount = Number.isFinite(normalizedCount) && normalizedCount >= 0;
  const formattedCount = hasCount ? formatNumber(normalizedCount) : "";
  return `
    <a
      href="${escapeHtml(href)}"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-center gap-2 rounded-md border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition ${accentClass}"
      aria-label="Open ${escapeHtml(label)}${hasCount ? `, ${escapeHtml(formattedCount)} downloads` : ""}"
    >
      ${icon}
      <span>${escapeHtml(label)}</span>
      ${hasCount ? `<span class="download-count-badge rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-brand-700">${escapeHtml(formattedCount)}</span>` : ""}
    </a>
  `;
}

export function renderDeveloperIconLinks(developerInfo) {
  const { githubLink, curseforgeLink } = resolveDeveloperLinks(developerInfo);
  const github = iconLink({
    href: githubLink,
    label: "GitHub",
    icon: githubIcon(),
    accentClass: "hover:border-slate-400 hover:bg-slate-50",
  });
  const curseforge = iconLink({
    href: curseforgeLink,
    label: "CurseForge",
    icon: curseforgeIcon(),
    accentClass: "hover:border-orange-300 hover:bg-orange-50",
  });

  if (!github && !curseforge) {
    return `<p class="mt-1 text-xs font-medium text-slate-500">No links listed</p>`;
  }

  return `
    <div class="mt-1 flex items-center gap-2">
      ${github}
      ${curseforge}
    </div>
  `;
}

export function renderDeveloperButtons(developerInfo) {
  const { githubLink, curseforgeLink } = resolveDeveloperLinks(developerInfo);
  const githubButton = textLink({
    href: githubLink,
    label: "GitHub",
    icon: githubIcon(),
    accentClass: "hover:border-slate-400 hover:bg-slate-50",
  });
  const curseforgeButton = textLink({
    href: curseforgeLink,
    label: "CurseForge",
    icon: curseforgeIcon(),
    accentClass: "hover:border-orange-300 hover:bg-orange-50",
  });

  if (!githubButton && !curseforgeButton) {
    return `<p class="mt-2 text-sm text-slate-500">No developer links provided.</p>`;
  }

  return `
    <div class="mt-2 flex flex-wrap items-center gap-2">
      ${githubButton}
      ${curseforgeButton}
    </div>
  `;
}
