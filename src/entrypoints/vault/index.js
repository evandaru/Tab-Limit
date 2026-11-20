import {
  listPages,
  getPage,
  createPage,
  unlockPage,
  saveContent,
  updateMeta,
  setPassword,
  deletePage,
  exportPage,
  importPackageIntoPage,
} from "../../features/secure-pages/storage.js";
import { importPackage, formatDate } from "../../features/secure-pages/crypto.js";
import { renderMarkdown } from "../../features/secure-pages/markdown.js";
import {
  delimitedToTable,
  tableToDelimited,
  toEmbedUrl,
} from "../../features/secure-pages/parse.js";

const AUTO_LOCK_MS = 15 * 60 * 1000;

// Only plain http(s) targets are accepted: a stored link must never be able to
// run script (javascript:, data:, ...) when the recipient opens it.
const ALLOWED_LINK_HOSTS = new Set([
  "docs.google.com",
  "sheets.google.com",
  "drive.google.com",
  "docs.googleusercontent.com",
]);

export function sanitizeLinkUrl(raw) {
  const value = (raw || "").trim();
  if (!value) return "";
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Link is not valid.");
  }
  if (url.protocol !== "https:") throw new Error("Only https links are allowed.");
  if (!ALLOWED_LINK_HOSTS.has(url.hostname)) {
    throw new Error(
      `Only Google Sheets/Drive links are allowed (${[...ALLOWED_LINK_HOSTS].join(", ")}).`,
    );
  }
  return url.toString();
}

const state = {
  pages: [],
  currentId: null,
  content: null,
  key: null, // in-memory only, dropped on lock
  mode: "note",
  link: { url: "", note: "", embed: true },
  preview: false,
  dirty: false,
  saveTimer: null,
  idleTimer: null,
  filter: "",
  pendingImport: null,
};

const $ = (id) => document.getElementById(id);

