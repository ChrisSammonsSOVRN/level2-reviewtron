/**
 * Database Connection Module
 * Handles connections to PostgreSQL database
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { logMessage } = require('../utils/logger');

// Create a connection pool
let pool;

// Initialize the database connection pool
function initPool() {
    // Check if DATABASE_URL is provided (Render deployment)
    if (process.env.DATABASE_URL) {
        logMessage('Using DATABASE_URL for connection');
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
    } else {
        // Use individual connection parameters (local development)
        logMessage('Using individual connection parameters');
        pool = new Pool({
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 5432,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
    }

    // Log pool errors
    pool.on('error', (err) => {
        logMessage(`Unexpected error on idle client: ${err.message}`, 'error');
    });

    return pool;
}

/**
 * Execute a database query
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} - Query result
 */
async function query(text, params) {
    const start = Date.now();
    try {
        // Initialize the connection pool if not already done
        if (!pool) {
            pool = initPool();
        }

        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        
        logMessage(`Executed query in ${duration}ms: ${text.substring(0, 50)}...`);
        
        return result;
    } catch (error) {
        const duration = Date.now() - start;
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
    try {
        // Create logs directory if it doesn't exist
        const logsDir = path.join(__dirname, '..', 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        // Initialize the connection pool if not already done
        if (!pool) {
            pool = initPool();
        }

        // Read the schema file
        const schemaPath = path.join(__dirname, 'schema.sql');
        let schemaSQL;
        
        try {
            schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        } catch (err) {
            if (err.code === 'ENOENT') {
                throw new Error('Error reading schema file');
            }
            throw err;
        }

        // Execute the schema SQL
        logMessage('Executing database schema...');
        await pool.query(schemaSQL);
        logMessage('Database schema executed successfully');

        return { success: true };
    } catch (error) {
        logMessage(`Error initializing database: ${error.message}`, 'error');
        throw new Error(`Error initializing database: ${error.message}`);
    }
}

module.exports = {
    query,
    transaction,
    initDatabase,
    pool: () => pool
}; 