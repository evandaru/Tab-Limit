import { initDashboardUI, renderQuotes } from "../../features/quotes-manager/dashboard-ui.js";
import {
  renderTimeAnalytics,
  initTimeframeFilters,
} from "../../features/time-tracker/analytics-ui.js";
import { initPomodoroDashboard } from "../../features/pomodoro/dashboard-ui.js";
import { initRetentionDashboard } from "../../features/retention/dashboard-ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  initDashboardUI();
  initPomodoroDashboard();
  initRetentionDashboard();
  initTimeframeFilters();

  const openVaultBtn = document.getElementById("openVaultBtn");
  if (openVaultBtn) {
    openVaultBtn.addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("src/entrypoints/vault/index.html") });
    });
  }

  const openSitesBtn = document.getElementById("openSitesBtn");
  if (openSitesBtn) {
    openSitesBtn.addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("src/entrypoints/sites/index.html") });
    });
  }

  await renderQuotes();
  await renderTimeAnalytics("today");
});

