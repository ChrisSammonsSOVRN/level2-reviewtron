/**
 * Generate SQL for storing audit results
 * @param {Object} auditResult - The audit result object
 * @returns {Object} SQL text and values
 */
function generateAuditResultSQL(auditResult) {
    logMessage('[SQLGenerator] Generating SQL for audit result');
    
    const status = auditResult.status === 'error' ? 'failed' : auditResult.status;
    const failureReason = auditResult.status === 'error' ? 'Unknown failure reason' : null;
    
    // Get rejection code based on checks
    const rejectionCode = determineRejectionCode(auditResult);
    
    // Convert the full result to JSON string
    const resultJson = JSON.stringify(auditResult);
    
    // SQL for inserting audit result
    const sql = `
BEGIN;
INSERT INTO audit_results (url, timestamp, status, failure_reason, rejection_code)
VALUES ($1, $2, $3, $4, $5);
UPDATE sites 
SET approval_state = 2, reject_reason_code = $6, approval_state_updated = NOW() 
WHERE site = $7 AND approval_state = 32;`;
    
    const values = [
        auditResult.url,
        auditResult.timestamp,
        status,
        failureReason,
        rejectionCode,
        rejectionCode,
        auditResult.url
    ];
    
    return { sql, values };
}

/**
 * Determine rejection code based on audit result
 * @param {Object} auditResult - The audit result object
 * @returns {string} Rejection code
 */
function determineRejectionCode(auditResult) {
    // Default rejection code
    let rejectionCode = '298'; // Unknown failure
    
    // Check if there's a specific rejection code already set
    if (auditResult.rejection_code) {
        return auditResult.rejection_code;
    }
    
    // Determine rejection code based on checks
    const checks = auditResult.checks || {};
    
    if (checks.hateSpeech && checks.hateSpeech.status === 'fail') {
        rejectionCode = '201'; // Hate speech detected
    } else if (checks.plagiarism && checks.plagiarism.status === 'fail') {
        rejectionCode = '202'; // Plagiarism detected
    } else if (checks.images && checks.images.status === 'fail') {
        rejectionCode = '203'; // Inappropriate images
    } else if (checks.ads && checks.ads.status === 'fail') {
        rejectionCode = '204'; // Excessive or inappropriate ads
    } else if (auditResult.contentRecency && auditResult.contentRecency.status === 'fail') {
        rejectionCode = '205'; // Content not recent
    }
    
    return rejectionCode;
}

module.exports = {
    generateSiteSQL,
    generateAuditResultSQL,
    generateAuditCheckResultsSQL,
    determineRejectionCode
}; 