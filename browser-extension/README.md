# Website Auditor Browser Extension

This extension integrates with the Website Auditor backend to perform audits on the current website. It extracts page content via a content script, processes messages with a background script, and displays audit results in a popup UI.

## Folder Structure

- **manifest.json** – Extension metadata and configuration.
- **src/** – Main source files:
  - **background.js** – Background service worker.
  - **content.js** – Injected into webpages to extract content.
  - **extension-api.js** – Module to interact with the backend API.
  - **window.js** – Handles the popup UI logic.
  - **logger.js** – Logging utility.
- **ui/** – UI components:
  - **window.html** – Popup interface.
  - **styles.css** – Styling for the popup.
- **README.md** – This documentation file.

## Installation

1. Open your browser and navigate to the extensions page (e.g., `chrome://extensions/` for Chrome).
2. Enable Developer Mode.
3. Click "Load unpacked" and select the `browser-extension` folder.
4. The extension icon will appear. Click it to see the audit results for the current page.

## Configuration

- Adjust the API URL in `src/extension-api.js` to point to your backend.
- Use the logger in `src/logger.js` to track performance and errors as needed.
