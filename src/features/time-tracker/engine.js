import { getTodayKey } from "../../shared/utils/time-formatter.js";
import { getHostname } from "../../shared/utils/url-validator.js";

let activeSession = { domain: null, startTime: null, tabId: null };

export async function recordDistractionAttempt(blockedUrl) {
  const todayKey = getTodayKey();
  const data = await chrome.storage.local.get(todayKey);
  const todayData = data[todayKey] || {
    totalTime: 0,
    domains: {},
    distractions: 0,
    distractionSites: {},
    tabsOpened: 0,
    tabsClosed: 0,
    peakTabs: 0,
    hourly: {},
    firstSeen: null,
    lastSeen: null,
    idleSecs: 0,
    idleSince: null,
  };
  todayData.distractions += 1;
  if (blockedUrl) {
    const host = getHostname(blockedUrl);
    if (host) {
      if (!todayData.distractionSites || typeof todayData.distractionSites !== "object") {
        todayData.distractionSites = {};
      }
      todayData.distractionSites[host] = (todayData.distractionSites[host] || 0) + 1;
    }
  }
  await chrome.storage.local.set({ [todayKey]: todayData });
}

async function commitSessionTime() {
  if (!activeSession.domain || !activeSession.startTime) return;

  const now = Date.now();
  const durationSecs = Math.floor((now - activeSession.startTime) / 1000);

  if (durationSecs > 0 && durationSecs < 86400) {
    const todayKey = getTodayKey();
    const data = await chrome.storage.local.get([todayKey, "allTimeTotal"]);

    const todayData = data[todayKey] || {
      totalTime: 0,
      domains: {},
      distractions: 0,
      distractionSites: {},
      tabsOpened: 0,
      tabsClosed: 0,
      peakTabs: 0,
      hourly: {},
      firstSeen: null,
      lastSeen: null,
      idleSecs: 0,
      idleSince: null,
    };
    const allTimeTotal = (data.allTimeTotal || 0) + durationSecs;

    todayData.totalTime += durationSecs;
    todayData.domains[activeSession.domain] =
      (todayData.domains[activeSession.domain] || 0) + durationSecs;

    // Rhythm: split the duration into the current hour + record first/last seen
    if (!todayData.hourly || typeof todayData.hourly !== "object") {
      todayData.hourly = {};
    }
    const hour = new Date(now).getHours();
    todayData.hourly[hour] = (todayData.hourly[hour] || 0) + durationSecs;
    if (!todayData.firstSeen) todayData.firstSeen = activeSession.startTime;
    todayData.lastSeen = now;

    await chrome.storage.local.set({
      [todayKey]: todayData,
      allTimeTotal: allTimeTotal,
    });
  }
  activeSession.startTime = Date.now();
}

export function initTimeTracker() {
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    await commitSessionTime();
    activeSession.tabId = activeInfo.tabId;
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      const domain = getHostname(tab.url);
      activeSession.domain = domain;
      activeSession.startTime = domain ? Date.now() : null;
    } catch (e) {}
  });

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (tabId === activeSession.tabId && changeInfo.url) {
      await commitSessionTime();
      const domain = getHostname(changeInfo.url);
      activeSession.domain = domain;
      activeSession.startTime = domain ? Date.now() : null;
    }
  });

  chrome.windows.onFocusChanged.addListener(async (windowId) => {
    await commitSessionTime();
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      activeSession.domain = null;
      activeSession.startTime = null;
    } else {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          windowId: windowId,
        });
        if (tab) {
          activeSession.tabId = tab.id;
          const domain = getHostname(tab.url);
          activeSession.domain = domain;
          activeSession.startTime = domain ? Date.now() : null;
        }
      } catch (e) {}
    }
  });

  chrome.alarms.create("syncTracker", { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "syncTracker") commitSessionTime();
  });
}
