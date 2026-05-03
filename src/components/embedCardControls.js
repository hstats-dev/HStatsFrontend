import { API_ROOT } from "../config";
import { escapeHtml } from "../utils/escapeHtml";

export const DEFAULT_EMBED_OPTIONS = {
  theme: "light",
  layout: "compact",
  size: "md",
  dark: false,
  font: "arial",
  background: "solid",
  radius: 14,
  borderWidth: 2,
  bg: "",
  backgroundColor: "",
  text: "",
  muted: "",
  border: "",
  divider: "",
  panel: "",
  panelBorder: "",
  chartBg: "",
  chartGrid: "",
  chartAxis: "",
  serversColor: "",
  playersColor: "",
};

const THEME_OPTIONS = [
  ["light", "Light"],
  ["dark", "Dark"],
  ["github", "GitHub"],
  ["terminal", "Terminal"],
  ["forest", "Forest"],
  ["ember", "Ember"],
];

const LAYOUT_OPTIONS = [
  ["compact", "Compact"],
  ["stacked", "Stacked"],
  ["history", "History"],
];

const SIZE_OPTIONS = [
  ["sm", "Small"],
  ["md", "Medium"],
  ["lg", "Large"],
];

const FONT_OPTIONS = [
  ["arial", "Arial"],
  ["system", "System"],
  ["verdana", "Verdana"],
  ["georgia", "Georgia"],
  ["mono", "Mono"],
];

const BACKGROUND_OPTIONS = [
  ["solid", "Solid"],
  ["transparent", "Transparent"],
];

const COLOR_OPTIONS = [
  ["bg", "Card Background", "#111827 or transparent"],
  ["backgroundColor", "Background Alias", "#111827 or transparent"],
  ["text", "Text", "#f9fafb"],
  ["muted", "Muted Text", "#94a3b8"],
  ["border", "Outer Border", "#374151"],
  ["divider", "Divider", "#e2e8f0"],
  ["panel", "Panel Background", "#1f2937 or transparent"],
  ["panelBorder", "Panel Border", "#374151"],
  ["chartBg", "Chart Background", "#111827 or transparent"],
  ["chartGrid", "Chart Grid", "#334155"],
  ["chartAxis", "Chart Axis", "#64748b"],
  ["serversColor", "Servers Color", "#f97316"],
  ["playersColor", "Players Color", "#22c55e"],
];

const COMMON_COLOR_OPTIONS = new Set([
  "bg",
  "backgroundColor",
  "text",
  "muted",
  "border",
  "serversColor",
  "playersColor",
]);
const LAYOUT_COLOR_OPTIONS = {
  compact: new Set(["divider"]),
  stacked: new Set(["panel", "panelBorder"]),
  history: new Set(["panelBorder", "chartBg", "chartGrid", "chartAxis"]),
};

function optionValue(options, key) {
  return options?.[key] ?? DEFAULT_EMBED_OPTIONS[key];
}

function optionIsSelected(options, key, value) {
  return optionValue(options, key) === value ? " selected" : "";
}

function checked(value) {
  return value ? " checked" : "";
}

function clampInteger(value, min, max, fallback) {
  const numberValue = Number.parseInt(value, 10);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, numberValue));
}

function normalizeChoice(value, allowedValues, fallback) {
  return allowedValues.includes(value) ? value : fallback;
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
  }
  return Boolean(value);
}

function normalizeHexColor(value) {
  const rawValue = String(value || "").trim();
  const match = rawValue.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) return "";

  const hex = match[1];
  if (hex.length === 3) {
    return `#${hex
      .split("")
      .map((character) => character + character)
      .join("")
      .toLowerCase()}`;
  }

  return `#${hex.toLowerCase()}`;
}

function isColorOptionVisibleForLayout(key, layout) {
  return COMMON_COLOR_OPTIONS.has(key) || Boolean(LAYOUT_COLOR_OPTIONS[layout]?.has(key));
}

export function normalizeEmbedOptions(options = {}) {
  const normalized = {
    theme: normalizeChoice(String(options.theme || ""), THEME_OPTIONS.map(([value]) => value), DEFAULT_EMBED_OPTIONS.theme),
    layout: normalizeChoice(String(options.layout || ""), LAYOUT_OPTIONS.map(([value]) => value), DEFAULT_EMBED_OPTIONS.layout),
    size: normalizeChoice(String(options.size || ""), SIZE_OPTIONS.map(([value]) => value), DEFAULT_EMBED_OPTIONS.size),
    dark: normalizeBoolean(options.dark),
    font: normalizeChoice(String(options.font || ""), FONT_OPTIONS.map(([value]) => value), DEFAULT_EMBED_OPTIONS.font),
    background: normalizeChoice(
      String(options.background || ""),
      BACKGROUND_OPTIONS.map(([value]) => value),
      DEFAULT_EMBED_OPTIONS.background,
    ),
    radius: clampInteger(options.radius, 0, 24, DEFAULT_EMBED_OPTIONS.radius),
    borderWidth: clampInteger(options.borderWidth, 0, 4, DEFAULT_EMBED_OPTIONS.borderWidth),
  };

  COLOR_OPTIONS.forEach(([key]) => {
    normalized[key] = String(options[key] || "").trim();
  });

  return normalized;
}

