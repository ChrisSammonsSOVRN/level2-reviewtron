/**
 * History Routes - API endpoints for querying audit history
 */

const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { logMessage } = require('../utils/logger');

/**
 * @route GET /history/latest
 * @description Get latest audit results for all sites
 * @access Public
 */
router.get('/latest', async (req, res) => {
    try {
        logMessage('[HistoryRoutes] Getting latest audit results');
        
        const result = await db.query(`
            SELECT * FROM latest_audit_results 
            ORDER BY timestamp DESC 
            LIMIT 100
        `);
        
        return res.json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        logMessage(`[HistoryRoutes] Error getting latest results: ${error.message}`, 'error');
        return res.status(500).json({
            success: false,
            error: 'Server error retrieving audit history'
        });
    }
});

/**
 * @route GET /history/site/:url
 * @description Get audit history for a specific site
 * @access Public
 */
router.get('/site/:url', async (req, res) => {
    try {
        const url = decodeURIComponent(req.params.url);
        logMessage(`[HistoryRoutes] Getting audit history for site: ${url}`);
        
        const result = await db.query(`
            SELECT * FROM audit_results 
            WHERE url = $1
            ORDER BY timestamp DESC
        `, [url]);
        
        return res.json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        logMessage(`[HistoryRoutes] Error getting site history: ${error.message}`, 'error');
        return res.status(500).json({
            success: false,
            error: 'Server error retrieving site audit history'
        });
    }
});

/**
 * @route GET /history/checks/:url/:timestamp
 * @description Get detailed check results for a specific audit
 * @access Public
 */
router.get('/checks/:url/:timestamp', async (req, res) => {
    try {
        const url = decodeURIComponent(req.params.url);
        const timestamp = req.params.timestamp;
        
        logMessage(`[HistoryRoutes] Getting check details for site: ${url}, timestamp: ${timestamp}`);
        
        const result = await db.query(`
            SELECT * FROM audit_check_results 
            WHERE url = $1 AND timestamp = $2
            ORDER BY check_name
        `, [url, timestamp]);
        
        return res.json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        logMessage(`[HistoryRoutes] Error getting check details: ${error.message}`, 'error');
        return res.status(500).json({
            success: false,
            error: 'Server error retrieving check details'
        });
    }
});

/**
 * @route GET /history/stats
 * @description Get audit statistics
 * @access Public
 */
router.get('/stats', async (req, res) => {
    try {
        logMessage('[HistoryRoutes] Getting audit statistics');
        
        // Get overall statistics
        const overallStats = await db.query(`
            SELECT 
                COUNT(*) as total_audits,
                COUNT(DISTINCT url) as unique_sites,
                SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed_count,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
                ROUND(100.0 * SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) / COUNT(*), 2) as pass_rate
            FROM audit_results
        `);
        
        // Get top failure reasons
        const failureReasons = await db.query(`
            SELECT 
                failure_reason, 
                COUNT(*) as count,
                ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as percentage
            FROM audit_results
            WHERE status = 'failed' AND failure_reason IS NOT NULL
            GROUP BY failure_reason
            ORDER BY count DESC
            LIMIT 10
        `);
        
        // Get audit counts by day for the last 30 days
        const auditTrends = await db.query(`
            SELECT 
                DATE_TRUNC('day', timestamp) as date,
                COUNT(*) as total,
                SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
            FROM audit_results
            WHERE timestamp > NOW() - INTERVAL '30 days'
            GROUP BY DATE_TRUNC('day', timestamp)
            ORDER BY date
        `);
        
        return res.json({
            success: true,
            data: {
                overall: overallStats.rows[0],
                failureReasons: failureReasons.rows,
                trends: auditTrends.rows
            }
        });
    } catch (error) {
        logMessage(`[HistoryRoutes] Error getting statistics: ${error.message}`, 'error');
        return res.status(500).json({
            success: false,
            error: 'Server error retrieving audit statistics'
        });
    }
});

