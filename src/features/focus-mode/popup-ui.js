export async function initFocusModeUI() {
  const enabledEl = document.getElementById("enabled");
  const maxTabsEl = document.getElementById("maxTabs");
  const blockedSitesEl = document.getElementById("blockedSites");
  const saveBtn = document.getElementById("saveBtn");

  if (!enabledEl || !maxTabsEl || !blockedSitesEl || !saveBtn) return;

  const data = await chrome.storage.sync.get([
    "enabled",
    "maxTabs",
    "blockedSites",
  ]);

  enabledEl.checked = data.enabled ?? true;
  maxTabsEl.value = data.maxTabs ?? 5;
  blockedSitesEl.value = (data.blockedSites ?? []).join("\n");

  saveBtn.addEventListener("click", async () => {
    const rawSites = blockedSitesEl.value.split(/\r?\n|,/);

    const sanitizedSites = rawSites
      .map((site) => site.trim().toLowerCase())
      .filter((site) => site.length > 0);

    await chrome.storage.sync.set({
      enabled: enabledEl.checked,
      maxTabs: Number(maxTabsEl.value),
      blockedSites: sanitizedSites,
    });

    alert("Pengaturan Mode Fokus berhasil disimpan!");
  });
}
