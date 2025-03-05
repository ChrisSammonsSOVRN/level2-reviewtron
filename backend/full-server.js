// Full server with routes and controllers
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { setupDatabase } = require('./db-setup');

// Initialize Express app
const app = express();
const port = parseInt(process.env.PORT) || 8080;

console.log('Starting full server');
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

// Utility function to validate URL
function isValidUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (error) {
    return false;
  }
}

// Puppeteer launch function with error handling
async function launchBrowser() {
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome-stable',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-software-rasterizer'
      ]
    });
    return browser;
  } catch (error) {
    console.error(`Error launching browser: ${error.message}`);
    throw error;
  }
}

// Extract content from URL using Puppeteer
async function extractContent(url) {
  let browser = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Set up request interception to block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    await page.goto(url, { 
      waitUntil: ['domcontentloaded', 'networkidle2'],
      timeout: 30000
    });
    
    // Extract text content
    const content = await page.evaluate(() => {
      return document.body.innerText;
    });
    
    return content;
  } catch (error) {
    console.error(`Error extracting content: ${error.message}`);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Hate speech check function
async function checkHateSpeech(url) {
  try {
    const content = await extractContent(url);
    
    if (!content) {
      return {
        status: 'warning',
        reason: 'Content extraction failed',
        details: 'Could not extract content from the provided URL'
      };
    }
    
    // Simple check for problematic words (placeholder for actual hate speech detection)
    const problematicWords = ['hate', 'kill', 'death', 'violent', 'racist'];
    const foundWords = [];
    
    problematicWords.forEach(word => {
      if (content.toLowerCase().includes(word)) {
        foundWords.push(word);
      }
    });
    
    if (foundWords.length > 0) {
      return {
        status: 'failed',
        reason: 'Problematic content detected',
        details: `Found ${foundWords.length} instances of problematic words`,
        problematicWords: foundWords
      };
    }
    
    return {
      status: 'passed',
      reason: 'No hate speech detected',
      details: 'Content analysis shows no indicators of hate speech'
    };
  } catch (error) {
    console.error(`Error in hate speech check: ${error.message}`);
    return {
      status: 'warning',
      reason: 'Processing error',
      details: error.message
    };
  }
}

// Store audit result in database
async function storeAuditResult(results) {
  try {
    const { url, timestamp, status, checks } = results;
    
    // Insert into audit_results table
    const auditQuery = `
      INSERT INTO audit_results (url, timestamp, status)
      VALUES ($1, $2, $3)
      RETURNING id
    `;
    
    const auditResult = await query(auditQuery, [url, timestamp, status]);
    const auditId = auditResult.rows[0]?.id;
    
    // Insert check results
    if (checks && auditId) {
      for (const [checkName, checkResult] of Object.entries(checks)) {
        // Convert 'error' status to 'warning' to avoid failing the site
        const checkStatus = checkResult.status === 'error' ? 'warning' : checkResult.status;
        
        const checkQuery = `
          INSERT INTO audit_check_results (url, timestamp, check_name, status, reason, details)
          VALUES ($1, $2, $3, $4, $5, $6)
        `;
        
        await query(checkQuery, [
          url,
          timestamp,
          checkName,
          checkStatus,
          checkResult.reason || '',
          JSON.stringify(checkResult.details || '')
        ]);
      }
    }
    
    return auditId;
  } catch (error) {
    console.error(`Error storing audit result: ${error.message}`);
    throw error;
  }
}

// Audit URL route
app.post('/audit/url', async (req, res) => {
  try {
    const url = req.body.url || req.query.url;
    
    if (!url) {
      return res.status(400).json({ error: 'Missing URL parameter' });
    }
    
    // Validate URL format
    if (!isValidUrl(url)) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
    
    // Initialize results object
    const results = {
      url,
      timestamp: new Date().toISOString(),
      status: 'pending',
      checks: {}
    };
    
    // Return initial response to client
    res.json({
      url,
      timestamp: results.timestamp,
      status: 'pending',
      message: 'Audit request received and is being processed'
    });
    
    // Run hate speech check
    try {
      const hateSpeechResult = await checkHateSpeech(url);
      results.checks.hateSpeech = hateSpeechResult;
      
      // If the check failed, mark the overall audit as failed
      if (hateSpeechResult.status === 'failed') {
        results.status = 'failed';
      } else {
        results.status = 'passed';
      }
    } catch (error) {
      console.error(`Error in hate speech check: ${error.message}`);
      results.checks.hateSpeech = {
        status: 'warning',
        reason: 'Processing error',
        details: error.message
      };
    }
    
    // Store the audit result in the database
    try {
      await storeAuditResult(results);
      logMessage(`Audit results stored in database for ${url}`);
    } catch (error) {
      logMessage(`Error storing audit results: ${error.message}`, 'error');
    }
    
  } catch (error) {
    console.error(`Error in audit: ${error.message}`);
    // Client already received a response, so we just log the error
  }
});

// Get latest audit results
app.get('/history/latest', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const query = `
      SELECT ar.id, ar.url, ar.timestamp, ar.status,
             json_agg(json_build_object(
               'check_name', acr.check_name,
               'status', acr.status,
               'reason', acr.reason,
               'details', acr.details
             )) as checks
      FROM audit_results ar
      LEFT JOIN audit_check_results acr ON ar.url = acr.url AND ar.timestamp = acr.timestamp
      GROUP BY ar.id, ar.url, ar.timestamp, ar.status
      ORDER BY ar.timestamp DESC
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    
    res.json(result.rows);
  } catch (error) {
    console.error(`Error fetching audit history: ${error.message}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Error handling middleware (must be last)
app.use((err, req, res, next) => {
  console.error(err.stack);
  logMessage(`Error: ${err.message}`, 'error');
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start server and initialize database
async function startServer() {
  try {
    // Set up the database
    console.log('Setting up database...');
    const dbResult = await setupDatabase();
    if (dbResult.success) {
      console.log('Database setup successful');
    } else {
      console.error(`Database setup failed: ${dbResult.error}`);
    }
    
    // Start the server
    app.listen(port, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${port}/`);
    });
  } catch (error) {
    console.error(`Error starting server: ${error.message}`);
    process.exit(1);
  }
}

// Start the server
startServer(); 