import { applyXTrendingBlock, removeXTrendingBlock } from "./engine.js";

// Default ON: user yang belum pernah setting tetap terlindungi
let state = { enabled: true };

export function initXTrendingBlocker() {
  chrome.storage.sync.get(["xTrendingBlockEnabled"], (data) => {
    state.enabled = data.xTrendingBlockEnabled ?? true;
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "sync" && changes.xTrendingBlockEnabled) {
      state.enabled = changes.xTrendingBlockEnabled.newValue ?? true;
      applyToXTabs();
    }
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const url = changeInfo.url || tab.url;
    if (!url || !isXUrl(url)) return;
    // Injeksi di loading (awal) dan complete (setelah SPA render) agar tidak kelewatan
    if (changeInfo.status === "loading" || changeInfo.status === "complete") {
      // Delay kecil agar React X sempat me-render timeline
      setTimeout(() => handleTab(tabId), changeInfo.status === "complete" ? 1000 : 0);
    }
  });

  // Saat user pindah tab X yang sudah terbuka (tanpa reload)
  chrome.tabs.onActivated.addListener(async (info) => {
    if (!state.enabled) return;
    try {
      const tab = await chrome.tabs.get(info.tabId);
      if (tab.url && isXUrl(tab.url)) handleTab(info.tabId);
    } catch { /* tab tertutup */ }
  });
}

function isXUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "x.com" || host === "twitter.com" || host.endsWith(".x.com");
  } catch {
    return false;
  }
}

async function applyToXTabs() {
  const tabs = await chrome.tabs.query({ url: ["*://x.com/*", "*://*.x.com/*", "*://twitter.com/*"] });
  for (const tab of tabs) handleTab(tab.id);
}

async function handleTab(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: state.enabled ? applyXTrendingBlock : removeXTrendingBlock,
    });
  } catch {
    // Abaikan: halaman restricted / tab sudah ditutup
  }
}
