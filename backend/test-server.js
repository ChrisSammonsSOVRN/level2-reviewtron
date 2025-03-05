const express = require('express');
const app = express();
const port = parseInt(process.env.PORT) || 8080;

console.log(`Starting minimal test server on port ${port}`);

app.get('/', (req, res) => {
  console.log('Root endpoint called');
  res.send('Test server is running');
});

app.get('/_health', (req, res) => {
  console.log('Health check endpoint called');
  res.status(200).send('OK');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Test server running on http://0.0.0.0:${port}`);
}); 