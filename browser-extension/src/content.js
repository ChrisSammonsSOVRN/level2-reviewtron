// src/content.js
console.log("[Content Script] Loaded on:", window.location.href);

// Extract the page's text content (for example, for auditing purposes)
try {
    const pageContent = document.body.innerText;
    console.log("[Content Script] Successfully extracted page content");

    // Send the extracted content to the background script
    chrome.runtime.sendMessage({ action: "extractContent", content: pageContent }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("[Content Script] Error sending message:", chrome.runtime.lastError);
            return;
        }
        console.log("[Content Script] Message sent successfully");
    });
} catch (error) {
    console.error("[Content Script] Error extracting content:", error);
}
