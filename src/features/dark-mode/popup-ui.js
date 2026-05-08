export async function initDarkModeUI() {
    const darkEnabledEl = document.getElementById("darkEnabled");
    const darkExcludedEl = document.getElementById("darkExcluded");
    const saveBtn = document.getElementById("saveBtn");

    if (!darkEnabledEl || !darkExcludedEl || !saveBtn) return;

    // Load data saat popup dibuka
    const data = await chrome.storage.sync.get(["darkEnabled", "darkExcluded"]);
    darkEnabledEl.checked = data.darkEnabled ?? false;
    darkExcludedEl.value = (data.darkExcluded ?? []).join("\n");

    // Nebeng ke tombol "Simpan Pengaturan" yang sudah ada
    saveBtn.addEventListener("click", async () => {
        const rawSites = darkExcludedEl.value.split(/\r?\n|,/);
        const sanitizedSites = rawSites
            .map((site) => site.trim().toLowerCase())
            .filter((site) => site.length > 0);

        await chrome.storage.sync.set({
            darkEnabled: darkEnabledEl.checked,
            darkExcluded: sanitizedSites,
        });
    });
}