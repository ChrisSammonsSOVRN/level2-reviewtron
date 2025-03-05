const { logMessage } = require('../utils/logger');
const url = require('url');
const axios = require('axios');
const bannedWords = require('../utils/bannedWords');
const contentRecencyChecker = require('./contentRecencyChecker');
const hateSpeechChecker = require('./hateSpeechChecker');
const plagiarismChecker = require('./plagiarismChecker');
const imageAnalyzer = require('./imageAnalyzer');
const adAnalyzer = require('./adAnalyzer');
const sqlGenerator = require('./sqlGenerator');
const db = require('../db/database'); // Assuming we have a database connection module
const puppeteer = require('puppeteer-core');

/**
 * Checks if a URL contains banned words or patterns
 * @param {string} urlString - The URL to check
 * @returns {Object|null} - Result object if banned words found, null otherwise
 */
function checkBannedWords(urlString) {
    logMessage(`🔍 Checking for banned words in URL: ${urlString}`);
    
    try {
        // Parse the URL to get its components
        const parsedUrl = new URL(urlString);
        const hostname = parsedUrl.hostname.toLowerCase();
        const pathname = parsedUrl.pathname.toLowerCase();
        const fullUrl = urlString.toLowerCase();
        
        // Check for banned TLDs
        const tld = hostname.split('.').pop(); // Get the last part after the dot
        if (bannedWords.bannedTLDs && bannedWords.bannedTLDs.includes(tld)) {
            logMessage(`❌ Banned TLD detected: "${tld}"`);
            return {
                status: "fail",
                reason: `Banned TLD detected`,
                details: `The domain uses a banned top-level domain: .${tld}`,
                category: 'bannedTLD'
            };
        }
        
        // Check each category of banned words
        for (const [category, wordList] of Object.entries(bannedWords)) {
            // Skip the bannedTLDs category as we've already checked it
            if (category === 'bannedTLDs') continue;
            
            for (const word of wordList) {
                // Check hostname (domain)
                if (hostname.includes(word)) {
                    logMessage(`❌ Banned word detected in hostname: "${word}" (Category: ${category})`);
                    return {
                        status: "fail",
                        reason: `Banned content detected (${category})`,
                        details: `The domain contains banned term: ${word}`,
                        category
                    };
                }
                
                // Check pathname (URL path)
                if (pathname.includes(word)) {
                    logMessage(`❌ Banned word detected in pathname: "${word}" (Category: ${category})`);
                    return {
                        status: "fail",
                        reason: `Banned content detected (${category})`,
                        details: `The URL path contains banned term: ${word}`,
                        category
                    };
                }
                
                // Check full URL (including query parameters)
                if (fullUrl.includes(word)) {
                    logMessage(`❌ Banned word detected in URL: "${word}" (Category: ${category})`);
                    return {
                        status: "fail",
                        reason: `Banned content detected (${category})`,
                        details: `The URL contains banned term: ${word}`,
                        category
                    };
                }
            }
        }
        
        // No banned words found
        logMessage(`✓ No banned words detected in URL`);
        return null;
        
    } catch (error) {
        logMessage(`❌ Error checking banned words: ${error.message}`, 'error');
        return null; // Continue with other checks if there's an error parsing the URL
    }
}

/**
 * Checks if a URL redirects to an external domain
 * @param {string} urlString - The URL to check
 * @returns {Promise<Object|null>} - Result object if redirect detected, null otherwise
 */
