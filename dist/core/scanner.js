"use strict";
/**
 * Core scanner - Progressive web page testing with Playwright
 * Optimized for Claude Code autonomous usage
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Scanner = void 0;
const playwright_1 = require("playwright");
const helpers_1 = require("../utils/helpers");
const issue_detector_1 = require("./issue-detector");
class Scanner {
    browser = null;
    config;
    visitedUrls = new Set();
    urlQueue = [];
    pagesScanned = 0;
    issuesFound = 0;
    criticalIssues = 0;
    onOutput;
    constructor(config, onOutput) {
        this.config = {
            maxPages: 100,
            maxDepth: 3,
            parallelPages: 1, // Sequential by default
            viewports: ['desktop'],
            progressive: true,
            prioritizeCritical: true,
            captureScreenshots: true,
            captureConsoleLogs: true,
            captureNetworkRequests: true,
            measurePerformance: true,
            waitStrategy: 'load', // Balanced performance
            blockExternalResources: false,
            criticalOnly: false,
            checkAccessibility: false,
            ...config,
        };
        this.onOutput = onOutput;
    }
    /**
     * Start the scan
     */
    async scan() {
        const runId = (0, helpers_1.generateId)();
        const startTime = Date.now();
        // Emit scan start
        this.emit({
            type: 'scan_start',
            runId,
            baseUrl: this.config.baseUrl,
            timestamp: (0, helpers_1.formatTimestamp)(),
        });
        try {
            // Launch browser
            this.browser = await playwright_1.chromium.launch({
                headless: true,
            });
            // Add initial URL to queue
            this.urlQueue.push(this.config.baseUrl);
            // Process queue
            while (this.urlQueue.length > 0 && this.pagesScanned < (this.config.maxPages || 100)) {
                const url = this.urlQueue.shift();
                if (this.visitedUrls.has(url))
                    continue;
                this.visitedUrls.add(url);
                await this.scanPage(url);
                this.pagesScanned++;
                // Emit progress
                if (this.config.progressive) {
                    this.emit({
                        type: 'progress',
                        pagesScanned: this.pagesScanned,
                        totalPages: this.visitedUrls.size + this.urlQueue.length,
                        issuesFound: this.issuesFound,
                        criticalIssues: this.criticalIssues,
                    });
                }
            }
            // Emit scan complete
            this.emit({
                type: 'scan_complete',
                runId,
                totalPages: this.pagesScanned,
                issuesFound: this.issuesFound,
                duration: (Date.now() - startTime) / 1000,
                timestamp: (0, helpers_1.formatTimestamp)(),
            });
        }
        finally {
            await this.close();
        }
    }
    /**
     * Scan a single page
     */
    async scanPage(url) {
        if (!this.browser)
            throw new Error('Browser not initialized');
        const page = await this.browser.newPage();
        const startTime = Date.now();
        // Emit page scanning status
        this.emit({
            type: 'page',
            url,
            status: 'scanning',
        });
        try {
            // Collectors
            const consoleLogs = [];
            const networkRequests = [];
            const requestTimings = new Map();
            // Resource blocking
            if (this.config.blockExternalResources || this.config.blockedResourceTypes) {
                await page.route('**/*', (route) => {
                    const requestUrl = route.request().url();
                    const resourceType = route.request().resourceType();
                    const pageOrigin = new URL(this.config.baseUrl).origin;
                    const requestOrigin = new URL(requestUrl).origin;
                    // Block external resources if configured
                    if (this.config.blockExternalResources && requestOrigin !== pageOrigin) {
                        // Allow whitelisted domains
                        const isAllowed = this.config.allowedDomains?.some(domain => requestUrl.includes(domain));
                        if (!isAllowed) {
                            return route.abort();
                        }
                    }
                    // Block specific resource types
                    if (this.config.blockedResourceTypes?.includes(resourceType)) {
                        return route.abort();
                    }
                    route.continue();
                });
            }
            // Listen to console
            if (this.config.captureConsoleLogs) {
                page.on('console', (msg) => {
                    consoleLogs.push(this.captureConsoleLog(msg));
                });
            }
            // Track request timing
            if (this.config.captureNetworkRequests) {
                page.on('request', (request) => {
                    requestTimings.set(request.url(), Date.now());
                });
                page.on('response', async (response) => {
                    const startTime = requestTimings.get(response.url());
                    const duration = startTime ? Date.now() - startTime : 0;
                    networkRequests.push(await this.captureNetworkRequest(response, duration));
                });
            }
            // Navigate to page with configurable wait strategy
            const response = await page.goto(url, {
                waitUntil: this.config.waitStrategy || 'load',
                timeout: 30000,
            });
            const httpStatus = response?.status() || 0;
            // Wait a bit for dynamic content
            await page.waitForTimeout(1000);
            // Collect performance metrics
            const performance = this.config.measurePerformance
                ? await this.collectPerformance(page)
                : undefined;
            // Capture screenshots
            const screenshots = this.config.captureScreenshots
                ? await this.captureScreenshots(page, url)
                : undefined;
            // Discover new links
            await this.discoverLinks(page, url);
            // Detect issues
            const issues = (0, issue_detector_1.detectIssues)({
                url,
                consoleLogs,
                networkRequests,
                performance,
                httpStatus,
            });
            // Update counters
            this.issuesFound += issues.length;
            this.criticalIssues += issues.filter((i) => i.severity === 'CRITICAL').length;
            // Emit issues immediately (progressive mode)
            if (this.config.progressive && this.config.prioritizeCritical) {
                // Emit critical issues first
                issues
                    .filter((i) => i.severity === 'CRITICAL')
                    .forEach((issue) => this.emit(issue));
            }
            // Emit page complete
            this.emit({
                type: 'page',
                url,
                status: 'complete',
                httpStatus,
                issues,
                consoleLogs: this.config.captureConsoleLogs ? consoleLogs : undefined,
                networkRequests: this.config.captureNetworkRequests ? networkRequests : undefined,
                performance,
                screenshots,
                scannedAt: (0, helpers_1.formatTimestamp)(),
                duration: (Date.now() - startTime) / 1000,
            });
            // Emit non-critical issues
            if (this.config.progressive && this.config.prioritizeCritical) {
                issues
                    .filter((i) => i.severity !== 'CRITICAL')
                    .forEach((issue) => this.emit(issue));
            }
        }
        catch (error) {
            // Emit page failed
            this.emit({
                type: 'page',
                url,
                status: 'failed',
                duration: (Date.now() - startTime) / 1000,
            });
        }
        finally {
            await page.close();
        }
    }
    /**
     * Capture console log
     */
    captureConsoleLog(msg) {
        return {
            type: msg.type(),
            message: msg.text(),
            source: msg.location().url,
            timestamp: (0, helpers_1.formatTimestamp)(),
        };
    }
    /**
     * Capture network request
     */
    async captureNetworkRequest(response, duration = 0) {
        const request = response.request();
        return {
            url: response.url(),
            method: request.method(),
            status: response.status(),
            statusText: response.statusText(),
            duration,
            failed: response.status() >= 400,
        };
    }
    /**
     * Collect performance metrics
     */
    async collectPerformance(page) {
        const metrics = await page.evaluate(() => {
            const navigation = performance.getEntriesByType('navigation')[0];
            const paint = performance.getEntriesByType('paint');
            return {
                loadTime: navigation ? navigation.loadEventEnd - navigation.fetchStart : 0,
                ttfb: navigation ? navigation.responseStart - navigation.requestStart : 0,
                lcp: paint.find((p) => p.name === 'largest-contentful-paint')?.startTime,
            };
        });
        return metrics;
    }
    /**
     * Capture screenshots
     */
    async captureScreenshots(page, url) {
        const screenshots = [];
        const viewportConfigs = {
            mobile: { width: 375, height: 667 },
            tablet: { width: 768, height: 1024 },
            desktop: { width: 1920, height: 1080 },
        };
        for (const viewport of this.config.viewports || ['desktop']) {
            const config = viewportConfigs[viewport];
            await page.setViewportSize(config);
            const filename = `${(0, helpers_1.generateId)()}-${viewport}.png`;
            const path = `/tmp/web-tester/screenshots/${filename}`;
            await page.screenshot({ path, fullPage: false });
            screenshots.push({
                viewport,
                path,
                width: config.width,
                height: config.height,
            });
        }
        return screenshots;
    }
    /**
     * Discover links on page
     */
    async discoverLinks(page, currentUrl) {
        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a[href]'))
                .map((a) => a.href)
                .filter((href) => href.startsWith('http'));
        });
        const baseUrl = new URL(this.config.baseUrl);
        for (const link of links) {
            try {
                const linkUrl = new URL(link);
                // Only same origin
                if (linkUrl.origin !== baseUrl.origin)
                    continue;
                // Check include/exclude patterns
                if (!(0, helpers_1.shouldIncludeUrl)(link, this.config.includePatterns, this.config.excludePatterns)) {
                    continue;
                }
                // Add to queue if not visited
                if (!this.visitedUrls.has(link) && !this.urlQueue.includes(link)) {
                    this.urlQueue.push(link);
                }
            }
            catch (e) {
                // Invalid URL, skip
            }
        }
    }
    /**
     * Emit output
     */
    emit(output) {
        if (this.onOutput) {
            this.onOutput(output);
        }
    }
    /**
     * Close browser
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}
exports.Scanner = Scanner;
//# sourceMappingURL=scanner.js.map