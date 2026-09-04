import { isAllowedUrl } from "../../shared/utils/url-validator.js";
import { triggerBadgeFeedback } from "../../shared/utils/ui-feedback.js";
import { StorageAPI } from "../../shared/api/storage.js";
import { handleDomExtractorMenu } from "../dom-extractor/parser.js";
import { handleFakeFillerMenu } from "../fake-filler/filler-engine.js";
import { handleLinkExtractorMenu } from "../link-extractor/engine.js";

let clickListenerRegistered = false;

function setupMenus() {
  // Remove old menus first to avoid duplicate ids
  // (Chrome menus persist across extension reloads/updates).
  chrome.contextMenus.removeAll(() => {
    // Save/Copy text & code menus
    chrome.contextMenus.create({
      id: "save-text",
      title: "📝 Save Text to Dashboard",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: "save-code",
      title: "💻 Save Code to Dashboard",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: "fake-filler",
      title: "🛠️ Fill Form with Fake Data",
      contexts: ["all"],
    });

    // NEW FEATURE: Copy Blog as MD (DOM parsing based)
    chrome.contextMenus.create({
      id: "copy-blog-md",
      title: "📋 Copy Entire Blog as MD",
      contexts: ["page"],
    });

    // NEW FEATURE: Save Code as HTML (for selected code blocks)
    chrome.contextMenus.create({
      id: "save-code-html",
      title: "📄 Save Selection as .html",
      contexts: ["selection"],
    });

    chrome.contextMenus.create({
      id: "copy-all-links",
      title: "🔗 Copy All Links on Page",
      contexts: ["page", "all"],
    });

    chrome.contextMenus.create({
      id: "separator-1",
      type: "separator",
      contexts: ["all"],
    });
    chrome.contextMenus.create({
      id: "open-dashboard",
      title: "📖 Open Quotes Dashboard",
      contexts: ["all"],
    });
  });
}

export function initContextMenus() {
  // Re-register on install/update...
  chrome.runtime.onInstalled.addListener(() => {
    setupMenus();
  });

  // ...and on every service worker start (MV3 is ephemeral).
  setupMenus();

  // Avoid duplicate listeners if init is called again.
  if (clickListenerRegistered) return;
  clickListenerRegistered = true;

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    try {
      if (!tab?.id || !isAllowedUrl(tab.url)) {
        return;
      }

      switch (info.menuItemId) {
        case "save-text":
          await StorageAPI.saveQuote({
            text: info.selectionText,
            url: info.pageUrl,
            timestamp: new Date().toISOString(),
          });
          triggerBadgeFeedback(tab.id, "Saved", "#198754");
          break;

        case "save-code":
          await StorageAPI.saveQuote({
            text: `\`\`\`\n${info.selectionText}\n\`\`\``,
            url: info.pageUrl,
            timestamp: new Date().toISOString(),
          });
          triggerBadgeFeedback(tab.id, "Code", "#0dcaf0");
          break;

        case "open-dashboard":
          chrome.runtime.openOptionsPage();
          break;

        case "copy-blog-md":
        case "save-code-html":
          await handleDomExtractorMenu(info, tab);
          break;

        case "fake-filler":
          await handleFakeFillerMenu(info, tab);
          break;

        case "copy-all-links": 
          await handleLinkExtractorMenu(info, tab);
          break;
      }
    } catch (error) {
      console.error("Context Menu Error:", error);
    }
  });
}
