/**
 * X Trending Blocker Engine
 * Menyembunyikan panel trending di X.com (sidebar "What's happening",
 * kartu berita "N posts", tab Explore/Trending, sel "Trending in ...")
 * agar tidak terpapar konten viral/NSFW. Idempotent & SPA-aware
 * (X adalah React SPA dengan class acak, jadi deteksi berbasis
 *  data-testid/ARIA/teks, bukan class).
 */
export function applyXTrendingBlock() {
  if (window.__DEVKITA_XTREND_ENGINE) return;
  window.__DEVKITA_XTREND_ENGINE = true;

  const STYLE_ID = "devkita-x-trending-block";
  const MARK = "devkitaXHidden";
  const ATTR = "data-devkita-x-hidden";

  // Lapisan 1 (instan): pola URL + testid yang stabil, tak bergantung class acak
  const STABLE_CSS = `
    a[href="/explore"],
    a[href*="/explore/tabs/"],
    div[data-testid="trend"] { display: none !important; }
  `;

  // Kata yang menandai sebuah sel sebagai trending (case-insensitive, includes)
  const CELL_KEYWORDS = [
    "trending in",
    "sedang tren di",
    "politics \u00B7 trending",
    "politik \u00B7 sedang tren",
  ];

  // Heading panel sidebar (cocok persis setelah trim + lowercase)
  const PANEL_HEADINGS = [
    "what's happening",
    "whats happening",
    "sedang berlangsung",
    "apa yang sedang terjadi",
    "trending now",
  ];

  // Pola "51.8K posts" / "1,301 posts" pada kartu berita trending
  const POSTS_PATTERN = /\b\d[\d.,]*\s*[kmb]?\s+posts?\b/i;

  // Jangan pernah menyentuh timeline utama / composer
  const isProtected = (el) => {
    if (!(el instanceof HTMLElement)) return true;
    const tag = el.tagName;
    if (tag === "MAIN" || tag === "BODY" || tag === "HTML") return true;
    if (el.matches('div[data-testid="primaryColumn"]')) return true;
    if (el.closest('div[data-testid="primaryColumn"]')) return true;
    return false;
  };

  const injectCSS = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = STABLE_CSS;
    (document.head || document.documentElement).appendChild(style);
  };

  const markHide = (el) => {
    if (!(el instanceof HTMLElement) || el.dataset[MARK] || isProtected(el)) return false;
    el.style.display = "none";
    el.dataset[MARK] = "1";
    return true;
  };

  // Naik dari elemen awal sampai stopFn cocok; batal jika menabrak area proteksi
  const climb = (startEl, maxDepth, stopFn) => {
    let cur = startEl;
    for (let i = 0; i < maxDepth && cur && cur.tagName !== "BODY"; i++) {
      if (stopFn(cur)) return cur;
      if (cur.tagName === "MAIN" || cur.matches?.('div[data-testid="primaryColumn"]')) return null;
      cur = cur.parentElement;
    }
    return null;
  };

  const isPanelContainer = (el) =>
    el.tagName === "ASIDE" ||
    el.tagName === "SECTION" ||
    el.getAttribute?.("role") === "region" ||
    (el.tagName === "DIV" &&
      (el.querySelector('a[href*="/explore/"]') ||
        el.querySelectorAll('a[href*="/status/"]').length >= 2));

  const hidePanelFromHeading = (headingEl) => {
    const panel = climb(headingEl, 10, isPanelContainer);
    if (panel) markHide(panel);
  };

  const isCellContainer = (el) =>
    el.matches?.(
      'div[data-testid="cellInnerDiv"], div[data-testid="trend"], a[href*="/status/"], a[href*="/search"]'
    ) ||
    ((el.getAttribute?.("role") === "button" || el.getAttribute?.("role") === "link") &&
      el.tagName !== "ARTICLE");

  // Sel trending: sembunyikan container sel, tapi jangan pernah menyentuh <article> (tweet asli)
  const hideCell = (el) => {
    if (el.closest?.("article")) {
      // Keyword muncul di dalam tweet biasa — hanya sembunyikan jika itu sel trend eksplisit
      const trend = el.closest('div[data-testid="trend"], div[data-testid="cellInnerDiv"]');
      if (trend) markHide(trend);
      return;
    }
    const cell = climb(el, 8, isCellContainer);
    if (cell) markHide(cell);
    else markHide(el);
  };

  // Kartu berita ("... · 1,301 posts"): hanya sembunyikan jika container me-link ke search/explore
  const hideNewsCard = (el) => {
    const cell = climb(el, 8, isCellContainer);
    if (!cell) return;
    if (cell.querySelector('a[href*="/search"], a[href*="/explore"]') || cell.matches('a[href*="/search"]')) {
      markHide(cell);
    }
  };

  const scanTextNodes = (root) => {
    let walker;
    try {
      walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    } catch {
      return;
    }
    const panels = [];
    const cells = [];
    const news = [];
    let node;
    while ((node = walker.nextNode())) {
      const raw = node.nodeValue ? node.nodeValue.trim() : "";
      if (!raw || raw.length > 100) continue;
      const text = raw.toLowerCase();
      if (PANEL_HEADINGS.includes(text)) {
        if (node.parentElement) panels.push(node.parentElement);
      } else if (CELL_KEYWORDS.some((k) => text.includes(k))) {
        if (node.parentElement) cells.push(node.parentElement);
      } else if (POSTS_PATTERN.test(raw)) {
        if (node.parentElement) news.push(node.parentElement);
      }
    }
    for (const el of panels) hidePanelFromHeading(el);
    for (const el of cells) hideCell(el);
    for (const el of news) hideNewsCard(el);
  };

  const hideStableCells = (root) => {
    const scope = root.querySelectorAll ? root : document;
    try {
      // Sel trend eksplisit: runtuhkan container selnya agar tak tersisa gap kosong
      scope.querySelectorAll('div[data-testid="trend"]').forEach((trend) => {
        const cell = trend.closest('div[data-testid="cellInnerDiv"]');
        markHide(cell || trend);
      });
    } catch { /* abaikan */ }
    try {
      // Link nav "Explore" di sidebar kiri: sembunyikan 1 level pembungkusnya saja
      scope.querySelectorAll('a[href="/explore"]').forEach((a) => {
        const wrap = a.parentElement;
        if (wrap && wrap.tagName === "DIV" && !wrap.querySelector("nav")) markHide(wrap);
      });
    } catch { /* abaikan */ }
  };

  const sweep = () => {
    if (!document.body) return;
    hideStableCells(document);
    scanTextNodes(document.body);
  };

  injectCSS();
  if (document.body) sweep();
  else document.addEventListener("DOMContentLoaded", sweep, { once: true });

  // Sapuan tertunda untuk render React yang datang terlambat
  const timers = [500, 1500, 3000, 6000].map((ms) => setTimeout(sweep, ms));

  // Observer di-throttle agar tidak membebani tab X yang sangat reaktif
  let scheduled = false;
  const scheduleSweep = () => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      sweep();
    }, 400);
  };
  const observer = new MutationObserver(scheduleSweep);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Jaring pengaman terakhir: X me-render konten async kapan saja
  const interval = setInterval(sweep, 3000);

  window.__DEVKITA_XTREND_CLEANUP__ = () => {
    observer.disconnect();
    clearInterval(interval);
    timers.forEach(clearTimeout);
    document.getElementById(STYLE_ID)?.remove();
    document.querySelectorAll(`[${ATTR}]`).forEach((el) => {
      el.style.display = "";
      delete el.dataset[MARK];
    });
    delete window.__DEVKITA_XTREND_ENGINE__;
    delete window.__DEVKITA_XTREND_CLEANUP__;
  };
}

export function removeXTrendingBlock() {
  if (typeof window.__DEVKITA_XTREND_CLEANUP__ === "function") {
    window.__DEVKITA_XTREND_CLEANUP__();
  }
  document.getElementById("devkita-x-trending-block")?.remove();
}
