/**
 * Link Cleaner Engine (URL Sanitizer)
 * Runs in the background as an interceptor that strips tracking parameters.
 */

let state = { enabled: false };

// Uses a Set for O(1) lookups
const EXACT_TRACKERS = new Set([
    'fbclid', 'gclid', 'igshid', 'ref', '_ga',
    'mc_cid', 'mc_eid', 'yclid', '_ke', 'mkt_tok'
]);

// Detects prefixed param variants (e.g. utm_source, utm_medium, etc.)
const PREFIX_TRACKERS = ['utm_'];

export function initLinkCleaner() {
    // 1. Initialize State
    chrome.storage.sync.get(['cleanerEnabled'], (data) => {
        state.enabled = data.cleanerEnabled ?? false;
    });

    // 2. Reactivity to user config
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes.cleanerEnabled) {
            state.enabled = changes.cleanerEnabled.newValue;
        }
    });

    // 3. Interceptor Pipeline
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        // Only processes on URL change while enabled
        if (!state.enabled || !changeInfo.url) return;

        try {
            const urlObj = new URL(changeInfo.url);
            const searchParams = urlObj.searchParams;
            const keysToDelete = [];

            // Collect param keys matching the tracker criteria
            for (const key of searchParams.keys()) {
                const lowerKey = key.toLowerCase();

                const isExactMatch = EXACT_TRACKERS.has(lowerKey);
                const isPrefixMatch = PREFIX_TRACKERS.some(prefix => lowerKey.startsWith(prefix));

                if (isExactMatch || isPrefixMatch) {
                    keysToDelete.push(key);
                }
            }

            // If dirty params are found, mutate the URI and redirect
            if (keysToDelete.length > 0) {
                keysToDelete.forEach(key => searchParams.delete(key));

                const cleanUrl = urlObj.toString();

                // Update the active tab URL to prevent client-side tracker execution
                chrome.tabs.update(tabId, { url: cleanUrl });
            }
        } catch (e) {
            // Silently catch errors (e.g. invalid internal browser protocols)
        }
    });
}