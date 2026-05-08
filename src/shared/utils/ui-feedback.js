export function triggerBadgeFeedback(tabId, text, color) {
  chrome.action.setBadgeText({ text, tabId }, () => {
    chrome.action.setBadgeBackgroundColor({ color, tabId }, () => {
      // Clear badge setelah 1.5 detik
      setTimeout(() => {
        chrome.action.setBadgeText({ text: "", tabId });
      }, 1500);
    });
  });
}