const els = {
  pageList: $("pageList"),
  search: $("searchInput"),
  emptyState: $("emptyState"),
  lockScreen: $("lockScreen"),
  lockTitle: $("lockTitle"),
  lockSub: $("lockSub"),
  lockForm: $("lockForm"),
  lockPassword: $("lockPassword"),
  lockError: $("lockError"),
  editor: $("editor"),
  pageTitle: $("pageTitle"),
  metaUpdated: $("metaUpdated"),
  metaLock: $("metaLock"),
  noteArea: $("noteArea"),
  previewPane: $("previewPane"),
  tablePane: $("tablePane"),
  grid: $("grid"),
  linkPane: $("linkPane"),
  linkUrl: $("linkUrl"),
  linkNote: $("linkNote"),
  linkHost: $("linkHost"),
  linkFrame: $("linkFrame"),
  saveStatus: $("saveStatus"),
  toast: $("toast"),
};

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function resetIdleTimer() {
  clearTimeout(state.idleTimer);
  state.idleTimer = setTimeout(() => {
    if (state.currentId) {
      lockCurrent("Locked automatically after 15 minutes of inactivity.");
    }
  }, AUTO_LOCK_MS);
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

async function refreshList() {
  state.pages = await listPages();
  const term = state.filter.trim().toLowerCase();
  const visible = state.pages.filter((meta) => {
    if (!term) return true;
    const title = meta.hideTitle ? "" : meta.title;
    return title.toLowerCase().includes(term);
  });

  els.pageList.innerHTML = "";
  if (!visible.length) {
    els.pageList.innerHTML = `<div style="padding:14px;color:var(--text-muted);font-size:12.5px;">${
      term ? "No page matches that search." : "No pages yet. Create one with + New page."
    }</div>`;
    return;
  }

  for (const meta of visible) {
    const item = document.createElement("div");
    item.className = "page-item" + (meta.id === state.currentId ? " active" : "");
    const title = meta.hideTitle && meta.locked ? "🔒 Locked page" : meta.title || "Untitled";
    item.innerHTML = `
      <span class="icon">${meta.locked ? "🔒" : meta.mode === "table" ? "📊" : meta.mode === "link" ? "🔗" : "📝"}</span>
      <span style="min-width:0">
        <span class="name">${escapeText(title)}</span>
        <span class="sub">${formatDate(meta.updatedAt)}</span>
      </span>`;
    item.addEventListener("click", () => openPage(meta.id));
    els.pageList.appendChild(item);
  }
}

function escapeText(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

/* ------------------------------------------------------------------ */
/* View switching                                                      */
/* ------------------------------------------------------------------ */

function showView(name) {
  els.emptyState.classList.toggle("hidden", name !== "empty");
  els.lockScreen.classList.toggle("hidden", name !== "lock");
  els.editor.classList.toggle("hidden", name !== "editor");
}

function currentMeta() {
  return state.pages.find((m) => m.id === state.currentId) || null;
}

async function openPage(id) {
  if (state.dirty) await flushSave();
  state.currentId = id;
  state.content = null;
  state.key = null;
  await refreshList();

  const record = await getPage(id);
  if (!record) {
    showView("empty");
    return;
  }
  const meta = record.meta;

  if (meta.locked) {
    els.lockTitle.textContent = meta.hideTitle ? "Locked page" : meta.title;
    els.lockSub.textContent = "This page is encrypted. Enter its password to open it.";
    els.lockPassword.value = "";
    els.lockError.textContent = "";
    els.lockPassword.focus();
    showView("lock");
    return;
  }

  await doUnlock(record, "");
}

async function doUnlock(record, password) {
  try {
    const { content, key } = await unlockPage(record, password);
    state.content = content;
    state.key = key;
    state.mode = content.mode || "note";
    state.dirty = false;
    loadEditor();
    showView("editor");
    resetIdleTimer();
  } catch {
    els.lockError.textContent = "Wrong password.";
    els.lockPassword.select();
  }
}

function lockCurrent(message) {
  flushSave().catch(() => {});
  state.key = null;
  state.content = null;
  state.dirty = false;
  els.noteArea.value = "";
  els.grid.innerHTML = "";
  clearTimeout(state.idleTimer);

  const meta = currentMeta();
  if (meta) {
    els.lockTitle.textContent = meta.hideTitle ? "Locked page" : meta.title;
    els.lockSub.textContent = "This page is encrypted. Enter its password to open it.";
    els.lockPassword.value = "";
    els.lockError.textContent = "";
    showView("lock");
  } else {
    showView("empty");
  }
  refreshList();
  if (message) toast(message);
}

function loadEditor() {
  const content = state.content;
  els.pageTitle.value = content.title || "";
  els.noteArea.value = content.note || "";
  els.linkUrl.value = content.link?.url || "";
  els.linkNote.value = content.link?.note || "";
  els.metaUpdated.textContent = "Updated " + formatDate(content.updatedAt || Date.now());
  const meta = currentMeta();
  els.metaLock.textContent = meta?.hasPassword ? "🔑 Password protected" : "🔓 No password (this device only)";
  document.querySelectorAll(".mode-tabs button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === state.mode);
  });
  renderMode();
  els.saveStatus.textContent = "";
}

function renderMode() {
  els.noteArea.closest("#notePane").classList.toggle("hidden", state.mode !== "note");
  els.tablePane.classList.toggle("hidden", state.mode !== "table");
  els.linkPane.classList.toggle("hidden", state.mode !== "link");
  els.previewPane.classList.toggle("hidden", !(state.mode === "note" && state.preview));
  els.noteArea.classList.toggle("hidden", state.mode === "note" && state.preview);
  updateToolbarVisibility();
  if (state.preview) els.previewPane.innerHTML = renderMarkdown(els.noteArea.value);
  if (state.mode === "table") renderGrid();
  if (state.mode === "link") renderLink();
}

function updateToolbarVisibility() {
  const tableMode = state.mode === "table";
  ["addRowBtn", "addColBtn", "csvImportBtn", "csvExportBtn"].forEach((id) => {
    $(id).classList.toggle("hidden", !tableMode);
  });
  ["boldBtn", "italicBtn", "codeBtn", "h2Btn", "ulBtn", "todoBtn", "previewBtn"].forEach((id) => {
    $(id).classList.toggle("hidden", state.mode !== "note");
  });
}

/* ---------------------------- Link ---------------------------- */

function renderLink() {
  const link = state.content?.link || { url: "", note: "", embed: true };
  els.linkUrl.value = link.url || "";
  els.linkNote.value = link.note || "";
  els.linkHost.textContent = link.url ? new URL(link.url).hostname : "";
  const frameable = isFrameable(link.url);
  els.linkPreviewBtn.disabled = !frameable;
  els.linkPreviewBtn.title = frameable
    ? "Preview di dalam halaman ini"
    : "Preview only supports published sheets (/publish?output=embed)";
  els.linkFrame.hidden = true;
  els.linkFrame.src = "";
  els.linkOpenBtn.disabled = !link.url;
}

function isFrameable(url) {
  if (!url) return false;
  try {
    return new URL(url).hostname.endsWith("google.com");
  } catch {
    return false;
  }
}

async function openLinkTarget() {
  const url = safeLinkFromEditor();
  if (!url) {
    toast("Isi link tujuan dulu.");
    return;
  }
  await chrome.tabs.create({ url });
}

function toggleLinkPreview() {
  const url = safeLinkFromEditor();
  if (!url) {
    toast("Isi link tujuan dulu.");
    return;
  }
  if (!els.linkFrame.hidden) {
    els.linkFrame.hidden = true;
    els.linkFrame.src = "";
    return;
  }
  els.linkFrame.src = toEmbedUrl(url);
  els.linkFrame.hidden = false;
}

function safeLinkFromEditor() {
  try {
    return sanitizeLinkUrl(els.linkUrl.value);
  } catch (err) {
    toast(err.message);
    return "";
  }
}

/* ------------------------------------------------------------------ */
/* Editor <-> content                                                  */
/* ------------------------------------------------------------------ */

function readContentFromEditor() {
  const content = { ...(state.content || {}) };
  content.title = els.pageTitle.value.trim() || "Untitled";
  content.mode = state.mode;
  content.note = els.noteArea.value;
  content.table = currentTable();
  content.link = {
    url: state.mode === "link" ? els.linkUrl.value.trim() : state.content?.link?.url || "",
    note: state.mode === "link" ? els.linkNote.value : state.content?.link?.note || "",
    embed: state.content?.link?.embed ?? true,
  };
  content.updatedAt = Date.now();
  return content;
}

function markDirty() {
  state.dirty = true;
  els.saveStatus.textContent = "Unsaved changes…";
  scheduleSave();
  resetIdleTimer();
}

function scheduleSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => flushSave().catch(() => {}), 700);
}

