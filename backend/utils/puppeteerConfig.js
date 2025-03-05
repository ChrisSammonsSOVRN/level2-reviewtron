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
    
    logMessage('[PuppeteerConfig] Checking Chrome installation status...');
    
    // Log environment information
    logMessage(`[PuppeteerConfig] NODE_ENV: ${process.env.NODE_ENV}`);
    logMessage(`[PuppeteerConfig] CHROME_BIN: ${process.env.CHROME_BIN || 'not set'}`);
    
    // Try to find Chrome using which command
    try {
        const whichChromium = execSync('which chromium 2>/dev/null || echo "not found"').toString().trim();
        const whichChromiumBrowser = execSync('which chromium-browser 2>/dev/null || echo "not found"').toString().trim();
        const whichGoogleChrome = execSync('which google-chrome 2>/dev/null || echo "not found"').toString().trim();
        
        logMessage(`[PuppeteerConfig] which chromium: ${whichChromium}`);
        logMessage(`[PuppeteerConfig] which chromium-browser: ${whichChromiumBrowser}`);
        logMessage(`[PuppeteerConfig] which google-chrome: ${whichGoogleChrome}`);
    } catch (error) {
        logMessage(`[PuppeteerConfig] Error running which commands: ${error.message}`);
    }
    
    // Check Nix store
    try {
        logMessage('[PuppeteerConfig] Checking Nix store for Chromium...');
        const nixStoreContent = execSync('find /nix/store -name "chromium*" 2>/dev/null || echo "No matches"').toString().trim();
        logMessage(`[PuppeteerConfig] Nix store chromium matches:\n${nixStoreContent}`);
    } catch (error) {
        logMessage(`[PuppeteerConfig] Error checking Nix store: ${error.message}`);
    }
    
    // Define possible Chrome paths in order of preference
    const chromePaths = [
        process.env.CHROME_BIN,
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/nix/store/x205pbkd5xh5g4iv0n41vgpn3q0a2wmw-chromium-108.0.5359.94/bin/chromium'
    ];

    // Check each path and log its status
    for (const path of chromePaths) {
        if (path) {
            try {
                if (fs.existsSync(path)) {
                    const stats = fs.statSync(path);
                    logMessage(`[PuppeteerConfig] Found ${path}:`);
                    logMessage(`  - File permissions: ${stats.mode}`);
                    logMessage(`  - Owner: ${stats.uid}`);
                    logMessage(`  - Size: ${stats.size} bytes`);
                    logMessage(`  - Is executable: ${(stats.mode & fs.constants.S_IXUSR) !== 0}`);
                } else {
                    logMessage(`[PuppeteerConfig] Path does not exist: ${path}`);
                }
            } catch (error) {
                logMessage(`[PuppeteerConfig] Error checking path ${path}: ${error.message}`);
            }
        }
    }

    // Find the first existing Chrome path
    let executablePath = null;
    for (const path of chromePaths) {
        if (path && fs.existsSync(path)) {
            executablePath = path;
            logMessage(`[PuppeteerConfig] Selected Chrome path: ${path}`);
            break;
        }
    }

    if (!executablePath) {
        logMessage(`[PuppeteerConfig] WARNING: No Chrome installation found in any standard location`, 'warn');
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

    logMessage(`[PuppeteerConfig] Final Puppeteer configuration:`, 'info');
    logMessage(JSON.stringify(options, null, 2));
    
    return options;
}

module.exports = {
    getPuppeteerLaunchOptions
}; 