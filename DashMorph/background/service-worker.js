// DashMorph Background Service Worker

// Initialize context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "dashmorph-toggle-mode",
    title: "DashMorph: Toggle Rearrange Mode (Alt+Shift+D)",
    contexts: ["page"]
  });

  chrome.contextMenus.create({
    id: "dashmorph-reset-page",
    title: "DashMorph: Reset to Default Layout",
    contexts: ["page"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;

  if (info.menuItemId === "dashmorph-toggle-mode") {
    chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_REARRANGE_MODE" }).catch(() => {});
  } else if (info.menuItemId === "dashmorph-reset-page") {
    chrome.tabs.sendMessage(tab.id, { action: "RESET_LAYOUT" }).catch(() => {});
  }
});

// Handle keyboard shortcut command
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle_rearrange") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_REARRANGE_MODE" }).catch(() => {});
    }
  }
});

// Relay messages if needed and update badge
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "UPDATE_BADGE" && sender.tab?.id) {
    const count = request.cardCount;
    if (count > 0) {
      chrome.action.setBadgeText({ tabId: sender.tab.id, text: String(count) });
      chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: "#6366F1" });
    } else {
      chrome.action.setBadgeText({ tabId: sender.tab.id, text: "" });
    }
    sendResponse({ success: true });
  }
  return true;
});
