const { LanguageServiceClient } = require('@google-cloud/language');
const axios = require('axios');
const puppeteer = require('puppeteer-core');
const { logMessage } = require('../utils/logger');
const path = require('path');

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

class HateSpeechChecker {
    constructor() {
        // Add configurable API call limit with a default value of 2
        this.maxHateSpeechApiCalls = process.env.MAX_HATE_SPEECH_API_CALLS ? 
            parseInt(process.env.MAX_HATE_SPEECH_API_CALLS) : 2;
        
        logMessage(`[HateSpeechChecker] Initialized with maxHateSpeechApiCalls: ${this.maxHateSpeechApiCalls}`);
        
        logMessage(`[HateSpeechChecker] Initializing with Google Cloud credentials`);
        this.languageClient = new LanguageServiceClient({
            keyFilename: path.join(__dirname, '../config/credentials/google-cloud-credentials.json')
        });

        // Common problematic phrases and patterns
        this.problematicPhrases = [
            // Hate speech indicators
            'kill all',
            'death to',
            'should die',
            'was right about',
            'was right abt',
            // Context-specific patterns
            'deserve to',
            'hate all',
            'eliminate all'
        ];
    }

    async checkContent(url) {
        try {
            logMessage(`[HateSpeechChecker] Starting content check for URL: ${url}`);
            
            // Extract content from URL
            const content = await this.extractContent(url);
            
            if (!content || content.length < 10) {
                logMessage(`[HateSpeechChecker] No content extracted from URL: ${url}`, 'warn');
                return {
                    url,
                    status: "error",
                    reason: "No content extracted",
                    details: "Could not extract meaningful content from the provided URL"
                };
            }
            
            logMessage(`[HateSpeechChecker] Content extracted, length: ${content.length} characters`);
            
            // Quick scan for problematic phrases
            const quickScanResults = this.quickScan(content);
            
            // If quick scan finds issues, extract context and return
            if (quickScanResults.length > 0) {
                logMessage(`[HateSpeechChecker] Quick scan found ${quickScanResults.length} problematic phrases`);
                const contextContent = this.extractContext(content, quickScanResults);
                
                return {
                    url,
                    status: "fail",
                    reason: "Problematic content detected",
                    details: `Found ${quickScanResults.length} instances of problematic phrases`,
                    problematicPhrases: quickScanResults
                };
            }
            
            logMessage(`[HateSpeechChecker] Quick scan passed, proceeding to NLP analysis`);
            
            // Split content into manageable chunks for NLP API
            const chunks = this.splitContent(content);
            
            // Analyze text chunks with NLP API
            const results = await this.analyzeTextChunks(chunks);
            
            // Evaluate results and return final assessment
            return this.evaluateResults(results, url, quickScanResults);
            
        } catch (error) {
            logMessage(`[HateSpeechChecker] Error checking content: ${error.message}`, 'error');
            return {
                url,
                status: "error",
                reason: "Processing error",
                details: error.message
            };
        }
    }

    quickScan(content) {
        const foundPhrases = [];
        const lowerContent = content.toLowerCase();

        this.problematicPhrases.forEach(phrase => {
            const index = lowerContent.indexOf(phrase);
            if (index !== -1) {
                foundPhrases.push({
                    phrase,
                    index,
                    context: content.substring(Math.max(0, index - 50), Math.min(content.length, index + 50))
                });
                logMessage(`[HateSpeechChecker] Found problematic phrase: "${phrase}" in context: "...${foundPhrases[foundPhrases.length - 1].context}..."`);
            }
        });

        return foundPhrases;
    }

    extractContext(content, quickScanResults) {
        // Get content around problematic phrases with context
        const contexts = quickScanResults.map(result => {
            const start = Math.max(0, result.index - 100);
            const end = Math.min(content.length, result.index + 100);
            return content.substring(start, end);
        });

        return contexts.join(' ');
    }
    
    /**
     * Intelligently truncates text to a specified character limit while preserving natural sentence boundaries
     * @param {string} text - The text to truncate
     * @param {number} maxLength - Maximum character length (default: 500)
     * @returns {string} - Truncated text
     */
    truncateText(text, maxLength = 500) {
        logMessage(`[HateSpeechChecker] Truncating text from ${text.length} characters to max ${maxLength}`);
        
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
            logMessage(`[HateSpeechChecker] No sentence boundary found, using simple truncation`);
            return truncated + '...';
        }
        
