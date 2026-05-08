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

// ==========================================
// MODUL 3: TELEMETRY ENGINE (Analytics)
// ==========================================
let activeSession = { domain: null, startTime: null };

// Helper: Mendapatkan kunci tanggal hari ini (Format: YYYY-MM-DD)
function getTodayKey() {
  return `analytics_${new Date().toISOString().split("T")[0]}`;
}

// Helper: Menginisialisasi atau mengambil data analitik hari ini
async function getDailyStats() {
  const key = getTodayKey();
  const data = await chrome.storage.local.get(key);
  return (
    data[key] || {
      domains: {}, // Durasi per domain (dalam detik)
      distractions: 0, // Jumlah upaya membuka situs diblokir
      tabSamples: [], // Sampel jumlah tab untuk rata-rata
      hourly: {}, // Distribusi waktu aktif per jam (00-23)
    }
  );
}

// Helper: Menyimpan durasi sesi yang baru selesai
async function commitSessionTime() {
  if (!activeSession.domain || !activeSession.startTime) return;

  const endTime = Date.now();
  const durationSecs = Math.floor((endTime - activeSession.startTime) / 1000);

  // Abaikan sesi anomali (misal: kurang dari 1 detik atau SW tertidur sangat lama)
  if (durationSecs > 0 && durationSecs < 86400) {
    const stats = await getDailyStats();
    const currentHour = new Date().getHours().toString().padStart(2, "0");

    // Agregasi Data
    stats.domains[activeSession.domain] =
      (stats.domains[activeSession.domain] || 0) + durationSecs;
    stats.hourly[currentHour] = (stats.hourly[currentHour] || 0) + durationSecs;

    const key = getTodayKey();
    await chrome.storage.local.set({ [key]: stats });
  }

  activeSession = { domain: null, startTime: null };
}

// Listener: Melacak pergantian Tab
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await commitSessionTime(); // Simpan sesi tab sebelumnya

  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && !tab.url.startsWith("chrome://")) {
      activeSession.domain = new URL(tab.url).hostname;
      activeSession.startTime = Date.now();
    }
  } catch (error) {
    // Tab mungkin sudah ditutup atau tidak dapat diakses
  }
});

// Listener: Melacak pergantian window (Fokus OS)
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // User minimize browser atau pindah ke aplikasi lain
    await commitSessionTime();
  } else {
    // User kembali ke browser, mulai hitung ulang tab yang sedang aktif
    const [tab] = await chrome.tabs.query({ active: true, windowId: windowId });
    if (tab && tab.url && !tab.url.startsWith("chrome://")) {
      activeSession.domain = new URL(tab.url).hostname;
      activeSession.startTime = Date.now();
    }
  }
});

// Listener: Polling sampel jumlah tab saat ada tab baru dibuat
chrome.tabs.onCreated.addListener(async (tab) => {
  // Modul pemblokir tab ada di bagian atas background.js Anda
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const stats = await getDailyStats();
  stats.tabSamples.push(tabs.length);

  // Batasi array sampel agar tidak membebani memory storage
  if (stats.tabSamples.length > 100) stats.tabSamples.shift();

  const key = getTodayKey();
  await chrome.storage.local.set({ [key]: stats });
});

// ==========================================
// MODUL 3: TELEMETRY ENGINE (Analytics)
// ==========================================
let activeSession = { domain: null, startTime: null };

// Helper: Mendapatkan kunci tanggal hari ini (Format: YYYY-MM-DD)
function getTodayKey() {
  return `analytics_${new Date().toISOString().split('T')[0]}`;
}

// Helper: Menginisialisasi atau mengambil data analitik hari ini
async function getDailyStats() {
  const key = getTodayKey();
  const data = await chrome.storage.local.get(key);
  return data[key] || {
    domains: {},         // Durasi per domain (dalam detik)
    distractions: 0,     // Jumlah upaya membuka situs diblokir
    tabSamples: [],      // Sampel jumlah tab untuk rata-rata
    hourly: {}           // Distribusi waktu aktif per jam (00-23)
  };
}

// Helper: Menyimpan durasi sesi yang baru selesai
async function commitSessionTime() {
  if (!activeSession.domain || !activeSession.startTime) return;

  const endTime = Date.now();
  const durationSecs = Math.floor((endTime - activeSession.startTime) / 1000);
  
  // Abaikan sesi anomali (misal: kurang dari 1 detik atau SW tertidur sangat lama)
  if (durationSecs > 0 && durationSecs < 86400) {
    const stats = await getDailyStats();
    const currentHour = new Date().getHours().toString().padStart(2, '0');

    // Agregasi Data
    stats.domains[activeSession.domain] = (stats.domains[activeSession.domain] || 0) + durationSecs;
    stats.hourly[currentHour] = (stats.hourly[currentHour] || 0) + durationSecs;

    const key = getTodayKey();
    await chrome.storage.local.set({ [key]: stats });
  }

  activeSession = { domain: null, startTime: null };
}

// Listener: Melacak pergantian Tab
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await commitSessionTime(); // Simpan sesi tab sebelumnya
  
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && !tab.url.startsWith('chrome://')) {
      activeSession.domain = new URL(tab.url).hostname;
      activeSession.startTime = Date.now();
    }
  } catch (error) {
    // Tab mungkin sudah ditutup atau tidak dapat diakses
  }
});

// Listener: Melacak pergantian window (Fokus OS)
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // User minimize browser atau pindah ke aplikasi lain
    await commitSessionTime();
  } else {
    // User kembali ke browser, mulai hitung ulang tab yang sedang aktif
    const [tab] = await chrome.tabs.query({ active: true, windowId: windowId });
    if (tab && tab.url && !tab.url.startsWith('chrome://')) {
      activeSession.domain = new URL(tab.url).hostname;
      activeSession.startTime = Date.now();
    }
  }
});

// Listener: Polling sampel jumlah tab saat ada tab baru dibuat
chrome.tabs.onCreated.addListener(async (tab) => {
  // Modul pemblokir tab ada di bagian atas background.js Anda
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const stats = await getDailyStats();
  stats.tabSamples.push(tabs.length);
  
  // Batasi array sampel agar tidak membebani memory storage
  if (stats.tabSamples.length > 100) stats.tabSamples.shift();
  
  const key = getTodayKey();
  await chrome.storage.local.set({ [key]: stats });
});