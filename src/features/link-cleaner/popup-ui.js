export async function initLinkCleanerUI() {
    const cleanerEnabledEl = document.getElementById("cleanerEnabled");

    if (!cleanerEnabledEl) return;

    const data = await chrome.storage.sync.get(["cleanerEnabled"]);
    cleanerEnabledEl.checked = data.cleanerEnabled ?? false;

    // Sekali klik = langsung tersimpan, tanpa tombol Save
    cleanerEnabledEl.addEventListener("change", async () => {
        await chrome.storage.sync.set({
            cleanerEnabled: cleanerEnabledEl.checked,
        });
    });
}
