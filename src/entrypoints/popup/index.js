import { initFocusModeUI } from "../../features/focus-mode/popup-ui.js";
import { initDomExtractorUI } from "../../features/dom-extractor/parser.js";
import { initDarkModeUI } from "../../features/dark-mode/popup-ui.js";
import { initLinkExtractorUI } from "../../features/link-extractor/engine.js";
import { initResponsiveTesterUI } from "../../features/responsive-tester/ui.js";
import { initLinkCleanerUI } from "../../features/link-cleaner/popup-ui.js";
import { initPomodoroPopupUI } from "../../features/pomodoro/popup-ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  await initFocusModeUI();
  await initDarkModeUI();
  await initLinkCleanerUI();

  initDomExtractorUI();
  initLinkExtractorUI();
  initResponsiveTesterUI();
  initPomodoroPopupUI();

  const openDashboardBtn = document.getElementById("openDashboardBtn");
  if (openDashboardBtn) {
    openDashboardBtn.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
  }
});
