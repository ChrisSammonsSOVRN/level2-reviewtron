/**
 * Puppeteer Configuration Utility
 * Provides consistent browser launch configuration across the application
 */

const { logMessage } = require('./logger');
const fs = require('fs');

/**
 * Find the first existing Chrome/Chromium executable from a list of possible paths
 * @returns {string|null} Path to Chrome executable or null if not found
 */
function findChromeExecutable() {
    // Possible Chrome/Chromium paths on different systems
    const chromePaths = [
        // Render.com Nix paths
        '/nix/store/*/chromium-*/bin/chromium',
        '/nix/store/*/chromium-*/bin/chromium-browser',
        // Standard Linux paths
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        // Snap paths
        '/snap/bin/chromium',
        // Debian/Ubuntu specific
        '/usr/lib/chromium/chromium',
        // Alpine Linux
        '/usr/bin/chromium-browser'
    ];

    // Log what we're doing
    logMessage(`[PuppeteerConfig] Searching for Chrome executable...`);

    // Try to find an existing Chrome executable
    for (const pattern of chromePaths) {
        // If the path contains a wildcard, use glob pattern matching
        if (pattern.includes('*')) {
            try {
                // Simple glob-like functionality for Nix store paths
                const dirParts = pattern.split('*');
                const baseDir = dirParts[0]; // e.g., '/nix/store/'
                
                // Check if base directory exists
                if (!fs.existsSync(baseDir)) {
                    continue;
                }
                
                // Read the base directory
                const items = fs.readdirSync(baseDir);
                
                // Look for matching paths
                for (const item of items) {
                    const fullItemPath = `${baseDir}${item}`;
                    
                    // Skip if not a directory
                    if (!fs.existsSync(fullItemPath) || !fs.statSync(fullItemPath).isDirectory()) {
                        continue;
                    }
                    
                    // Check if this might be a chromium directory
                    if (dirParts[1].startsWith('/chromium-') && !item.includes('chromium-')) {
                        continue;
                    }
                    
                    // Try to construct the full path
                    const possiblePath = `${baseDir}${item}${dirParts[1]}`;
                    
                    if (fs.existsSync(possiblePath)) {
                        logMessage(`[PuppeteerConfig] Found Chrome at: ${possiblePath}`);
                        return possiblePath;
                    }
                }
            } catch (error) {
                logMessage(`[PuppeteerConfig] Error searching pattern ${pattern}: ${error.message}`, 'error');
            }
        } 
        // Direct path check
        else if (fs.existsSync(pattern)) {
            logMessage(`[PuppeteerConfig] Found Chrome at: ${pattern}`);
            return pattern;
        }
    }

    // If we get here, we couldn't find Chrome
    logMessage(`[PuppeteerConfig] Could not find Chrome executable in any of the expected locations`, 'warn');
    return null;
}

/**
 * Get Puppeteer launch options based on environment
 * @returns {Object} Puppeteer launch options
 */
function getPuppeteerLaunchOptions() {
    // For Render.com deployment
    if (process.env.NODE_ENV === 'production') {
        logMessage('[PuppeteerConfig] Using Puppeteer configuration for production environment');
        
        // Try to find Chrome executable
        const executablePath = findChromeExecutable();
        
        const options = {
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ],
            headless: "new",
            ignoreHTTPSErrors: true
        };
        
        // Only set executablePath if we found a Chrome executable
        if (executablePath) {
            options.executablePath = executablePath;
            logMessage(`[PuppeteerConfig] Using Chrome at: ${executablePath}`);
        } else {
            logMessage(`[PuppeteerConfig] No Chrome executable found, Puppeteer will try to find Chrome itself`, 'warn');
        }
        
        return options;
    }
    
    // For local development
    logMessage('[PuppeteerConfig] Using Puppeteer configuration for local environment');
    return {
        executablePath: process.platform === 'darwin' 
            ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' // Mac
            : process.platform === 'win32'
                ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' // Windows
                : '/usr/bin/google-chrome', // Linux
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        headless: "new",
        ignoreDefaultArgs: ['--disable-extensions']
    };
}

module.exports = {
    getPuppeteerLaunchOptions
}; 