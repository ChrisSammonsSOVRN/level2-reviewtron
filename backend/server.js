const express = require('express');
const cors = require('cors');
const { logMessage } = require('./utils/logger');
const auditRoutes = require('./routes/auditRoutes');
const historyRoutes = require('./routes/historyRoutes');
// Conditionally require database
let db;
try {
    db = require('./db/database');
    console.log('Database module loaded successfully');
} catch (error) {
    console.error('Error loading database module:', error.message);
    // Create a mock db object to prevent crashes
    db = {
        initDatabase: () => Promise.resolve(),
        query: () => Promise.resolve({ rows: [] })
    };
}

// Initialize Express app
const app = express();
const port = parseInt(process.env.PORT) || 8080;

console.log(`Starting server with PORT=${process.env.PORT}, parsed as ${port}`);

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    try {
        logMessage(`${req.method} ${req.url}`);
    } catch (error) {
        console.error('Error in logging middleware:', error.message);
    }
    next();
});

// Health check endpoint for Cloud Run
app.get('/_health', (req, res) => {
    console.log('Health check endpoint called');
    res.status(200).send('OK');
});

// Routes
app.use('/audit', auditRoutes);
app.use('/history', historyRoutes);

// Home route
app.get('/', (req, res) => {
    console.log('Root endpoint called');
    res.json({
        message: 'Website Auditor API',
        version: '1.0.0',
        status: 'running',
        port: port,
        env: process.env.NODE_ENV || 'development',
        endpoints: {
            audit: '/audit/url',
            history: '/history/latest'
        }
    });
});

// Error route for testing
app.get('/debug', (req, res) => {
    console.log('Debug endpoint called');
    res.json({
        env: process.env,
        cwd: process.cwd(),
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: process.memoryUsage()
    });
});

// Start server immediately
console.log(`Attempting to start server on port ${port}`);
const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
    try {
        logMessage(`Server running on http://0.0.0.0:${port}`);
    } catch (error) {
        console.error('Error in server startup logging:', error.message);
    }
    
    // Try to initialize database after server is running
    console.log('Attempting to initialize database...');
    try {
        db.initDatabase()
            .then(() => {
                console.log('Database initialized successfully');
                try {
                    logMessage('Database initialized successfully');
                } catch (error) {
                    console.error('Error logging database init success:', error.message);
                }
            })
            .catch(error => {
                console.error('Database initialization failed:', error.message);
                try {
                    logMessage(`Warning: Database initialization failed: ${error.message}`, 'warn');
                } catch (logError) {
                    console.error('Error logging database init failure:', logError.message);
                }
                // Don't exit process, let the server continue running
            });
    } catch (error) {
        console.error('Error during database initialization attempt:', error.message);
    }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error.message, error.stack);
    try {
        logMessage(`Unhandled Rejection: ${error.message}`, 'error');
    } catch (logError) {
        console.error('Error logging unhandled rejection:', logError.message);
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error.message, error.stack);
    try {
        logMessage(`Uncaught Exception: ${error.message}`, 'error');
    } catch (logError) {
        console.error('Error logging uncaught exception:', logError.message);
    }
    // Don't exit immediately, give time for cleanup
    try {
        server.close(() => {
            process.exit(1);
        });
    } catch (closeError) {
        console.error('Error closing server:', closeError.message);
        process.exit(1);
    }
}); 