import { isAllowedUrl } from "../../shared/utils/url-validator.js";
import { triggerBadgeFeedback } from "../../shared/utils/ui-feedback.js";
import { StorageAPI } from "../../shared/api/storage.js";
import { handleDomExtractorMenu } from "../dom-extractor/parser.js";
import { handleFakeFillerMenu } from "../fake-filler/filler-engine.js";

export function initContextMenus() {
  chrome.runtime.onInstalled.addListener(() => {
    // Menu Simpan/Copy Teks & Kode
    chrome.contextMenus.create({
      id: "save-text",
      title: "📝 Simpan Teks ke Dashboard",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: "save-code",
      title: "💻 Simpan Kode ke Dashboard",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: "fake-filler",
      title: "🛠️ Fill Form with Fake Data",
      contexts: ["all"],
    });

    // FITUR BARU: Copy Blog as MD (Berbasis DOM Parsing)
    chrome.contextMenus.create({
      id: "copy-blog-md",
      title: "📋 Copy Seluruh Blog as MD",
      contexts: ["page"],
    });

    // FITUR BARU: Save Code as HTML (Khusus untuk blok kode yang diseleksi)
    chrome.contextMenus.create({
      id: "save-code-html",
      title: "📄 Save Seleksi as .html",
      contexts: ["selection"],
    });

    chrome.contextMenus.create({
      id: "separator-1",
      type: "separator",
      contexts: ["all"],
    });
    chrome.contextMenus.create({
      id: "open-dashboard",
      title: "📁 Buka Dashboard Kutipan",
      contexts: ["all"],
    });
  });

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
      }
    } catch (error) {
      console.error("Context Menu Error:", error);
    }
  });
}
