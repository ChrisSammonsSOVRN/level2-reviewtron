const express = require('express');
const cors = require('cors');
const { logMessage } = require('./utils/logger');
const auditRoutes = require('./routes/auditRoutes');
const historyRoutes = require('./routes/historyRoutes');
const db = require('./db/database');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    logMessage(`${req.method} ${req.url}`);
    next();
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

// Initialize database before starting server
db.initDatabase()
    .then(() => {
        // Start server
        app.listen(PORT, () => {
            logMessage(`Server running on port ${PORT}`);
        });
    })
    .catch(error => {
        logMessage(`Failed to initialize database: ${error.message}`, 'error');
        process.exit(1);
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
    process.exit(1);
}); 