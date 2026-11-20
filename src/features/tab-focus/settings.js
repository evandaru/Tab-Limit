// Shared Tab Focus switch.
//
// Tab Focus used to be installed as the new tab page override. `chrome_url_overrides`
// is not removable at runtime, so the switch could never truly turn the override
// off and every attempt to hand the tab back to the browser's own new tab page
// was fragile. The override is gone from the manifest now: Tab Focus is a normal
// extension page, and this switch only decides whether it is offered from the
// popup.

const FLAG = "tabFocusEnabled";

// Written to both areas: `sync` keeps the preference portable, `local` is a
// fast local read for the popup.
export function getTabFocusEnabled() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [FLAG]: undefined }, (localRes) => {
      if (localRes && localRes[FLAG] !== undefined) {
        resolve(!!localRes[FLAG]);
        return;
      }
      chrome.storage.sync.get({ [FLAG]: true }, (syncRes) => {
        resolve(!(syncRes && syncRes[FLAG] === false));
      });
    });
  });
}

export function setTabFocusEnabled(enabled) {
  const value = !!enabled;
  return Promise.all([
    new Promise((r) => chrome.storage.sync.set({ [FLAG]: value }, r)),
    new Promise((r) => chrome.storage.local.set({ [FLAG]: value }, r)),
  ]);
}
// ============================================================================
// ARCHIVED - NEW TAB OVERRIDE (disabled, kept here for reference)
//
// Tab Focus used to be registered as the new tab page override through
// `chrome_url_overrides.newtab` in manifest.json. That entry cannot be removed at
// runtime, so the switch could only be faked from inside the override page, and
// every hand-back attempt was blocked by some browser builds (error page, or a
// loop that kept opening replacement tabs).
//
// To bring the override back:
//   1. copy the `chrome_url_overrides` block from manifest.newtab-override.jsonc
//      into manifest.json,
//   2. uncomment the block below,
//   3. uncomment the archived boot/disabled-shell block in
//      src/entrypoints/newtab/index.js.
// ============================================================================

// The URL that lands the user on their browser's stock new tab page.
// export function getDefaultNtpUrl() {
//   const ua = navigator.userAgent || "";
//   if (/Firefox\/|Seamonkey\//.test(ua)) return "about:newtab";
//   if (/Edg\//.test(ua)) return "edge://newtab/";
//   if (/OPR\//.test(ua)) return "chrome://newtab/";
//   return "chrome://newtab/";
// }

// const isOwnPage = (url) =>
//   typeof url === "string" && url.startsWith(chrome.runtime.getURL(""));

// const HANDBACK_KEY = "ntHandbackAttempts";
// const SHARED_KEY = "ntHandbackAt";
// const SHARED_COUNT_KEY = "ntHandbackCount";
// const COOLDOWN_MS = 5000;
// const RESET_AFTER_MS = 60000;
// const MAX_ATTEMPTS = 3;

// export function resetHandbackAttempts() {
//   try {
//     sessionStorage.removeItem(HANDBACK_KEY);
//   } catch {
//     // sessionStorage unavailable
//   }
//   chrome.storage.local.set({ [SHARED_KEY]: 0, [SHARED_COUNT_KEY]: 0 });
// }

// async function claimAttempt() {
//   if (Number(sessionStorage.getItem(HANDBACK_KEY) || 0) >= 1) return false;

//   const res = await chrome.storage.local.get({
//     [SHARED_KEY]: 0,
//     [SHARED_COUNT_KEY]: 0,
//   });
//   const now = Date.now();
//   const last = res[SHARED_KEY] || 0;
//   const count = now - last > RESET_AFTER_MS ? 0 : res[SHARED_COUNT_KEY] || 0;

//   if (now - last < COOLDOWN_MS) return false;
//   if (count >= MAX_ATTEMPTS) return false;

//   try {
//     sessionStorage.setItem(HANDBACK_KEY, "1");
//   } catch {
//     // sessionStorage unavailable
//   }
//   await chrome.storage.local.set({ [SHARED_KEY]: now, [SHARED_COUNT_KEY]: count + 1 });
//   return true;
// }

// const currentTab = () =>
//   new Promise((resolve) => {
//     try {
//       chrome.tabs.getCurrent((tab) => resolve(tab || null));
//     } catch {
//       resolve(null);
//     }
//   });

// Hands the tab back to the browser's own new tab page by asking the browser
// for a fresh tab (no URL = the browser's new tab page) and closing this one.
// No `chrome://` string is involved: several builds reject those navigations
// from an extension and render an error page instead.
//
// Returns true when the caller must show its fallback UI.
// export async function handBackToDefaultNtp() {
//   const tab = await currentTab();
//   if (!tab) return true;
//   if (!(await claimAttempt())) return true;

//   try {
//     await chrome.tabs.create({
//       active: true,
//       windowId: tab.windowId,
//       index: tab.index + 1,
//     });
//   } catch {
//     return true;
//   }

//   try {
//     await chrome.tabs.remove(tab.id);
//   } catch {
//     return true; // this tab survived, so show the fallback UI
//   }

//   return false;
// }
