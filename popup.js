const enabledEl = document.getElementById("enabled");
const maxTabsEl = document.getElementById("maxTabs");
const blockedSitesEl = document.getElementById("blockedSites");
const saveBtn = document.getElementById("saveBtn");

async function loadSettings() {
  const data = await chrome.storage.sync.get(["enabled", "maxTabs", "blockedSites"]);

  enabledEl.checked = data.enabled ?? true;
  maxTabsEl.value = data.maxTabs ?? 5;
  // Ubah array kembali menjadi string untuk ditampilkan di textarea
  blockedSitesEl.value = (data.blockedSites ?? []).join("\n");
}

saveBtn.addEventListener("click", async () => {
  // Parsing input textarea menjadi Array of Strings
  const rawSites = blockedSitesEl.value.split(/\r?\n|,/);
  
  // Clean architecture: normalisasi input (trim & lowercase) dan buang entri kosong
  const sanitizedSites = rawSites
    .map(site => site.trim().toLowerCase())
    .filter(site => site.length > 0);

  await chrome.storage.sync.set({
    enabled: enabledEl.checked,
    maxTabs: Number(maxTabsEl.value),
    blockedSites: sanitizedSites,
  });

  alert("Pengaturan Mode Fokus berhasil disimpan!");
});

loadSettings();