import { getTodayKey } from "../../shared/utils/time-formatter.js";

/**
 * Daily Rhythm — same pattern as time-tracker & tab-counter:
 * analytics_YYYY-MM-DD = { ..., peakTabs, hourly, firstSeen, lastSeen }
 * - peakTabs: highest concurrent tab count for the day
 * - hourly: { 0..23: seconds } online time accumulated per hour
 * - firstSeen/lastSeen: first & last activity timestamps
 */

function ensureRhythmShape(todayData) {
  if (typeof todayData.peakTabs !== "number") todayData.peakTabs = 0;
  if (!todayData.hourly || typeof todayData.hourly !== "object") {
    todayData.hourly = {};
  }
  if (!("firstSeen" in todayData)) todayData.firstSeen = null;
  if (!("lastSeen" in todayData)) todayData.lastSeen = null;
  return todayData;
}

export async function recordHeartbeat() {
  const todayKey = getTodayKey();
  const now = Date.now();

  let tabCount = 0;
  try {
    const tabs = await chrome.tabs.query({});
    tabCount = tabs.length;
  } catch (e) {}

  const data = await chrome.storage.local.get(todayKey);
  const todayData = ensureRhythmShape(
    data[todayKey] || {
      totalTime: 0,
      domains: {},
      distractions: 0,
      tabsOpened: 0,
      tabsClosed: 0,
      peakTabs: 0,
      hourly: {},
      firstSeen: null,
      lastSeen: null,
    }
  );

  if (tabCount > todayData.peakTabs) todayData.peakTabs = tabCount;
  if (!todayData.firstSeen) todayData.firstSeen = now;
  todayData.lastSeen = now;

  await chrome.storage.local.set({ [todayKey]: todayData });
}

export function initActivityRhythm() {
  chrome.tabs.onCreated.addListener(() => {
    recordHeartbeat();
  });

  chrome.tabs.onRemoved.addListener(() => {
    recordHeartbeat();
  });

  chrome.tabs.onActivated.addListener(() => {
    recordHeartbeat();
  });

  chrome.alarms.create("rhythmPulse", { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "rhythmPulse") recordHeartbeat();
  });
}
