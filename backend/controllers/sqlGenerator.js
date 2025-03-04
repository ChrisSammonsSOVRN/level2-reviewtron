/**
 * SQL Query Generator for Audit Results
 * Generates SQL queries to store audit results in PostgreSQL database
 */

const { logMessage } = require('../utils/logger');
const path = require('path');
const fs = require('fs');

class SQLGenerator {
    constructor() {
        // Map of failure reasons to rejection codes
        this.rejectionMap = new Map([
            // URL and Redirect Checks (Phase 0-1)
            ['Banned word detected in URL', '261'],
            ['External redirect detected', '277'],
            ['Site failed to load', '298'],
            ['Geo-blocking detected', '298'],
            
            // Content Recency Check (Phase 2)
            ['Content too old', '284'],
            ['Lacking 4 months or recent content', '284'],
            ['No date information found', '298'],
            ['Unable to extract dates from content', '284'],
            
            // Hate Speech Detection
            ['Hate speech detected', '272'],
            ['Multiple instances of concerning content', '272'],
            ['Explicit harmful content detected', '272'],
            
            // Plagiarism Check
            ['Content similarity above 85% threshold', '64'],
            ['Multiple paragraphs appear to be plagiarized', '64'],
            ['Unable to verify content originality', '64'],
            
            // Image Analysis
            ['Adult content detected in images', '272'],
            ['Violent content detected in images', '272'],
            ['Inappropriate imagery detected', '272'],
            ['Inappropriate image content detected', '272'],
            
            // Ad Presence Analysis
            ['No ad implementation detected', '298'],
            ['No ad activity detected', '298'],
            ['Insufficient premium ad partners', '298'],
            ['Ad activity without premium networks', '298'],
            ['Limited premium ad networks', '298'],
            
            // General System Failures
            ['Timeout during analysis', '298'],
            ['Unable to access site content', '298'],
            ['Technical error during analysis', '298']
        ]);

        logMessage('[SQLGenerator] Initialized with rejection code mapping');
    }

