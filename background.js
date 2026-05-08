async function getSettings() {
  const data = await chrome.storage.sync.get(["enabled", "maxTabs"]);

  return {
    enabled: data.enabled ?? true,
    maxTabs: data.maxTabs ?? 5,
  };
}

chrome.tabs.onCreated.addListener(async (tab) => {
  const settings = await getSettings();

  if (!settings.enabled) return;

  const tabs = await chrome.tabs.query({
    currentWindow: true,
  });

  if (tabs.length > settings.maxTabs) {
    chrome.tabs.remove(tab.id);
  }
});
