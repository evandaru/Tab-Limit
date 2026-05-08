import { StorageAPI } from "./core/storage-api.js";

// ==========================================
// STATE MANAGEMENT & CACHE
// ==========================================
let stateCache = { enabled: true, maxTabs: 5, blockedSites: [] };
let activeSession = { domain: null, startTime: null, tabId: null };

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

// Utility Analitik
function getTodayKey() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  const localISOTime = new Date(date - offset).toISOString().split("T")[0];
  return `analytics_${localISOTime}`;
}

function getHostname(urlStr) {
  try {
    const urlObj = new URL(urlStr);
    return ["http:", "https:"].includes(urlObj.protocol)
      ? urlObj.hostname.replace(/^www\./, "")
      : null;
  } catch (error) {
    return null;
  }
}

// ==========================================
// MODUL 1: MODE FOKUS & DISTRACTION BLOCKER
// ==========================================
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
  if (tabs.length > stateCache.maxTabs) chrome.tabs.remove(tab.id);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!stateCache.enabled || !changeInfo.url) return;

  if (isUrlBlocked(changeInfo.url)) {
    chrome.tabs.remove(tabId);

    // Catat upaya distraksi ke storage analitik
    const todayKey = getTodayKey();
    const data = await chrome.storage.local.get(todayKey);
    const todayData = data[todayKey] || {
      totalTime: 0,
      domains: {},
      distractions: 0,
    };
    todayData.distractions += 1;
    await chrome.storage.local.set({ [todayKey]: todayData });
  }
});

// ==========================================
// MODUL 2: CONTEXT MENU REGISTRY & ROUTER
// ==========================================

// Helper Function: Manajemen state visual pada ekstensi (Badge UI)
const triggerBadgeFeedback = (tabId, text, color) => {
  chrome.action.setBadgeText({ text, tabId });
  chrome.action.setBadgeBackgroundColor({ color, tabId });
  setTimeout(() => chrome.action.setBadgeText({ text: "", tabId }), 1500);
};

// 1. Registrasi Menu pada tahap instalasi/inisialisasi
chrome.runtime.onInstalled.addListener(() => {
  // Menu 1: Simpan teks biasa
  chrome.contextMenus.create({
    id: "save-text",
    title: "📝 Simpan Teks ke Dashboard",
    contexts: ["selection"],
  });

  // Menu 2: Simpan sebagai kode
  chrome.contextMenus.create({
    id: "save-code",
    title: "💻 Simpan Kode ke Dashboard",
    contexts: ["selection"],
  });

  // Menu 3: Langsung unduh sebagai file Markdown
  chrome.contextMenus.create({
    id: "download-md",
    title: "⬇️ Unduh Seleksi sebagai .md",
    contexts: ["selection"],
  });

  // Garis Pemisah (Separator UI)
  chrome.contextMenus.create({
    id: "separator-1",
    type: "separator",
    contexts: ["all"],
  });

  // Menu 4: Navigasi cepat ke Dashboard (Bisa diklik di mana saja, tanpa harus blok teks)
  chrome.contextMenus.create({
    id: "open-dashboard",
    title: "📁 Buka Dashboard Kutipan",
    contexts: ["all"],
  });
});

// 2. Routing logic berdasarkan ID menu yang dipicu
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    switch (info.menuItemId) {
      case "save-text":
        await StorageAPI.saveQuote({
          text: info.selectionText,
          url: info.pageUrl,
          timestamp: new Date().toISOString(),
        });
        triggerBadgeFeedback(tab.id, "Saved", "#198754");
        break;

      case "save-code":
        await StorageAPI.saveQuote({
          text: `\`\`\`\n${info.selectionText}\n\`\`\``,
          url: info.pageUrl,
          timestamp: new Date().toISOString(),
        });
        triggerBadgeFeedback(tab.id, "Code", "#0dcaf0");
        break;

      case "download-md":
        // Kompilasi struktur data Markdown
        const dateStr = new Date().toLocaleDateString("id-ID");
        const mdContent = `> ${info.selectionText.replace(/\n/g, "\n> ")}\n\n**Sumber:** [Tautan](${info.pageUrl})\n\n**Tanggal Arsip:** ${dateStr}`;

        // Transformasi string murni menjadi Data URI berbasis Base64 atau URI Component
        const dataUrl =
          "data:text/markdown;charset=utf-8," + encodeURIComponent(mdContent);

        // Eksekusi API unduhan tanpa memicu prompt 'Save As' untuk kecepatan
        chrome.downloads.download({
          url: dataUrl,
          filename: `snippet-${new Date().getTime()}.md`,
          saveAs: false,
        });

        triggerBadgeFeedback(tab.id, "Unduh", "#6f42c1");
        break;

      case "open-dashboard":
        // Rutekan pengguna ke Options Page secara otomatis
        chrome.runtime.openOptionsPage();
        break;
    }
  } catch (error) {
    console.error("Kesalahan arsitektural pada eksekusi Context Menu:", error);
  }
});
// ==========================================
// MODUL 3: TIME TRACKING ENGINE
// ==========================================
async function commitSessionTime() {
  if (!activeSession.domain || !activeSession.startTime) return;

  const now = Date.now();
  const durationSecs = Math.floor((now - activeSession.startTime) / 1000);

  if (durationSecs > 0 && durationSecs < 86400) {
    const todayKey = getTodayKey();
    const data = await chrome.storage.local.get([todayKey, "allTimeTotal"]);

    const todayData = data[todayKey] || {
      totalTime: 0,
      domains: {},
      distractions: 0,
    };
    const allTimeTotal = (data.allTimeTotal || 0) + durationSecs;

    todayData.totalTime += durationSecs;
    todayData.domains[activeSession.domain] =
      (todayData.domains[activeSession.domain] || 0) + durationSecs;

    await chrome.storage.local.set({
      [todayKey]: todayData,
      allTimeTotal: allTimeTotal,
    });
  }
  activeSession.startTime = Date.now();
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await commitSessionTime();
  activeSession.tabId = activeInfo.tabId;
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    const domain = getHostname(tab.url);
    activeSession.domain = domain;
    activeSession.startTime = domain ? Date.now() : null;
  } catch (e) {}
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId === activeSession.tabId && changeInfo.url) {
    await commitSessionTime();
    const domain = getHostname(changeInfo.url);
    activeSession.domain = domain;
    activeSession.startTime = domain ? Date.now() : null;
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  await commitSessionTime();
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    activeSession.domain = null;
    activeSession.startTime = null;
  } else {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        windowId: windowId,
      });
      if (tab) {
        activeSession.tabId = tab.id;
        const domain = getHostname(tab.url);
        activeSession.domain = domain;
        activeSession.startTime = domain ? Date.now() : null;
      }
    } catch (e) {}
  }
});

chrome.alarms.create("syncTracker", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "syncTracker") commitSessionTime();
});
