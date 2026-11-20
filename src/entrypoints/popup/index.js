import { initFocusModeUI } from "../../features/focus-mode/popup-ui.js";
import { initDomExtractorUI } from "../../features/dom-extractor/parser.js";
import { initDarkModeUI } from "../../features/dark-mode/popup-ui.js";
import { initLinkExtractorUI } from "../../features/link-extractor/engine.js";
import { initResponsiveTesterUI } from "../../features/responsive-tester/ui.js";
import { initLinkCleanerUI } from "../../features/link-cleaner/popup-ui.js";
import { initShortsBlockerUI } from "../../features/shorts-blocker/popup-ui.js";
import { initXTrendingBlockerUI } from "../../features/x-trending-blocker/popup-ui.js";
import { initPomodoroPopupUI } from "../../features/pomodoro/popup-ui.js";
import {
  renderTimeAnalytics,
  initTimeframeFilters,
} from "../../features/time-tracker/analytics-ui.js";
import {
  getTabFocusEnabled,
  setTabFocusEnabled,
} from "../../features/tab-focus/settings.js";

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

      // Refresh data when switching to the analytics tab
      if (targetId === "tabAnalytics") {
        await renderTimeAnalytics(activeTimeframe);
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  // Initialize tab navigation
  initPopupTabs();

  // Initialize existing control features
  await initFocusModeUI();
  await initDarkModeUI();
  await initLinkCleanerUI();
  await initShortsBlockerUI();
  await initXTrendingBlockerUI();

  initDomExtractorUI();
  initLinkExtractorUI();
  initResponsiveTesterUI();
  initPomodoroPopupUI();

  // Initialize Analytics Dashboard
  initTimeframeFilters((selectedFilter) => {
    activeTimeframe = selectedFilter;
  });

  // Initial analytics render
  await renderTimeAnalytics(activeTimeframe);

  // Analytics Refresh Button
  const refreshAnalyticsBtn = document.getElementById("refreshAnalyticsBtn");
  if (refreshAnalyticsBtn) {
    refreshAnalyticsBtn.addEventListener("click", async () => {
      refreshAnalyticsBtn.innerText = "⏳ Loading...";
      await renderTimeAnalytics(activeTimeframe);
      setTimeout(() => {
        refreshAnalyticsBtn.innerText = "🔄 Refresh";
      }, 400);
    });
  }

  // Open Full Dashboard Buttons (on both tabs)
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

  // Tab Focus Feature Setting (New Tab)
  const tabFocusCheckbox = document.getElementById("tabFocusEnabled");
  const openTabFocusBtn = document.getElementById("openTabFocusBtn");

  const syncTabFocusUi = (enabled) => {
    if (!openTabFocusBtn) return;
    openTabFocusBtn.disabled = !enabled;
    openTabFocusBtn.style.opacity = enabled ? "1" : "0.5";
    openTabFocusBtn.style.cursor = enabled ? "pointer" : "not-allowed";
    openTabFocusBtn.title = enabled
      ? "Open the Tab Focus portal in a tab"
      : "Enable Tab Focus Portal first";
  };

  if (tabFocusCheckbox) {
    tabFocusCheckbox.checked = await getTabFocusEnabled();
    syncTabFocusUi(tabFocusCheckbox.checked);
    tabFocusCheckbox.addEventListener("change", async () => {
      await setTabFocusEnabled(tabFocusCheckbox.checked);
      syncTabFocusUi(tabFocusCheckbox.checked);
    });
  } else {
    syncTabFocusUi(await getTabFocusEnabled());
  }

  if (openTabFocusBtn) {
    openTabFocusBtn.addEventListener("click", () => {
      if (openTabFocusBtn.disabled) return;
      chrome.tabs.create({
        url: chrome.runtime.getURL("src/entrypoints/newtab/index.html"),
      });
    });
  }

  const openVaultBtn = document.getElementById("openVaultBtn");
  if (openVaultBtn) {
    openVaultBtn.addEventListener("click", () => {
      chrome.tabs.create({
        url: chrome.runtime.getURL("src/entrypoints/vault/index.html"),
      });
    });
  }

  const openSitesBtn = document.getElementById("openSitesBtn");
  if (openSitesBtn) {
    openSitesBtn.addEventListener("click", () => {
      chrome.tabs.create({
        url: chrome.runtime.getURL("src/entrypoints/sites/index.html"),
      });
    });
  }

  // Shortcut: turn a Google Sheets / Drive link into a password-protected page.
  const protectLinkInput = document.getElementById("protectLinkInput");
  const protectLinkBtn = document.getElementById("protectLinkBtn");
  if (protectLinkInput && protectLinkBtn) {
    protectLinkBtn.addEventListener("click", () => {
      const url = protectLinkInput.value.trim();
      if (!url) return;
      chrome.tabs.create({
        url: chrome.runtime.getURL(
          "src/entrypoints/vault/index.html") + "?url=" + encodeURIComponent(url),
      });
    });
    protectLinkInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") protectLinkBtn.click();
    });
  }
});

