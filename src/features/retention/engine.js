/**
 * Retention Engine — bounds storage.local growth so the dashboard
 * stays fast forever. Prunes analytics_YYYY-MM-DD entries older than
 * retentionDays (user setting, default 90). Runs once per service
 * worker start; cheap single get/remove round-trip.
 */

export async function pruneOldAnalytics(retentionDays = 90) {
  const allData = await chrome.storage.local.get(null);
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const staleKeys = Object.keys(allData).filter((k) => {
    if (!k.startsWith("analytics_") || k.length !== 20) return false;
    const entryDate = new Date(k.replace("analytics_", "") + "T00:00:00");
    return entryDate < cutoff;
  });

  if (staleKeys.length > 0) {
    await chrome.storage.local.remove(staleKeys);
  }
  return staleKeys.length;
}

export function initRetention() {
  chrome.storage.sync.get({ retentionDays: 90 }, async (res) => {
    const days = Number(res.retentionDays) || 90;
    await pruneOldAnalytics(days);
  });
}
