/**
 * ChromaScope - Background Service Worker
 * Handles viewport capture, context menus, and storage management
 */

// Initialize context menu on installation
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "chromascope-inspect",
        title: "Inspect Pixel Color with ChromaScope",
        contexts: ["all"]
    });
    console.log("ChromaScope service worker installed successfully.");
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "chromascope-inspect" && tab?.id) {
        startInPageInspector(tab.id);
    }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
    if (command === "toggle-inspector") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                startInPageInspector(tabs[0].id, "TOGGLE_INSPECTOR");
            }
        });
    } else if (command === "quick-eyedropper") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                chrome.tabs.sendMessage(tabs[0].id, { action: "QUICK_EYEDROPPER" }, (res) => {
                    if (chrome.runtime.lastError) {
                        // Inject and trigger
                        startInPageInspector(tabs[0].id, "ACTIVATE_INSPECTOR");
                    }
                });
            }
        });
    }
});

// Function to trigger in-page inspector
function startInPageInspector(tabId, action = "ACTIVATE_INSPECTOR") {
    chrome.tabs.sendMessage(tabId, { action }, (response) => {
        if (chrome.runtime.lastError) {
            // If content script not yet injected, inject it now
            chrome.scripting.executeScript({
                target: { tabId },
                files: [
                    "scripts/color-names.js",
                    "scripts/color-engine.js",
                    "scripts/content.js"
                ]
            }).then(() => {
                chrome.scripting.insertCSS({
                    target: { tabId },
                    files: ["styles/content.css"]
                }).then(() => {
                    chrome.tabs.sendMessage(tabId, { action });
                });
            }).catch(err => console.error("Script injection error:", err));
        }
    });
}

// Handle runtime messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "CAPTURE_TAB") {
        chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                sendResponse({ error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ dataUrl });
            }
        });
        return true; // Keep message channel open for async response
    }

    if (request.action === "SAVE_COLOR") {
        chrome.storage.local.get(["chromaHistory"], (result) => {
            let history = result.chromaHistory || [];
            // Remove duplicates of same hex
            history = history.filter(item => item.hex.toUpperCase() !== request.color.hex.toUpperCase());
            // Prepend new color
            history.unshift({
                ...request.color,
                timestamp: Date.now()
            });
            // Keep up to 50 items
            if (history.length > 50) history.pop();
            chrome.storage.local.set({ chromaHistory: history }, () => {
                sendResponse({ success: true, count: history.length });
            });
        });
        return true;
    }

    if (request.action === "START_INSPECTOR_FROM_POPUP") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                startInPageInspector(tabs[0].id);
                sendResponse({ success: true });
            } else {
                sendResponse({ success: false, error: "No active tab" });
            }
        });
        return true;
    }
});
