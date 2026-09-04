import { triggerBadgeFeedback } from "../../shared/utils/ui-feedback.js";

/**
 * Pure function executed inside the isolated content script.
 * Scrapes links, sanitizes tracker params, and deduplicates URIs.
 */
function extractAllLinksEngine() {
    const anchorNodes = document.querySelectorAll("a[href]");
    const uniqueLinks = new Set();

    // Tracker params are defined inside because this function
    // runs in the target tab's isolated scope.
    const EXACT_TRACKERS = new Set([
        'fbclid', 'gclid', 'igshid', 'ref', '_ga',
        'mc_cid', 'mc_eid', 'yclid', '_ke', 'mkt_tok'
    ]);
    const PREFIX_TRACKERS = ['utm_'];

    anchorNodes.forEach((a) => {
        try {
            const url = new URL(a.href);
            if (url.protocol === "http:" || url.protocol === "https:") {

                // 1. Identify dirty params
                const keysToDelete = [];
                for (const key of url.searchParams.keys()) {
                    const lowerKey = key.toLowerCase();
                    const isExactMatch = EXACT_TRACKERS.has(lowerKey);
                    const isPrefixMatch = PREFIX_TRACKERS.some(prefix => lowerKey.startsWith(prefix));

                    if (isExactMatch || isPrefixMatch) {
                        keysToDelete.push(key);
                    }
                }

                // 2. Sanitize the URL in place
                keysToDelete.forEach(key => url.searchParams.delete(key));

                // 3. Store the fully cleaned URL in the Set
                uniqueLinks.add(url.href);
            }
        } catch (e) {
            // Malformed URIs are silently ignored
        }
    });

    return Array.from(uniqueLinks).join("\n");
}

/**
 * Execution handler via Context Menu (background context)
 */
export async function handleLinkExtractorMenu(info, tab) {
    if (info.menuItemId === "copy-all-links") {
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: extractAllLinksEngine,
            });

            const extractedLinks = results[0]?.result;

            if (!extractedLinks) throw new Error("No links found");

            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (text) => navigator.clipboard.writeText(text),
                args: [extractedLinks],
            });

            triggerBadgeFeedback(tab.id, "Copied", "#6f42c1");
        } catch (error) {
            console.error("[Link Extractor] Operation failed:", error);
            triggerBadgeFeedback(tab.id, "Failed", "#dc2626");
        }
    }
}

/**
 * Execution handler via Popup (UI context)
 */
export async function initLinkExtractorUI() {
    const copyLinksBtn = document.getElementById("copyLinksBtn");

    if (!copyLinksBtn) return;

    copyLinksBtn.addEventListener("click", async () => {
        try {
            const originalText = copyLinksBtn.innerText;
            copyLinksBtn.innerText = "⏳ Processing...";
            copyLinksBtn.disabled = true;

            const [activeTab] = await chrome.tabs.query({
                active: true,
                currentWindow: true,
            });

            if (!activeTab) throw new Error("No active tab.");

            const results = await chrome.scripting.executeScript({
                target: { tabId: activeTab.id },
                func: extractAllLinksEngine,
            });

            const extractedLinks = results[0]?.result;

            if (extractedLinks) {
                await navigator.clipboard.writeText(extractedLinks);
                copyLinksBtn.innerText = `✅ Copied (${extractedLinks.split('\n').length} links)`;
            } else {
                copyLinksBtn.innerText = "⚠️ No Links";
            }

            setTimeout(() => {
                copyLinksBtn.innerText = originalText;
                copyLinksBtn.disabled = false;
            }, 2000);
        } catch (error) {
            console.error("[Link Extractor] Popup execution failed:", error);
            copyLinksBtn.innerText = "❌ Copy Failed";
            setTimeout(() => {
                copyLinksBtn.innerText = "Copy All Links";
                copyLinksBtn.disabled = false;
            }, 2000);
        }
    });
}