async function checkRedirect(urlString) {
    logMessage(`🔍 Checking for redirects in URL: ${urlString}`);
    
    try {
        // Parse the original URL to get its hostname
        const originalUrl = new URL(urlString);
        const originalHostname = originalUrl.hostname.toLowerCase();
        
        // Perform a HEAD request with redirects disabled
        const response = await axios.head(urlString, {
            maxRedirects: 0,
            validateStatus: status => true // Accept all status codes
        });
        
        // Check if the response indicates a redirect (3xx status code)
        if (response.status >= 300 && response.status < 400) {
            // Get the redirect location
            const location = response.headers.location;
            
            if (!location) {
                logMessage(`⚠️ Redirect detected (${response.status}) but no Location header found`);
                return {
                    status: "review",
                    reason: "Redirect without destination",
                    details: `The URL redirects (${response.status}) but no destination was specified`
                };
            }
            
            // Parse the redirect URL
            let redirectUrl;
            try {
                // Handle relative URLs
                if (location.startsWith('/')) {
                    redirectUrl = new URL(location, urlString);
                } else {
                    redirectUrl = new URL(location);
                }
            } catch (error) {
                logMessage(`⚠️ Invalid redirect URL: ${location}`);
                return {
                    status: "review",
                    reason: "Invalid redirect",
                    details: `The URL redirects to an invalid location: ${location}`
                };
            }
            
            // Check if the redirect is to an external domain
            const redirectHostname = redirectUrl.hostname.toLowerCase();
            
            if (redirectHostname !== originalHostname) {
                logMessage(`❌ External redirect detected: ${originalHostname} → ${redirectHostname}`);
                return {
                    status: "fail",
                    reason: "External redirect",
                    details: `The URL redirects to an external domain: ${redirectHostname}`,
                    redirectUrl: redirectUrl.href
                };
            }
            
            // Internal redirect (same domain)
            logMessage(`ℹ️ Internal redirect detected: ${originalUrl.pathname} → ${redirectUrl.pathname}`);
            return null; // Allow internal redirects
        }
        
        // No redirect
        logMessage(`✓ No redirect detected for URL`);
        return null;
        
    } catch (error) {
        logMessage(`❌ Error checking redirect: ${error.message}`, 'error');
        return {
            status: "error",
            reason: "Redirect check failed",
            details: error.message
        };
    }
}

/**
 * Analyzes a URL for various compliance checks
 * @param {string} url - The URL to analyze
 * @returns {Object} - Analysis results
 */
