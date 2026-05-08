import { initFocusModeUI } from "../../features/focus-mode/popup-ui.js";
import { initDomExtractorUI } from "../../features/dom-extractor/parser.js";
import { initDarkModeUI } from "../../features/dark-mode/popup-ui.js";
import { initLinkExtractorUI } from "../../features/link-extractor/engine.js";

document.addEventListener("DOMContentLoaded", async () => {
  await initFocusModeUI();
  await initDarkModeUI();
  initDomExtractorUI();
  initLinkExtractorUI();

  const openDashboardBtn = document.getElementById("openDashboardBtn");
  if (openDashboardBtn) {
    openDashboardBtn.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
  }
});
