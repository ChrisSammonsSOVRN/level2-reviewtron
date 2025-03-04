// src/background.js
console.log("[Background] Service worker initialized");

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
    console.log("[Background] Extension installed");
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[Background] Message received:", message);
    
    if (message.action === "extractContent") {
        console.log("[Background] Content received from:", sender.tab.url);
        // Send acknowledgment back to content script
        sendResponse({ status: "received" });
        return true; // Keep the message channel open for the async response
    }
});

// Listen for tab updates to inject content script
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        console.log("[Background] Tab updated:", tab.url);
        // You can manually inject the content script here if needed
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['src/content.js']
        }).then(() => {
            console.log("[Background] Content script injected into tab:", tabId);
        }).catch((err) => {
            console.error("[Background] Failed to inject content script:", err);
        });
    }
});
  