import { getTodayKey } from "../../shared/utils/time-formatter.js";

/**
 * Presence Engine — splits "tab open" time into active vs idle.
 * Fully event-driven via chrome.idle (no polling): when the OS reports
 * idle/locked we stamp idleSince; when it reports active again we bank
 * the elapsed seconds into today's idleSecs.
 * Same daily storage rhythm: analytics_YYYY-MM-DD = { ..., idleSecs, idleSince }
 */

function defaultDay() {
  return {
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
}

function ensurePresenceShape(todayData) {
  if (typeof todayData.idleSecs !== "number") todayData.idleSecs = 0;
  if (!("idleSince" in todayData)) todayData.idleSince = null;
  if (
    !todayData.distractionSites ||
    typeof todayData.distractionSites !== "object"
  ) {
    todayData.distractionSites = {};
  }
  return todayData;
}

export function initPresence() {
  try {
    chrome.idle.setDetectionInterval(60);
  } catch (e) {}

  chrome.idle.onStateChanged.addListener(async (state) => {
    const todayKey = getTodayKey();
    const data = await chrome.storage.local.get(todayKey);
    const todayData = ensurePresenceShape(data[todayKey] || defaultDay());

    if (state === "idle" || state === "locked") {
      if (!todayData.idleSince) todayData.idleSince = Date.now();
    } else if (state === "active") {
      if (todayData.idleSince) {
        const idleSecs = Math.floor((Date.now() - todayData.idleSince) / 1000);
        if (idleSecs > 0 && idleSecs < 86400) {
          todayData.idleSecs += idleSecs;
        }
        todayData.idleSince = null;
      }
    }

    await chrome.storage.local.set({ [todayKey]: todayData });
  });
}
