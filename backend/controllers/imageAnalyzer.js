/**
 * Image Analyzer - Analyzes images on a webpage for inappropriate content
 * Uses a simplified approach that guarantees arrays are always returned
 */

// 1. Module Setup and Imports
const axios = require('axios');
const cheerio = require('cheerio');
const { logMessage } = require('../utils/logger');

class ImageAnalyzer {
    // 2. Constructor Initialization
    constructor() {
        logMessage(`[ImageAnalyzer] Initializing image analyzer`);
        
        // Set API key from environment variables
        this.apiKey = process.env.GOOGLE_VISION_API_KEY;
        
        // Set maximum number of images to analyze (default: 4)
        this.maxImages = process.env.MAX_IMAGE_API_CALLS ? 
            parseInt(process.env.MAX_IMAGE_API_CALLS) : 4;
        
        logMessage(`[ImageAnalyzer] Configuration: Will analyze up to ${this.maxImages} images per URL`);
    }

    /**
     * Main entry point - Analyzes images on a URL
     * @param {string} url - The URL to analyze
     * @returns {Promise<Object>} - Analysis results
     */
    async analyzeUrl(url) {
        try {
            // Log the call stack to see where this method is being called from
            const stack = new Error().stack;
            logMessage(`[ImageAnalyzer] analyzeUrl called for ${url}`);
            logMessage(`[ImageAnalyzer] Call stack: ${stack}`);
            
            // 3. Extract images from the URL
            const images = await this.extractImages(url);
            
            // Log the raw images data
            logMessage(`[ImageAnalyzer] Raw images data type: ${typeof images}, isArray: ${Array.isArray(images)}`);
            
            // Safety check - ensure images is an array
            let imagesArray;
            if (Array.isArray(images)) {
                imagesArray = images;
                logMessage(`[ImageAnalyzer] Images is already an array with ${images.length} elements`);
            } else {
                logMessage(`[ImageAnalyzer] Images is NOT an array, converting. Type: ${typeof images}`);
                imagesArray = images ? [images] : [];
            }
            
            if (imagesArray.length === 0) {
                logMessage(`[ImageAnalyzer] No images found on ${url}`);
                return {
                    status: "pass",
                    reason: "No images found to analyze",
                    details: "Page contained no suitable images for analysis"
                };
            }
            
            // 4. Select random images for analysis
            const selectedImages = this.selectRandomImages(imagesArray, this.maxImages);
            logMessage(`[ImageAnalyzer] Selected ${selectedImages.length} images for analysis`);
            
            // Double-check that selectedImages is an array before passing to analyzeImages
            if (!Array.isArray(selectedImages)) {
                logMessage(`[ImageAnalyzer] WARNING: selectedImages is not an array! Converting to array.`);
                const safeImages = selectedImages ? [selectedImages] : [];
                // 5. Analyze the selected images
                const results = await this.analyzeImages(safeImages);
                // 6. Evaluate results and return
                return this.evaluateResults(results, url);
            } else {
                // 5. Analyze the selected images
                const results = await this.analyzeImages(selectedImages);
                // 6. Evaluate results and return
                return this.evaluateResults(results, url);
            }
        } catch (error) {
            logMessage(`[ImageAnalyzer] Error analyzing URL: ${error.message}`, 'error');
            return {
                status: "error",
                reason: `Error analyzing images: ${error.message}`,
                details: error.stack
            };
        }
    }

    /**
     * Extracts images from a URL
     * @param {string} url - The URL to extract images from
     * @returns {Promise<Array>} - Array of image objects
     */
    async extractImages(url) {
        logMessage(`[ImageAnalyzer] Extracting images from ${url}`);
        
        try {
            // 3a. Fetch the HTML
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 15000
            });
            
            logMessage(`[ImageAnalyzer] Successfully fetched HTML from ${url} (${response.data.length} bytes)`);
            
            // 3b. Load HTML into Cheerio
            const $ = cheerio.load(response.data);
            
            // 3c & 3e. Extract all <img> tags and collect results in an array
            const images = [];
            const allImgTags = $('img');
            
            logMessage(`[ImageAnalyzer] Found ${allImgTags.length} total <img> tags on the page`);
            
            let skippedCount = 0;
            let relativeCount = 0;
            