/**
 * @route GET /history/search
 * @description Search audit history
 * @access Public
 */
router.get('/search', async (req, res) => {
    try {
        const { query, status, startDate, endDate, limit = 50, offset = 0 } = req.query;
        
        logMessage(`[HistoryRoutes] Searching audit history with query: ${query}, status: ${status}`);
        
        // Build the WHERE clause based on search parameters
        let whereClause = [];
        let params = [];
        let paramIndex = 1;
        
        if (query) {
            whereClause.push(`url ILIKE $${paramIndex}`);
            params.push(`%${query}%`);
            paramIndex++;
        }
        
        if (status && ['passed', 'failed'].includes(status)) {
            whereClause.push(`status = $${paramIndex}`);
            params.push(status);
            paramIndex++;
        }
        
        if (startDate) {
            whereClause.push(`timestamp >= $${paramIndex}`);
            params.push(startDate);
            paramIndex++;
        }
        
        if (endDate) {
            whereClause.push(`timestamp <= $${paramIndex}`);
            params.push(endDate);
            paramIndex++;
        }
        
        // Construct the final query
        const whereClauseStr = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';
        
        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(*) as total
            FROM audit_results
            ${whereClauseStr}
        `;
        
        const countResult = await db.query(countQuery, params);
        const total = parseInt(countResult.rows[0].total);
        
        // Get the actual results
        const dataQuery = `
            SELECT *
            FROM audit_results
            ${whereClauseStr}
            ORDER BY timestamp DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        
        const dataParams = [...params, limit, offset];
        const dataResult = await db.query(dataQuery, dataParams);
        
        return res.json({
            success: true,
            count: dataResult.rows.length,
            total,
            data: dataResult.rows,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: parseInt(offset) + dataResult.rows.length < total
            }
        });
    } catch (error) {
        logMessage(`[HistoryRoutes] Error searching history: ${error.message}`, 'error');
        return res.status(500).json({
            success: false,
            error: 'Server error searching audit history'
        });
    }
});

/**
 * @route GET /history/export
 * @description Export audit history to CSV
 * @access Public
 */
router.get('/export', async (req, res) => {
    try {
        const { startDate, endDate, status } = req.query;
        
        logMessage(`[HistoryRoutes] Exporting audit history to CSV`);
        
        // Build the WHERE clause based on parameters
        let whereClause = [];
        let params = [];
        let paramIndex = 1;
        
        if (status && ['passed', 'failed'].includes(status)) {
            whereClause.push(`status = $${paramIndex}`);
            params.push(status);
            paramIndex++;
        }
        
        if (startDate) {
            whereClause.push(`timestamp >= $${paramIndex}`);
            params.push(startDate);
            paramIndex++;
        }
        
        if (endDate) {
            whereClause.push(`timestamp <= $${paramIndex}`);
            params.push(endDate);
            paramIndex++;
        }
        
        // Construct the final query
        const whereClauseStr = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';
        
        const query = `
            SELECT 
                url, 
                timestamp, 
                status, 
                failure_reason, 
                rejection_code
            FROM audit_results
            ${whereClauseStr}
            ORDER BY timestamp DESC
        `;
        
        const result = await db.query(query, params);
        
        // Set headers for CSV download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=audit_history.csv');
        
        // Write CSV header
        res.write('URL,Timestamp,Status,Failure Reason,Rejection Code\n');
        
        // Write data rows
        result.rows.forEach(row => {
            const csvRow = [
                `"${row.url}"`,
                `"${row.timestamp}"`,
                `"${row.status}"`,
                `"${row.failure_reason || ''}"`,
                `"${row.rejection_code || ''}"`
            ].join(',');
            
            res.write(csvRow + '\n');
        });
        
        res.end();
    } catch (error) {
        logMessage(`[HistoryRoutes] Error exporting history: ${error.message}`, 'error');
        return res.status(500).json({
            success: false,
            error: 'Server error exporting audit history'
        });
    }
});

module.exports = router; 