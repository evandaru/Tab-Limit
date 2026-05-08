import { initFocusMode } from "../../features/focus-mode/background.js";
import { initTimeTracker } from "../../features/time-tracker/engine.js";
import { initContextMenus } from "../../features/quotes-manager/context-menu.js";
import { initDarkMode } from "../../features/dark-mode/background.js";
import { initVideoSpeedController } from "../../features/video-speed/background.js"; 

function bootstrapServices() {
  console.log("Initializing Service Worker...");

  initFocusMode();
  initTimeTracker();
  initContextMenus();
  initDarkMode();
  initVideoSpeedController();
}

bootstrapServices();
