function generateAuditResultSQL(auditResult) {
    const { url, status, site_id } = auditResult;
    
    // Check if rejection_code exists in the auditResult
    const hasRejectionCode = 'rejection_code' in auditResult;
    
    let text;
    let values;
    
    if (hasRejectionCode) {
        // Use rejection_code if it exists
        text = `
            INSERT INTO audit_results (url, status, site_id, rejection_code)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `;
        values = [url, status, site_id, auditResult.rejection_code || null];
    } else {
        // Skip rejection_code if it doesn't exist
        text = `
            INSERT INTO audit_results (url, status, site_id)
            VALUES ($1, $2, $3)
            RETURNING id
        `;
        values = [url, status, site_id];
    }
    
    return { text, values };
} 