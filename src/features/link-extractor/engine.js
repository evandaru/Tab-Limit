import { triggerBadgeFeedback } from "../../shared/utils/ui-feedback.js";

/**
 * Pure function untuk dieksekusi di dalam isolated content script.
 * Melakukan scraping, sanitasi, dan deduplikasi URI.
 */
function extractAllLinksEngine() {
    const anchorNodes = document.querySelectorAll("a[href]");

    // Menggunakan Set untuk deduplikasi secara native (O(n) time complexity)
    const uniqueLinks = new Set();

    anchorNodes.forEach((a) => {
        try {
            // Normalisasi URI dan abaikan fragment/hash murni atau pseudo-protocols
            const url = new URL(a.href);
            if (url.protocol === "http:" || url.protocol === "https:") {
                uniqueLinks.add(url.href);
            }
        } catch (e) {
            // Catch invalid URLs secara silent
        }
    });

    return Array.from(uniqueLinks).join("\n");
}

/**
 * Handler eksekusi via Context Menu (Background Context)
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

            // Injeksi kembali ke DOM tab untuk bypass pembatasan clipboard API di background script
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
 * Handler eksekusi via Popup (UI Context)
 */
export async function initLinkExtractorUI() {
    const copyLinksBtn = document.getElementById("copyLinksBtn");

    if (!copyLinksBtn) return;

    copyLinksBtn.addEventListener("click", async () => {
        try {
            const originalText = copyLinksBtn.innerText;
            copyLinksBtn.innerText = "⏳ Memproses...";
            copyLinksBtn.disabled = true;

            const [activeTab] = await chrome.tabs.query({
                active: true,
                currentWindow: true,
            });

            if (!activeTab) throw new Error("Tidak ada tab aktif.");

            const results = await chrome.scripting.executeScript({
                target: { tabId: activeTab.id },
                func: extractAllLinksEngine,
            });

            const extractedLinks = results[0]?.result;

            if (extractedLinks) {
                // Karena dieksekusi di popup, kita bisa memanggil clipboard API secara langsung
                await navigator.clipboard.writeText(extractedLinks);
                copyLinksBtn.innerText = `✅ Tersalin (${extractedLinks.split('\n').length} link)`;
            } else {
                copyLinksBtn.innerText = "⚠️ Tidak Ada Link";
            }

            setTimeout(() => {
                copyLinksBtn.innerText = originalText;
                copyLinksBtn.disabled = false;
            }, 2000);
        } catch (error) {
            console.error("[Link Extractor] Popup execution failed:", error);
            copyLinksBtn.innerText = "❌ Gagal Menyalin";
            setTimeout(() => {
                copyLinksBtn.innerText = "Copy Semua Link";
                copyLinksBtn.disabled = false;
            }, 2000);
        }
    });
}