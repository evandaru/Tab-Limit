import { getTodayKey } from "../../shared/utils/time-formatter.js";

/**
 * Same daily structure as time-tracker:
 * analytics_YYYY-MM-DD = { totalTime, domains, distractions, tabsOpened, tabsClosed,
 *   peakTabs, hourly, firstSeen, lastSeen }
 * Plus global accumulators: allTimeTabsOpened, allTimeTabsClosed
 */

async function bumpTabCounter(field) {
  const todayKey = getTodayKey();
  const allTimeKey =
    field === "tabsOpened" ? "allTimeTabsOpened" : "allTimeTabsClosed";

  const data = await chrome.storage.local.get([todayKey, allTimeKey]);
  const todayData = data[todayKey] || {
    totalTime: 0,
    domains: {},
    distractions: 0,
    tabsOpened: 0,
    tabsClosed: 0,
    peakTabs: 0,
    hourly: {},
    firstSeen: null,
    lastSeen: null,
  };

  // Backward-compat: old data lacks tab/rhythm fields
  if (typeof todayData.tabsOpened !== "number") todayData.tabsOpened = 0;
  if (typeof todayData.tabsClosed !== "number") todayData.tabsClosed = 0;
  if (typeof todayData.peakTabs !== "number") todayData.peakTabs = 0;
  if (!todayData.hourly || typeof todayData.hourly !== "object") {
    todayData.hourly = {};
  }
  if (!("firstSeen" in todayData)) todayData.firstSeen = null;
  if (!("lastSeen" in todayData)) todayData.lastSeen = null;

  todayData[field] += 1;
  const allTimeVal = (data[allTimeKey] || 0) + 1;

  await chrome.storage.local.set({
    [todayKey]: todayData,
    [allTimeKey]: allTimeVal,
  });
}

export async function recordTabOpened() {
  await bumpTabCounter("tabsOpened");
}

export async function recordTabClosed() {
  await bumpTabCounter("tabsClosed");
}

export function initTabCounter() {
  chrome.tabs.onCreated.addListener(() => {
    recordTabOpened();
  });

  chrome.tabs.onRemoved.addListener(() => {
    recordTabClosed();
  });
}
