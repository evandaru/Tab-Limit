// Password-based encryption for Secure Pages.
//
// A page's content is never stored in plain text: it is sealed with AES-GCM
// using a key derived from the page password (PBKDF2-SHA256). The stored
// record only carries salt + iv + ciphertext, so reading the extension's
// storage gives nothing away without the password.
//
// Pages created without a password still get encrypted, but with a random
// per-page key ("device mode") so the same code path and the same at-rest
// guarantee apply.

const PBKDF2_ITERATIONS = 250000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function randomId(length = 12) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return toBase64Url(bytes);
}

export function toBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function fromBase64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function toBase64Url(bytes) {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomKey() {
  return crypto.getRandomValues(new Uint8Array(32));
}

export async function deriveKey(password, salt, iterations = PBKDF2_ITERATIONS) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function importAesKey(rawBytes) {
  return crypto.subtle.importKey("raw", rawBytes, { name: "AES-GCM" }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function seal(key, payload) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return { iv: toBase64(iv), data: toBase64(new Uint8Array(ciphertext)) };
}

// Throws if the key or the password is wrong - that failure is what doubles as
// the password check.
export async function unseal(key, pkg) {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(pkg.iv) },
    key,
    fromBase64(pkg.data),
  );
  return JSON.parse(decoder.decode(plaintext));
}

export function newPasswordBox(password) {
  return {
    mode: "password",
    salt: toBase64(crypto.getRandomValues(new Uint8Array(16))),
    iterations: PBKDF2_ITERATIONS,
  };
}

export function newDeviceBox() {
  return { mode: "device", key: toBase64(randomKey()) };
}

// Re-encrypt a sealed payload under a new password (or under a fresh device
// key when `password` is null).
export async function reseal(_pkg, newBox, password, payload) {
  let key;
  if (newBox.mode === "password") {
    key = await deriveKey(password, fromBase64(newBox.salt), newBox.iterations);
  } else {
    key = await importAesKey(fromBase64(newBox.key));
  }
  return { box: newBox, pkg: await seal(key, payload), key };
}

// Encrypted export file: everything the other device needs, nothing readable.
export async function exportPackage(box, pkg, meta) {
  return JSON.stringify(
    { format: "secure-page", version: 1, meta, box, pkg },
    null,
    2,
  );
}

export async function importPackage(text, password) {
  const parsed = JSON.parse(text);
  if (parsed.format !== "secure-page") {
    throw new Error("Not a Secure Pages export file.");
  }
  const box = parsed.box;
  let key;
  if (box.mode === "password") {
    key = await deriveKey(password, fromBase64(box.salt), box.iterations);
  } else {
    key = await importAesKey(fromBase64(box.key));
  }
  const content = await unseal(key, parsed.pkg);
  return { content, meta: parsed.meta || {} };
}

export function formatDate(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }) +
    " " +
    d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}