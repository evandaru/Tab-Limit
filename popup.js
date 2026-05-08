const enabledEl = document.getElementById("enabled");
const maxTabsEl = document.getElementById("maxTabs");
const saveBtn = document.getElementById("saveBtn");

async function loadSettings() {
  const data = await chrome.storage.sync.get(["enabled", "maxTabs"]);

  enabledEl.checked = data.enabled ?? true;
  maxTabsEl.value = data.maxTabs ?? 5;
}

saveBtn.addEventListener("click", async () => {
  await chrome.storage.sync.set({
    enabled: enabledEl.checked,
    maxTabs: Number(maxTabsEl.value),
  });

  alert("Settings saved!");
});

loadSettings();