async function analyzeURL(url) {
    logMessage(`🔍 Starting URL analysis: ${url}`);
    
    // Initialize results object
    const results = {
        url,
        timestamp: new Date().toISOString(),
        status: "pending",
        checks: {}
    };
    
    // PHASE 0: Check for banned words in URL
    logMessage(`🔍 PHASE 0: Checking for banned words in URL: ${url}`);
    const bannedWordsResult = checkBannedWords(url);
    if (bannedWordsResult) {
        logMessage(`❌ URL failed banned words check: ${url}`);
        results.status = 'fail';
        results.checks.bannedWords = bannedWordsResult;
        return results; // Short-circuit and return immediately
    }
    
    // PHASE 1: Check for redirects
    logMessage(`🔍 PHASE 1: Checking for redirects: ${url}`);
    try {
        const redirectResult = await checkRedirect(url);
        if (redirectResult && redirectResult.status === 'fail') {
            logMessage(`❌ URL failed redirect check: ${url}`);
            results.status = 'fail';
            results.checks.redirect = redirectResult;
            return results; // Short-circuit and return immediately
        }
        
        // Store the redirect check result if it's a warning/review
        if (redirectResult) {
            results.checks.redirect = redirectResult;
        }
    } catch (error) {
        logMessage(`❌ Error in redirect check: ${error.message}`, 'error');
        results.checks.redirect = {
            status: "error",
            reason: "Redirect check failed",
            details: error.message
        };
    }
    
    // PHASE 2: Run Content Recency Check Sequentially
    logMessage(`🔄 Starting Phase 2: Content Recency Check for ${url}`);
    let contentRecencyResult = null;
    try {
        // Fix: Use checkRecency instead of checkContent
        contentRecencyResult = await Promise.race([
            contentRecencyChecker.checkRecency(url),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Content recency check timed out after 30 seconds')), 30000)
            )
        ]);
        
        logMessage(`✅ Content recency check completed: ${JSON.stringify(contentRecencyResult)}`);
        results.contentRecency = contentRecencyResult;
        
        if (contentRecencyResult && contentRecencyResult.status === 'fail') {
            results.status = 'fail';
            logMessage(`❌ Content recency check failed: ${contentRecencyResult.reason}`);
        } else if (contentRecencyResult && contentRecencyResult.status === 'review') {
            if (results.status !== 'fail') results.status = 'review';
            logMessage(`⚠️ Content recency check needs review: ${contentRecencyResult.reason}`);
        }
    } catch (error) {
        logMessage(`❌ Error in content recency check: ${error.message}`, 'error');
        results.contentRecency = {
            status: 'error',
            reason: `Error checking content recency: ${error.message}`
        };
    }
    logMessage(`🔄 Completed Phase 2: Content Recency Check`);
    
    // PHASE 3: Run Remaining Tests Concurrently
    // Only proceed to Phase 3 after Phase 2 is complete
    logMessage(`🔍 PHASE 3: Running remaining checks concurrently for: ${url}`);
    
    // Define the remaining checks to run
    const remainingChecks = [
        {
            name: 'hateSpeech',
            displayName: 'Hate Speech',
            runner: async () => {
                logMessage(`🔍 Analyzing hate speech for: ${url}`);
                return await hateSpeechChecker.checkContent(url);
            },
            timeout: 60000 // 60 seconds timeout
        },
        {
            name: 'plagiarism',
            displayName: 'Plagiarism',
            runner: async () => {
                logMessage(`🔍 Analyzing plagiarism for: ${url}`);
                return await plagiarismChecker.checkContent(url);
            },
            timeout: 60000 // 60 seconds timeout
        },
        {
            name: 'images',
            displayName: 'Image Analysis',
            runner: async () => {
                logMessage(`🔍 Analyzing images for: ${url}`);
                return await imageAnalyzer.analyzeUrl(url);
            },
            timeout: 90000 // 90 seconds timeout
        },
        {
            name: 'ads',
            displayName: 'Ad Analysis',
            runner: async () => {
                logMessage(`🔍 Analyzing ads for: ${url}`);
                return await adAnalyzer.analyzeUrl(url);
            },
            timeout: 60000 // 60 seconds timeout
        }
    ];
    
    // Create a promise for each remaining check with timeout
    const checkPromises = remainingChecks.map(check => {
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`${check.displayName} check timed out after ${check.timeout/1000} seconds`));
            }, check.timeout);
        });
        
        // Create the actual check promise
        const checkPromise = new Promise(async (resolve) => {
            try {
                const result = await check.runner();
                resolve({
                    name: check.name,
                    result: result
                });
            } catch (error) {
                logMessage(`❌ Error in ${check.displayName} check: ${error.message}`, 'error');
                resolve({
                    name: check.name,
                    result: {
                        status: "error",
                        reason: `${check.displayName} check failed`,
                        details: error.message
                    }
                });
            }
        });
        
        // Race between the check and the timeout
        return Promise.race([checkPromise, timeoutPromise])
            .catch(error => {
                logMessage(`⏱️ ${check.displayName} check: ${error.message}`, 'warn');
                return {
                    name: check.name,
                    result: {
                        status: "error",
                        reason: "Check timed out",
                        details: error.message
                    }
                };
            });
    });
    
    // Run all remaining checks concurrently and wait for all to complete or timeout
    const checkResults = await Promise.allSettled(checkPromises);
    
    // Process the results from the concurrent checks
    checkResults.forEach(promiseResult => {
        if (promiseResult.status === 'fulfilled') {
            const { name, result } = promiseResult.value;
            results.checks[name] = result;
        } else {
            // This should not happen due to our error handling above, but just in case
            logMessage(`Unexpected promise rejection: ${promiseResult.reason}`, 'error');
        }
    });
    
    // Determine overall status based on all checks
    let hasFailure = false;
    let hasError = false;
    let hasReview = false;
    
    Object.values(results.checks).forEach(result => {
        if (result.status === 'fail') {
            hasFailure = true;
        } else if (result.status === 'error') {
            hasError = true;
        } else if (result.status === 'review') {
            hasReview = true;
        }
    });
    
    // Set final status
    if (hasFailure) {
        results.status = 'fail';
    } else if (hasError) {
        results.status = 'error';
    } else if (hasReview) {
        results.status = 'review';
    } else {
        results.status = 'pass';
    }
    
    logMessage(`✅ URL Analysis Completed: ${url} (Status: ${results.status})`);

    // Store the audit result in the database
    try {
        // Generate SQL for the audit result
        const sqlResult = sqlGenerator.generateSQLForAudit(results);
        
        if (sqlResult.success) {
            logMessage(`[AuditController] Generated SQL for audit of ${url}`);
            
            // Execute the SQL queries
            await db.query(sqlResult.sql.transaction);
            logMessage(`[AuditController] Stored audit result in database for ${url}`);
            
            // Optionally save SQL to file for debugging
            if (process.env.SAVE_SQL_TO_FILE === 'true') {
                await sqlGenerator.saveToFile(sqlResult.sql.transaction, url);
            }
            
            // Add database storage result to the response
            results.databaseStorage = {
                success: true,
                status: sqlResult.status,
                rejectionCode: sqlResult.rejectionCode
            };
        } else {
            logMessage(`[AuditController] Failed to generate SQL for audit of ${url}: ${sqlResult.error}`, 'error');
            results.databaseStorage = {
                success: false,
                error: sqlResult.error
            };
        }
    } catch (error) {
        logMessage(`[AuditController] Error storing audit result in database: ${error.message}`, 'error');
        results.databaseStorage = {
            success: false,
            error: error.message
        };
    }

    return results;
}

