/**
 * SQL Generator Module
 * Generates SQL queries for storing audit results in the database
 */

/**
 * Generate SQL for inserting an audit result
 * @param {Object} auditResult - The audit result object
 * @returns {Object} SQL query object with text and values
 */
function generateAuditResultSQL(auditResult) {
    const text = `
        INSERT INTO audit_results (url, timestamp, status, failure_reason, site_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
    `;
    
    const values = [
        auditResult.url,
        auditResult.timestamp,
        auditResult.status,
        auditResult.failureReason,
        auditResult.siteId
    ];
    
    return { text, values };
}

/**
 * Generate SQL for inserting multiple audit check results
 * @param {number} auditId - The ID of the parent audit
 * @param {Array} checks - Array of check result objects
 * @returns {Object|null} SQL query object with text and values, or null if checks array is empty
 */
function generateAuditCheckResultsSQL(auditId, checks) {
    if (!checks || checks.length === 0) {
        return null;
    }
    
    const values = [];
    let placeholders = [];
    let placeholderIndex = 1;
    
    checks.forEach(check => {
        placeholders.push(`($${placeholderIndex}, $${placeholderIndex + 1}, $${placeholderIndex + 2}, $${placeholderIndex + 3}, $${placeholderIndex + 4})`);
        values.push(
            auditId,
            check.name,
            check.status,
            check.reason,
            JSON.stringify(check.details || {})
        );
        placeholderIndex += 5;
    });
    
    const text = `
        INSERT INTO audit_check_results (audit_id, name, status, reason, details)
        VALUES ${placeholders.join(', ')}
    `;
    
    return { text, values };
}

/**
 * Generate SQL for inserting or updating a site
 * @param {string} url - The site URL
 * @returns {Object} SQL query object with text and values
 */
function generateSiteSQL(url) {
    const text = `
        INSERT INTO sites (url, created_at, updated_at)
        VALUES ($1, NOW(), NOW())
        ON CONFLICT (url) DO UPDATE
        SET updated_at = NOW()
        RETURNING id
    `;
    
    const values = [url];
    
    return { text, values };
}

module.exports = {
    generateAuditResultSQL,
    generateAuditCheckResultsSQL,
    generateSiteSQL
}; 