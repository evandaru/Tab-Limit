import { getAggregatedAnalytics } from "../time-tracker/analytics-ui.js";

/**
 * Fetches tab opened/closed stats for a given time filter.
 * @param {'today' | 'week' | 'month' | 'year' | 'all'} filter
 */
export async function getAggregatedTabStats(filter = "today") {
  const data = await getAggregatedAnalytics(filter);
  return {
    filter: data.filter,
    tabsOpened: data.tabsOpened,
    tabsClosed: data.tabsClosed,
    dailyHistory: data.dailyHistory,
    allTimeTabsOpened: data.allTimeTabsOpened,
    allTimeTabsClosed: data.allTimeTabsClosed,
  };
}

/**
 * Dedicated tab-number renderer (used by newtab & as a popup/options complement).
 * Safe to call alongside renderTimeAnalytics since it only touches tab elements.
 * @param {'today' | 'week' | 'month' | 'year' | 'all'} [timeframe='today']
 */
export async function renderTabStats(timeframe = "today") {
  const data = await getAggregatedTabStats(timeframe);

  const statTabsOpened = document.getElementById("statTabsOpened");
  const statTabsClosed = document.getElementById("statTabsClosed");
  const statAllTabsOpened = document.getElementById("statAllTabsOpened");
  const statAllTabsClosed = document.getElementById("statAllTabsClosed");
  const valTabsOpened = document.getElementById("valTabsOpened");
  const valTabsClosed = document.getElementById("valTabsClosed");

  if (statTabsOpened) statTabsOpened.innerText = data.tabsOpened;
  if (statTabsClosed) statTabsClosed.innerText = data.tabsClosed;
  if (statAllTabsOpened) statAllTabsOpened.innerText = data.allTimeTabsOpened;
  if (statAllTabsClosed) statAllTabsClosed.innerText = data.allTimeTabsClosed;
  if (valTabsOpened) valTabsOpened.innerText = `${data.tabsOpened} tabs`;
  if (valTabsClosed) valTabsClosed.innerText = `${data.tabsClosed} tabs`;
}
