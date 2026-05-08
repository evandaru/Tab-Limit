// Menggunakan pattern caching di memori untuk menghindari 
// pemanggilan I/O storage yang intensif pada setiap event tab.
let stateCache = {
  enabled: true,
  maxTabs: 5,
  blockedSites: []
};

// Inisialisasi state awal dari storage
chrome.storage.sync.get(["enabled", "maxTabs", "blockedSites"], (data) => {
  stateCache.enabled = data.enabled ?? true;
  stateCache.maxTabs = data.maxTabs ?? 5;
  stateCache.blockedSites = data.blockedSites ?? [];
});

// Listener untuk menyinkronkan stateCache jika terjadi perubahan di popup
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.enabled) stateCache.enabled = changes.enabled.newValue;
    if (changes.maxTabs) stateCache.maxTabs = changes.maxTabs.newValue;
    if (changes.blockedSites) stateCache.blockedSites = changes.blockedSites.newValue;
  }
});

// Utility function: Evaluasi host domain
function isUrlBlocked(targetUrl) {
  try {
    const urlObj = new URL(targetUrl);
    const hostname = urlObj.hostname;
    
    // Mengecek apakah hostname saat ini mengandung salah satu string di blocklist
    return stateCache.blockedSites.some(site => hostname.includes(site));
  } catch (error) {
    // Abaikan jika protokol invalid (seperti chrome:// atau about:blank)
    return false;
  }
}

// 1. Modul Pembatas Tab
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!stateCache.enabled) return;

  const tabs = await chrome.tabs.query({ currentWindow: true });

  if (tabs.length > stateCache.maxTabs) {
    chrome.tabs.remove(tab.id);
  }
});

// 2. Modul Pemblokir Situs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!stateCache.enabled) return;

  // Optimasi: Hanya jalankan inspeksi jika property URL mengalami perubahan
  if (changeInfo.url) {
    if (isUrlBlocked(changeInfo.url)) {
      // Tindakan: Tutup tab secara paksa jika cocok dengan domain blacklist
      chrome.tabs.remove(tabId);
      
      // Catatan: Jika ingin redirect daripada ditutup, Anda bisa menggunakan:
      // chrome.tabs.update(tabId, { url: "chrome-extension://..." });
    }
  }
});