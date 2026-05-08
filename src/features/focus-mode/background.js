import { recordDistractionAttempt } from "../time-tracker/engine.js";

let focusState = { enabled: true, maxTabs: 5, blockedSites: [] };

export function initFocusMode() {
  // 1. Load initial state
  chrome.storage.sync.get(["enabled", "maxTabs", "blockedSites"], (data) => {
    focusState = { ...focusState, ...data };
  });

  // 2. Listen to state changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "sync") {
      if (changes.enabled) focusState.enabled = changes.enabled.newValue;
      if (changes.maxTabs) focusState.maxTabs = changes.maxTabs.newValue;
      if (changes.blockedSites) focusState.blockedSites = changes.blockedSites.newValue;
    }
  });

  // 3. Tab Limit Logic
  chrome.tabs.onCreated.addListener(async (tab) => {
    if (!focusState.enabled) return;
    const tabs = await chrome.tabs.query({ currentWindow: true });
    if (tabs.length > focusState.maxTabs) chrome.tabs.remove(tab.id);
  });

  // 4. Distraction Blocker Logic
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (!focusState.enabled || !changeInfo.url) return;
    
    if (isUrlBlocked(changeInfo.url)) {
      chrome.tabs.remove(tabId);
      await recordDistractionAttempt(); 
    }
  });
}

function isUrlBlocked(targetUrl) {
  try {
    const urlObj = new URL(targetUrl);
    return focusState.blockedSites.some((site) => urlObj.hostname.includes(site));
  } catch (error) {
    return false;
  }
}
