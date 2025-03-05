const axios = require('axios');
const puppeteer = require('puppeteer-core');
const { logMessage } = require('../utils/logger');
const path = require('path');
const { getPuppeteerLaunchOptions } = require('../utils/puppeteerConfig');

// Check if JSDOM and Readability are available, if not provide instructions
let JSDOM, Readability;
try {
    JSDOM = require('jsdom').JSDOM;
} catch (error) {
    console.error('JSDOM module not found. Please install it using: npm install jsdom');
}

try {
    Readability = require('@mozilla/readability').Readability;
} catch (error) {
    console.error('@mozilla/readability module not found. Please install it using: npm install @mozilla/readability');
}

class PlagiarismChecker {
    constructor() {
        // Add configurable API call limit with a default value of 2
        this.maxApiCalls = process.env.MAX_PLAGIARISM_API_CALLS ? 
            parseInt(process.env.MAX_PLAGIARISM_API_CALLS) : 2;
        
        logMessage(`[PlagiarismChecker] Initialized with maxApiCalls: ${this.maxApiCalls}`);
        
        logMessage(`[PlagiarismChecker] Initializing`);
        
        // Configure Google search API
        this.searchApiKey = process.env.GOOGLE_SEARCH_API_KEY || 'your-api-key';
        this.searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID || 'your-search-engine-id';
    }

    async checkContent(url) {
        try {
            logMessage(`[PlagiarismChecker] Starting plagiarism check for URL: ${url}`);
            
            // Extract content from URL
            const content = await this.extractContent(url);
            
            if (!content || content.length < 10) {
                logMessage(`[PlagiarismChecker] No content extracted from URL: ${url}`, 'warn');
                return {
                    url,
                    status: "error",
                    reason: "No content extracted",
                    details: "Could not extract meaningful content from the provided URL"
                };
            }
            
            logMessage(`[PlagiarismChecker] Content extracted, length: ${content.length} characters`);
            
            // Get representative paragraphs for checking
            const paragraphs = this.getRepresentativeParagraphs(content);
            
            if (paragraphs.length === 0) {
                logMessage(`[PlagiarismChecker] No paragraphs found for checking`, 'warn');
                return {
                    url,
                    status: "error",
                    reason: "No paragraphs found",
                    details: "Could not find suitable paragraphs for plagiarism checking"
                };
            }
            
            // Check paragraphs for plagiarism
            const results = await this.checkParagraphs(paragraphs, url);
            
            // Evaluate results and return final assessment
            return this.evaluateResults(results, url);
            
        } catch (error) {
            logMessage(`[PlagiarismChecker] Error checking content: ${error.message}`, 'error');
            return {
                url,
                status: "error",
                reason: "Processing error",
                details: error.message
            };
        }
    }
    
    /**
     * Intelligently truncates text to a specified character limit while preserving natural sentence boundaries
     * @param {string} text - The text to truncate
     * @param {number} maxLength - Maximum character length (default: 500)
     * @returns {string} - Truncated text
     */
    truncateText(text, maxLength = 500) {
        logMessage(`[PlagiarismChecker] Truncating text from ${text.length} characters to max ${maxLength}`);
        
        // If text is already shorter than the limit, return it as is
        if (text.length <= maxLength) {
            return text;
        }
        
        // Get the first maxLength characters
        const truncated = text.substring(0, maxLength);
        
        // Find the last sentence-ending punctuation
        const lastPeriodIndex = truncated.lastIndexOf('.');
        const lastQuestionIndex = truncated.lastIndexOf('?');
        const lastExclamationIndex = truncated.lastIndexOf('!');
        
        // Find the maximum of these indices (the last sentence boundary)
        const indices = [lastPeriodIndex, lastQuestionIndex, lastExclamationIndex]
            .filter(index => index > 0);
        
        if (indices.length === 0) {
            // No sentence boundary found, return simple truncation with ellipsis
            logMessage(`[PlagiarismChecker] No sentence boundary found, using simple truncation`);
            return truncated + '...';
        }
        
        const lastSentenceEnd = Math.max(...indices);
        
        // Return text up to the last sentence boundary plus ellipsis
        const result = text.substring(0, lastSentenceEnd + 1) + '...';
        logMessage(`[PlagiarismChecker] Truncated text to ${result.length} characters at natural boundary`);
        return result;
    }

