import { initFocusMode } from "../../features/focus-mode/background.js";
import { initTimeTracker } from "../../features/time-tracker/engine.js";
import { initTabCounter } from "../../features/tab-counter/engine.js";
import { initActivityRhythm } from "../../features/activity-rhythm/engine.js";
import { initContextMenus } from "../../features/quotes-manager/context-menu.js";
import { initDarkMode } from "../../features/dark-mode/background.js";
import { initVideoSpeedController } from "../../features/video-speed/background.js";
import { initLinkCleaner } from "../../features/link-cleaner/background.js";
import { applyPomodoroOverlay } from "../../features/pomodoro/engine.js";
import { initPomodoro } from "../../features/pomodoro/background.js";

function bootstrapServices() {
  console.log("Initializing Service Worker...");

  initFocusMode();
  initTimeTracker();
  initTabCounter();
  initActivityRhythm();
  initContextMenus();
  initDarkMode();
  initVideoSpeedController();
  initLinkCleaner();
  initPomodoro();
}

bootstrapServices();
