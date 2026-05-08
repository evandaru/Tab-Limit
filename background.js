import { StorageAPI } from "./core/storage-api.js";

// ==========================================
// MODUL 1: MODE FOKUS (Limitasi Tab & Site Blocker)
// ==========================================
let stateCache = {
  enabled: true,
  maxTabs: 5,
  blockedSites: [],
};

chrome.storage.sync.get(["enabled", "maxTabs", "blockedSites"], (data) => {
  stateCache.enabled = data.enabled ?? true;
  stateCache.maxTabs = data.maxTabs ?? 5;
  stateCache.blockedSites = data.blockedSites ?? [];
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "sync") {
    if (changes.enabled) stateCache.enabled = changes.enabled.newValue;
    if (changes.maxTabs) stateCache.maxTabs = changes.maxTabs.newValue;
    if (changes.blockedSites)
      stateCache.blockedSites = changes.blockedSites.newValue;
  }
});

function isUrlBlocked(targetUrl) {
  try {
    const urlObj = new URL(targetUrl);
    return stateCache.blockedSites.some((site) =>
      urlObj.hostname.includes(site),
    );
  } catch (error) {
    return false;
  }
}

chrome.tabs.onCreated.addListener(async (tab) => {
  if (!stateCache.enabled) return;
  const tabs = await chrome.tabs.query({ currentWindow: true });
  if (tabs.length > stateCache.maxTabs) {
    chrome.tabs.remove(tab.id);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!stateCache.enabled) return;
  if (changeInfo.url) {
    if (isUrlBlocked(changeInfo.url)) {
      chrome.tabs.remove(tabId);
    }
  }
});

// ==========================================
// MODUL 2: CLIPBOARD MANAGER (Context Menu)
// ==========================================
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-clipboard",
    title: "Simpan ke Dashboard Kutipan",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "save-clipboard") {
    try {
      const newQuote = {
        text: info.selectionText,
        url: info.pageUrl,
        timestamp: new Date().toISOString(),
      };

      await StorageAPI.saveQuote(newQuote);

      // Indikator visual sukses pada badge ekstensi
      chrome.action.setBadgeText({ text: "✓", tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({
        color: "#198754",
        tabId: tab.id,
      });
      setTimeout(
        () => chrome.action.setBadgeText({ text: "", tabId: tab.id }),
        1500,
      );
    } catch (error) {
      console.error("Gagal melakukan operasi write ke storage:", error);
    }
  }
});
