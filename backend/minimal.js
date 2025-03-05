// Minimal server with no dependencies
const http = require('http');
const port = process.env.PORT || 8080;

console.log('Starting minimal HTTP server');
console.log(`PORT env: ${process.env.PORT}`);
console.log(`Using port: ${port}`);

const server = http.createServer((req, res) => {
  console.log(`Received request: ${req.method} ${req.url}`);
  
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    message: 'Minimal server is running',
    url: req.url,
    method: req.method,
    time: new Date().toISOString()
  }));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Minimal server running at http://0.0.0.0:${port}/`);
}); 