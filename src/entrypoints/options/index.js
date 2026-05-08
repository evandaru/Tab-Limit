import { initDashboardUI, renderQuotes } from "../../features/quotes-manager/dashboard-ui.js";
import { renderTimeAnalytics } from "../../features/time-tracker/analytics-ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  initDashboardUI();
  await renderQuotes();
  await renderTimeAnalytics();
});
