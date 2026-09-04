import { initFocusModeUI } from "../../features/focus-mode/popup-ui.js";
import { initDomExtractorUI } from "../../features/dom-extractor/parser.js";
import { initDarkModeUI } from "../../features/dark-mode/popup-ui.js";
import { initLinkExtractorUI } from "../../features/link-extractor/engine.js";
import { initResponsiveTesterUI } from "../../features/responsive-tester/ui.js";
import { initLinkCleanerUI } from "../../features/link-cleaner/popup-ui.js";
import { initPomodoroPopupUI } from "../../features/pomodoro/popup-ui.js";
import {
  renderTimeAnalytics,
  initTimeframeFilters,
} from "../../features/time-tracker/analytics-ui.js";

let activeTimeframe = "today";

function initPopupTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetId = btn.getAttribute("data-target");

      tabBtns.forEach((b) => b.classList.remove("active"));
      tabPanes.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add("active");
      }

      // Jika berpindah ke tab analitik, segarkan data
      if (targetId === "tabAnalytics") {
        await renderTimeAnalytics(activeTimeframe);
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  // Inisialisasi navigasi tab
  initPopupTabs();

  // Inisialisasi fitur kontrol yang ada
  await initFocusModeUI();
  await initDarkModeUI();
  await initLinkCleanerUI();

  initDomExtractorUI();
  initLinkExtractorUI();
  initResponsiveTesterUI();
  initPomodoroPopupUI();

  // Inisialisasi Dashboard Analitik
  initTimeframeFilters((selectedFilter) => {
    activeTimeframe = selectedFilter;
  });

  // Render awal analitik
  await renderTimeAnalytics(activeTimeframe);

  // Tombol Refresh Analitik
  const refreshAnalyticsBtn = document.getElementById("refreshAnalyticsBtn");
  if (refreshAnalyticsBtn) {
    refreshAnalyticsBtn.addEventListener("click", async () => {
      refreshAnalyticsBtn.innerText = "⏳ Memuat...";
      await renderTimeAnalytics(activeTimeframe);
      setTimeout(() => {
        refreshAnalyticsBtn.innerText = "🔄 Refresh";
      }, 400);
    });
  }

  // Tombol Buka Dashboard Lengkap (di kedua tab)
  const openDashboardBtn = document.getElementById("openDashboardBtn");
  if (openDashboardBtn) {
    openDashboardBtn.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
  }

  const openFullAnalyticsBtn = document.getElementById("openFullAnalyticsBtn");
  if (openFullAnalyticsBtn) {
    openFullAnalyticsBtn.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
  }

  // Pengaturan Fitur Tab Focus (New Tab)
  const tabFocusCheckbox = document.getElementById("tabFocusEnabled");
  if (tabFocusCheckbox) {
    chrome.storage.sync.get({ tabFocusEnabled: true }, (res) => {
      tabFocusCheckbox.checked = res.tabFocusEnabled;
    });
    tabFocusCheckbox.addEventListener("change", () => {
      chrome.storage.sync.set({ tabFocusEnabled: tabFocusCheckbox.checked });
    });
  }

  const openTabFocusBtn = document.getElementById("openTabFocusBtn");
  if (openTabFocusBtn) {
    openTabFocusBtn.addEventListener("click", () => {
      chrome.tabs.create({
        url: chrome.runtime.getURL("src/entrypoints/newtab/index.html"),
      });
    });
  }
});

