// src/window.js
import { fetchAuditResults } from './extension-api.js';

// Helper function to get the URL of the current active tab
function getCurrentTabUrl() {
  return new Promise((resolve, reject) => {
    console.log("[Window] Getting current tab URL...");
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error("[Window] Error getting tab:", chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        console.log("[Window] Current tab URL:", tabs[0].url);
        resolve(tabs[0].url);
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[Window] Popup loaded, initializing...");
  try {
    const url = await getCurrentTabUrl();
    console.log("[Window] Sending audit request for URL:", url);
    const result = await fetchAuditResults(url);
    console.log("[Window] Received API response:", result);
    
    // Update UI with results
    const resultsElement = document.getElementById("results");
    if (resultsElement) {
      resultsElement.innerText = JSON.stringify(result, null, 2);
      console.log("[Window] Updated UI with results");
    } else {
      console.error("[Window] Could not find results element");
    }
  } catch (error) {
    console.error("[Window] Error in window.js:", error);
    const resultsElement = document.getElementById("results");
    if (resultsElement) {
      resultsElement.innerText = "Error loading audit results.";
    }
  }
});
