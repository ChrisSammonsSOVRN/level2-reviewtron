/**
 * Puppeteer Configuration Utility
 * Provides consistent browser launch configuration across the application
 */

const { logMessage } = require('./logger');
const fs = require('fs');

/**
 * Get Puppeteer launch options based on environment
 * @returns {Object} Puppeteer launch options
 */
function getPuppeteerLaunchOptions() {
    // For Render.com deployment
    if (process.env.NODE_ENV === 'production') {
        logMessage('[PuppeteerConfig] Using Puppeteer configuration for production environment');
        
        // Standard paths to check for Chromium
        const chromePaths = [
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/google-chrome'
        ];
        
        // Find the first existing Chrome executable
        let executablePath = null;
        for (const path of chromePaths) {
            if (fs.existsSync(path)) {
                executablePath = path;
                logMessage(`[PuppeteerConfig] Found Chrome at: ${path}`);
                break;
            }
        }
        
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