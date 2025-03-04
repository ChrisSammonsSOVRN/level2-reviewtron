const fs = require('fs');
const path = require('path');

const LOGGING_ENABLED = process.env.LOGGING_ENABLED === 'true';
const logFilePath = path.join(__dirname, '../logs/server.log');

function logMessage(message) {
    if (!LOGGING_ENABLED) return;

    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    console.log(logEntry);
    fs.appendFile(logFilePath, logEntry, (err) => {
        if (err) console.error('Error writing to log file', err);
    });
}

module.exports = { logMessage };