/**
 * Audit a URL for SEO and content issues
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function auditUrl(req, res) {
    const url = req.params.url;
    let browser = null;
    let page = null;
    
    logMessage(`Starting audit for URL: ${url}`);
    
    // Validate URL
    try {
        new URL(url); // Will throw if URL is invalid
    } catch (error) {
        logMessage(`Invalid URL provided: ${url}`, 'error');
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid URL provided' 
        });
    }
    
    try {
        // Launch browser with updated configuration
        browser = await puppeteer.launch({
            executablePath: process.env.NODE_ENV === 'production' 
              ? '/usr/bin/google-chrome-stable'  // Path to Chrome on Render
              : process.platform === 'darwin' 
                ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' // Mac
                : process.platform === 'win32'
                  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' // Windows
                  : '/usr/bin/google-chrome', // Linux
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            headless: "new",
            ignoreDefaultArgs: ['--disable-extensions']
        });
        
        // Create new page
        page = await browser.newPage();
        
        // Set viewport
        await page.setViewport({ width: 1280, height: 800 });
        
        // Set user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Set extra HTTP headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9'
        });
        
        // Navigate to URL
        logMessage(`Navigating to ${url}`);
        await page.goto(url, { 
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        // Get page content
        const content = await page.content();
        
        // Take screenshot
        const screenshot = await page.screenshot({ 
            type: 'jpeg',
            quality: 80,
            fullPage: false
        });
        
        // Analyze screenshot with image analyzer
        const imageData = await imageAnalyzer.analyzeImage(screenshot);
        
        // Extract page data
        const title = await page.evaluate(() => document.title);
        const metaTags = await page.evaluate(() => {
            const meta = {};
            const descriptionTag = document.querySelector('meta[name="description"]');
            if (descriptionTag) {
                meta.description = descriptionTag.getAttribute('content');
            }
            return meta;
        });
        
        // Extract headings
        const h1s = await page.evaluate(() => 
            Array.from(document.querySelectorAll('h1')).map(h => h.innerText.trim())
        );
        
        const h2s = await page.evaluate(() => 
            Array.from(document.querySelectorAll('h2')).map(h => h.innerText.trim())
        );
        
        // Extract images
        const images = await page.evaluate(() => 
            Array.from(document.querySelectorAll('img')).map(img => ({
                src: img.src,
                alt: img.alt || ''
            }))
        );
        
        // Extract links
        const links = await page.evaluate(() => 
            Array.from(document.querySelectorAll('a')).map(a => ({
                href: a.href,
                text: a.innerText.trim() || a.getAttribute('title') || ''
            }))
        );
        
        // Perform checks
        const checks = [
            {
                name: 'title',
                status: title && title.length > 0 ? 'pass' : 'fail',
                details: { title }
            },
            {
                name: 'meta_description',
                status: metaTags.description && metaTags.description.length > 0 ? 'pass' : 'fail',
                details: { description: metaTags.description || '' }
            },
            {
                name: 'headings',
                status: h1s.length > 0 ? 'pass' : 'fail',
                details: { h1s, h2s }
            },
            {
                name: 'images',
                status: images.length > 0 ? 'pass' : 'fail',
                details: { 
                    count: images.length,
                    withAlt: images.filter(img => img.alt && img.alt.length > 0).length,
                    withoutAlt: images.filter(img => !img.alt || img.alt.length === 0).length
                }
            },
            {
                name: 'links',
                status: links.length > 0 ? 'pass' : 'fail',
                details: { 
                    count: links.length,
                    internal: links.filter(link => link.href.includes(url)).length,
                    external: links.filter(link => !link.href.includes(url)).length
                }
            }
        ];
        
        // Create audit result object
        const auditResultData = {
            url,
            timestamp: new Date().toISOString(),
            title,
            description: metaTags.description || '',
            screenshot: screenshot.toString('base64'),
            checks,
            imageAnalysis: imageData
        };
        
        // Store audit result in database
        try {
            await storeAuditResult(auditResultData);
            logMessage(`Audit result for ${url} stored in database`);
        } catch (dbError) {
            logMessage(`Database error storing audit result: ${dbError.message}`, 'error');
            // Continue with response even if DB storage fails
            // We'll just log the error but still return the audit result to the client
        }
        
        // Return audit result
        return res.status(200).json({
            success: true,
            url,
            title,
            description: metaTags.description || '',
            checks,
            imageAnalysis: imageData
        });
        
    } catch (error) {
        logMessage(`Error during audit: ${error.message}`, 'error');
        return res.status(500).json({ 
            success: false, 
            error: `Error during audit: ${error.message}` 
        });
    } finally {
        // Close page and browser
        if (page) await page.close().catch(e => logMessage(`Error closing page: ${e.message}`, 'error'));
        if (browser) await browser.close().catch(e => logMessage(`Error closing browser: ${e.message}`, 'error'));
        logMessage(`Audit completed for URL: ${url}`);
    }
}

/**
 * Store audit result in database
 * @param {Object} auditResult - Audit result object
 * @returns {Promise<Object>} - Database operation result
 */
