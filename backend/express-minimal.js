// Minimal Express server
const express = require('express');
const app = express();
const port = parseInt(process.env.PORT) || 8080;

console.log('Starting minimal Express server');
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
    message: 'Minimal Express server is running',
    time: new Date().toISOString()
  });
});

// Debug route
app.get('/debug', (req, res) => {
  console.log('Debug endpoint called');
  res.json({
    env: process.env,
    cwd: process.cwd(),
    nodeVersion: process.version,
    platform: process.platform
  });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Minimal Express server running at http://0.0.0.0:${port}/`);
}); 