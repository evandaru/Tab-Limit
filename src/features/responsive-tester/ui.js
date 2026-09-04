/**
 * Responsive Tester Module
 * Opens the active tab URL in a new window with industry-standard device dimensions.
 */

const DEVICE_CONFIGS = {
    mobile: { width: 375, height: 812, type: 'popup' },   // iPhone X/12/13/14 Pro viewport
    tablet: { width: 768, height: 1024, type: 'popup' },  // iPad Standard viewport
    desktop: { width: 1440, height: 900, type: 'popup' }  // Standard Desktop viewport
};

export function initResponsiveTesterUI() {
    const container = document.getElementById("responsiveTesterContainer");
    if (!container) return;

    // Uses event delegation for better performance
    container.addEventListener("click", async (event) => {
        const btn = event.target.closest("button[data-device]");
        if (!btn) return;

        const deviceType = btn.dataset.device;
        const config = DEVICE_CONFIGS[deviceType];

        if (!config) return;

        try {
            const originalText = btn.innerText;
            btn.innerText = "⏳";
            btn.disabled = true;

            // Grab the active tab metadata
            const [activeTab] = await chrome.tabs.query({
                active: true,
                currentWindow: true
            });

            // Validate the URL protocol to prevent running on internal browser pages
            if (!activeTab || !activeTab.url || activeTab.url.startsWith("chrome://")) {
                throw new Error("Invalid protocol for responsive testing.");
            }

            // Launch a new window with precise dimensions
            await chrome.windows.create({
                url: activeTab.url,
                width: config.width,
                height: config.height,
                type: config.type,
                focused: true
            });

            // Restore UI state
            btn.innerText = originalText;
            btn.disabled = false;

        } catch (error) {
            console.error("[Responsive Tester] Operation failed:", error);
            const originalText = btn.innerText;
            btn.innerText = "❌ Failed";
            setTimeout(() => {
                btn.innerText = originalText;
                btn.disabled = false;
            }, 1500);
        }
    });
}