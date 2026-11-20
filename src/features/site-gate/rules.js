// DNR session rules for the Protected Sites whitelist.
//
// Each enabled entry becomes one session rule that redirects the main frame to
// the gate page. Unlocking an entry does not rewrite the URL or touch page
// scripts: its rule is simply lifted for the length of the session and put back
// on a timer, so browsing stays normal until the session expires.

import { listEntries, isUnlocked } from "./storage.js";

const GATE_PATH = "/src/entrypoints/gate/index.html";
const REARM_ALARM = "site-gate-rearm";

const ruleIdFor = (index) => 900000 + index;

// Deterministic ids keep the sync idempotent: index within the sorted entry list.
const ruleFor = (entry, index) => ({
  id: ruleIdFor(index),
  priority: 1,
  action: {
    type: "redirect",
    redirect: { extensionPath: `${GATE_PATH}?entry=${encodeURIComponent(entry.id)}` },
  },
  condition: {
    regexFilter: entry.filter,
    resourceTypes: ["main_frame"],
  },
});

export async function activeEntries() {
  const entries = await listEntries();
  const results = [];
  for (const entry of entries) {
    if (!entry.enabled) continue;
    if (await isUnlocked(entry.id)) continue;
    results.push(entry);
  }
  return results;
}

export async function syncRules() {
  const entries = await activeEntries();
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: await existingRuleIds(),
    addRules: entries.map(ruleFor),
  });
  return entries.length;
}

async function existingRuleIds() {
  const rules = await chrome.declarativeNetRequest.getSessionRules();
  return rules.filter((rule) => rule.id >= ruleIdFor(0)).map((rule) => rule.id);
}

// Lifts only this entry's rule for the length of the session, then re-arms.
export async function unlockEntry(id, minutes) {
  const entries = await listEntries();
  const index = entries.findIndex((entry) => entry.id === id);
  if (index < 0) return 0;
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [ruleIdFor(index)] });
  await chrome.alarms.create(REARM_ALARM, { delayInMinutes: minutes });
  return 1;
}

export function initSiteGateRules() {
  syncRules().catch((error) => console.error("[site-gate] rule sync failed", error));

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== REARM_ALARM) return;
    await syncRules();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes.sg_entries || changes.sg_unlocked) {
      syncRules().catch((error) => console.error("[site-gate] rule sync failed", error));
    }
  });
}