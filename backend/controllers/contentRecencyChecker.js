const axios = require('axios');
const { JSDOM } = require('jsdom');
const { logMessage } = require('../utils/logger');

class ContentRecencyChecker {
    constructor() {
        // Primary sitemap locations to check first
        this.primarySitemapPaths = [
            '/sitemap.xml',
            '/sitemap_index.xml'
        ];

        // Fallback sitemap locations to check if primary fails
        this.fallbackSitemapPaths = [
            '/wp-sitemap.xml',
            '/sitemap/sitemap.xml',
            '/sitemaps/sitemap.xml',
            '/sitemap/index.xml',
            '/sitemap.php',
            '/sitemap_news.xml',
            '/sitemap/web.xml',
            '/sitemap/category.xml',
            '/sitemap/post.xml',
            '/sitemap/page.xml'
        ];

        // Define selectors for date elements
        this.dateSelectors = [
            // Medal.tv specific selectors
            '.StyledText-sc-1sadyjn-0',
            '.iSdOTS',
            // Timestamp specific selectors
            '.duet--article--timestamp time',
            '[class*="timestamp"] time',
            '[class*="article"] time',
            // Common date containers
            '.post-info',
            '.date',
            '.published-date',
            'time',
            '[class*="date"]',
            '[class*="time"]',
            // Policy page selectors
            '[class*="terms"]',
            '[class*="policy"]',
            // Generic selectors that might contain dates
            'span',
            'div',
            'p'
        ];
    }