            $('img').each((i, element) => {
                // Log the raw element for debugging
                const elementHtml = $.html(element);
                logMessage(`[ImageAnalyzer] Processing img tag ${i+1}: ${elementHtml.substring(0, 200)}${elementHtml.length > 200 ? '...' : ''}`);
                
                // Log all attributes
                const attributes = {};
                Object.keys(element.attribs || {}).forEach(key => {
                    attributes[key] = element.attribs[key];
                });
                logMessage(`[ImageAnalyzer] Image ${i+1} attributes: ${JSON.stringify(attributes)}`);
                
                // 3d. Validate and normalize the src
                const src = $(element).attr('src');
                
                if (!src || src.trim() === '') {
                    logMessage(`[ImageAnalyzer] Skipping image ${i+1}: Missing or empty src attribute`);
                    skippedCount++;
                    return; // Skip this image
                }
                
                // Convert relative URLs to absolute
                let absoluteSrc = src;
                
                if (src.startsWith('/')) {
                    // Handle root-relative URLs
                    const urlObj = new URL(url);
                    absoluteSrc = `${urlObj.protocol}//${urlObj.host}${src}`;
                    logMessage(`[ImageAnalyzer] Converted root-relative URL: ${src} -> ${absoluteSrc}`);
                    relativeCount++;
                } else if (!src.startsWith('http')) {
                    // Handle other relative URLs
                    try {
                        absoluteSrc = new URL(src, url).href;
                        logMessage(`[ImageAnalyzer] Converted relative URL: ${src} -> ${absoluteSrc}`);
                        relativeCount++;
                    } catch (error) {
                        logMessage(`[ImageAnalyzer] Error converting relative URL: ${src}`, 'warn');
                        skippedCount++;
                        return; // Skip this image
                    }
                }
                
                // Create the image object
                const imageObj = {
                    src: absoluteSrc,
                    alt: $(element).attr('alt') || '',
                    width: $(element).attr('width') || 'unknown',
                    height: $(element).attr('height') || 'unknown'
                };
                
                // Log the image object
                logMessage(`[ImageAnalyzer] Adding image ${i+1}: ${JSON.stringify(imageObj)}`);
                
                // Add image to the array
                images.push(imageObj);
            });
            
            logMessage(`[ImageAnalyzer] Extraction summary: ${images.length} valid images, ${skippedCount} skipped (invalid src), ${relativeCount} relative URLs converted`);
            
            // Log the final array
            logMessage(`[ImageAnalyzer] Final images array: ${JSON.stringify(images)}`);
            