export function buildEmbedCardUrl(kind, uuid, options = DEFAULT_EMBED_OPTIONS, { cacheBust = false } = {}) {
  const safeUuid = encodeURIComponent(uuid || "");
  const normalized = normalizeEmbedOptions(options);
  const params = new URLSearchParams();

  params.set("theme", normalized.theme);
  params.set("layout", normalized.layout);
  params.set("size", normalized.size);
  params.set("dark", String(normalized.dark));

  ["font", "background", "radius", "borderWidth"].forEach((key) => {
    if (normalized[key] !== DEFAULT_EMBED_OPTIONS[key]) {
      params.set(key, String(normalized[key]));
    }
  });

  COLOR_OPTIONS.forEach(([key]) => {
    if (normalized[key] && isColorOptionVisibleForLayout(key, normalized.layout)) {
      params.set(key, normalized[key]);
    }
  });

  if (cacheBust) {
    params.set("t", String(Date.now()));
  }

  const route = kind === "developer" ? `/embed/developer/${safeUuid}/card.svg` : `/embed/${safeUuid}/card.svg`;
  return `${API_ROOT}${route}?${params.toString()}`;
}

function renderOptions(options, values, key) {
  return values
    .map(([value, label]) => `<option value="${escapeHtml(value)}"${optionIsSelected(options, key, value)}>${escapeHtml(label)}</option>`)
    .join("");
}

function renderColorInputs(options, idPrefix) {
  const layout = normalizeEmbedOptions(options).layout;
  return COLOR_OPTIONS.map(([key, label, placeholder]) => {
    const id = `${idPrefix}-${key}`;
    const pickerId = `${id}-picker`;
    const pickerValue = normalizeHexColor(optionValue(options, key)) || "#000000";
    const visibilityClass = isColorOptionVisibleForLayout(key, layout) ? "" : " hidden";
    return `
      <label class="grid gap-1 text-xs font-semibold text-slate-600${visibilityClass}" data-embed-color-control="${escapeHtml(key)}">
        ${escapeHtml(label)}
        <span class="grid grid-cols-[44px_minmax(0,1fr)] gap-2">
          <input
            id="${escapeHtml(pickerId)}"
            data-embed-color-picker="${escapeHtml(key)}"
            type="color"
            class="h-10 w-11 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
            value="${escapeHtml(pickerValue)}"
            title="${escapeHtml(label)} picker"
            aria-label="${escapeHtml(label)} picker"
          />
          <input
            id="${escapeHtml(id)}"
            data-embed-color-option="${escapeHtml(key)}"
            type="text"
            spellcheck="false"
            class="input-base py-2 font-mono text-xs"
            placeholder="${escapeHtml(placeholder)}"
            value="${escapeHtml(optionValue(options, key))}"
          />
        </span>
      </label>
    `;
  }).join("");
}

