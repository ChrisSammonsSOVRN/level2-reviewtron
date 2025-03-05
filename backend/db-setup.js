// Database setup script
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Create a database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

console.log('Starting database setup');
console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? '[REDACTED]' : 'not set'}`);

// Schema definition
const schema = `
-- Create audit_results table
CREATE TABLE IF NOT EXISTS audit_results (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create audit_check_results table
CREATE TABLE IF NOT EXISTS audit_check_results (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  check_name TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_audit_results_url ON audit_results(url);
CREATE INDEX IF NOT EXISTS idx_audit_results_timestamp ON audit_results(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_check_results_url ON audit_check_results(url);
CREATE INDEX IF NOT EXISTS idx_audit_check_results_timestamp ON audit_check_results(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_check_results_check_name ON audit_check_results(check_name);
`;

async function setupDatabase() {
  let client;
  try {
    console.log('Connecting to database...');
    client = await pool.connect();
    console.log('Connected to database');
    
    console.log('Executing schema...');
    await client.query(schema);
    console.log('Schema executed successfully');
    
    return { success: true, message: 'Database setup completed successfully' };
  } catch (error) {
    console.error(`Error setting up database: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    if (client) {
      client.release();
      console.log('Database connection released');
    }
  }
}

// Run the setup if this script is executed directly
if (require.main === module) {
  setupDatabase()
    .then(result => {
      console.log(result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { setupDatabase }; 