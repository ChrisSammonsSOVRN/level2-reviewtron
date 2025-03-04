/**
 * Database Connection Module
 * Handles connections to PostgreSQL database
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { logMessage } = require('../utils/logger');

// Create a connection pool with SSL support for production
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'website_auditor',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
    connectionTimeoutMillis: 2000, // How long to wait for a connection
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Handle idle errors
pool.on('error', (err) => {
    logMessage('Unexpected error on idle client', 'error');
    process.exit(-1);
});

/**
 * Execute a database query
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} - Query result
 */
async function query(text, params) {
    const start = Date.now();
    try {
        // Only pass params if they are provided
        const res = params ? await pool.query(text, params) : await pool.query(text);
        const duration = Date.now() - start;
        logMessage(`Executed query in ${duration}ms: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
        return res;
    } catch (error) {
        logMessage(`Error executing query: ${error.message}`, 'error');
        logMessage(`Failed query: ${text}`, 'error');
        throw error;
    }
}

/**
 * Execute a transaction
 * @param {Function|string} queriesOrCallback - Either a callback function that receives a client and returns a Promise,
 *                                             or a string containing SQL queries separated by semicolons
 * @returns {Promise<any>} Transaction result
 */
async function transaction(queriesOrCallback) {
    let client = null;
    
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        
        let result;
        
        if (typeof queriesOrCallback === 'function') {
            // If a callback function is provided, execute it with the client
            result = await queriesOrCallback(client);
        } else if (typeof queriesOrCallback === 'string') {
            // If a string of queries is provided, split and execute them
            const queryArray = queriesOrCallback.split(';').filter(q => q.trim().length > 0);
            let results = [];
            
            for (const query of queryArray) {
                const res = await client.query(query);
                results.push(res);
            }
            
            result = results;
        } else {
            throw new Error('Invalid argument: expected a function or string');
        }
        
        await client.query('COMMIT');
        return result;
    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        logMessage(`Transaction error: ${error.message}`, 'error');
        throw error;
    } finally {
        if (client) {
            client.release();
        }
    }
}

/**
 * Initialize the database
 * Creates tables if they don't exist
 */
async function initDatabase() {
    logMessage('Initializing database...');
    
    try {
        // Read schema file
        let schema;
        try {
            schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        } catch (error) {
            if (error.code === 'ENOENT') {
                logMessage('Error reading schema file: File not found', 'error');
                throw new Error('Error reading schema file');
            }
            throw error;
        }
        
        // Execute schema - don't pass undefined as second parameter
        await query(schema);
        
        logMessage('Database schema initialized successfully');
        return { success: true };
    } catch (error) {
        // If it's already a specific error, just re-throw it
        if (error.message === 'Error reading schema file') {
            throw error;
        } else {
            logMessage(`Error initializing database: ${error.message}`, 'error');
            throw new Error('Error initializing database');
        }
    }
}

module.exports = {
    query,
    transaction,
    initDatabase,
    pool
}; 