    async extractContent(url) {
        let browser = null;
        try {
            logMessage(`[PlagiarismChecker] Extracting content from URL: ${url}`);
            
            // Get Puppeteer launch options
            const launchOptions = getPuppeteerLaunchOptions();
            
            // Check if Chrome executable was found
            if (!launchOptions._chromeExists) {
                logMessage('[PlagiarismChecker] Chrome executable not found, cannot launch browser', 'error');
                return {
                    status: 'error',
                    reason: 'Chrome not found',
                    details: 'Chrome executable not found on server. Please contact support.'
                };
            }
            
            // Launch Puppeteer with proper configurations
            browser = await puppeteer.launch(launchOptions);
            
            // Open a new page and set the environment
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            await page.setViewport({ width: 1280, height: 800 });
            
            // Set up request interception to block unnecessary resources
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                const resourceType = request.resourceType();
                if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                    request.abort();
                } else {
                    request.continue();
                }
            });
            
            // Navigate to the target URL
            logMessage(`[PlagiarismChecker] Navigating to URL: ${url}`);
            await page.goto(url, { 
                waitUntil: ['domcontentloaded', 'networkidle2'],
                timeout: 60000
            });
            
            // Extract the full HTML content
            const html = await page.content();
            logMessage(`[PlagiarismChecker] HTML content extracted, length: ${html.length}`);
            
            let content = '';
            
            // Check if JSDOM and Readability are available
            if (JSDOM && Readability) {
                // Parse the HTML with JSDOM
                const dom = new JSDOM(html, { url });
                
                // Extract the article body with Readability
                const reader = new Readability(dom.window.document);
                const article = reader.parse();
                
                if (article && article.textContent) {
                    logMessage(`[PlagiarismChecker] Successfully extracted article using Readability`);
                    content = article.textContent;
                }
            }
            
            // If content is still empty, use fallback methods
            if (!content || content.length < 100) {
                logMessage(`[PlagiarismChecker] Readability extraction failed or not available, falling back to alternative methods`);
                
                // Fallback 1: Try to find common article containers
                const articleSelectors = [
                    'article', '.article', '.post', '.content', 
                    'main', '#main', '.main-content', '.post-content',
                    '.entry-content', '.article-content'
                ];
                
                let articleContent = '';
                for (const selector of articleSelectors) {
                    const articleElement = await page.$(selector);
                    if (articleElement) {
                        articleContent = await page.evaluate(el => el.textContent, articleElement);
                        if (articleContent && articleContent.length > 100) {
                            logMessage(`[PlagiarismChecker] Found article content using selector: ${selector}`);
                            break;
                        }
                    }
                }
                
                if (articleContent && articleContent.length > 100) {
                    content = articleContent;
                } else {
                    // Fallback 2: Extract all paragraph text
                    logMessage(`[PlagiarismChecker] No article container found, extracting all paragraphs`);
                    content = await page.evaluate(() => {
                        return Array.from(document.querySelectorAll('p'))
                            .map(p => p.textContent)
                            .filter(text => text.trim().length > 0)
                            .join('\n\n');
                    });
                    
                    // Fallback 3: If still no content, get all body text
                    if (!content || content.length < 100) {
                        logMessage(`[PlagiarismChecker] No paragraphs found, extracting body text`);
                        content = await page.evaluate(() => document.body.textContent);
                    }
                }
            }
            
            // Clean up the content
            content = content.replace(/\s+/g, ' ').trim();
            logMessage(`[PlagiarismChecker] Extracted content length before truncation: ${content.length}`);
            
            // Truncate the content to 500 characters with intelligent boundary detection
            content = this.truncateText(content, 500);
            
            return content;
        } catch (error) {
            logMessage(`[PlagiarismChecker] Error extracting content: ${error.message}`, 'error');
            throw error;
        } finally {
            // Close the browser
            if (browser) {
                await browser.close();
                logMessage(`[PlagiarismChecker] Browser closed`);
            }
        }
    }

    async launchBrowser() {
        return await puppeteer.launch(getPuppeteerLaunchOptions());
    }

    /**
     * Gets representative paragraphs from content for plagiarism checking
     * @param {string} content - The content to analyze
     * @returns {string[]} - Array of representative paragraphs
     */
    getRepresentativeParagraphs(content) {
        // Split content into paragraphs
        const paragraphs = content.split(/\n\s*\n/).filter(p => 
            p.trim().length > 100 && // Only paragraphs with substantial content
            !/^[\s\d.,:;!?()[\]{}'"<>]+$/.test(p) // Exclude paragraphs that are just punctuation or numbers
        );
        
        logMessage(`[PlagiarismChecker] Found ${paragraphs.length} substantial paragraphs`);
        
        if (paragraphs.length === 0) {
            return [];
        }
        
        // Sort paragraphs by length (descending) to prioritize longer, more substantial paragraphs
        const sortedParagraphs = [...paragraphs].sort((a, b) => b.length - a.length);
        
        // Limit to maxApiCalls paragraphs to control API usage
        const representativeParagraphs = sortedParagraphs.slice(0, this.maxApiCalls);
        
        logMessage(`[PlagiarismChecker] Selected ${representativeParagraphs.length} representative paragraphs (limited by maxApiCalls: ${this.maxApiCalls})`);
        
        return representativeParagraphs;
    }

    /**
     * Checks paragraphs for plagiarism
     * @param {string[]} paragraphs - Array of paragraphs to check
     * @param {string} originalUrl - The original URL being checked
     * @returns {Object[]} - Array of results for each paragraph
     */
    async checkParagraphs(paragraphs, originalUrl) {
        const results = [];
        let apiCallsMade = 0;
        
        // Limit the number of paragraphs to check based on maxApiCalls
        const paragraphsToCheck = paragraphs.slice(0, this.maxApiCalls);
        
        logMessage(`[PlagiarismChecker] Checking ${paragraphsToCheck.length} paragraphs for plagiarism (limited by maxApiCalls: ${this.maxApiCalls})`);
        
        for (const paragraph of paragraphsToCheck) {
            try {
                // Truncate text to a reasonable length for API calls
                const truncatedText = this.truncateText(paragraph);
                
                // Search for similar content
                const searchResults = await this.searchSimilarContent(truncatedText);
                
                // Skip empty results
                if (!searchResults || searchResults.length === 0) {
                    results.push({
                        paragraph: truncatedText,
                        similarityScore: 0,
                        matchedUrl: null,
                        status: 'pass',
                        reason: 'No similar content found'
                    });
                    continue;
                }
                
                // Check similarity with each result
                const similarityResults = await Promise.all(
                    searchResults.map(result => this.checkSimilarity(truncatedText, result))
                );
                
                // Find the highest similarity score
                const highestSimilarity = similarityResults.reduce((max, result) => 
                    result.similarityScore > max.similarityScore ? result : max, 
                    { similarityScore: 0 }
                );
                
                // Add the original paragraph to the highest similarity result
                // This fixes the issue where paragraph is missing in the result
                highestSimilarity.paragraph = truncatedText;
                
                // Add to results
                results.push(highestSimilarity);
                
                // Increment API call counter
                apiCallsMade++;
                
                // Log progress
                logMessage(`[PlagiarismChecker] Processed paragraph ${apiCallsMade}/${paragraphsToCheck.length} with similarity score: ${highestSimilarity.similarityScore}`);
                
            } catch (error) {
                logMessage(`[PlagiarismChecker] Error checking paragraph: ${error.message}`, 'error');
                results.push({
                    paragraph: this.truncateText(paragraph),
                    similarityScore: 0,
                    matchedUrl: null,
                    status: 'error',
                    reason: `Error checking similarity: ${error.message}`
                });
            }
        }
        
        logMessage(`[PlagiarismChecker] Completed plagiarism check with ${apiCallsMade} API calls`);
        
        return results;
    }

    async searchSimilarContent(text) {
        try {
            // Use Google Custom Search API to find similar content
            const query = text.substring(0, 128); // Use first 128 chars as search query
            
            const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
                params: {
                    key: this.searchApiKey,
                    cx: this.searchEngineId,
                    q: query
                }
            });
            
            if (response.data && response.data.items) {
                return response.data.items;
            }
            
            return [];
        } catch (error) {
            logMessage(`[PlagiarismChecker] Error searching similar content: ${error.message}`, 'error');
            return [];
        }
    }

    async checkSimilarity(originalText, searchResult) {
        try {
            // Extract content from search result URL
            const content = await this.extractContent(searchResult.link);
            
            if (!content) {
                return { similarityScore: 0, matchedText: '' };
            }
            
            // Calculate similarity score
            const similarityScore = this.calculateSimilarity(originalText, content);
            
            // Find the best matching substring
            let bestMatch = '';
            if (similarityScore > 0.5) {
                // Simple approach: find the longest common substring
                const words1 = originalText.split(/\s+/);
                const words2 = content.split(/\s+/);
                
                for (let i = 0; i < words1.length; i++) {
                    for (let j = 0; j < words2.length; j++) {
                        let k = 0;
                        while (i + k < words1.length && j + k < words2.length && 
                               words1[i + k].toLowerCase() === words2[j + k].toLowerCase()) {
                            k++;
                        }
                        
                        if (k > 5) { // At least 5 consecutive matching words
                            const match = words2.slice(j, j + k).join(' ');
                            if (match.length > bestMatch.length) {
                                bestMatch = match;
                            }
                        }
                    }
                }
            }
            
            return {
                similarityScore: similarityScore,
                matchedText: bestMatch
            };
        } catch (error) {
            logMessage(`[PlagiarismChecker] Error checking similarity: ${error.message}`, 'error');
            return { similarityScore: 0, matchedText: '' };
        }
    }

    calculateSimilarity(str1, str2) {
        // Simple Jaccard similarity coefficient
        const set1 = new Set(str1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
        const set2 = new Set(str2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
        
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        
        return intersection.size / union.size;
    }

    /**
     * Evaluates plagiarism check results
     * @param {Object[]} results - Array of plagiarism check results
     * @param {string} url - The URL being checked
     * @returns {Object} - Final evaluation result
     */
    evaluateResults(results, url) {
        if (!results || results.length === 0) {
            return {
                status: 'error',
                reason: 'No results to evaluate',
                details: 'Plagiarism check failed to produce any results'
            };
        }
        
        // Count results by status
        const statusCounts = results.reduce((counts, result) => {
            counts[result.status] = (counts[result.status] || 0) + 1;
            return counts;
        }, {});
        
        // Calculate average similarity score
        const totalScore = results.reduce((sum, result) => sum + (result.similarityScore || 0), 0);
        const averageScore = totalScore / results.length;
        
        logMessage(`[PlagiarismChecker] Results summary - Average similarity: ${averageScore.toFixed(2)}, Status counts: ${JSON.stringify(statusCounts)}`);
        
        // Determine overall status
        let status, reason;
        
        if (statusCounts.fail && statusCounts.fail > 0) {
            status = 'fail';
            reason = `${statusCounts.fail} paragraph(s) detected as potential plagiarism`;
        } else if (statusCounts.review && statusCounts.review > 0) {
            status = 'review';
            reason = `${statusCounts.review} paragraph(s) need review for similarity`;
        } else if (statusCounts.error && statusCounts.error > 0) {
            status = 'error';
            reason = `${statusCounts.error} paragraph(s) encountered errors during checking`;
        } else {
            status = 'pass';
            reason = 'No plagiarism detected';
        }
        
        return {
            status,
            reason,
            details: {
                url,
                averageSimilarityScore: averageScore,
                paragraphsChecked: results.length,
                maxApiCallsLimit: this.maxApiCalls,
                statusCounts,
                results: results.map(r => ({
                    // Fix: Handle case when paragraph is missing
                    excerpt: r.paragraph ? r.paragraph.substring(0, 100) + '...' : 
                             r.matchedText ? r.matchedText.substring(0, 100) + '...' : 
                             'No text available',
                    similarityScore: r.similarityScore,
                    matchedUrl: r.matchedUrl,
                    status: r.status
                }))
            }
        };
    }
}

module.exports = new PlagiarismChecker();
