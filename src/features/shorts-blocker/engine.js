/**
 * YouTube Shorts Blocker Engine
 * Menyembunyikan shelf/video Shorts di feed + redirect halaman /shorts/ ke /watch
 * agar tetap bisa fokus. Idempotent & SPA-aware (YouTube pakai navigasi client-side).
 */
export function applyShortsBlock() {
  if (window.__DEVKITA_SHORTS_ENGINE) return;
  window.__DEVKITA_SHORTS_ENGINE = true;

  const STYLE_ID = "devkita-shorts-block";
  const SELECTORS = [
    // Shelf / rak Shorts di homepage, search, channel
    "ytd-rich-shelf-renderer[is-shorts]",
    "ytd-reel-shelf-renderer",
    "ytd-shorts",
    "ytm-shorts-lockup-view-model",
    "[href*='/shorts/']",
    "a[title='Shorts']",
    "ytd-guide-entry-renderer a[href='/shorts']",
    "ytd-mini-guide-entry-renderer a[href='/shorts']",
    // Tab Shorts di channel page
    "yt-tab-shape[tab-title='Shorts']",
  ];

  const injectCSS = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      ytd-rich-shelf-renderer[is-shorts],
      ytd-rich-shelf-renderer:has(a[href*="/shorts/"]),
      ytd-rich-section-renderer:has(a[href*="/shorts/"]),
      ytd-reel-shelf-renderer,
      ytd-shorts, grid-shelf-view-model,
      ytm-shorts-lockup-view-model { display: none !important; }
    `;
    (document.head || document.documentElement).appendChild(style);
  };

  const hideSingle = (el) => {
    if (!(el instanceof HTMLElement) || el.dataset.devkitaShortsHidden) return;
    // Jangan sembunyikan seluruh sidebar/nav — naik 1 level saja untuk item menu
    if (el.tagName === "A" && el.closest("ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer")) {
      const entry = el.closest("ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer");
      entry.style.display = "none";
      entry.dataset.devkitaShortsHidden = "1";
    } else if (el.matches("a[href*='/shorts/']")) {
      // Thumbnail video Shorts: sembunyikan card terdekat, bukan seluruh halaman
      const card = el.closest(
        "ytd-rich-item-renderer, ytd-rich-section-renderer, ytd-rich-shelf-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytm-video-card-renderer, ytd-reel-item-renderer"
      );
      const target = card || el;
      target.style.display = "none";
      target.dataset.devkitaShortsHidden = "1";
    } else {
      // Shelf/section: pastikan ini memang rak Shorts (mengandung link /shorts/)
      if (el.matches("ytd-rich-section-renderer, ytd-rich-shelf-renderer") && !el.querySelector("a[href*='/shorts/']")) return;
      el.style.display = "none";
      el.dataset.devkitaShortsHidden = "1";
    }
  };

  const hideNodes = (root = document) => {
    if (root instanceof HTMLElement && root.dataset.devkitaShortsHidden) return;
    // Cek root itu sendiri (addedNodes bisa berupa elemen yang cocok langsung)
    if (root instanceof HTMLElement) {
      for (const sel of SELECTORS) {
        try { if (root.matches(sel)) hideSingle(root); } catch { /* abaikan */ }
      }
    }
    const scope = root.querySelectorAll ? root : document;
    for (const sel of SELECTORS) {
      try {
        scope.querySelectorAll(sel).forEach(hideSingle);
      } catch { /* selector tidak valid di halaman ini */ }
    }
  };

  // Redirect /shorts/<id> -> /watch?v=<id> agar tidak terjebak infinite scroll Shorts
  const redirectIfShortsPage = () => {
    const m = location.pathname.match(/^\/shorts\/([^/?#]+)/);
    if (m && m[1]) {
      location.replace(`https://www.youtube.com/watch?v=${m[1]}`);
      return true;
    }
    return false;
  };

  if (redirectIfShortsPage()) return;

  injectCSS();
  hideNodes();

  const observer = new MutationObserver(() => {
    hideNodes(document);
    // Tangkap navigasi SPA YouTube (history.pushState tanpa reload)
    redirectIfShortsPage();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  // YouTube SPA juga fire event 'yt-navigate-finish'
  document.addEventListener("yt-navigate-finish", () => {
    if (!redirectIfShortsPage()) hideNodes();
  });

  window.__DEVKITA_SHORTS_CLEANUP__ = () => {
    observer.disconnect();
    document.getElementById(STYLE_ID)?.remove();
    delete window.__DEVKITA_SHORTS_ENGINE__;
    delete window.__DEVKITA_SHORTS_CLEANUP__;
  };
}

export function removeShortsBlock() {
  if (typeof window.__DEVKITA_SHORTS_CLEANUP__ === "function") {
    window.__DEVKITA_SHORTS_CLEANUP__();
  }
  document.getElementById("devkita-shorts-block")?.remove();
  // Kembalikan elemen yang di-hide via inline style (reload ringan tidak diperlukan)
  document
    .querySelectorAll('[style*="display: none"]')
    .forEach((el) => { if (el.id !== "devkita-pomo-container") el.style.display = ""; });
}
