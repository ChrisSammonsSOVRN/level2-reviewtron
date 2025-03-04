const puppeteer = require('puppeteer');
const { logMessage } = require('../utils/logger');

class AdAnalyzer {
    constructor() {
        logMessage(`[AdAnalyzer] Initializing`);
        
        // List of premium ad networks and their identifying patterns
        this.premiumAdNetworks = [
            { name: 'Google AdSense', patterns: ['pagead2.googlesyndication.com', 'adservice.google.com', '/pagead/js/'] },
            { name: 'Google Ad Manager', patterns: ['securepubads.g.doubleclick.net', 'googletagservices.com'] },
            { name: 'Amazon Associates', patterns: ['amazon-adsystem.com', 'assoc-amazon'] },
            { name: 'Media.net', patterns: ['media.net', 'adservetx.media.net'] },
            { name: 'Mediavine', patterns: ['mediavine.com', 'ads.mediavine.com'] },
            { name: 'AdThrive', patterns: ['adthrive.com', 'ads.adthrive.com'] },
            { name: 'Ezoic', patterns: ['ezoic.net', 'ezoic.com', 'ezojs.com'] },
            { name: 'Taboola', patterns: ['taboola.com', 'trc.taboola.com'] },
            { name: 'Outbrain', patterns: ['outbrain.com', 'outbrainimg.com'] },
            { name: 'Criteo', patterns: ['criteo.com', 'criteo.net'] },
            { name: 'Rubicon', patterns: ['rubiconproject.com', 'fastlane.rubiconproject.com'] },
            { name: 'AppNexus', patterns: ['adnxs.com', 'appnexus.com'] },
            { name: 'Index Exchange', patterns: ['casalemedia.com', 'indexww.com'] },
            { name: 'OpenX', patterns: ['openx.net', 'openx.com'] },
            { name: 'PubMatic', patterns: ['pubmatic.com', 'ads.pubmatic.com'] },
            { name: 'Sovrn', patterns: ['sovrn.com', 'lijit.com'] },
            { name: 'TripleLift', patterns: ['triplelift.com', '3lift.com'] },
            { name: 'Teads', patterns: ['teads.tv', 'teads.com'] },
            { name: 'Sharethrough', patterns: ['sharethrough.com', 'strl.co'] },
            { name: 'Verizon Media', patterns: ['yahoo.com/admax', 'oath.com', 'advertising.com'] }
        ];
        
        // Known tracking domains
        this.trackingDomains = [
            'google-analytics.com',
            'analytics.google.com',
            'doubleclick.net',
            'facebook.com/tr',
            'facebook.com/signals',
            'pixel.facebook.com',
            'bat.bing.com',
            'analytics.twitter.com',
            'static.ads-twitter.com',
            'ads.linkedin.com',
            'px.ads.linkedin.com',
            'snap.licdn.com',
            'analytics.pinterest.com',
            'ct.pinterest.com',
            'pixel.quantserve.com',
            'pixel.mathtag.com',
            'beacon.krxd.net',
            'analytics.tiktok.com',
            'pixel.advertising.com',
            'pixel.rubiconproject.com',
            'pixel.tapad.com',
            'beacon.clickequations.net',
            'pixel.sitescout.com',
            'pixel.advertising.com',
            'beacon.krxd.net',
            'analytics.yahoo.com',
            'sp.analytics.yahoo.com',
            'clarity.ms',
            'hotjar.com',
            'mouseflow.com',
            'fullstory.com',
            'segment.io',
            'segment.com',
            'mixpanel.com',
            'amplitude.com',
            'statcounter.com',
            'chartbeat.com',
            'parsely.com',
            'newrelic.com',
            'sentry.io'
        ];
        
        // Ad impression pixel patterns in URLs
        this.impressionPixelPatterns = [
            'impression', 'imp', 'pixel', 'beacon', 'track', 'view', 'log', 'event', 'analytics',
            'collect', 'ping', 'hit', 'stats', 'conversion', 'click', 'pageview', 'metric'
        ];
        
        // Ad creative patterns - specific patterns that indicate ad content
        this.adCreativePatterns = [
            '/ad/', '/ads/', '/adv/', '/advert/', '/banner/', '/promo/', '/sponsor/',
            'ad.', 'ads.', 'advert', 'banner', 'creative', 'promo', 'sponsor'
        ];
        
        // Content image patterns - patterns that indicate regular content
        this.contentImagePatterns = [
            'media.', 'images.', 'photos.', 'img.', 'content.', 'assets.',
            '/media/', '/images/', '/photos/', '/img/', '/content/', '/assets/',
            'stellar/prod', 'article', 'news', 'story', 'photo', 'gallery'
        ];
        
        // Common ad container selectors
        this.adContainerSelectors = [
            'div[id*="ad-"]',
            'div[class*="ad-"]',
            'div[id*="advertisement"]',
            'div[class*="advertisement"]',
            'div[id*="banner"]',
            'div[class*="banner"]',
            'div[class*="sponsored"]',
            'div[id*="sponsored"]',
            'aside[class*="ad"]',
            'section[class*="ad"]',
            'div[data-ad]',
            'div[data-ad-unit]',
            'div[data-adunit]'
        ];
        
        // Content container selectors
        this.contentContainerSelectors = [
            'article', 
            'main', 
            '.article-content', 
            '.story-content', 
            '.post-content',
            '.main-content',
            'section[class*="content"]',
            'div[class*="article"]',
            'div[class*="story"]',
            'div[class*="post"]'
        ];
    }

