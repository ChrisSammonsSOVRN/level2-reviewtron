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
        // Initialize the connection pool if not already done
        if (!pool) {
            pool = initPool();
        }
        
        // Read schema file
        const schemaPath = path.join(__dirname, 'schema.sql');
        logMessage(`Reading schema file from: ${schemaPath}`);
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Execute schema
        await pool.query(schema);
        logMessage('Database schema initialized successfully');
        
        // Run migrations
        const migrationFiles = [
            'migrations/add_rejection_code.sql'
        ];
        
        for (const migrationFile of migrationFiles) {
            try {
                const migrationPath = path.join(__dirname, migrationFile);
                logMessage(`Applying migration from: ${migrationPath}`);
                
                if (!fs.existsSync(migrationPath)) {
                    logMessage(`Migration file not found: ${migrationPath}`, 'error');
                    continue;
                }
                
                const migration = fs.readFileSync(migrationPath, 'utf8');
                await pool.query(migration);
                logMessage(`Migration ${migrationFile} applied successfully`);
                
                // Verify the column exists after migration
                const checkColumnQuery = `
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'audit_results' AND column_name = 'rejection_code'
                `;
                const result = await pool.query(checkColumnQuery);
                if (result.rows.length > 0) {
                    logMessage('Verified rejection_code column exists in audit_results table');
                } else {
                    logMessage('WARNING: rejection_code column still does not exist after migration', 'error');
                }
            } catch (migrationError) {
                logMessage(`Error applying migration ${migrationFile}: ${migrationError.message}`, 'error');
                // Continue with other migrations even if one fails
            }
        }
        
        return true;
    } catch (error) {
        // Handle file not found error specifically
        if (error.code === 'ENOENT') {
            logMessage('Error reading schema file: File not found', 'error');
            throw new Error('Error reading schema file');
        }
        
        logMessage(`Error initializing database: ${error.message}`, 'error');
        throw error;
    }
}

module.exports = {
    query,
    transaction,
    initDatabase,
    pool: () => pool
}; 