async function flushSave() {
  clearTimeout(state.saveTimer);
  if (!state.dirty || !state.currentId || !state.key) return;
  state.dirty = false;
  const content = readContentFromEditor();
  const result = await saveContent(state.currentId, content, state.key);
  state.content = result.content;
  els.metaUpdated.textContent = "Updated " + formatDate(result.content.updatedAt);
  els.saveStatus.textContent = "Saved " + new Date().toLocaleTimeString("id-ID");
  await refreshList();
}

/* ---------------------------- Notes ---------------------------- */

function wrapSelection(before, after = before) {
  const area = els.noteArea;
  const start = area.selectionStart;
  const end = area.selectionEnd;
  const selected = area.value.slice(start, end);
  area.setRangeText(before + selected + after, start, end, "select");
  area.focus();
  markDirty();
}

function prefixLine(prefix) {
  const area = els.noteArea;
  const start = area.selectionStart;
  const lineStart = area.value.lastIndexOf("\n", start - 1) + 1;
  area.setRangeText(prefix, lineStart, lineStart, "end");
  area.focus();
  markDirty();
}

/* ---------------------------- Sheet ---------------------------- */

function renderGrid() {
  const table = currentTable();
  els.grid.innerHTML = "";

  const head = document.createElement("tr");
  head.appendChild(document.createElement("th"));
  table.columns.forEach((name, c) => {
    const th = document.createElement("th");
    const input = document.createElement("input");
    input.type = "text";
    input.value = name;
    input.addEventListener("input", () => {
      table.columns[c] = input.value;
      markDirty();
    });
    th.appendChild(input);
    head.appendChild(th);
  });
  els.grid.appendChild(head);

  table.rows.forEach((row, r) => {
    const tr = document.createElement("tr");
    const rowHead = document.createElement("td");
    rowHead.className = "rowhead";
    rowHead.textContent = String(r + 1);
    tr.appendChild(rowHead);

    table.columns.forEach((_, c) => {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "text";
      input.value = row[c] ?? "";
      input.dataset.row = String(r);
      input.dataset.col = String(c);
      input.addEventListener("input", () => {
        table.rows[r][c] = input.value;
        markDirty();
      });
      input.addEventListener("keydown", onGridKeydown);
      td.appendChild(input);
      tr.appendChild(td);
    });
    els.grid.appendChild(tr);
  });
}

