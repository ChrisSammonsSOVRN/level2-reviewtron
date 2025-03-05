/**
 * Puppeteer Configuration Utility
 * Provides consistent browser launch configuration across the application
 */

const { logMessage } = require('./logger');

/**
 * Get Puppeteer launch options based on environment
 * @returns {Object} Puppeteer launch options
 */
function getPuppeteerLaunchOptions() {
    // For Render.com deployment
    if (process.env.NODE_ENV === 'production') {
        logMessage('Using Puppeteer configuration for production environment');
        return {
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
            ignoreHTTPSErrors: true,
            // Don't specify executablePath - let Puppeteer use its built-in Chrome
        };
    }
    
    // For local development
    logMessage('Using Puppeteer configuration for local environment');
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