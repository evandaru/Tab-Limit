/**
 * Link Cleaner Engine (URL Sanitizer)
 * Berjalan di background sebagai interceptor untuk membersihkan tracking parameters.
 */

let state = { enabled: false };

// Menggunakan Set untuk optimasi pencarian O(1)
const EXACT_TRACKERS = new Set([
    'fbclid', 'gclid', 'igshid', 'ref', '_ga',
    'mc_cid', 'mc_eid', 'yclid', '_ke', 'mkt_tok'
]);

// Untuk mendeteksi varian parameter dengan prefix (seperti utm_source, utm_medium, dll)
const PREFIX_TRACKERS = ['utm_'];

export function initLinkCleaner() {
    // 1. Inisialisasi State
    chrome.storage.sync.get(['cleanerEnabled'], (data) => {
        state.enabled = data.cleanerEnabled ?? false;
    });

    // 2. Reactivity pada konfigurasi user
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes.cleanerEnabled) {
            state.enabled = changes.cleanerEnabled.newValue;
        }
    });

    // 3. Interceptor Pipeline
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        // Hanya memproses saat URL berubah dan state aktif
        if (!state.enabled || !changeInfo.url) return;

        try {
            const urlObj = new URL(changeInfo.url);
            const searchParams = urlObj.searchParams;
            const keysToDelete = [];

            // Kumpulkan kunci parameter yang cocok dengan kriteria tracker
            for (const key of searchParams.keys()) {
                const lowerKey = key.toLowerCase();

                const isExactMatch = EXACT_TRACKERS.has(lowerKey);
                const isPrefixMatch = PREFIX_TRACKERS.some(prefix => lowerKey.startsWith(prefix));

                if (isExactMatch || isPrefixMatch) {
                    keysToDelete.push(key);
                }
            }

            // Jika ditemukan parameter kotor, lakukan mutasi URI dan redirect
            if (keysToDelete.length > 0) {
                keysToDelete.forEach(key => searchParams.delete(key));

                const cleanUrl = urlObj.toString();

                // Update URL di tab aktif untuk mencegah eksekusi tracker di sisi klien
                chrome.tabs.update(tabId, { url: cleanUrl });
            }
        } catch (e) {
            // Catch error secara silent (misal: invalid internal browser protocol)
        }
    });
}