        const lastSentenceEnd = Math.max(...indices);
        
        // Return text up to the last sentence boundary plus ellipsis
        const result = text.substring(0, lastSentenceEnd + 1) + '...';
        logMessage(`[HateSpeechChecker] Truncated text to ${result.length} characters at natural boundary`);
        return result;
    }

    async extractContent(url) {
        let browser = null;
        try {
            logMessage(`[HateSpeechChecker] Extracting content from URL: ${url}`);
            
            // Launch Puppeteer with proper configurations
            browser = await this.launchBrowser();
            
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
            logMessage(`[HateSpeechChecker] Navigating to URL: ${url}`);
            await page.goto(url, { 
                waitUntil: ['domcontentloaded', 'networkidle2'],
                timeout: 60000
            });
            
            // Extract the full HTML content
            const html = await page.content();
            logMessage(`[HateSpeechChecker] HTML content extracted, length: ${html.length}`);
            
            let content = '';
            
            // Check if JSDOM and Readability are available
            if (JSDOM && Readability) {
                // Parse the HTML with JSDOM
                const dom = new JSDOM(html, { url });
                
                // Extract the article body with Readability
                const reader = new Readability(dom.window.document);
                const article = reader.parse();
                
                if (article && article.textContent) {
                    logMessage(`[HateSpeechChecker] Successfully extracted article using Readability`);
                    content = article.textContent;
                }
            }
            
            // If content is still empty, use fallback methods
            if (!content || content.length < 100) {
                logMessage(`[HateSpeechChecker] Readability extraction failed or not available, falling back to alternative methods`);
                
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
                            logMessage(`[HateSpeechChecker] Found article content using selector: ${selector}`);
                            break;
                        }
                    }
                }
                
                if (articleContent && articleContent.length > 100) {
                    content = articleContent;
                } else {
                    // Fallback 2: Extract all paragraph text
                    logMessage(`[HateSpeechChecker] No article container found, extracting all paragraphs`);
                    content = await page.evaluate(() => {
                        return Array.from(document.querySelectorAll('p'))
                            .map(p => p.textContent)
                            .filter(text => text.trim().length > 0)
                            .join('\n\n');
                    });
                    
                    // Fallback 3: If still no content, get all body text
                    if (!content || content.length < 100) {
                        logMessage(`[HateSpeechChecker] No paragraphs found, extracting body text`);
                        content = await page.evaluate(() => document.body.textContent);
                    }
                }
            }
            
            // Clean up the content
            content = content.replace(/\s+/g, ' ').trim();
            logMessage(`[HateSpeechChecker] Extracted content length before truncation: ${content.length}`);
            
            // Truncate the content to 500 characters with intelligent boundary detection
            content = this.truncateText(content, 500);
            
            return content;
        } catch (error) {
            logMessage(`[HateSpeechChecker] Error extracting content: ${error.message}`, 'error');
            throw error;
        } finally {
            // Close the browser
            if (browser) {
                await browser.close();
                logMessage(`[HateSpeechChecker] Browser closed`);
            }
        }
    }

    splitContent(content, maxChunkSize = 1000) {
        // Split content into chunks for API processing
        const chunks = [];
        let currentChunk = '';
        
        const sentences = content.split(/(?<=[.!?])\s+/);
        
        for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > maxChunkSize) {
                chunks.push(currentChunk);
                currentChunk = sentence;
            } else {
                currentChunk += (currentChunk ? ' ' : '') + sentence;
            }
        }
        
        if (currentChunk) {
            chunks.push(currentChunk);
        }
        
        logMessage(`[HateSpeechChecker] Split content into ${chunks.length} chunks for analysis`);
        return chunks;
    }

    /**
     * Analyzes text chunks for hate speech
     * @param {Array} chunks - Array of text chunks
     * @returns {Promise<Array>} - Analysis results
     */
    async analyzeTextChunks(chunks) {
        // Limit chunks to maxHateSpeechApiCalls
        const chunksToAnalyze = chunks.slice(0, this.maxHateSpeechApiCalls);
        
        logMessage(`[HateSpeechChecker] Analyzing ${chunksToAnalyze.length} text chunks (limited by maxHateSpeechApiCalls: ${this.maxHateSpeechApiCalls}) out of ${chunks.length} total chunks`);
        
        const results = [];
        let apiCallsMade = 0;
        
        for (const chunk of chunksToAnalyze) {
            try {
                // Analyze sentiment
                const [sentimentResult] = await this.languageClient.analyzeSentiment({
                    document: {
                        content: chunk,
                        type: 'PLAIN_TEXT',
                    },
                });
                
                // Analyze entity sentiment
                const [entityResult] = await this.languageClient.analyzeEntitySentiment({
                    document: {
                        content: chunk,
                        type: 'PLAIN_TEXT',
                    },
                });
                
                // Classify content
                const [classificationResult] = await this.languageClient.classifyText({
                    document: {
                        content: chunk,
                        type: 'PLAIN_TEXT',
                    },
                });
                
                results.push({
                    sentiment: sentimentResult.documentSentiment,
                    entities: entityResult.entities,
                    categories: classificationResult.categories || []
                });
                
                // Increment API call counter
                apiCallsMade++;
                
                // Log progress
                logMessage(`[HateSpeechChecker] Processed chunk ${apiCallsMade}/${chunksToAnalyze.length}`);
                
                logMessage(`[HateSpeechChecker] Successfully analyzed chunk ${apiCallsMade}`);
            } catch (error) {
                logMessage(`[HateSpeechChecker] Error analyzing chunk ${apiCallsMade}: ${error.message}`, 'error');
                // Continue with other chunks even if one fails
            }
        }
        
        logMessage(`[HateSpeechChecker] Completed text analysis with ${apiCallsMade} API calls`);
        
        return results;
    }

    /**
     * Evaluates hate speech check results
     * @param {Array} results - Analysis results
     * @param {string} url - The URL being checked
     * @param {Array} quickScanResults - Results from quick scan
     * @returns {Object} - Evaluation result
     */
    evaluateResults(results, url, quickScanResults = []) {
        logMessage(`[HateSpeechChecker] Evaluating analysis results`);
        
        const response = {
            url,
            analyzed: true,
            quickScanResults,
            analysis: {
                totalChunks: results.length,
                maxApiCallsLimit: this.maxHateSpeechApiCalls,
            },
        };
        
        // If no results were obtained, return error
        if (!results || results.length === 0) {
            logMessage(`[HateSpeechChecker] No analysis results to evaluate`, 'warn');
            return {
                ...response,
                status: "error",
                reason: "Analysis failed",
                details: "Could not obtain analysis results from the NLP API"
            };
        }
        
        // Check for extremely negative sentiment
        const hasNegativeSentiment = results.some(result => 
            result.sentiment && result.sentiment.score < -0.7
        );
        
        // Check for negative entity sentiment toward specific groups
        const hasNegativeEntitySentiment = results.some(result => 
            result.entities && result.entities.some(entity => 
                entity.sentiment.score < -0.7 && 
                ['PERSON', 'ORGANIZATION', 'OTHER'].includes(entity.type)
            )
        );
        
        // Check for sensitive content categories
        const hasSensitiveCategories = results.some(result => 
            result.categories && result.categories.some(category => 
                category.name.includes('/Sensitive') || 
                category.name.includes('/Adult') ||
                category.name.includes('/Hate')
            )
        );
        
        // If no indicators of hate speech, return pass
        if (!hasNegativeSentiment && !hasNegativeEntitySentiment && !hasSensitiveCategories) {
            logMessage(`[HateSpeechChecker] No hate speech detected in NLP analysis`);
            return {
                ...response,
                status: "pass",
                reason: "No hate speech detected",
                details: "NLP content analysis shows no indicators of hate speech"
            };
        }
        
        logMessage(`[HateSpeechChecker] Hate speech detected through NLP analysis`);
        return {
            ...response,
            status: "fail",
            reason: "Hate speech detected",
            details: "NLP analysis found indicators of potentially harmful content"
        };
    }

    async launchBrowser() {
        return await puppeteer.launch({
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
    }
}

module.exports = new HateSpeechChecker();

