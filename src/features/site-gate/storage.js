// Storage + password hashing for the Protected Sites whitelist.
//
// Each entry holds a URL pattern, its own password (PBKDF2-SHA256, 250k rounds,
// random salt - the plaintext password is never stored), and the session rules
// derived from it.

const ENTRIES_KEY = "sg:entries";
const UNLOCKED_KEY = "sg:unlocked";

export const PBKDF2_ITERATIONS = 250000;

export async function listEntries() {
  const res = await chrome.storage.local.get(ENTRIES_KEY);
  return Array.isArray(res[ENTRIES_KEY]) ? res[ENTRIES_KEY] : [];
}

async function writeEntries(entries) {
  await chrome.storage.local.set({ [ENTRIES_KEY]: entries });
  return entries;
}

export function randomId(length = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const encoder = new TextEncoder();

function toBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    256,
  );
  return { salt: toBase64(salt), hash: toBase64(bits), iterations: PBKDF2_ITERATIONS };
}

async function derive(password, salt, iterations) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: Uint8Array.from(atob(salt), (c) => c.charCodeAt(0)), iterations, hash: "SHA-256" },
    material,
    256,
  );
  return toBase64(bits);
}

export async function verifyPassword(entry, password) {
  if (!password) return false;
  const candidate = await derive(password, entry.salt, entry.iterations);
  if (candidate.length !== entry.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i += 1) diff |= candidate.charCodeAt(i) ^ entry.hash.charCodeAt(i);
  return diff === 0;
}

// Patterns are written the way people think about them:
//   docs.google.com/spreadsheets/*    -> any sheet
//   app.notion.com                    -> whole site
//   app.notion.com/p/Getting-*        -> a section
export function patternToRegex(pattern) {
  const cleaned = (pattern || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (!cleaned) throw new Error("Pattern is empty.");
  if (/[\s?#]/.test(cleaned)) throw new Error("Pattern cannot contain spaces, ? or #.");

  const wildcard = cleaned.indexOf("*") >= 0;
  const escaped = cleaned.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  // A bare host (no "/") also matches every path under it.
  const source = cleaned.includes("/") || wildcard ? escaped : `${escaped}(?:/.*)?`;
  return `^https?://${source}`;
}

export function patternToFilter(pattern) {
  return patternToRegex(pattern);
}

export function matchesPattern(entry, url) {
  return new RegExp(patternToRegex(entry.pattern)).test(url);
}

export async function addEntry({ pattern, label, password, unlockMinutes = 30 }) {
  if (!password || password.length < 4) throw new Error("Password must be at least 4 characters.");
  const filter = patternToFilter(pattern); // validates the pattern early
  const credentials = await hashPassword(password);
  const entry = {
    id: randomId(),
    pattern: (pattern || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, ""),
    filter,
    label: (label || "").trim() || (pattern || "").trim(),
    unlockMinutes: Math.min(720, Math.max(1, Number(unlockMinutes) || 30)),
    enabled: true,
    createdAt: Date.now(),
    ...credentials,
  };
  return writeEntries([...(await listEntries()), entry]);
}

export async function updateEntry(id, patch) {
  const entries = await listEntries();
  const next = await Promise.all(
    entries.map(async (entry) => {
      if (entry.id !== id) return entry;
      const updated = { ...entry, ...patch };
      if (patch.password) {
        if (patch.password.length < 4) throw new Error("Password must be at least 4 characters.");
        Object.assign(updated, await hashPassword(patch.password));
        delete updated.password;
        // Password changed: drop any active session for this entry.
        await clearUnlock(id);
      }
      if (patch.pattern) {
        updated.pattern = (patch.pattern || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
        updated.filter = patternToFilter(updated.pattern);
      }
      if (patch.unlockMinutes !== undefined) {
        updated.unlockMinutes = Math.min(720, Math.max(1, Number(patch.unlockMinutes) || 30));
      }
      return updated;
    }),
  );
  return writeEntries(next);
}

export async function deleteEntry(id) {
  await clearUnlock(id);
  return writeEntries((await listEntries()).filter((entry) => entry.id !== id));
}

/* --------------------- unlocked sessions --------------------- */

export async function getUnlocked() {
  const res = await chrome.storage.local.get(UNLOCKED_KEY);
  const map = res[UNLOCKED_KEY] || {};
  const now = Date.now();
  const live = Object.fromEntries(Object.entries(map).filter(([, until]) => until > now));
  if (Object.keys(live).length !== Object.keys(map).length) {
    await chrome.storage.local.set({ [UNLOCKED_KEY]: live });
  }
  return live;
}

export async function isUnlocked(id) {
  const map = await getUnlocked();
  return Boolean(map[id]);
}

export async function markUnlocked(id, minutes) {
  const map = await getUnlocked();
  map[id] = Date.now() + minutes * 60000;
  await chrome.storage.local.set({ [UNLOCKED_KEY]: map });
  return map[id];
}

export async function clearUnlock(id) {
  const map = await getUnlocked();
  delete map[id];
  await chrome.storage.local.set({ [UNLOCKED_KEY]: map });
}

// Simple brute-force brake: the gate UI reads this before checking a password.
export async function registerFailure() {
  const now = Date.now();
  const res = await chrome.storage.local.get({ sgFails: 0, sgLockedUntil: 0 });
  const fails = (now - res.sgFails > 300000 ? 0 : res.sgFails) + 1;
  const lockedUntil = fails >= 5 ? now + 30000 : 0;
  await chrome.storage.local.set({ sgFails: fails, sgLockedUntil });
  return { fails, lockedUntil };
}

export async function clearFailures() {
  await chrome.storage.local.set({ sgFails: 0, sgLockedUntil: 0 });
}

export async function getGateCooldown() {
  const res = await chrome.storage.local.get({ sgLockedUntil: 0 });
  return res.sgLockedUntil;
}