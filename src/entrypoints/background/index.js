import { initFocusMode } from "../../features/focus-mode/background.js";
import { initTimeTracker } from "../../features/time-tracker/engine.js";
import { initContextMenus } from "../../features/quotes-manager/context-menu.js";

function bootstrapServices() {
  console.log("Initializing Service Worker...");
  
  initFocusMode();
  initTimeTracker();
  initContextMenus();
}

bootstrapServices();
