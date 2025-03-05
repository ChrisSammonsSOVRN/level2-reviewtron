/**
 * Puppeteer Configuration Utility
 * Provides consistent browser launch configuration across the application
 */

const { logMessage } = require('./logger');
const fs = require('fs');
const { execSync } = require('child_process');

/**
 * Find Chrome/Chromium executable
 * @returns {string} Path to Chrome/Chromium executable or a default path if not found
 */
function findChromeExecutable() {
    // Check standard paths first
    const standardPaths = [
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        // Render.com Nix path
        '/nix/store/x205pbkd5xh5g4iv0n41vgpn3q0a2wmw-chromium-108.0.5359.94/bin/chromium'
    ];

    for (const path of standardPaths) {
        if (fs.existsSync(path)) {
            logMessage(`[PuppeteerConfig] Found Chrome/Chromium at standard path: ${path}`);
            return path;
        }
    }

    // Try to find using which command
    try {
        const whichResult = execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome 2>/dev/null || which google-chrome-stable 2>/dev/null || echo "Not found"').toString().trim();
        if (whichResult && whichResult !== 'Not found') {
            logMessage(`[PuppeteerConfig] Found Chrome/Chromium using which: ${whichResult}`);
            return whichResult;
        }
    } catch (error) {
        logMessage(`[PuppeteerConfig] Error running which: ${error.message}`);
    }

    // Try to find in Nix store (for Render.com)
    try {
        const nixPaths = execSync('find /nix/store -name "chromium" -type f 2>/dev/null || echo "Not found"').toString().trim();
        if (nixPaths && nixPaths !== 'Not found') {
            const firstPath = nixPaths.split('\n')[0];
            logMessage(`[PuppeteerConfig] Found Chrome/Chromium in Nix store: ${firstPath}`);
            return firstPath;
        }
    } catch (error) {
        logMessage(`[PuppeteerConfig] Error checking Nix store: ${error.message}`);
    }

    // If we get here, we couldn't find Chrome
    logMessage('[PuppeteerConfig] No Chrome/Chromium executable found, using default path');
    
    // Return a default path - this will cause an error when Puppeteer tries to use it,
    // but it will be a more controlled error that we can catch
    return '/usr/bin/google-chrome-stable';
}

/**
 * Get Puppeteer launch options based on environment
 * @returns {Object} Puppeteer launch options
 */
function getPuppeteerLaunchOptions() {
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Define possible Chrome paths in order of preference
    const chromePaths = [
        process.env.CHROME_BIN,
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        // Render.com Nix path - this is typically where Chrome is installed
        '/nix/store/x205pbkd5xh5g4iv0n41vgpn3q0a2wmw-chromium-108.0.5359.94/bin/chromium'
    ];

    // Find the first existing Chrome path
    let executablePath = null;
    for (const path of chromePaths) {
        if (path && fs.existsSync(path)) {
            executablePath = path;
            logMessage(`[PuppeteerConfig] Found Chrome at: ${path}`);
            break;
        }
    }

    if (!executablePath) {
        logMessage(`[PuppeteerConfig] WARNING: No Chrome installation found in any standard location`, 'warn');
        // Default to chromium-browser as a last resort
        executablePath = '/usr/bin/chromium-browser';
    }

    const options = {
        headless: 'new',
        executablePath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--disable-software-rasterizer'
        ]
    };

    logMessage(`[PuppeteerConfig] Configured Puppeteer with executablePath: ${executablePath}`);
    return options;
}

module.exports = {
    getPuppeteerLaunchOptions
}; 