    async checkRecency(url) {
        logMessage(`📅 Checking content recency for ${url}`);
        
        try {
            // Extract hostname for sitemap paths
            const parsedUrl = new URL(url);
            const hostname = parsedUrl.hostname;
            const baseUrl = `${parsedUrl.protocol}//${hostname}`;
            
            // Aggregate all dates from all sources
            let allDates = [];
            let sourcesChecked = [];
            
            // Step 1: Check primary sitemaps concurrently
            logMessage(`🔍 Checking primary sitemaps for ${hostname}`);
            const primarySitemapPromises = this.primarySitemapPaths.map(path => {
                const sitemapUrl = `${baseUrl}${path}`;
                return this.checkSingleSitemap(sitemapUrl)
                    .then(dates => {
                        if (dates && dates.length > 0) {
                            sourcesChecked.push(`Primary sitemap: ${sitemapUrl} (${dates.length} dates)`);
                            
                            // Check if this source alone would pass the evaluation
                            const evaluation = this.evaluateDates(dates);
                            if (evaluation.status === 'pass') {
                                logMessage(`✅ Primary sitemap check passed: ${sitemapUrl}`);
                                return { earlyExit: true, result: { ...evaluation, source: sitemapUrl, dates } };
                            }
                            
                            // Otherwise, add dates to the aggregate pool
                            allDates = [...allDates, ...dates];
                            return { earlyExit: false, dates };
                        }
                        return { earlyExit: false, dates: [] };
                    })
                    .catch(err => {
                        logMessage(`⚠️ Error checking sitemap ${sitemapUrl}: ${err.message}`, 'warn');
                        return { earlyExit: false, dates: [] };
                    });
            });
            
            // Wait for all primary sitemap checks to complete
            const primaryResults = await Promise.all(primarySitemapPromises);
            
            // Check if any primary sitemap provided a passing result for early exit
            const passingPrimaryResult = primaryResults.find(result => result.earlyExit);
            if (passingPrimaryResult) {
                return passingPrimaryResult.result;
            }
            
            // Check if the combined dates from primary sitemaps pass
            if (allDates.length > 0) {
                const combinedEvaluation = this.evaluateDates(allDates);
                if (combinedEvaluation.status === 'pass') {
                    logMessage(`✅ Combined primary sitemap checks passed`);
                    return { 
                        ...combinedEvaluation, 
                        source: 'Combined primary sitemaps', 
                        sourcesChecked 
                    };
                }
            }
            
            // Step 2: Check fallback sitemaps concurrently
            logMessage(`🔍 Checking fallback sitemaps for ${hostname}`);
            const fallbackSitemapPromises = this.fallbackSitemapPaths.map(path => {
                const sitemapUrl = `${baseUrl}${path}`;
                return this.checkSingleSitemap(sitemapUrl)
                    .then(dates => {
                        if (dates && dates.length > 0) {
                            sourcesChecked.push(`Fallback sitemap: ${sitemapUrl} (${dates.length} dates)`);
                            
                            // Add dates to the aggregate pool
                            allDates = [...allDates, ...dates];
                            
                            // Check if combined dates now pass
                            const combinedEvaluation = this.evaluateDates(allDates);
                            if (combinedEvaluation.status === 'pass') {
                                logMessage(`✅ Combined sitemap checks passed after adding ${sitemapUrl}`);
                                return { earlyExit: true, result: { 
                                    ...combinedEvaluation, 
                                    source: 'Combined sitemaps', 
                                    sourcesChecked 
                                }};
                            }
                            
                            return { earlyExit: false, dates };
                        }
                        return { earlyExit: false, dates: [] };
                    })
                    .catch(err => {
                        logMessage(`⚠️ Error checking fallback sitemap ${sitemapUrl}: ${err.message}`, 'warn');
                        return { earlyExit: false, dates: [] };
                    });
            });
            
            // Wait for all fallback sitemap checks to complete
            const fallbackResults = await Promise.all(fallbackSitemapPromises);
            
            // Check if any fallback sitemap provided a passing result for early exit
            const passingFallbackResult = fallbackResults.find(result => result.earlyExit);
            if (passingFallbackResult) {
                return passingFallbackResult.result;
            }
            
            // Step 3: Extract dates from HTML content
            logMessage(`🔍 Extracting dates from HTML content for ${url}`);
            
            // First check the main URL
            try {
                const mainUrlDates = await this.extractDatesFromHtml(url);
                if (mainUrlDates && mainUrlDates.length > 0) {
                    sourcesChecked.push(`Main URL: ${url} (${mainUrlDates.length} dates)`);
                    allDates = [...allDates, ...mainUrlDates];
                    
                    // Check if combined dates now pass
                    const combinedEvaluation = this.evaluateDates(allDates);
                    if (combinedEvaluation.status === 'pass') {
                        logMessage(`✅ Combined checks passed after adding HTML dates from main URL`);
                        return { 
                            ...combinedEvaluation, 
                            source: 'Combined sources including HTML', 
                            sourcesChecked 
                        };
                    }
                }
            } catch (error) {
                logMessage(`⚠️ Error extracting dates from main URL: ${error.message}`, 'warn');
            }
            
            // Check additional pages that might contain older content
            const additionalPaths = [
                '/archive',
                '/archives',
                '/blog',
                '/news',
                '/articles',
                '/older-news',
                '/history',
                '/about',
                '/about-us',
                '/company',
                '/tos',
                '/legal'
            ];
            
            for (const path of additionalPaths) {
                try {
                    const additionalUrl = `${baseUrl}${path}`;
                    logMessage(`🔍 Checking additional URL for dates: ${additionalUrl}`);
                    
                    const additionalDates = await this.extractDatesFromHtml(additionalUrl);
                    if (additionalDates && additionalDates.length > 0) {
                        sourcesChecked.push(`Additional URL: ${additionalUrl} (${additionalDates.length} dates)`);
                        allDates = [...allDates, ...additionalDates];
                        
                        // Check if combined dates now pass
                        const combinedEvaluation = this.evaluateDates(allDates);
                        if (combinedEvaluation.status === 'pass') {
                            logMessage(`✅ Combined checks passed after adding HTML dates from ${additionalUrl}`);
                            return { 
                                ...combinedEvaluation, 
                                source: 'Combined sources including additional HTML', 
                                sourcesChecked 
                            };
                        }
                    }
                } catch (error) {
                    logMessage(`⚠️ Error extracting dates from additional URL: ${error.message}`, 'warn');
                    // Continue to next URL even if this one fails
                }
            }
            
            // Final evaluation with all collected dates
            if (allDates.length > 0) {
                const finalEvaluation = this.evaluateDates(allDates);
                logMessage(`📊 Final evaluation after checking all sources: ${finalEvaluation.status}`);
                return { 
                    ...finalEvaluation, 
                    source: 'All available sources', 
                    sourcesChecked,
                    totalDatesFound: allDates.length
                };
            }
            
            // If we get here, we couldn't find any dates
            logMessage(`❌ No dates found for ${url} after checking all sources`, 'error');
            return {
                status: 'fail',
                reason: 'No dates found in any source',
                details: 'Could not determine content recency',
                sourcesChecked
            };
        } catch (error) {
            logMessage(`❌ Error in checkRecency: ${error.message}`, 'error');
            return {
                status: 'error',
                reason: `Error checking content recency: ${error.message}`,
                details: error.stack
            };
        }
    }

