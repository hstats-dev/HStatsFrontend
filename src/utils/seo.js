const SITE_NAME = "HStats";
const DEFAULT_TITLE = "HStats | Real-time Hytale Mod Analytics";
const DEFAULT_DESCRIPTION = "HStats helps Hytale mod developers track live usage across servers with privacy and developer-focused analytics.";
const DEFAULT_IMAGE_PATH = "/big_logo.png";

function resolveSiteBaseUrl() {
  const configured = String(import.meta.env.VITE_SITE_URL || "").trim();
  if (configured) {
    try {
      const url = new URL(configured);
      return url.toString().replace(/\/$/, "");
    } catch {
      // Ignore invalid configured site URL and fall back to current origin.
    }
  }

  return window.location.origin;
}

function toAbsoluteUrl(input, siteBaseUrl) {
  try {
    return new URL(String(input || "/"), `${siteBaseUrl}/`).toString();
  } catch {
    return `${siteBaseUrl}/`;
  }
}

function ensureMetaByName(name) {
  let meta = document.head.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", name);
    document.head.appendChild(meta);
  }
  return meta;
}

function ensureMetaByProperty(property) {
  let meta = document.head.querySelector(`meta[property="${property}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("property", property);
    document.head.appendChild(meta);
  }
  return meta;
}

function setMetaName(name, value) {
  ensureMetaByName(name).setAttribute("content", String(value || ""));
}

function setMetaProperty(property, value) {
  ensureMetaByProperty(property).setAttribute("content", String(value || ""));
}

function setCanonical(href) {
  let canonical = document.head.querySelector("link[rel='canonical']");
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }
  canonical.setAttribute("href", href);
}

function buildDocumentTitle(title) {
  const trimmed = String(title || "").trim();
  if (!trimmed) return `${SITE_NAME} | ${DEFAULT_TITLE}`;
  if (trimmed.toLowerCase().includes(SITE_NAME.toLowerCase())) return trimmed;
  return `${SITE_NAME} | ${trimmed}`;
}

export function setPageSeo({
  title,
  description,
  path,
  image,
  type = "website",
  noIndex = false,
} = {}) {
  const siteBaseUrl = resolveSiteBaseUrl();
  const canonicalUrl = toAbsoluteUrl(path || `${window.location.pathname}${window.location.search}`, siteBaseUrl);
  const imageUrl = toAbsoluteUrl(image || DEFAULT_IMAGE_PATH, siteBaseUrl);
  const resolvedTitle = buildDocumentTitle(title || DEFAULT_TITLE);
  const resolvedDescription = String(description || DEFAULT_DESCRIPTION).trim() || DEFAULT_DESCRIPTION;

  document.title = resolvedTitle;

  setMetaName("description", resolvedDescription);
  setMetaName("robots", noIndex ? "noindex, nofollow" : "index, follow");

  setMetaProperty("og:site_name", SITE_NAME);
  setMetaProperty("og:type", type);
  setMetaProperty("og:title", resolvedTitle);
  setMetaProperty("og:description", resolvedDescription);
  setMetaProperty("og:url", canonicalUrl);
  setMetaProperty("og:image", imageUrl);
  setMetaProperty("og:image:alt", "HStats preview image");

  setMetaName("twitter:card", "summary_large_image");
  setMetaName("twitter:title", resolvedTitle);
  setMetaName("twitter:description", resolvedDescription);
  setMetaName("twitter:image", imageUrl);

  setCanonical(canonicalUrl);
}
