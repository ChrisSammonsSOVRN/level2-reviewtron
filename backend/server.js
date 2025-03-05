const express = require('express');
const cors = require('cors');
const { logMessage } = require('./utils/logger');
const auditRoutes = require('./routes/auditRoutes');
const historyRoutes = require('./routes/historyRoutes');
const db = require('./db/database');

// Initialize Express app
const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    logMessage(`${req.method} ${req.url}`);
    next();
});

// Health check endpoint for Cloud Run
app.get('/_health', (req, res) => {
    res.status(200).send('OK');
});

// Routes
app.use('/audit', auditRoutes);
app.use('/history', historyRoutes);

// Home route
app.get('/', (req, res) => {
    res.json({
        message: 'Website Auditor API',
        version: '1.0.0',
        endpoints: {
            audit: '/audit/url',
            history: '/history/latest'
        }
    });
});

// Start server first, then initialize database
const server = app.listen(port, () => {
    logMessage(`Server running on port ${port}`);
    
    // Initialize database after server is running
    db.initDatabase()
        .then(() => {
            logMessage('Database initialized successfully');
        })
        .catch(error => {
            logMessage(`Warning: Database initialization failed: ${error.message}`, 'warn');
            // Don't exit process, let the server continue running
        });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
    logMessage(`Unhandled Rejection: ${error.message}`, 'error');
    console.error(error);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logMessage(`Uncaught Exception: ${error.message}`, 'error');
    console.error(error);
    // Don't exit immediately, give time for cleanup
    server.close(() => {
        process.exit(1);
    });
}); 