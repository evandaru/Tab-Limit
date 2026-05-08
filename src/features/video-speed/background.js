import { applyVideoSpeedController } from "./engine.js";

export function initVideoSpeedController() {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        // Filter out restricted protocols (chrome://, edge://, etc.)
        if (changeInfo.status === "loading" && tab.url && tab.url.startsWith("http")) {
            chrome.scripting.executeScript({
                target: { tabId },
                func: applyVideoSpeedController
            }).catch((err) => {
                // Silently catch environment restriction errors
                console.warn(`[Devkita VDS] Skipped injection for ${tab.url}`, err);
            });
        }
    });
}