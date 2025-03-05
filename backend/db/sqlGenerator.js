function generateAuditResultSQL(auditResult) {
    const { url, status, site_id, rejection_code } = auditResult;
    
    const text = `
        INSERT INTO audit_results (url, status, site_id, rejection_code)
        VALUES ($1, $2, $3, $4)
        RETURNING id
    `;
    
    const values = [url, status, site_id, rejection_code || null];
    
    return { text, values };
} 