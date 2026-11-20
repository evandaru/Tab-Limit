const debounce = (fn, ms = 400) => {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

export async function initFocusModeUI() {
  const enabledEl = document.getElementById("enabled");
  const maxTabsEl = document.getElementById("maxTabs");
  const blockedSitesEl = document.getElementById("blockedSites");

  if (!enabledEl || !maxTabsEl || !blockedSitesEl) return;

  const data = await chrome.storage.sync.get([
    "enabled",
    "maxTabs",
    "blockedSites",
  ]);

  enabledEl.checked = data.enabled ?? true;
  maxTabsEl.value = data.maxTabs ?? 5;
  blockedSitesEl.value = (data.blockedSites ?? []).join("\n");

  const persist = async () => {
    const rawSites = blockedSitesEl.value.split(/\r?\n|,/);
    const sanitizedSites = rawSites
      .map((site) => site.trim().toLowerCase())
      .filter((site) => site.length > 0);

    await chrome.storage.sync.set({
      enabled: enabledEl.checked,
      maxTabs: Number(maxTabsEl.value),
      blockedSites: sanitizedSites,
    });
  };

  const persistDebounced = debounce(persist);

  // Sekali klik/ketik = langsung tersimpan, tanpa tombol Save
  enabledEl.addEventListener("change", persist);
  maxTabsEl.addEventListener("change", persist);
  maxTabsEl.addEventListener("input", persistDebounced);
  blockedSitesEl.addEventListener("input", persistDebounced);
  blockedSitesEl.addEventListener("change", persist);
}