            // Always return an array
            return images;
        } catch (error) {
            logMessage(`[ImageAnalyzer] Error extracting images: ${error.message}`, 'error');
            // Return empty array on error
            return [];
        }
    }

    /**
     * Selects random images from an array
     * @param {Array} images - Array of image objects
     * @param {number} count - Number of images to select
     * @returns {Array} - Selected images
     */
    selectRandomImages(images, count) {
        // 7. Ensuring Consistency - Safety check
        if (!Array.isArray(images)) {
            logMessage(`[ImageAnalyzer] Warning: images parameter is not an array in selectRandomImages`, 'warn');
            return images ? [images] : [];
        }
        
        // If we have fewer images than the count, return all images
        if (images.length <= count) {
            logMessage(`[ImageAnalyzer] Using all ${images.length} images (fewer than max ${count})`);
            return images;
        }
        
        // 4. Random Selection - Shuffle the array using Fisher-Yates algorithm
        const shuffled = [...images];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        // Return the first 'count' elements
        const selected = shuffled.slice(0, count);
        
        logMessage(`[ImageAnalyzer] Randomly selected ${selected.length} images from a pool of ${images.length}`);
        logMessage(`[ImageAnalyzer] Selected images:`);
        selected.forEach((img, i) => {
            logMessage(`[ImageAnalyzer]   - Image ${i+1}: ${img.src.substring(0, 100)}${img.src.length > 100 ? '...' : ''}`);
        });
        
        return selected;
    }

    /**
     * Analyzes images for inappropriate content
     * @param {Array} images - Array of image objects
     * @returns {Promise<Object>} - Analysis results
     */
    async analyzeImages(images) {
        // Log the call stack to see where this method is being called from
        const stack = new Error().stack;
        logMessage(`[ImageAnalyzer] analyzeImages called`);
        logMessage(`[ImageAnalyzer] Call stack: ${stack}`);
        
        // 7. Ensuring Consistency - Safety check
        if (!Array.isArray(images)) {
            logMessage(`[ImageAnalyzer] Warning: images parameter is not an array in analyzeImages`, 'warn');
            logMessage(`[ImageAnalyzer] Type of images: ${typeof images}`);
            logMessage(`[ImageAnalyzer] Value of images: ${JSON.stringify(images)}`);
            images = images ? [images] : [];
        }
        
        logMessage(`[ImageAnalyzer] Starting analysis of ${images.length} images`);
        
        // 5. Image Analysis - Process each image
        const results = [];
        let apiCallsMade = 0;
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            logMessage(`[ImageAnalyzer] Processing image ${i+1}/${images.length}: ${JSON.stringify(image)}`);
            
            try {
                // Skip invalid images
                if (!image || !image.src || typeof image.src !== 'string') {
                    logMessage(`[ImageAnalyzer] Skipping invalid image object: ${JSON.stringify(image)}`);
                    continue;
                }
                
                logMessage(`[ImageAnalyzer] Analyzing image ${i+1}/${images.length}: ${image.src.substring(0, 100)}${image.src.length > 100 ? '...' : ''}`);
                
                // Call the Vision API
                const startTime = Date.now();
                const response = await axios.post(
                    `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`,
                    {
                        requests: [
                            {
                                image: {
                                    source: {
                                        imageUri: image.src
                                    }
                                },
                                features: [
                                    {
                                        type: "SAFE_SEARCH_DETECTION"
                                    }
                                ]
                            }
                        ]
                    }
                );
                const endTime = Date.now();
                
                apiCallsMade++;
                
                // Process the response
                if (response.data && 
                    response.data.responses && 
                    response.data.responses[0] && 
                    response.data.responses[0].safeSearchAnnotation) {
                    
                    const safeSearch = response.data.responses[0].safeSearchAnnotation;
                    successCount++;
                    
                    const adultContent = ['LIKELY', 'VERY_LIKELY'].includes(safeSearch.adult);
                    const violentContent = ['LIKELY', 'VERY_LIKELY'].includes(safeSearch.violence);
                    const isFlagged = adultContent || violentContent;
                    
                    logMessage(`[ImageAnalyzer] Analysis complete in ${endTime - startTime}ms - Results: Adult: ${safeSearch.adult}, Violence: ${safeSearch.violence}, Flagged: ${isFlagged ? 'YES' : 'NO'}`);
                    
                    results.push({
                        image: image,
                        safeSearch: safeSearch,
                        analysisTimeMs: endTime - startTime
                    });
                }
            } catch (error) {
                errorCount++;
                logMessage(`[ImageAnalyzer] Error analyzing image: ${error.message}`, 'error');
                if (error.response) {
                    logMessage(`[ImageAnalyzer] API error details: ${JSON.stringify(error.response.data)}`, 'error');
                }
                
                // Include error result
                results.push({
                    image: image,
                    error: error.message
                });
            }
        }
        
        logMessage(`[ImageAnalyzer] Analysis summary: ${apiCallsMade} API calls made, ${successCount} successful, ${errorCount} errors`);
        logMessage(`[ImageAnalyzer] Results array: ${JSON.stringify(results)}`);
        
        // Return analysis results
        return {
            totalImages: images.length,
            analyzedImages: results.length,
            successfulAnalyses: successCount,
            failedAnalyses: errorCount,
            results: results
        };
    }

    /**
     * Evaluates image analysis results
     * @param {Object} results - Analysis results
     * @param {string} url - The URL being analyzed
     * @returns {Object} - Evaluation result
     */
    evaluateResults(results, url) {
        // 6. Evaluation and Output
        
        // Safety check
        if (!results || !results.results) {
            logMessage(`[ImageAnalyzer] No results to evaluate`, 'warn');
            return {
                status: "error",
                reason: "No results to evaluate",
                details: "Image analysis failed to produce any results"
            };
        }
        
        // Ensure results.results is an array
        const images = Array.isArray(results.results) ? results.results : [results.results];
        
        // Count images by category
        let flaggedCount = 0;
        let safeCount = 0;
        let errorCount = 0;
        
        for (const result of images) {
            if (result.error) {
                errorCount++;
            } else if (result.safeSearch) {
                const adultContent = ['LIKELY', 'VERY_LIKELY'].includes(result.safeSearch.adult);
                const violentContent = ['LIKELY', 'VERY_LIKELY'].includes(result.safeSearch.violence);
                
                if (adultContent || violentContent) {
                    flaggedCount++;
                } else {
                    safeCount++;
                }
            }
        }
        
        logMessage(`[ImageAnalyzer] Evaluation summary for ${url}:`);
        logMessage(`[ImageAnalyzer]   - Total images found: ${results.totalImages || 0}`);
        logMessage(`[ImageAnalyzer]   - Images analyzed: ${results.analyzedImages || 0}`);
        logMessage(`[ImageAnalyzer]   - Flagged images: ${flaggedCount}`);
        logMessage(`[ImageAnalyzer]   - Safe images: ${safeCount}`);
        logMessage(`[ImageAnalyzer]   - Error images: ${errorCount}`);
        
        // Create response object
        const response = {
            url,
            analysis: {
                totalImagesFound: results.totalImages || 0,
                imagesAnalyzed: results.analyzedImages || 0,
                maxImagesLimit: this.maxImages,
                flaggedImages: flaggedCount,
                safeImages: safeCount,
                errorImages: errorCount
            },
            images: images.map(r => ({
                url: r.image ? r.image.src : 'unknown',
                safe: !r.error && r.safeSearch && 
                      !['LIKELY', 'VERY_LIKELY'].includes(r.safeSearch.adult) && 
                      !['LIKELY', 'VERY_LIKELY'].includes(r.safeSearch.violence),
                adultContent: r.safeSearch ? r.safeSearch.adult : null,
                violentContent: r.safeSearch ? r.safeSearch.violence : null,
                analysisTimeMs: r.analysisTimeMs || null,
                error: r.error || null
            }))
        };
        
        // Determine overall status
        if (flaggedCount > 0) {
            logMessage(`[ImageAnalyzer] RESULT: FAIL - Found ${flaggedCount} inappropriate images`);
            return {
                ...response,
                status: "fail",
                reason: "Inappropriate image content detected",
                details: `Found ${flaggedCount} images with adult/violent content`
            };
        }
        
        logMessage(`[ImageAnalyzer] RESULT: PASS - No inappropriate images found`);
        return {
            ...response,
            status: "pass",
            reason: "No inappropriate images detected",
            details: "All analyzed images passed content guidelines"
        };
    }
}

// Export an instance of the class to ensure it works with auditController.js
module.exports = new ImageAnalyzer();