require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const auditRoutes = require('./routes/auditRoutes'); // Import audit routes
const { logMessage } = require('./utils/logger');      // Import our logging module

const app = express();

// Middleware configuration
app.use(express.json());  // Parse JSON bodies
app.use(cors());          // Enable CORS
app.use(helmet());        // Secure HTTP headers

app.use(express.json()); // <-- This ensures Express parses JSON requests

// Mount the audit routes under the "/audit" endpoint
app.use('/audit', auditRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    logMessage(`🚀 Server running on port ${PORT}`);
});
