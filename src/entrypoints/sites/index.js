import {
  listEntries,
  addEntry,
  updateEntry,
  deleteEntry,
  isUnlocked,
} from "../../features/site-gate/storage.js";

const els = {
  rows: document.getElementById("entryRows"),
  empty: document.getElementById("emptyState"),
  error: document.getElementById("formError"),
  stats: document.getElementById("stats"),
};

let entries = [];

async function refresh() {
  entries = await listEntries();
  els.rows.innerHTML = "";
  els.empty.classList.toggle("hidden", entries.length > 0);

  let live = 0;
  for (const entry of entries) {
    const unlocked = await isUnlocked(entry.id);
    if (entry.enabled && !unlocked) live += 1;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="pattern">${escapeHtml(entry.pattern)}</td>
      <td>${escapeHtml(entry.label || "-")}</td>
      <td>${entry.unlockMinutes} mnt</td>
      <td><span class="badge ${entry.enabled ? (unlocked ? "live" : "off") : ""}">${
        !entry.enabled ? "nonaktif" : unlocked ? "terbuka" : "terkunci"
      }</span></td>
      <td>
        <div class="row-actions">
          <button class="ghost small" data-action="toggle" data-id="${entry.id}">${entry.enabled ? "Disable" : "Enable"}</button>
          <button class="ghost small" data-action="password" data-id="${entry.id}">Password</button>
          <button class="danger small" data-action="delete" data-id="${entry.id}">Delete</button>
        </div>
      </td>`;
    els.rows.appendChild(tr);
  }

  els.stats.textContent = `${entries.length} pattern terdaftar, ${live} sedang aktif mengunci tab.`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("backVaultBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/entrypoints/vault/index.html") });
  });

  document.getElementById("presets").addEventListener("click", (event) => {
    const pattern = event.target.dataset?.pattern;
    if (!pattern) return;
    document.getElementById("patternInput").value = pattern;
    document.getElementById("passwordInput").focus();
  });

  document.getElementById("addBtn").addEventListener("click", async () => {
    els.error.textContent = "";
    try {
      await addEntry({
        pattern: document.getElementById("patternInput").value,
        label: document.getElementById("labelInput").value,
        password: document.getElementById("passwordInput").value,
        unlockMinutes: document.getElementById("minutesInput").value,
      });
      document.getElementById("patternInput").value = "";
      document.getElementById("labelInput").value = "";
      document.getElementById("passwordInput").value = "";
      await refresh();
    } catch (error) {
      els.error.textContent = error.message;
    }
  });

  els.rows.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const entry = entries.find((item) => item.id === button.dataset.id);
    if (!entry) return;

    try {
      if (button.dataset.action === "toggle") {
        await updateEntry(entry.id, { enabled: !entry.enabled });
      } else if (button.dataset.action === "delete") {
        if (!confirm(`Hapus pattern "${entry.pattern}"?`)) return;
        await deleteEntry(entry.id);
      } else if (button.dataset.action === "password") {
        const password = prompt(`Password baru untuk "${entry.pattern}" (kosongkan untuk membatalkan):`);
        if (!password) return;
        await updateEntry(entry.id, { password });
      }
      await refresh();
    } catch (error) {
      alert(error.message);
    }
  });

  await refresh();
});