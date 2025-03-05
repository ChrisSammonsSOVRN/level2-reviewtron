// Express server with Puppeteer test
const express = require('express');
const app = express();
const port = parseInt(process.env.PORT) || 8080;

console.log('Starting Express server with Puppeteer test');
console.log(`PORT env: ${process.env.PORT}`);
console.log(`Using port: ${port}`);

// Basic middleware
app.use(express.json());

// Health check endpoint
app.get('/_health', (req, res) => {
  console.log('Health check endpoint called');
  res.status(200).send('OK');
});

// Home route
app.get('/', (req, res) => {
  console.log('Root endpoint called');
  res.json({
    message: 'Express server with Puppeteer is running',
    time: new Date().toISOString()
  });
});

// Chrome test route
app.get('/chrome-test', async (req, res) => {
  console.log('Chrome test endpoint called');
  try {
    const fs = require('fs');
    const chromePath = process.env.CHROME_BIN || '/usr/bin/google-chrome-stable';
    
    const exists = fs.existsSync(chromePath);
    const stats = exists ? fs.statSync(chromePath) : null;
    
    res.json({
      chromePath,
      exists,
      stats: stats ? {
        size: stats.size,
        isFile: stats.isFile(),
        permissions: stats.mode.toString(8),
        uid: stats.uid,
        gid: stats.gid
      } : null
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

// Puppeteer test route
app.get('/puppeteer-test', async (req, res) => {
  console.log('Puppeteer test endpoint called');
  try {
    const puppeteer = require('puppeteer-core');
    
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome-stable',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    
    console.log('Browser launched successfully');
    const version = await browser.version();
    
    console.log('Opening new page...');
    const page = await browser.newPage();
    
    console.log('Navigating to example.com...');
    await page.goto('https://example.com');
    
    console.log('Getting page title...');
    const title = await page.title();
    
    console.log('Closing browser...');
    await browser.close();
    
    res.json({
      success: true,
      browserVersion: version,
      pageTitle: title,
      message: 'Puppeteer test completed successfully'
    });
  } catch (error) {
    console.error('Puppeteer test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Express server with Puppeteer running at http://0.0.0.0:${port}/`);
}); 