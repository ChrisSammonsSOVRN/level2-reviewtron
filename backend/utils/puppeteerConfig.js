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
        
        // Try to find chromium-browser which we installed in postinstall
        const chromiumPath = '/usr/bin/chromium-browser';
        
        // Log whether the path exists
        if (fs.existsSync(chromiumPath)) {
            logMessage(`[PuppeteerConfig] Found Chromium at: ${chromiumPath}`);
        } else {
            logMessage(`[PuppeteerConfig] WARNING: Chromium not found at ${chromiumPath}`, 'warn');
        }
        
        return {
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-features=site-per-process',
                '--disable-extensions',
                '--disable-web-security',
                '--single-process'
            ],
            headless: true, // Use the old headless mode
            ignoreHTTPSErrors: true,
            executablePath: chromiumPath
        };
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