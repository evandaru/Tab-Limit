export async function initXTrendingBlockerUI() {
  const toggleEl = document.getElementById("xTrendingBlockEnabled");

  if (!toggleEl) return;

  // Default ON — sesuai permintaan: trending disembunyikan sejak awal
  const data = await chrome.storage.sync.get(["xTrendingBlockEnabled"]);
  toggleEl.checked = data.xTrendingBlockEnabled ?? true;

  // Sekali klik = langsung tersimpan, tanpa tombol Save
  toggleEl.addEventListener("change", async () => {
    await chrome.storage.sync.set({ xTrendingBlockEnabled: toggleEl.checked });
  });
}
