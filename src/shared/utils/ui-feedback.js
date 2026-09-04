export function triggerBadgeFeedback(tabId, text, color) {
  chrome.action.setBadgeText({ text, tabId }, () => {
    chrome.action.setBadgeBackgroundColor({ color, tabId }, () => {
      // Clear the badge after 1.5 seconds
      setTimeout(() => {
        chrome.action.setBadgeText({ text: "", tabId });
      }, 1500);
    });
  });
}
