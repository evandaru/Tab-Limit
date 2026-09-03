import { initDashboardUI, renderQuotes } from "../../features/quotes-manager/dashboard-ui.js";
import {
  renderTimeAnalytics,
  initTimeframeFilters,
} from "../../features/time-tracker/analytics-ui.js";
import { initPomodoroDashboard } from "../../features/pomodoro/dashboard-ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  initDashboardUI();
  initPomodoroDashboard();
  initTimeframeFilters();

  await renderQuotes();
  await renderTimeAnalytics("today");
});

