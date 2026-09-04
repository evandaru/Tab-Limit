import { getAggregatedAnalytics } from "../time-tracker/analytics-ui.js";

/**
 * Fetches rhythm stats (peak tabs, active hours, first/last, streak)
 * using the same time filter: today | week | month | year | all.
 * @param {'today' | 'week' | 'month' | 'year' | 'all'} filter
 */
export async function getAggregatedRhythm(filter = "today") {
  const data = await getAggregatedAnalytics(filter);
  return {
    filter: data.filter,
    peakTabs: data.peakTabs,
    hourly: data.hourly,
    firstSeen: data.firstSeen,
    lastSeen: data.lastSeen,
    activeDays: data.activeDays,
    streak: data.streak,
  };
}

/**
 * Dedicated rhythm-number renderer for newtab elements (valPeakTabs, valFirstSeen,
 * valLastSeen, valStreak, rhythmHeatmap). Safe to call alongside
 * the newtab dashboard loader since it only touches rhythm elements.
 * @param {'today' | 'week' | 'month' | 'year' | 'all'} [timeframe='today']
 */
export async function renderRhythmStats(timeframe = "today") {
  const data = await getAggregatedRhythm(timeframe);

  const valPeakTabs = document.getElementById("valPeakTabs");
  const valFirstSeen = document.getElementById("valFirstSeen");
  const valLastSeen = document.getElementById("valLastSeen");
  const valStreak = document.getElementById("valStreak");

  const fmtClock = (ts) => {
    if (!ts) return "-";
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes()
    ).padStart(2, "0")}`;
  };

  if (valPeakTabs) valPeakTabs.innerText = `${data.peakTabs || 0} tabs`;
  if (valFirstSeen) valFirstSeen.innerText = fmtClock(data.firstSeen);
  if (valLastSeen) valLastSeen.innerText = fmtClock(data.lastSeen);
  if (valStreak) valStreak.innerText = `${data.streak || 0} days`;
}