    async checkSingleSitemap(sitemapUrl) {
        logMessage(`🔍 Checking sitemap: ${sitemapUrl}`);
        
        try {
            const response = await axios.get(sitemapUrl, {
                timeout: 10000,
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ReviewtronBot/1.0)' }
            });
            
            const xml = response.data;
            const dates = [];
            
            // Extract lastmod dates from sitemap
            const lastmodRegex = /<lastmod>(.+?)<\/lastmod>/g;
            let match;
            
            while ((match = lastmodRegex.exec(xml)) !== null) {
                this.tryParseDate(match[1], dates);
            }
            
            logMessage(`📊 Found ${dates.length} dates in sitemap ${sitemapUrl}`);
            return dates;
        } catch (error) {
            logMessage(`❌ Error fetching sitemap ${sitemapUrl}: ${error.message}`, 'error');
            throw error;
        }
    }

    async extractDatesFromHtml(url) {
        try {
            const response = await axios.get(url);
            const dom = new JSDOM(response.data);
            const dates = [];

            // 1. Check time elements first (highest priority)
            const timeElements = dom.window.document.querySelectorAll('time');
            timeElements.forEach(time => {
                // Check datetime attribute first
                const datetime = time.getAttribute('datetime');
                if (datetime) {
                    const date = new Date(datetime);
                    if (!isNaN(date)) {
                        logMessage(`[RecencyChecker] Found date in time datetime attribute: ${date.toISOString()}`);
                        dates.push(date);
                    }
                }
                
                // Also check text content as backup
                const text = time.textContent.trim();
                if (text) {
                    this.tryParseDate(text, dates);
                }
            });

            // 2. Check specific div classes next
            const divSelectors = [
                '.post-info',
                '.date',
                '.published-date',
                '.entry-date',
                '.article-date',
                '[class*="date"]',
                '[class*="time"]'
            ];

            divSelectors.forEach(selector => {
                const elements = dom.window.document.querySelectorAll(selector);
                elements.forEach(el => {
                    const text = el.textContent.trim();
                    if (!text) return;

                    logMessage(`[RecencyChecker] Found div with date class: "${text}" in selector ${selector}`);
                    
                    // Try parsing Month DD, YYYY format (e.g., "Feb 26, 2025")
                    const monthDayYearMatch = text.match(/([A-Za-z]+)\s+(\d{1,2})(?:,|\s+)?(\d{4})/);
                    if (monthDayYearMatch) {
                        const [_, month, day, year] = monthDayYearMatch;
                        const date = new Date(`${month} ${day}, ${year}`);
                        if (!isNaN(date)) {
                            logMessage(`[RecencyChecker] Parsed date from div: ${date.toISOString()}`);
                            dates.push(date);
                            return;
                        }
                    }

                    // Try other date formats if the specific format didn't match
                    this.tryParseDate(text, dates);
                });
            });

            // 3. Check meta tags
            const metaTags = dom.window.document.querySelectorAll('meta');
            metaTags.forEach(tag => {
                const property = tag.getAttribute('property');
                const name = tag.getAttribute('name');
                const content = tag.getAttribute('content');

                if (content && (
                    (property && property.includes('time')) ||
                    (property && property.includes('date')) ||
                    (name && name.includes('time')) ||
                    (name && name.includes('date'))
                )) {
                    const date = new Date(content);
                    if (!isNaN(date)) {
                        logMessage(`[RecencyChecker] Found date in meta tag: ${date.toISOString()}`);
                        dates.push(date);
                    }
                }
            });

            // 4. Check article tags
            const articles = dom.window.document.querySelectorAll('article');
            articles.forEach(article => {
                // Check article's time tags
                const timeTags = article.querySelectorAll('time');
                timeTags.forEach(time => {
                    const datetime = time.getAttribute('datetime') || time.textContent;
                    const date = new Date(datetime);
                    if (!isNaN(date)) {
                        logMessage(`[RecencyChecker] Found date in article time tag: ${date.toISOString()}`);
                        dates.push(date);
                    }
                });

                // Check article's date-related attributes
                const dateAttrs = [
                    article.getAttribute('data-date'),
                    article.getAttribute('data-published'),
                    article.getAttribute('data-modified'),
                    article.getAttribute('pubdate')
                ].filter(attr => attr);

                dateAttrs.forEach(attr => {
                    const date = new Date(attr);
                    if (!isNaN(date)) {
                        logMessage(`[RecencyChecker] Found date in article attribute: ${date.toISOString()}`);
                        dates.push(date);
                    }
                });
            });

            return dates;
        } catch (error) {
            logMessage(`[RecencyChecker] HTML extraction error for ${url}: ${error.message}`);
            return [];
        }
    }

    tryParseDate(text, dates) {
        let date;

        // 1. Try "Month DD, YYYY" format (e.g., "Feb 26, 2025")
        const monthDayYearMatch = text.match(/([A-Za-z]+)\s+(\d{1,2})(?:,|\s+)?(\d{4})/);
        if (monthDayYearMatch) {
            const [_, month, day, year] = monthDayYearMatch;
            date = new Date(`${month} ${day}, ${year}`);
            if (!isNaN(date)) {
                logMessage(`[RecencyChecker] Parsed 'Month DD YYYY' date: ${date.toISOString()}`);
                dates.push(date);
                return;
            }
        }

        // 2. Try "Updated Month YYYY" format
        const updatedMonthYearMatch = text.match(/Updated\s+([A-Za-z]+)\s+(\d{4})/i);
        if (updatedMonthYearMatch) {
            const [_, month, year] = updatedMonthYearMatch;
            date = new Date(`${month} 1, ${year}`);
            if (!isNaN(date)) {
                logMessage(`[RecencyChecker] Parsed 'Updated Month YYYY' date: ${date.toISOString()}`);
                dates.push(date);
                return;
            }
        }

        // 3. Try "Month YYYY" format
        const monthYearMatch = text.match(/([A-Za-z]+)\s+(\d{4})/);
        if (monthYearMatch) {
            const [_, month, year] = monthYearMatch;
            date = new Date(`${month} 1, ${year}`);
            if (!isNaN(date)) {
                logMessage(`[RecencyChecker] Parsed 'Month YYYY' date: ${date.toISOString()}`);
                dates.push(date);
                return;
            }
        }

        // 4. Try direct parsing as a fallback
        date = new Date(text);
        if (!isNaN(date)) {
            logMessage(`[RecencyChecker] Parsed direct date: ${date.toISOString()}`);
            dates.push(date);
        }
    }

    evaluateDates(dates) {
        // Sort dates in descending order (newest first)
        dates.sort((a, b) => b - a);
        
        const mostRecent = dates[0];
        const oldest = dates[dates.length - 1];
        const now = new Date();
        
        // Calculate days since most recent and oldest content
        const daysSinceRecent = (now - mostRecent) / (1000 * 60 * 60 * 24);
        const daysSinceOldest = (now - oldest) / (1000 * 60 * 60 * 24);

        logMessage(`[RecencyChecker] Most recent content: ${daysSinceRecent} days old`);
        logMessage(`[RecencyChecker] Oldest content: ${daysSinceOldest} days old`);

        const result = {
            dates: {
                mostRecent: mostRecent.toISOString(),
                oldest: oldest.toISOString()
            },
            contentAge: {
                mostRecentDays: Math.round(daysSinceRecent),
                oldestDays: Math.round(daysSinceOldest)
            }
        };

        // Check requirements:
        // 1. Most recent content must be within 30 days
        // 2. Must have content older than 95 days
        if (daysSinceRecent > 30) {
            return {
                ...result,
                status: "fail",
                reason: "Lacking 4 months or recent content",
                details: `Most recent content is ${Math.round(daysSinceRecent)} days old (must be less than 30 days)`
            };
        }

        if (daysSinceOldest < 95) {
            return {
                ...result,
                status: "fail",
                reason: "Lacking 4 months or recent content",
                details: `Oldest content is only ${Math.round(daysSinceOldest)} days old (must be more than 95 days)`
            };
        }

        return {
            ...result,
            status: "pass",
            reason: "Content meets recency and historical requirements",
            details: `Content ranges from ${Math.round(daysSinceRecent)} to ${Math.round(daysSinceOldest)} days old`
        };
    }
}

module.exports = new ContentRecencyChecker(); 