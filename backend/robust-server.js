// Robust server with all components and improved error handling
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Initialize Express app
const app = express();
const port = parseInt(process.env.PORT) || 8080;

console.log('Starting robust server');
console.log(`PORT env: ${process.env.PORT}`);
console.log(`Using port: ${port}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

// Create a logger function that won't crash if logs directory doesn't exist
const logMessage = (message, level = 'info') => {
  console.log(`[${level.toUpperCase()}] ${message}`);
  
  try {
    // Try to write to log file, but don't crash if it fails
    const logsDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(path.join(logsDir, 'server.log'), logEntry);
  } catch (error) {
    console.error(`Error writing to log file: ${error.message}`);
  }
};

// Create a database connection pool
let pool;
try {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  console.log('Database pool created');
} catch (error) {
  console.error(`Error creating database pool: ${error.message}`);
  // Create a mock pool to prevent crashes
  pool = {
    connect: () => {
      console.error('Using mock database connection');
      return {
        query: () => Promise.resolve({ rows: [] }),
        release: () => {}
      };
    },
    query: () => Promise.resolve({ rows: [] })
  };
}

// Database query wrapper with error handling
const query = async (text, params) => {
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    console.error(`Database query error: ${error.message}`);
    console.error(`Query: ${text}`);
    console.error(`Params: ${JSON.stringify(params)}`);
    throw error;
  }
};

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logMessage(`${req.method} ${req.url}`);
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  logMessage(`Error: ${err.message}`, 'error');
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Health check endpoint
app.get('/_health', (req, res) => {
  res.status(200).send('OK');
});

// Home route
app.get('/', (req, res) => {
  res.json({
    message: 'Website Auditor API',
    version: '1.0.0',
    status: 'running'
  });
});

// Chrome test route
app.get('/chrome-test', async (req, res) => {
  try {
    const chromePath = process.env.CHROME_BIN || '/usr/bin/google-chrome-stable';
    
    const exists = fs.existsSync(chromePath);
    const stats = exists ? fs.statSync(chromePath) : null;
    
    res.json({
      chromePath,
      exists,
      stats: stats ? {
        size: stats.size,
        isFile: stats.isFile(),
        permissions: stats.mode.toString(8)
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
  try {
    const puppeteer = require('puppeteer-core');
    
    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome-stable',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    
    const version = await browser.version();
    const page = await browser.newPage();
    await page.goto('https://example.com');
    const title = await page.title();
    await browser.close();
    
    res.json({
      success: true,
      browserVersion: version,
      pageTitle: title
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Database test route
app.get('/db-test', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as time');
    client.release();
    
    res.json({
      success: true,
      time: result.rows[0].time
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Audit URL route
app.post('/audit/url', async (req, res) => {
  try {
    const url = req.body.url || req.query.url;
    
    if (!url) {
      return res.status(400).json({ error: 'Missing URL parameter' });
    }
    
    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
    
    // For now, just return a success response
    res.json({
      url,
      timestamp: new Date().toISOString(),
      status: 'pending',
      message: 'Audit request received and is being processed'
    });
    
    // In a real implementation, you would call your audit logic here
    // and store the results in the database
    
  } catch (error) {
    console.error(`Error in audit: ${error.message}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}/`);
}); 