export function renderEmbedCardControls({
  idPrefix,
  kind = "plugin",
  uuid,
  displayName = "embed card",
  eyebrow = "Embed Card",
  title = "Embed Card",
  description = "Configure and preview a shareable SVG card.",
  options = DEFAULT_EMBED_OPTIONS,
} = {}) {
  const normalized = normalizeEmbedOptions(options);
  const initialUrl = buildEmbedCardUrl(kind, uuid, normalized);
  const initialPreviewUrl = buildEmbedCardUrl(kind, uuid, normalized, { cacheBust: true });

  return `
    <section class="surface overflow-hidden" data-embed-card-controls="${escapeHtml(idPrefix)}">
      <div class="surface-body space-y-5">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">${escapeHtml(eyebrow)}</p>
          <h2 class="mt-1 text-lg font-bold text-slate-900">${escapeHtml(title)}</h2>
          <p class="muted mt-1 max-w-2xl">${escapeHtml(description)}</p>
        </div>

        <div class="grid gap-4">
          <div class="rounded-xl border border-sky-100 bg-slate-50 p-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p>
              <p class="text-[11px] text-slate-500">Preview is scaled to fit this panel. The final URL preserves the selected size.</p>
            </div>
            <div class="mt-3 overflow-hidden rounded-xl border border-sky-100 bg-white p-4">
              <img
                id="${escapeHtml(idPrefix)}-preview"
                src="${escapeHtml(initialPreviewUrl)}"
                alt="Embed preview for ${escapeHtml(displayName)}"
                loading="lazy"
                class="mx-auto h-auto w-full max-w-[920px] rounded"
              />
            </div>
          </div>

          <div class="space-y-4 rounded-xl border border-sky-100 bg-slate-50 p-4">
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label class="grid gap-1 text-xs font-semibold text-slate-600">
                Theme
                <select id="${escapeHtml(idPrefix)}-theme" class="input-base py-2">
                  ${renderOptions(normalized, THEME_OPTIONS, "theme")}
                </select>
              </label>
              <label class="grid gap-1 text-xs font-semibold text-slate-600">
                Layout
                <select id="${escapeHtml(idPrefix)}-layout" class="input-base py-2">
                  ${renderOptions(normalized, LAYOUT_OPTIONS, "layout")}
                </select>
              </label>
              <label class="grid gap-1 text-xs font-semibold text-slate-600">
                Size
                <select id="${escapeHtml(idPrefix)}-size" class="input-base py-2">
                  ${renderOptions(normalized, SIZE_OPTIONS, "size")}
                </select>
              </label>
              <label class="grid gap-1 text-xs font-semibold text-slate-600">
                Font
                <select id="${escapeHtml(idPrefix)}-font" class="input-base py-2">
                  ${renderOptions(normalized, FONT_OPTIONS, "font")}
                </select>
              </label>
              <label class="grid gap-1 text-xs font-semibold text-slate-600">
                Background
                <select id="${escapeHtml(idPrefix)}-background" class="input-base py-2">
                  ${renderOptions(normalized, BACKGROUND_OPTIONS, "background")}
                </select>
              </label>
              <label class="grid gap-1 text-xs font-semibold text-slate-600">
                Radius
                <input id="${escapeHtml(idPrefix)}-radius" type="number" min="0" max="24" step="1" class="input-base py-2" value="${escapeHtml(String(normalized.radius))}" />
              </label>
              <label class="grid gap-1 text-xs font-semibold text-slate-600">
                Border Width
                <input id="${escapeHtml(idPrefix)}-borderWidth" type="number" min="0" max="4" step="1" class="input-base py-2" value="${escapeHtml(String(normalized.borderWidth))}" />
              </label>
              <label class="inline-flex items-center gap-2 rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                <input id="${escapeHtml(idPrefix)}-dark" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"${checked(normalized.dark)} />
                Force dark (alias)
              </label>
            </div>

            <details class="rounded-lg border border-sky-100 bg-white p-3" open>
              <summary class="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">Color Overrides</summary>
              <p class="mt-2 text-[11px] text-slate-500">Use 3 or 6 digit hex values with or without #. Transparent is supported for card, panel, and chart backgrounds.</p>
              <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                ${renderColorInputs(normalized, idPrefix)}
              </div>
            </details>

            <div class="space-y-2">
              <label for="${escapeHtml(idPrefix)}-url" class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Embed URL</label>
              <input id="${escapeHtml(idPrefix)}-url" type="text" readonly class="input-base w-full py-1.5 font-mono text-[10px]" value="${escapeHtml(initialUrl)}" />
              <div class="flex flex-wrap items-center gap-2">
                <button id="${escapeHtml(idPrefix)}-copy" type="button" class="btn-secondary px-3 py-1.5 text-xs whitespace-nowrap">Copy URL</button>
                <p id="${escapeHtml(idPrefix)}-copy-status" class="text-[11px] text-slate-500"></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

export function bindEmbedCardControls(root, {
  idPrefix,
  kind = "plugin",
  uuid,
  state = null,
  copyMessage = "Embed URL copied.",
} = {}) {
  const elements = {
    theme: root.querySelector(`#${idPrefix}-theme`),
    layout: root.querySelector(`#${idPrefix}-layout`),
    size: root.querySelector(`#${idPrefix}-size`),
    font: root.querySelector(`#${idPrefix}-font`),
    background: root.querySelector(`#${idPrefix}-background`),
    radius: root.querySelector(`#${idPrefix}-radius`),
    borderWidth: root.querySelector(`#${idPrefix}-borderWidth`),
    dark: root.querySelector(`#${idPrefix}-dark`),
    preview: root.querySelector(`#${idPrefix}-preview`),
    url: root.querySelector(`#${idPrefix}-url`),
    copy: root.querySelector(`#${idPrefix}-copy`),
    status: root.querySelector(`#${idPrefix}-copy-status`),
  };
  const colorInputs = Array.from(root.querySelectorAll(`[data-embed-card-controls="${idPrefix}"] [data-embed-color-option]`));
  const colorPickers = Array.from(root.querySelectorAll(`[data-embed-card-controls="${idPrefix}"] [data-embed-color-picker]`));
  const colorControls = Array.from(root.querySelectorAll(`[data-embed-card-controls="${idPrefix}"] [data-embed-color-control]`));
  const cleanup = [];
  let copyStatusTimeout = null;
  let previewRefreshTimeout = null;

  if (!elements.preview || !elements.url) {
    return () => {};
  }

  const readOptions = () => {
    const options = {
      theme: elements.theme?.value,
      layout: elements.layout?.value,
      size: elements.size?.value,
      dark: Boolean(elements.dark?.checked),
      font: elements.font?.value,
      background: elements.background?.value,
      radius: elements.radius?.value,
      borderWidth: elements.borderWidth?.value,
    };

    colorInputs.forEach((input) => {
      options[input.getAttribute("data-embed-color-option")] = input.value.trim();
    });

    return normalizeEmbedOptions(options);
  };

  const refresh = ({ updatePreview = true } = {}) => {
    const options = readOptions();
    if (state && typeof state === "object") {
      Object.assign(state, options);
    }
    elements.url.value = buildEmbedCardUrl(kind, uuid, options);
    if (updatePreview) {
      elements.preview.src = buildEmbedCardUrl(kind, uuid, options, { cacheBust: true });
    }
    if (elements.status) {
      elements.status.textContent = "";
    }
  };

  const bind = (element, eventName, handler) => {
    if (!element) return;
    element.addEventListener(eventName, handler);
    cleanup.push(() => element.removeEventListener(eventName, handler));
  };

  const updateColorControlVisibility = () => {
    const layout = elements.layout?.value || DEFAULT_EMBED_OPTIONS.layout;
    colorControls.forEach((control) => {
      const key = control.getAttribute("data-embed-color-control");
      control.classList.toggle("hidden", !isColorOptionVisibleForLayout(key, layout));
    });
  };

  const refreshSoon = () => {
    if (previewRefreshTimeout) {
      window.clearTimeout(previewRefreshTimeout);
    }
    refresh({ updatePreview: false });
    previewRefreshTimeout = window.setTimeout(() => {
      refresh({ updatePreview: true });
      previewRefreshTimeout = null;
    }, 250);
  };

  [
    elements.theme,
    elements.layout,
    elements.size,
    elements.font,
    elements.background,
    elements.radius,
    elements.borderWidth,
    elements.dark,
  ].forEach((element) => bind(element, "change", () => {
    updateColorControlVisibility();
    refresh({ updatePreview: true });
  }));
  colorInputs.forEach((input) => bind(input, "input", refreshSoon));
  colorInputs.forEach((input) => bind(input, "input", () => {
    const key = input.getAttribute("data-embed-color-option");
    const picker = colorPickers.find((candidate) => candidate.getAttribute("data-embed-color-picker") === key);
    const normalizedHex = normalizeHexColor(input.value);
    if (picker && normalizedHex) {
      picker.value = normalizedHex;
    }
  }));
  colorPickers.forEach((picker) => bind(picker, "input", () => {
    const key = picker.getAttribute("data-embed-color-picker");
    const input = colorInputs.find((candidate) => candidate.getAttribute("data-embed-color-option") === key);
    if (input) {
      input.value = picker.value;
    }
    refresh({ updatePreview: false });
    refreshSoon();
  }));

  bind(elements.copy, "click", async () => {
    if (!elements.status) return;
    try {
      await navigator.clipboard.writeText(elements.url.value);
      elements.status.textContent = copyMessage;
    } catch {
      elements.status.textContent = "Copy failed. You can copy the URL field manually.";
    }

    if (copyStatusTimeout) {
      window.clearTimeout(copyStatusTimeout);
    }
    copyStatusTimeout = window.setTimeout(() => {
      elements.status.textContent = "";
    }, 2600);
  });

  updateColorControlVisibility();
  refresh({ updatePreview: false });

  return () => {
    cleanup.forEach((dispose) => dispose());
    if (copyStatusTimeout) {
      window.clearTimeout(copyStatusTimeout);
    }
    if (previewRefreshTimeout) {
      window.clearTimeout(previewRefreshTimeout);
    }
  };
}
