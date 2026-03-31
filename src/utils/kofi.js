const KOFI_OVERLAY_SCRIPT_SRC = "https://storage.ko-fi.com/cdn/scripts/overlay-widget.js";
const INLINE_KOFI_BUTTON_SRC = "https://storage.ko-fi.com/cdn/widget/Widget_2.js";
const KOFI_INLINE_ID = "U7U41WYL7F";
const KOFI_INLINE_TEXT = "Support me on Ko-fi";
const KOFI_INLINE_COLOR = "#72a4f2";

const scriptPromises = new Map();

function loadScriptOnce(src) {
  if (scriptPromises.has(src)) {
    return scriptPromises.get(src);
  }

  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
    document.head.appendChild(script);
  });

  scriptPromises.set(src, promise);
  return promise;
}

export async function mountKofiOverlay() {
  await loadScriptOnce(KOFI_OVERLAY_SCRIPT_SRC);

  if (typeof window.kofiWidgetOverlay?.draw !== "function") {
    throw new Error("Ko-fi overlay widget is unavailable.");
  }

  removeKofiOverlay();

  window.kofiWidgetOverlay.draw("al3xwarrior", {
    type: "floating-chat",
    "floating-chat.donateButton.text": "Donate",
    "floating-chat.donateButton.background-color": "#00b9fe",
    "floating-chat.donateButton.text-color": "#fff",
  });
}

export function removeKofiOverlay() {
  document.querySelectorAll(".floatingchat-container-wrap, .floatingchat-container-wrap-mobi").forEach((element) => {
    element.remove();
  });
}

function createInlineWidgetDocument() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: transparent;
        overflow: hidden;
      }

      body {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        min-height: 52px;
      }
    </style>
  </head>
  <body>
    <script src="${INLINE_KOFI_BUTTON_SRC}"><\/script>
    <script>
      kofiwidget2.init('${KOFI_INLINE_TEXT}', '${KOFI_INLINE_COLOR}', '${KOFI_INLINE_ID}');
      kofiwidget2.draw();
    <\/script>
  </body>
</html>`;
}

export function mountInlineKofiWidget(container) {
  if (!container) {
    return () => {};
  }

  container.innerHTML = "";
  const iframe = document.createElement("iframe");
  iframe.title = "Support HStats on Ko-fi";
  iframe.loading = "lazy";
  iframe.className = "h-[56px] w-[220px] max-w-full border-0 bg-transparent";
  iframe.setAttribute("scrolling", "no");
  iframe.setAttribute("allowtransparency", "true");
  iframe.setAttribute("sandbox", "allow-scripts allow-popups allow-popups-to-escape-sandbox");
  iframe.style.backgroundColor = "transparent";
  iframe.style.colorScheme = "auto";
  iframe.srcdoc = createInlineWidgetDocument();
  container.appendChild(iframe);

  return () => {
    iframe.remove();
  };
}
