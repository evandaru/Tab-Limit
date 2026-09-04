/**
 * Data Management dashboard UI (options page):
 * retention-days setting + full JSON backup export.
 * Follows the existing stat-card rhythm.
 */

export function initRetentionDashboard() {
  const daysInput = document.getElementById("retentionDays");
  const saveBtn = document.getElementById("saveRetentionBtn");
  const exportBtn = document.getElementById("exportJsonBtn");

  if (!daysInput && !exportBtn) return;

  if (daysInput && saveBtn) {
    chrome.storage.sync.get({ retentionDays: 90 }, (res) => {
      daysInput.value = res.retentionDays ?? 90;
    });

    saveBtn.addEventListener("click", async () => {
      const days = Math.max(7, Number(daysInput.value) || 90);
      await chrome.storage.sync.set({ retentionDays: days });
      daysInput.value = days;
      const originalText = saveBtn.innerText;
      saveBtn.innerText = "✅ Saved!";
      setTimeout(() => (saveBtn.innerText = originalText), 2000);
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
      try {
        const originalText = exportBtn.innerText;
        exportBtn.innerText = "⏳ Exporting...";
        const allData = await chrome.storage.local.get(null);
        const blob = new Blob([JSON.stringify(allData, null, 2)], {
          type: "application/json;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `tabfocus-backup-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
        exportBtn.innerText = "✅ Exported!";
        setTimeout(() => (exportBtn.innerText = originalText), 2000);
      } catch (error) {
        console.error("[Retention] Export failed:", error);
      }
    });
  }
}
