// Background glue for the Protected Sites gate.
//
// Chrome extensions cannot block a navigation from a web page, so the redirect
// itself is done by a declarativeNetRequest session rule. What the background is
// needed for is everything around it: remembering the URL the tab was heading to
// (the gate page cannot recover it once the redirect happened), verifying
// passwords, and lifting rules for the length of an unlocked session.

import {
  listEntries,
  verifyPassword,
  markUnlocked,
  isUnlocked,
  registerFailure,
  clearFailures,
  getGateCooldown,
} from "./storage.js";
import { syncRules, unlockEntry, initSiteGateRules } from "./rules.js";

const PENDING_TTL_MS = 60000;
const pending = new Map(); // tabId -> { url, at }

function rememberPending(details) {
  if (details.tabId < 0) return;
  pending.set(details.tabId, { url: details.url, at: Date.now() });
}

function consumePending(tabId) {
  const record = pending.get(tabId);
  pending.delete(tabId);
  if (!record || Date.now() - record.at > PENDING_TTL_MS) return null;
  return record.url;
}

function initPendingTracking() {
  chrome.webRequest.onBeforeRequest.addListener(
    rememberPending,
    { urls: ["http://*/*", "https://*/*"], types: ["main_frame"] },
    ["requestBody"],
  );

  chrome.tabs.onRemoved.addListener((tabId) => pending.delete(tabId));
}

async function handleMessage(message, sender) {
  switch (message?.type) {
    case "gate:context": {
      const entries = await listEntries();
      const entry = entries.find((item) => item.id === message.entryId) || null;
      const tabId = sender.tab?.id;
      const targetUrl = message.targetUrl || consumePending(tabId);
      const cooldown = await getGateCooldown();
      return {
        label: entry?.label || "",
        pattern: entry?.pattern || "",
        hasPassword: Boolean(entry),
        alreadyUnlocked: entry ? await isUnlocked(entry.id) : false,
        cooldown,
        targetUrl,
        tabId,
      };
    }

    case "gate:attempt": {
      const entries = await listEntries();
      const entry = entries.find((item) => item.id === message.entryId);
      if (!entry) return { ok: false, error: "This whitelist entry no longer exists." };

      const cooldown = await getGateCooldown();
      if (cooldown > Date.now()) {
        return { ok: false, error: "Too many wrong attempts. Wait a moment." };
      }

      const ok = await verifyPassword(entry, message.password);
      if (!ok) {
        await registerFailure();
        return { ok: false, error: "Wrong password." };
      }

      await clearFailures();
      await markUnlocked(entry.id, entry.unlockMinutes);
      await unlockEntry(entry.id, entry.unlockMinutes);
      await syncRules();
      return { ok: true, minutes: entry.unlockMinutes };
    }

    case "gate:resync":
      return { count: await syncRules() };

    default:
      return null;
  }
}

export function initSiteGate() {
  initSiteGateRules();
  initPendingTracking();
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));
    return true; // async response
  });
}