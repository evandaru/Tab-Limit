// Storage layer for Secure Pages.
//
// One index entry per page (id, title, lock state, timestamps) lives under a
// single key so the sidebar loads in one read; the encrypted body of each page
// lives under its own key. Content never touches disk unencrypted.

import {
  newDeviceBox,
  newPasswordBox,
  reseal,
  seal,
  unseal,
  importAesKey,
  deriveKey,
  fromBase64,
  randomId,
  exportPackage,
} from "./crypto.js";

const INDEX_KEY = "sp:index";
const pageKey = (id) => `sp:page:${id}`;

const storageGet = (key) => chrome.storage.local.get(key);
const storageSet = (key, value) => chrome.storage.local.set({ [key]: value });

async function readIndex() {
  const res = await storageGet(INDEX_KEY);
  return Array.isArray(res[INDEX_KEY]) ? res[INDEX_KEY] : [];
}

async function writeIndex(index) {
  await storageSet(INDEX_KEY, index);
  return index;
}

export async function listPages() {
  const index = await readIndex();
  return index.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getPage(id) {
  const res = await storageGet(pageKey(id));
  return res[pageKey(id)] || null;
}

function emptyContent(title, mode, link) {
  return {
    title,
    mode,
    note: "",
    table: { columns: ["Column 1", "Column 2", "Column 3"], rows: [["", "", ""]] },
    link: { url: link || "", note: "", embed: true },
    updatedAt: Date.now(),
  };
}

export async function createPage({
  title,
  mode = "note",
  password = "",
  link = "",
  hideTitle = false,
}) {
  const id = randomId(10);
  const content = emptyContent(title, mode, link);
  const box = password ? newPasswordBox(password) : newDeviceBox();
  const sealed = await reseal(null, box, password || null, content);

  const meta = {
    id,
    title,
    hideTitle,
    mode,
    locked: Boolean(password),
    hasPassword: Boolean(password),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await storageSet(pageKey(id), { id, meta, box: sealed.box, pkg: sealed.pkg });
  await writeIndex([...(await readIndex()), meta]);
  return { id, meta };
}

async function patchIndex(id, patch) {
  const index = await readIndex();
  const next = index.map((m) => (m.id === id ? { ...m, ...patch } : m));
  return writeIndex(next);
}

// Unlocks a page and returns its decrypted content plus the in-memory key used
// for later saves.
export async function unlockPage(record, password) {
  if (record.box.mode === "password") {
    if (!password) throw new Error("Password required.");
    const key = await deriveKey(password, fromBase64(record.box.salt), record.box.iterations);
    const content = await unseal(key, record.pkg);
    return { content, key };
  }
  const key = await importAesKey(fromBase64(record.box.key));
  const content = await unseal(key, record.pkg);
  return { content, key };
}

export async function saveContent(id, content, key) {
  const record = await getPage(id);
  if (!record) throw new Error("Page not found.");
  const next = { ...content, updatedAt: Date.now() };
  const pkg = await seal(key, next);
  const meta = { ...record.meta, title: next.title || record.meta.title, updatedAt: Date.now() };
  await storageSet(pageKey(id), { ...record, meta, pkg });
  await patchIndex(id, {
    title: meta.title,
    updatedAt: meta.updatedAt,
    mode: next.mode,
  });
  return { content: next, meta };
}

export async function updateMeta(id, patch) {
  const record = await getPage(id);
  if (!record) throw new Error("Page not found.");
  const meta = { ...record.meta, ...patch };
  await storageSet(pageKey(id), { ...record, meta });
  await patchIndex(id, patch);
  return meta;
}

// Adds, changes, or removes the page password. The page is re-encrypted with
// the new credentials, so the old password stops working immediately.
export async function setPassword(id, content, key, newPassword) {
  const record = await getPage(id);
  if (!record) throw new Error("Page not found.");
  const box = newPassword ? newPasswordBox(newPassword) : newDeviceBox();
  const sealed = await reseal(record.pkg, box, newPassword || null, content);
  const meta = {
    ...record.meta,
    hasPassword: Boolean(newPassword),
    locked: Boolean(newPassword),
    updatedAt: Date.now(),
  };
  await storageSet(pageKey(id), { id, meta, box: sealed.box, pkg: sealed.pkg });
  await patchIndex(id, { hasPassword: meta.hasPassword, locked: meta.locked, updatedAt: meta.updatedAt });
  return { record: { id, meta, box: sealed.box, pkg: sealed.pkg }, key: sealed.key };
}

export async function deletePage(id) {
  await chrome.storage.local.remove(pageKey(id));
  await writeIndex((await readIndex()).filter((m) => m.id !== id));
}

// Writes an encrypted .vault file. Pages that already have a password export
// with their own credentials; pages without one are re-sealed under the given
// export password so the file is never readable in plain text.
export async function exportPage(id, exportPassword) {
  const record = await getPage(id);
  if (!record) throw new Error("Page not found.");
  if (!record.meta.hasPassword && !exportPassword) {
    throw new Error("EXPORT_PASSWORD_REQUIRED");
  }

  let { box, pkg } = record;
  if (box.mode !== "password") {
    const key = await importAesKey(fromBase64(box.key));
    const content = await unseal(key, pkg);
    const newBox = newPasswordBox(exportPassword);
    const sealed = await reseal(null, newBox, exportPassword, content);
    box = sealed.box;
    pkg = sealed.pkg;
  }

  const text = await exportPackage(box, pkg, {
    title: record.meta.title,
    mode: record.meta.mode,
    hasPassword: true,
  });

  const slug =
    (record.meta.title || "page")
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-") || "page";
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}.vault`;
  a.click();
  URL.revokeObjectURL(url);
  return `${slug}.vault`;
}

// Restores an exported file as a new page. Password-protected files are
// re-sealed under the password the user just typed, so nothing but the
// ciphertext and the user's own key ever hits storage.
export async function importPackageIntoPage(unlocked, meta, password = "") {
  const usePassword = Boolean(meta?.hasPassword);
  if (usePassword && !password) throw new Error("Password required for this file.");

  const id = randomId(10);
  const box = usePassword ? newPasswordBox(password) : newDeviceBox();
  const sealed = await reseal(null, box, usePassword ? password : null, unlocked.content);
  const pageMeta = {
    id,
    title: unlocked.content.title || meta?.title || "Imported page",
    hideTitle: false,
    mode: unlocked.content.mode || meta?.mode || "note",
    locked: usePassword,
    hasPassword: usePassword,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await storageSet(pageKey(id), { id, meta: pageMeta, box: sealed.box, pkg: sealed.pkg });
  await writeIndex([...(await readIndex()), pageMeta]);
  return id;
}