export async function initShortsBlockerUI() {
  const toggleEl = document.getElementById("shortsBlockEnabled");

  if (!toggleEl) return;

  const data = await chrome.storage.sync.get(["shortsBlockEnabled"]);
  toggleEl.checked = data.shortsBlockEnabled ?? false;

  // Sekali klik = langsung tersimpan, tanpa tombol Save
  toggleEl.addEventListener("change", async () => {
    await chrome.storage.sync.set({ shortsBlockEnabled: toggleEl.checked });
  });
}
