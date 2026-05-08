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

chrome.runtime.onInstalled.addListener(() => {
  // Menu Simpan/Copy Teks & Kode
  chrome.contextMenus.create({
    id: "save-text",
    title: "📝 Simpan Teks ke Dashboard",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: "save-code",
    title: "💻 Simpan Kode ke Dashboard",
    contexts: ["selection"],
  });

  // FITUR BARU: Copy Blog as MD (Berbasis DOM Parsing)
  chrome.contextMenus.create({
    id: "copy-blog-md",
    title: "📋 Copy Seluruh Blog as MD",
    contexts: ["page"],
  });

  // FITUR BARU: Save Code as HTML (Khusus untuk blok kode yang diseleksi)
  chrome.contextMenus.create({
    id: "save-code-html",
    title: "📄 Save Seleksi as .html",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: "separator-1",
    type: "separator",
    contexts: ["all"],
  });
  chrome.contextMenus.create({
    id: "open-dashboard",
    title: "📁 Buka Dashboard Kutipan",
    contexts: ["all"],
  });
});

// Helper: Parser HTML ke Markdown (Fungsi yang akan diinjeksi)
function htmlToMdParser() {
  const rootNode =
    document.querySelector("article") ||
    document.querySelector("main") ||
    document.body;
  let markdown = "";
  function traverse(node) {
    const skipTags = [
      "NAV",
      "HEADER",
      "FOOTER",
      "ASIDE",
      "SCRIPT",
      "STYLE",
      "NOSCRIPT",
      "IFRAME",
      "BUTTON",
    ];
    if (node.nodeType === 1 && skipTags.includes(node.tagName)) return;
    if (node.nodeType === 1) {
      const tag = node.tagName;
      const text = node.innerText ? node.innerText.trim() : "";
      if (!text && tag !== "BR" && tag !== "HR") return;
      switch (tag) {
        case "H1":
          markdown += `\n# ${text}\n\n`;
          break;
        case "H2":
          markdown += `\n## ${text}\n\n`;
          break;
        case "H3":
          markdown += `\n### ${text}\n\n`;
          break;
        case "P":
          markdown += `${text}\n\n`;
          break;
        case "UL":
        case "OL":
          Array.from(node.children).forEach((child, i) => {
            if (child.tagName === "LI")
              markdown += `${tag === "UL" ? "-" : i + 1 + "."} ${child.innerText.trim()}\n`;
          });
          markdown += "\n";
          break;
        case "PRE":
        case "CODE":
          if (tag === "PRE") markdown += `\n\`\`\`\n${text}\n\`\`\`\n\n`;
          break;
        default:
          Array.from(node.childNodes).forEach(traverse);
          break;
      }
    }
  }
  Array.from(rootNode.childNodes).forEach(traverse);
  return {
    title: document.title,
    content: markdown.trim(),
    url: window.location.href,
  };
}

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

      case "copy-blog-md":
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: htmlToMdParser,
        });
        const data = results[0].result;
        const finalMd = `# ${data.title}\n\n> **Source:** ${data.url}\n\n---\n\n${data.content}`;

        // Mengirim ke clipboard melalui background memerlukan bantuan offscreen document atau scripting
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (text) => navigator.clipboard.writeText(text),
          args: [finalMd],
        });
        triggerBadgeFeedback(tab.id, "Copied", "#0d6efd");
        break;

      case "save-code-html":
        // Mengambil seleksi sebagai HTML menggunakan blob
        const htmlContent = info.selectionText; // info.selectionText hanya teks, jika ingin HTML butuh executeScript
        const dataUrl =
          "data:text/html;charset=utf-8," + encodeURIComponent(htmlContent);
        chrome.downloads.download({
          url: dataUrl,
          filename: `snippet-${Date.now()}.html`,
          saveAs: false,
        });
        triggerBadgeFeedback(tab.id, "HTML", "#0dcaf0");
        break;

      case "open-dashboard":
        chrome.runtime.openOptionsPage();
        break;
    }
  } catch (error) {
    console.error("Context Menu Error:", error);
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
