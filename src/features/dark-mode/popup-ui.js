const debounce = (fn, ms = 400) => {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

export async function initDarkModeUI() {
    const darkEnabledEl = document.getElementById("darkEnabled");
    const darkExcludedEl = document.getElementById("darkExcluded");

    if (!darkEnabledEl || !darkExcludedEl) return;

    // Load data when the popup opens
    const data = await chrome.storage.sync.get(["darkEnabled", "darkExcluded"]);
    darkEnabledEl.checked = data.darkEnabled ?? false;
    darkExcludedEl.value = (data.darkExcluded ?? []).join("\n");

    const persist = async () => {
        const rawSites = darkExcludedEl.value.split(/\r?\n|,/);
        const sanitizedSites = rawSites
            .map((site) => site.trim().toLowerCase())
            .filter((site) => site.length > 0);

        await chrome.storage.sync.set({
            darkEnabled: darkEnabledEl.checked,
            darkExcluded: sanitizedSites,
        });
    };

    const persistDebounced = debounce(persist);

    // Sekali klik/ketik = langsung tersimpan, tanpa tombol Save
    darkEnabledEl.addEventListener("change", persist);
    darkExcludedEl.addEventListener("input", persistDebounced);
    darkExcludedEl.addEventListener("change", persist);
}
