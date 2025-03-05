// Express server with Puppeteer and database test
const express = require('express');
const app = express();
const port = parseInt(process.env.PORT) || 8080;
const { Pool } = require('pg');

console.log('Starting Express server with Puppeteer and database test');
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
    message: 'Express server with Puppeteer and database is running',
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

// Database test route
app.get('/db-test', async (req, res) => {
  console.log('Database test endpoint called');
  try {
    console.log('DATABASE_URL:', process.env.DATABASE_URL);
    
    // Create a new pool using the connection string
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    console.log('Pool created, testing connection...');
    
    // Test the connection
    const client = await pool.connect();
    console.log('Connected to database');
    
    // Run a simple query
    const result = await client.query('SELECT NOW() as time');
    console.log('Query executed successfully');
    
    // Release the client
    client.release();
    console.log('Client released');
    
    res.json({
      success: true,
      connectionTest: 'successful',
      time: result.rows[0].time,
      message: 'Database connection test completed successfully'
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      hint: 'Make sure DATABASE_URL environment variable is set correctly'
    });
  }
});

// Environment variables route
app.get('/env', (req, res) => {
  console.log('Environment variables endpoint called');
  res.json({
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL ? '[REDACTED]' : 'not set',
    CHROME_BIN: process.env.CHROME_BIN
  });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Express server with Puppeteer and database running at http://0.0.0.0:${port}/`);
}); 