async function storeAuditResult(auditResult) {
    try {
        // Generate SQL for audit result
        const sqlResult = sqlGenerator.generateSQLForAudit(auditResult);
        
        if (!sqlResult.success) {
            throw new Error(`Failed to generate SQL: ${sqlResult.error}`);
        }
        
        // Execute transaction
        const result = await db.transaction(async (client) => {
            // Extract domain from URL
            const url = new URL(auditResult.url);
            const domain = url.hostname;
            
            // Store site information
            const siteResult = await client.query(
                'INSERT INTO sites (url, domain) VALUES ($1, $2) ON CONFLICT (url) DO UPDATE SET domain = $2 RETURNING id',
                [auditResult.url, domain]
            );
            
            const siteId = siteResult.rows[0].id;
            
            // Store audit result
            const auditInsertResult = await client.query(
                `INSERT INTO audit_results 
                (site_id, timestamp, title, description, screenshot) 
                VALUES ($1, $2, $3, $4, $5) 
                RETURNING id`,
                [
                    siteId,
                    auditResult.timestamp,
                    auditResult.title || '',
                    auditResult.description || '',
                    auditResult.screenshot || null
                ]
            );
            
            const auditId = auditInsertResult.rows[0].id;
            
            // Store check results
            for (const check of auditResult.checks) {
                await client.query(
                    `INSERT INTO audit_check_results 
                    (audit_id, check_name, status, details) 
                    VALUES ($1, $2, $3, $4)`,
                    [
                        auditId,
                        check.name,
                        check.status,
                        JSON.stringify(check.details || {})
                    ]
                );
            }
            
            return { success: true, auditId };
        });
        
        return result;
    } catch (error) {
        logMessage(`Database error in storeAuditResult: ${error.message}`, 'error');
        throw new Error(`Database error: ${error.message}`);
    }
}

module.exports = {
    analyzeURL,
    auditUrl,
    storeAuditResult
};