    /**
     * Generate SQL queries for an audit result
     * @param {Object} auditResult - The complete audit result
     * @returns {Object} - SQL queries and metadata
     */
    generateSQLForAudit(auditResult) {
        try {
            logMessage(`[SQLGenerator] Generating SQL for audit of ${auditResult.url}`);
            
            if (!auditResult || !auditResult.url) {
                logMessage('[SQLGenerator] Invalid audit result provided', 'error');
                return { success: false, error: 'Invalid audit result' };
            }

            const url = auditResult.url;
            const timestamp = new Date().toISOString();
            const overallStatus = this.getOverallStatus(auditResult);
            const failureReason = this.getFailureReason(auditResult);
            const rejectionCode = this.getRejectionCode(failureReason);
            
            // Generate SQL for inserting into audit_results table
            const auditSQL = this.generateAuditSQL(url, timestamp, overallStatus, failureReason, rejectionCode, auditResult);
            
            // Generate SQL for updating site status in sites table
            const updateSQL = this.generateUpdateSQL(url, overallStatus, rejectionCode);
            
            // Generate SQL for detailed check results
            const detailsSQL = this.generateDetailsSQL(url, timestamp, auditResult);
            
            return {
                success: true,
                url,
                status: overallStatus,
                reason: failureReason,
                rejectionCode,
                sql: {
                    audit: auditSQL,
                    update: updateSQL,
                    details: detailsSQL,
                    transaction: this.wrapInTransaction([auditSQL, updateSQL, detailsSQL])
                }
            };
        } catch (error) {
            logMessage(`[SQLGenerator] Error generating SQL: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    /**
     * Get the overall status from audit result
     * @param {Object} auditResult - The audit result
     * @returns {string} - 'passed' or 'failed'
     */
    getOverallStatus(auditResult) {
        // Check if any phase has failed
        if (auditResult.phases) {
            for (const phase of Object.values(auditResult.phases)) {
                if (phase.status === 'fail' || phase.status === 'failed') {
                    return 'failed';
                }
            }
        }
        
        // Check individual checks
        if (auditResult.checks) {
            for (const check of Object.values(auditResult.checks)) {
                if (check.status === 'fail' || check.status === 'failed') {
                    return 'failed';
                }
            }
        }
        
        // If we have an overall status, use that
        if (auditResult.status) {
            return auditResult.status === 'pass' ? 'passed' : 'failed';
        }
        
        // Default to passed if no failures found
        return 'passed';
    }

    /**
     * Get the failure reason from audit result
     * @param {Object} auditResult - The audit result
     * @returns {string} - Failure reason or empty string if passed
     */
    getFailureReason(auditResult) {
        if (this.getOverallStatus(auditResult) === 'passed') {
            return '';
        }
        
        // Check phases for failure reasons
        if (auditResult.phases) {
            for (const phase of Object.values(auditResult.phases)) {
                if (phase.status === 'fail' || phase.status === 'failed') {
                    return phase.reason || 'Failed in audit phase';
                }
            }
        }
        
        // Check individual checks for failure reasons
        if (auditResult.checks) {
            for (const [checkName, check] of Object.entries(auditResult.checks)) {
                if (check.status === 'fail' || check.status === 'failed') {
                    return check.reason || `Failed in ${checkName} check`;
                }
            }
        }
        
        // If we have an overall reason, use that
        if (auditResult.reason) {
            return auditResult.reason;
        }
        
        // Default reason
        return 'Unknown failure reason';
    }

    /**
     * Get rejection code based on failure reason
     * @param {string} failureReason - The failure reason
     * @returns {string} - Rejection code
     */
    getRejectionCode(failureReason) {
        if (!failureReason) return '';
        
        // Try an exact match first
        if (this.rejectionMap.has(failureReason)) {
            return this.rejectionMap.get(failureReason);
        }
        
        // Try partial matching
        for (const [key, code] of this.rejectionMap.entries()) {
            if (failureReason.includes(key)) {
                return code;
            }
        }
        
        // Default code for unknown reasons
        return '298';
    }

    /**
     * Generate SQL for inserting into audit_results table
     * @param {string} url - The URL
     * @param {string} timestamp - ISO timestamp
     * @param {string} status - 'passed' or 'failed'
     * @param {string} reason - Failure reason
     * @param {string} rejectionCode - Rejection code
     * @param {Object} auditResult - Full audit result for JSON storage
     * @returns {string} - SQL query
     */
    generateAuditSQL(url, timestamp, status, reason, rejectionCode, auditResult) {
        const jsonResult = JSON.stringify(auditResult).replace(/'/g, "''");
        
        return `
INSERT INTO audit_results (url, timestamp, status, failure_reason, rejection_code, full_result)
VALUES ('${url}', '${timestamp}', '${status}', '${reason.replace(/'/g, "''")}', '${rejectionCode}', '${jsonResult}');
`;
    }

    /**
     * Generate SQL for updating site status
     * @param {string} url - The URL
     * @param {string} status - 'passed' or 'failed'
     * @param {string} rejectionCode - Rejection code
     * @returns {string} - SQL query
     */
    generateUpdateSQL(url, status, rejectionCode) {
        if (status === 'passed') {
            return `
UPDATE sites 
SET approval_state = 92, approval_state_updated = NOW() 
WHERE site = '${url}' AND approval_state = 32;
`;
        } else {
            return `
UPDATE sites 
SET approval_state = 2, reject_reason_code = ${rejectionCode}, approval_state_updated = NOW() 
WHERE site = '${url}' AND approval_state = 32;
`;
        }
    }

    /**
     * Generate SQL for storing detailed check results
     * @param {string} url - The URL
     * @param {string} timestamp - ISO timestamp
     * @param {Object} auditResult - The audit result
     * @returns {string} - SQL query
     */
    generateDetailsSQL(url, timestamp, auditResult) {
        const queries = [];
        
        // Add individual check results
        if (auditResult.checks) {
            for (const [checkName, check] of Object.entries(auditResult.checks)) {
                const checkStatus = check.status === 'pass' ? 'passed' : 'failed';
                const checkReason = check.reason ? check.reason.replace(/'/g, "''") : '';
                const checkDetails = check.details ? JSON.stringify(check.details).replace(/'/g, "''") : '{}';
                
                queries.push(`
INSERT INTO audit_check_results (url, timestamp, check_name, status, reason, details)
VALUES ('${url}', '${timestamp}', '${checkName}', '${checkStatus}', '${checkReason}', '${checkDetails}');
`);
            }
        }
        
        return queries.join('\n');
    }

    /**
     * Wrap SQL queries in a transaction
     * @param {Array} queries - Array of SQL queries
     * @returns {string} - Transaction SQL
     */
    wrapInTransaction(queries) {
        return `
BEGIN;
${queries.join('\n')}
COMMIT;
`;
    }

    /**
     * Save SQL to file
     * @param {string} sql - SQL query
     * @param {string} url - URL for filename
     * @returns {Promise<string>} - Path to saved file
     */
    async saveToFile(sql, url) {
        try {
            const sanitizedUrl = url.replace(/[^a-zA-Z0-9]/g, '_');
            const timestamp = new Date().toISOString().replace(/[^0-9]/g, '');
            const filename = `audit_${sanitizedUrl}_${timestamp}.sql`;
            const filePath = path.join(__dirname, '../sql_output', filename);
            
            // Ensure directory exists
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            await fs.promises.writeFile(filePath, sql);
            logMessage(`[SQLGenerator] SQL saved to ${filePath}`);
            return filePath;
        } catch (error) {
            logMessage(`[SQLGenerator] Error saving SQL to file: ${error.message}`, 'error');
            throw error;
        }
    }
}

module.exports = new SQLGenerator(); 