    async analyzeUrl(url) {
        let browser;
        try {
            logMessage(`[AdAnalyzer] ========== Starting ad analysis for ${url} ==========`);
            
            browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await browser.newPage();
            
            // Track all network requests
            const requests = [];
            page.on('request', request => {
                requests.push({
                    url: request.url(),
                    resourceType: request.resourceType()
                });
            });

            // Navigate to the page and wait for network to be idle
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            
            // Wait a bit longer for delayed ad requests
            logMessage(`[AdAnalyzer] Waiting for delayed ad requests...`);
            await this.delay(5000);
            
            // Scroll down to trigger lazy-loaded ads
            logMessage(`[AdAnalyzer] Scrolling to trigger lazy-loaded ads...`);
            await this.autoScroll(page);
            
            // Wait again for any new requests triggered by scrolling
            await this.delay(3000);
            
            // Extract all images with their attributes and context
            const imageData = await this.extractImageData(page);
            
            // Find ad elements in the page
            const adElements = await this.findAdElements(page);
            
            await browser.close();
            
            // Analyze the collected data
            return this.analyzeAdData(requests, imageData, adElements, url);
            
        } catch (error) {
            logMessage(`[AdAnalyzer] ERROR: ${error.message}`);
            logMessage(`[AdAnalyzer] Error stack: ${error.stack}`);
            if (browser) await browser.close();
            return {
                status: "error",
                reason: "Ad analysis failed",
                details: error.message
            };
        }
    }
    
