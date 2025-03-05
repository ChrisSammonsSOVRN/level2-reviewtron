-- Website Auditor Database Schema

-- Sites table
CREATE TABLE IF NOT EXISTS sites (
    id SERIAL PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Audit results table
CREATE TABLE IF NOT EXISTS audit_results (
    id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES sites(id),
    url TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL,
    rejection_code TEXT,
    failure_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Audit check results table
CREATE TABLE IF NOT EXISTS audit_check_results (
    id SERIAL PRIMARY KEY,
    audit_id INTEGER REFERENCES audit_results(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT,
    details JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    audit_id INTEGER REFERENCES audit_results(id) ON DELETE CASCADE,
    log_type TEXT NOT NULL,
    message TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_results_url ON audit_results(url);
CREATE INDEX IF NOT EXISTS idx_audit_results_timestamp ON audit_results(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_results_status ON audit_results(status);
CREATE INDEX IF NOT EXISTS idx_audit_check_results_audit_id ON audit_check_results(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_check_results_status ON audit_check_results(status);

-- Create view for latest audit results
CREATE OR REPLACE VIEW latest_audit_results AS
SELECT DISTINCT ON (url) *
FROM audit_results
ORDER BY url, timestamp DESC;

-- Create view for audit statistics
CREATE OR REPLACE VIEW audit_statistics AS
SELECT
    COUNT(*) AS total_audits,
    COUNT(DISTINCT url) AS unique_sites,
    SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) AS passed_audits,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_audits
FROM audit_results; 