function onGridKeydown(event) {
  const input = event.currentTarget;
  if (event.key === "Tab") {
    event.preventDefault();
    const cells = [...els.grid.querySelectorAll("input[data-row]")];
    const index = cells.indexOf(input);
    const next = cells[index + (event.shiftKey ? -1 : 1)];
    if (next) next.focus();
  }
  if (event.key === "Enter") {
    event.preventDefault();
    const cells = [...els.grid.querySelectorAll("input[data-row]")];
    const index = cells.indexOf(input);
    const columns = state.content.table.columns.length;
    const target = cells[index + columns];
    if (target) target.focus();
  }
}

function currentTable() {
  if (!state.content) state.content = { title: "", mode: state.mode, note: "", table: null };
  if (!state.content.table) {
    state.content.table = { columns: ["Column 1", "Column 2"], rows: [["", ""]] };
  }
  return state.content.table;
}

function addRow() {
  const table = currentTable();
  table.rows.push(table.columns.map(() => ""));
  markDirty();
  renderGrid();
}

function addColumn() {
  const table = currentTable();
  table.columns.push(`Column ${table.columns.length + 1}`);
  table.rows.forEach((row) => row.push(""));
  markDirty();
  renderGrid();
}

function exportCsv() {
  const table = currentTable();
  const blob = new Blob([tableToDelimited(table)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${
    (els.pageTitle.value || "sheet")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || "sheet"
  }.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

async function newPage() {
  $("newTitle").value = "";
  $("newLinkUrl").value = "";
  $("newPassword").value = "";
  $("newHideTitle").checked = false;
  $("newMode").value = "link";
  $("newPageError").textContent = "";
  $("newLinkField").classList.remove("hidden");
  $("newPageDialog").showModal();
  $("newTitle").focus();
}

function syncNewPageMode() {
  $("newLinkField").classList.toggle("hidden", $("newMode").value !== "link");
}

async function submitNewPage(event) {
  event.preventDefault();
  const error = $("newPageError");
  const title = $("newTitle").value.trim();
  const mode = $("newMode").value;
  const password = $("newPassword").value;

  if (title.length < 2) {
    error.textContent = "Title is too short.";
    return;
  }
  if (password && password.length < 4) {
    error.textContent = "Use at least 4 characters.";
    return;
  }

  let link = "";
  if (mode === "link") {
    try {
      link = sanitizeLinkUrl($("newLinkUrl").value);
    } catch (err) {
      error.textContent = err.message;
      return;
    }
  }

  const { id } = await createPage({
    title,
    mode,
    password,
    link,
    hideTitle: $("newHideTitle").checked,
  });
  $("newPageDialog").close();
  state.pages = await listPages();
  await openPage(id);
  toast(password ? "Page dibuat dan dikunci password." : "Page dibuat (tanpa password).");
}

/* ---------------------------- CSV import ---------------------------- */

function openCsvImport() {
  $("csvText").value = "";
  $("importCsvError").textContent = "";
  $("importCsvDialog").showModal();
}

function submitCsvImport(event) {
  event.preventDefault();
  const text = $("csvText").value.trim();
  const error = $("importCsvError");
  if (!text) {
    error.textContent = "Paste the data first.";
    return;
  }
  const table = delimitedToTable(text);
  if (!table) {
    error.textContent = "No data found.";
    return;
  }

  state.content = {
    ...(state.content || {}),
    mode: "table",
    table,
  };
  state.mode = "table";
  document.querySelectorAll(".mode-tabs button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === "table");
  });
  $("importCsvDialog").close();
  renderMode();
  markDirty();
  toast(`Imported ${table.rows.length} baris x ${table.columns.length} kolom.`);
}

async function changePassword() {
  const meta = currentMeta();
  if (!meta) return;
  $("passwordDialogTitle").textContent = meta.hasPassword ? "Change page password" : "Set page password";
  $("pwdCurrent").value = "";
  $("pwdNew").value = "";
  $("pwdConfirm").value = "";
  $("pwdHideTitle").checked = Boolean(meta.hideTitle);
  $("passwordError").textContent = "";
  $("passwordDialog").showModal();
}

async function submitPassword(event) {
  event.preventDefault();
  const current = $("pwdCurrent").value;
  const next = $("pwdNew").value;
  const confirmPwd = $("pwdConfirm").value;
  const error = $("passwordError");
  const meta = currentMeta();

  if (next !== confirmPwd) {
    error.textContent = "New password does not match.";
    return;
  }
  if (meta.hasPassword && !current) {
    error.textContent = "Current password required.";
    return;
  }
  if (next && next.length < 4) {
    error.textContent = "Use at least 4 characters.";
    return;
  }

  try {
    const record = await getPage(state.currentId);
    let content = state.content;
    let key = state.key;

    // No in-memory key means the page is still locked: unlock it first with the
    // current password so it can be re-sealed under the new one.
    if (!key) {
      if (!current) {
        error.textContent = "Current password required.";
        return;
      }
      const unlocked = await unlockPage(record, current);
      content = unlocked.content;
      key = unlocked.key;
      state.content = content;
    }

    const result = await setPassword(state.currentId, readContentFromEditor(), key, next);
    state.content = content;
    state.key = result.key;
    await updateMeta(state.currentId, { hideTitle: $("pwdHideTitle").checked });
    state.pages = await listPages();
    loadEditor();
    await refreshList();
    $("passwordDialog").close();
    toast(next ? "Password updated." : "Password removed.");
  } catch {
    error.textContent = "Wrong current password.";
  }
}

async function copyShareLink() {
  const link = `${chrome.runtime.getURL("src/entrypoints/vault/index.html")}?page=${state.currentId}`;
  await navigator.clipboard.writeText(link);
  toast("Link copied. Paste it in a chat or doc.");
}

async function doExport() {
  const meta = currentMeta();
  if (meta?.hasPassword) {
    try {
      const filename = await exportPage(state.currentId, "");
      toast(`Exported ${filename} (encrypted).`);
    } catch (err) {
      if (err.message === "EXPORT_PASSWORD_REQUIRED") return;
      toast("Export failed.");
    }
    return;
  }
  $("exportPwd").value = "";
  $("exportError").textContent = "";
  $("exportDialog").showModal();
}

async function submitExport(event) {
  event.preventDefault();
  const pwd = $("exportPwd").value;
  if (pwd.length < 4) {
    $("exportError").textContent = "Use at least 4 characters.";
    return;
  }
  try {
    const filename = await exportPage(state.currentId, pwd);
    $("exportDialog").close();
    toast(`Exported ${filename} (encrypted).`);
  } catch {
    $("exportError").textContent = "Export failed.";
  }
}

function requestImport() {
  $("importFile").click();
}

async function onImportFile(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    state.pendingImport = await file.text();
    $("importPwd").value = "";
    $("importError").textContent = "";
    $("importHint").textContent = "This file is encrypted. Enter the password it was exported with.";
    $("importDialog").showModal();
  } catch {
    toast("Could not read that file.");
  }
}

async function submitImport(event) {
  event.preventDefault();
  const error = $("importError");
  try {
    const parsed = JSON.parse(state.pendingImport);
    const pwd = $("importPwd").value;
    const unlocked = await importPackage(state.pendingImport, parsed.box?.mode === "password" ? pwd : "");
    const id = await importPackageIntoPage(unlocked, parsed.meta, parsed.box?.mode === "password" ? pwd : "");
    $("importDialog").close();
    state.pendingImport = null;
    state.pages = await listPages();
    await openPage(id);
    toast("Page imported.");
  } catch (err) {
    error.textContent = err.message?.includes("format") ? err.message : "Wrong password or corrupted file.";
  }
}

async function removePage() {
  if (!state.currentId) return;
  const meta = currentMeta();
  if (!confirm(`Delete "${meta?.title || "this page"}"? This cannot be undone.`)) return;
  await deletePage(state.currentId);
  state.currentId = null;
  state.key = null;
  state.content = null;
  await refreshList();
  showView("empty");
  toast("Page deleted.");
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */

document.addEventListener("DOMContentLoaded", async () => {
  $("newPageBtn").addEventListener("click", newPage);
  $("emptyNewBtn").addEventListener("click", newPage);
  $("deleteBtn").addEventListener("click", removePage);
  $("lockBtn").addEventListener("click", () => lockCurrent("Page locked."));
  $("passwordBtn").addEventListener("click", changePassword);
  $("shareBtn").addEventListener("click", copyShareLink);
  $("exportBtn").addEventListener("click", doExport);
  $("importBtn").addEventListener("click", requestImport);
  $("importFile").addEventListener("change", onImportFile);
  $("addRowBtn").addEventListener("click", addRow);
  $("addColBtn").addEventListener("click", addColumn);
  $("csvImportBtn").addEventListener("click", openCsvImport);
  $("csvExportBtn").addEventListener("click", exportCsv);

  $("newPageForm").addEventListener("submit", submitNewPage);
  $("newPageCancel").addEventListener("click", () => $("newPageDialog").close());
  $("newMode").addEventListener("change", syncNewPageMode);
  $("importCsvForm").addEventListener("submit", submitCsvImport);
  $("importCsvCancel").addEventListener("click", () => $("importCsvDialog").close());
  $("linkOpenBtn").addEventListener("click", openLinkTarget);
  $("linkPreviewBtn").addEventListener("click", toggleLinkPreview);
  els.linkUrl.addEventListener("input", markDirty);
  els.linkNote.addEventListener("input", markDirty);

  $("boldBtn").addEventListener("click", () => wrapSelection("**"));
  $("italicBtn").addEventListener("click", () => wrapSelection("*"));
  $("codeBtn").addEventListener("click", () => wrapSelection("`"));
  $("h2Btn").addEventListener("click", () => prefixLine("## "));
  $("ulBtn").addEventListener("click", () => prefixLine("- "));
  $("todoBtn").addEventListener("click", () => prefixLine("- [ ] "));
  $("previewBtn").addEventListener("click", () => {
    state.preview = !state.preview;
    renderMode();
  });

  document.querySelectorAll(".mode-tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      readContentFromEditor();
      state.mode = btn.dataset.mode;
      document.querySelectorAll(".mode-tabs button").forEach((b) => b.classList.toggle("active", b === btn));
      renderMode();
      markDirty();
    });
  });

  els.pageTitle.addEventListener("input", markDirty);
  els.noteArea.addEventListener("input", markDirty);
  els.search.addEventListener("input", () => {
    state.filter = els.search.value;
    refreshList();
  });

  els.lockForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const record = await getPage(state.currentId);
    if (!record) return;
    await doUnlock(record, els.lockPassword.value);
  });

  $("passwordForm").addEventListener("submit", submitPassword);
  $("passwordCancel").addEventListener("click", () => $("passwordDialog").close());
  $("exportForm").addEventListener("submit", submitExport);
  $("exportCancel").addEventListener("click", () => $("exportDialog").close());
  $("importForm").addEventListener("submit", submitImport);
  $("importCancel").addEventListener("click", () => $("importDialog").close());

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      flushSave().then(() => toast("Saved."));
    }
  });

  window.addEventListener("beforeunload", () => {
    if (state.dirty) flushSave();
  });

  await refreshList();

  const params = new URLSearchParams(location.search);
  const requested = params.get("page");
  const prefillUrl = params.get("url");

  if (requested && state.pages.some((m) => m.id === requested)) {
    await openPage(requested);
  } else if (prefillUrl) {
    // Opened from the popup's "protect a sheet link" shortcut.
    await newPage();
    $("newLinkUrl").value = prefillUrl;
  } else {
    showView("empty");
  }
});