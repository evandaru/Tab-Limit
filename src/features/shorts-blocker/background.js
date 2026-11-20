import { applyShortsBlock, removeShortsBlock } from "./engine.js";

let state = { enabled: false };

export function initShortsBlocker() {
  chrome.storage.sync.get(["shortsBlockEnabled"], (data) => {
    state.enabled = data.shortsBlockEnabled ?? false;
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "sync" && changes.shortsBlockEnabled) {
      state.enabled = changes.shortsBlockEnabled.newValue;
      applyToYouTubeTabs();
    }
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const url = changeInfo.url || tab.url;
    if (!url || !isYouTubeUrl(url)) return;
    // Injeksi di loading (awal) dan complete (setelah SPA render) agar tidak kelewatan
    if (changeInfo.status === "loading" || changeInfo.status === "complete") {
      // Delay kecil agar shadow DOM YouTube sempat ter-render
      setTimeout(() => handleTab(tabId), changeInfo.status === "complete" ? 800 : 0);
    }
  });

  // Saat user pindah tab YouTube yang sudah terbuka (tanpa reload)
  chrome.tabs.onActivated.addListener(async (info) => {
    if (!state.enabled) return;
    try {
      const tab = await chrome.tabs.get(info.tabId);
      if (tab.url && isYouTubeUrl(tab.url)) handleTab(info.tabId);
    } catch { /* tab tertutup */ }
  });
}

function isYouTubeUrl(url) {
  try {
    const host = new URL(url).hostname;
    return host.includes("youtube.com") || host.includes("youtu.be");
  } catch {
    return false;
  }
}

async function applyToYouTubeTabs() {
  const tabs = await chrome.tabs.query({ url: ["*://*.youtube.com/*", "*://youtu.be/*"] });
  for (const tab of tabs) handleTab(tab.id);
}

async function handleTab(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: state.enabled ? applyShortsBlock : removeShortsBlock,
    });
  } catch {
    // Abaikan: halaman restricted / tab sudah ditutup
  }
}
