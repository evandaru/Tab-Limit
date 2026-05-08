import { getHostname } from "../../shared/utils/url-validator.js";
import { applySmartDarkMode, removeSmartDarkMode } from "./engine.js";

let state = { enabled: false, excluded: [] };

export function initDarkMode() {
    chrome.storage.sync.get(["darkEnabled", "darkExcluded"], (data) => {
        state.enabled = data.darkEnabled ?? false;
        state.excluded = data.darkExcluded ?? [];
    });

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === "sync") {
            let hasChanges = false;
            if (changes.darkEnabled) {
                state.enabled = changes.darkEnabled.newValue;
                hasChanges = true;
            }
            if (changes.darkExcluded) {
                state.excluded = changes.darkExcluded.newValue;
                hasChanges = true;
            }
            if (hasChanges) applyToAllTabs();
        }
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        // Jalankan saat tab sedang dimuat
        if (changeInfo.status === "loading" && tab.url) {
            handleTab(tabId, tab.url);
        }
    });
}

async function applyToAllTabs() {
    const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
    for (const tab of tabs) {
        handleTab(tab.id, tab.url);
    }
}

function isUrlExcluded(targetUrl) {
    const hostname = getHostname(targetUrl);
    if (!hostname) return true;
    return state.excluded.some((site) => hostname.includes(site));
}

async function handleTab(tabId, url) {
    if (!url.startsWith("http")) return;

    const shouldApply = state.enabled && !isUrlExcluded(url);

    try {
        if (shouldApply) {
            await chrome.scripting.executeScript({
                target: { tabId },
                func: applySmartDarkMode // Memanggil engine pintar kita
            });
        } else {
            await chrome.scripting.executeScript({
                target: { tabId },
                func: removeSmartDarkMode
            });
        }
    } catch (e) {
        // Biasanya gagal jika mencoba inject di chrome:// atau Chrome Web Store
    }
}