    // Simple delay function
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async autoScroll(page) {
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    
                    if (totalHeight >= scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });
    }
    
    async extractImageData(page) {
        logMessage(`[AdAnalyzer] Extracting image data from the page...`);
        
        const imageData = await page.evaluate(() => {
            const images = Array.from(document.querySelectorAll('img'));
            return images.map(img => {
                // Get computed style
                const style = window.getComputedStyle(img);
                
                // Get parent context
                let parentContext = '';
                let isInContentContainer = false;
                let isInAdContainer = false;
                let parentElement = img.parentElement;
                let depth = 0;
                const maxDepth = 5; // Check up to 5 levels up
                
                while (parentElement && depth < maxDepth) {
                    if (parentElement.id) {
                        parentContext += `#${parentElement.id} `;
                    }
                    if (parentElement.className) {
                        parentContext += `.${parentElement.className.replace(/\s+/g, '.')} `;
                    }
                    
                    // Check if in content container
                    if (!isInContentContainer) {
                        if (parentElement.tagName === 'ARTICLE' || 
                            parentElement.tagName === 'MAIN' ||
                            (parentElement.className && 
                             (parentElement.className.includes('article') || 
                              parentElement.className.includes('content') || 
                              parentElement.className.includes('story') || 
                              parentElement.className.includes('post')))) {
                            isInContentContainer = true;
                        }
                    }
                    
                    // Check if in ad container
                    if (!isInAdContainer) {
                        if ((parentElement.id && 
                             (parentElement.id.includes('ad') || 
                              parentElement.id.includes('banner') || 
                              parentElement.id.includes('sponsor'))) ||
                            (parentElement.className && 
                             (parentElement.className.includes('ad') || 
                              parentElement.className.includes('banner') || 
                              parentElement.className.includes('sponsor')))) {
                            isInAdContainer = true;
                        }
                    }
                    
                    parentElement = parentElement.parentElement;
                    depth++;
                }
                
                return {
                    src: img.src,
                    alt: img.alt || '',
                    width: img.width,
                    height: img.height,
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                    display: style.display,
                    visibility: style.visibility,
                    opacity: style.opacity,
                    position: style.position,
                    parentContext: parentContext.trim(),
                    isInContentContainer: isInContentContainer,
                    isInAdContainer: isInAdContainer
                };
            });
        });
        
        logMessage(`[AdAnalyzer] Extracted data for ${imageData.length} images`);
        return imageData;
    }
    
    async findAdElements(page) {
        logMessage(`[AdAnalyzer] Looking for ad elements in the page...`);
        
        // Look for common ad container elements
        const adElements = await page.evaluate(() => {
            const results = [];
            
            // Common ad selectors
            const adSelectors = [
                'iframe[src*="ad"]',
                'iframe[src*="ads"]',
                'iframe[id*="google_ads"]',
                'iframe[id*="ad"]',
                'div[id*="ad-"]',
                'div[class*="ad-"]',
                'div[id*="banner"]',
                'div[class*="banner"]',
                'div[id*="Advertisement"]',
                'div[class*="Advertisement"]',
                'div[data-ad]',
                'ins.adsbygoogle',
                'div[id*="taboola"]',
                'div[id*="outbrain"]',
                'div[class*="sponsored"]',
                'div[class*="partner-content"]'
            ];
            
            // Find all ad elements
            adSelectors.forEach(selector => {
                try {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(el => {
                        // Get computed style
                        const style = window.getComputedStyle(el);
                        
                        results.push({
                            selector: selector,
                            id: el.id || '',
                            class: el.className || '',
                            src: el.src || '',
                            width: el.offsetWidth,
                            height: el.offsetHeight,
                            display: style.display,
                            visibility: style.visibility,
                            position: style.position
                        });
                    });
                } catch (e) {
                    // Ignore errors for individual selectors
                }
            });
            
            return results;
        });
        
        logMessage(`[AdAnalyzer] Found ${adElements.length} potential ad elements`);
        return adElements;
    }
    
    analyzeAdData(requests, imageData, adElements, url) {
        logMessage(`[AdAnalyzer] Analyzing ${requests.length} network requests, ${imageData.length} images, and ${adElements.length} ad elements`);
        
        // Identify premium ad networks
        const detectedNetworks = new Map();
        const trackingPixels = [];
        const adCreatives = [];
        const contentImages = [];
        
        // Analyze network requests
        requests.forEach(request => {
            const requestUrl = request.url.toLowerCase();
            
            // Check for premium ad networks
            this.premiumAdNetworks.forEach(network => {
                if (!detectedNetworks.has(network.name)) {
                    const isMatch = network.patterns.some(pattern => 
                        requestUrl.includes(pattern.toLowerCase())
                    );
                    
                    if (isMatch) {
                        detectedNetworks.set(network.name, {
                            name: network.name,
                            matchedUrl: request.url
                        });
                        logMessage(`[AdAnalyzer] Detected premium ad network: ${network.name}`);
                    }
                }
            });
        });
        
        // Analyze images to classify as tracking pixels, ad creatives, or content images
        imageData.forEach(image => {
            const imageUrl = image.src.toLowerCase();
            
            // Check if it's a tracking pixel based on dimensions
            const isTrackingPixelBySize = (
                // 1x1, 2x2, or other very small dimensions
                (image.width <= 3 && image.height <= 3) ||
                (image.naturalWidth <= 3 && image.naturalHeight <= 3)
            );
            
            // Check if it's hidden
            const isHidden = (
                image.display === 'none' ||
                image.visibility === 'hidden' ||
                image.opacity === '0' ||
                (image.position === 'absolute' && (image.width === 0 || image.height === 0))
            );
            
            // Check URL against tracking domains
            const isTrackingDomain = this.trackingDomains.some(domain => 
                imageUrl.includes(domain)
            );
            
            // Check URL against impression pixel patterns
            const hasImpressionPattern = this.impressionPixelPatterns.some(pattern => 
                imageUrl.includes(pattern)
            );
            
            // Determine if it's a tracking pixel
            const isTrackingPixel = isTrackingPixelBySize || isHidden || isTrackingDomain || hasImpressionPattern;
            
            if (isTrackingPixel) {
                const reasons = [];
                if (isTrackingPixelBySize) reasons.push('small dimensions');
                if (isHidden) reasons.push('hidden element');
                if (isTrackingDomain) reasons.push('tracking domain');
                if (hasImpressionPattern) reasons.push('impression pattern in URL');
                
                trackingPixels.push({
                    src: image.src,
                    dimensions: `${image.width}x${image.height}`,
                    naturalDimensions: `${image.naturalWidth}x${image.naturalHeight}`,
                    reasons: reasons,
                    parentContext: image.parentContext
                });
                
                logMessage(`[AdAnalyzer] Detected tracking pixel: ${image.src} (${reasons.join(', ')})`);
            } 
            // Check if it's a content image
            else if (image.isInContentContainer || 
                     this.contentImagePatterns.some(pattern => imageUrl.includes(pattern))) {
                contentImages.push({
                    src: image.src,
                    dimensions: `${image.width}x${image.height}`,
                    alt: image.alt
                });
                
                logMessage(`[AdAnalyzer] Detected content image: ${image.src}`);
            }
            // Check if it's an ad creative
            else if (image.isInAdContainer || 
                     this.adCreativePatterns.some(pattern => imageUrl.includes(pattern))) {
                adCreatives.push({
                    src: image.src,
                    dimensions: `${image.width}x${image.height}`,
                    alt: image.alt,
                    inAdContainer: image.isInAdContainer
                });
                
                logMessage(`[AdAnalyzer] Detected ad creative: ${image.src}`);
            }
        });
        
        // Convert detected networks to array
        const detectedNetworksArray = Array.from(detectedNetworks.values());
        
        // Prepare response
        const response = {
            url,
            analysis: {
                totalRequests: requests.length,
                premiumAdNetworks: detectedNetworksArray.length,
                trackingPixels: trackingPixels.length,
                adCreatives: adCreatives.length,
                contentImages: contentImages.length,
                adElements: adElements.length,
                details: {
                    networks: detectedNetworksArray,
                    trackingPixels: trackingPixels.slice(0, 10), // Limit to first 10 for brevity
                    creatives: adCreatives.slice(0, 10), // Limit to first 10 for brevity
                    elements: adElements.slice(0, 10) // Limit to first 10 for brevity
                }
            }
        };
        
        // Determine status based on premium ad networks count and other signals
        if (detectedNetworksArray.length >= 2) {
            logMessage(`[AdAnalyzer] Found ${detectedNetworksArray.length} premium ad networks - PASS`);
            return {
                ...response,
                status: "pass",
                reason: "Sufficient premium ad networks detected",
                details: `Found ${detectedNetworksArray.length} premium ad networks`
            };
        } else if (detectedNetworksArray.length === 1 && (trackingPixels.length > 0 || adCreatives.length > 0)) {
            logMessage(`[AdAnalyzer] Found 1 premium ad network with tracking pixels/creatives - PASS`);
            return {
                ...response,
                status: "pass",
                reason: "Premium ad network with ad activity detected",
                details: `Found 1 premium ad network with ${trackingPixels.length} tracking pixels and ${adCreatives.length} ad creatives`
            };
        } else if (detectedNetworksArray.length === 1) {
            logMessage(`[AdAnalyzer] Found only 1 premium ad network - HUMAN REVIEW`);
            return {
                ...response,
                status: "failed",
                reason: "Limited premium ad networks",
                details: "Only one premium ad network detected, human review recommended"
            };
        } else if (trackingPixels.length > 0 || adCreatives.length > 0 || adElements.length > 0) {
            logMessage(`[AdAnalyzer] Found ad activity but no premium networks - HUMAN REVIEW`);
            return {
                ...response,
                status: "failed",
                reason: "Ad activity without premium networks",
                details: `Found ${trackingPixels.length} tracking pixels, ${adCreatives.length} ad creatives, and ${adElements.length} ad elements, but no premium networks`
            };
        } else {
            logMessage(`[AdAnalyzer] No ad activity detected - HUMAN REVIEW`);
            return {
                ...response,
                status: "failed",
                reason: "No ad activity detected",
                details: "No premium ad networks or ad activity detected, human review required"
            };
        }
    }

    evaluateResults(adNetworks) {
        logMessage(`[AdAnalyzer] Evaluating results for ad networks: ${JSON.stringify(adNetworks)}`);
        
        // If no ad networks were found
        if (!adNetworks || adNetworks.length === 0) {
            logMessage('[AdAnalyzer] No ad networks detected');
            return {
                status: "failed",
                message: "No ad activity detected"
            };
        }

        // Count premium networks
        const premiumNetworks = adNetworks.filter(network => 
            ['adsense', 'adx', 'amazon', 'index exchange', 'media.net', 'openx', 'pubmatic', 'rubicon', 'sovrn'].includes(network.toLowerCase())
        );
        
        logMessage(`[AdAnalyzer] Premium networks detected: ${premiumNetworks.length}`);
        
        // If there are premium networks but less than 2
        if (premiumNetworks.length > 0 && premiumNetworks.length < 2) {
            return {
                status: "failed",
                message: "Ad activity without premium networks"
            };
        }
        
        // If there are 2 or more premium networks
        if (premiumNetworks.length >= 2) {
            return {
                status: "pass",
                message: "Sufficient premium ad partners detected (≥2)"
            };
        }
        
        // If there are ad networks but no premium ones
        return {
            status: "failed",
            message: "Insufficient premium ad partners"
        };
    }
}

module.exports = new AdAnalyzer();
