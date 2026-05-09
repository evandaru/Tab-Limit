export async function initLinkCleanerUI() {
    const cleanerEnabledEl = document.getElementById("cleanerEnabled");
    const saveBtn = document.getElementById("saveBtn");

    if (!cleanerEnabledEl || !saveBtn) return;

    const data = await chrome.storage.sync.get(["cleanerEnabled"]);
    cleanerEnabledEl.checked = data.cleanerEnabled ?? false;

    // Binding ke tombol simpan yang sudah eksis di arsitektur Anda
    saveBtn.addEventListener("click", async () => {
        await chrome.storage.sync.set({
            cleanerEnabled: cleanerEnabledEl.checked,
        });
    });
}