/**
 * Core scanner - Progressive web page testing with Playwright
 * Optimized for Claude Code autonomous usage
 */

import { chromium, Browser, Page, ConsoleMessage } from 'playwright';
import {
  ScanConfig,
  ScanOutput,
  PageScanResult,
  Issue,
  ConsoleLog,
  NetworkRequest,
  Screenshot,
  PerformanceMetrics,
  ScanStart,
  ScanComplete,
  ScanProgress,
} from '../types';
import { generateId, formatTimestamp, shouldIncludeUrl } from '../utils/helpers';
import { detectIssues } from './issue-detector';

export class Scanner {
  private browser: Browser | null = null;
  private config: ScanConfig;
  private visitedUrls: Set<string> = new Set();
  private urlQueue: string[] = [];
  private pagesScanned: number = 0;
  private issuesFound: number = 0;
  private criticalIssues: number = 0;
  private onOutput?: (output: ScanOutput) => void;

  constructor(config: ScanConfig, onOutput?: (output: ScanOutput) => void) {
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
      ...config,
    };
    this.onOutput = onOutput;
  }

  /**
   * Start the scan
   */
  async scan(): Promise<void> {
    const runId = generateId();
    const startTime = Date.now();

    // Emit scan start
    this.emit<ScanStart>({
      type: 'scan_start',
      runId,
      baseUrl: this.config.baseUrl,
      timestamp: formatTimestamp(),
    });

    try {
      // Launch browser
      this.browser = await chromium.launch({
        headless: true,
      });

      // Add initial URL to queue
      this.urlQueue.push(this.config.baseUrl);

      // Process queue
      while (this.urlQueue.length > 0 && this.pagesScanned < (this.config.maxPages || 100)) {
        const url = this.urlQueue.shift()!;

        if (this.visitedUrls.has(url)) continue;
        this.visitedUrls.add(url);

        await this.scanPage(url);
        this.pagesScanned++;

        // Emit progress
        if (this.config.progressive) {
          this.emit<ScanProgress>({
            type: 'progress',
            pagesScanned: this.pagesScanned,
            totalPages: this.visitedUrls.size + this.urlQueue.length,
            issuesFound: this.issuesFound,
            criticalIssues: this.criticalIssues,
          });
        }
      }

      // Emit scan complete
      this.emit<ScanComplete>({
        type: 'scan_complete',
        runId,
        totalPages: this.pagesScanned,
        issuesFound: this.issuesFound,
        duration: (Date.now() - startTime) / 1000,
        timestamp: formatTimestamp(),
      });
    } finally {
      await this.close();
    }
  }

  /**
   * Scan a single page
   */
  private async scanPage(url: string): Promise<void> {
    if (!this.browser) throw new Error('Browser not initialized');

    const page = await this.browser.newPage();
    const startTime = Date.now();

    // Emit page scanning status
    this.emit<PageScanResult>({
      type: 'page',
      url,
      status: 'scanning',
    });

    try {
      // Collectors
      const consoleLogs: ConsoleLog[] = [];
      const networkRequests: NetworkRequest[] = [];

      // Listen to console
      if (this.config.captureConsoleLogs) {
        page.on('console', (msg: ConsoleMessage) => {
          consoleLogs.push(this.captureConsoleLog(msg));
        });
      }

      // Listen to network requests
      if (this.config.captureNetworkRequests) {
        page.on('response', async (response) => {
          networkRequests.push(await this.captureNetworkRequest(response));
        });
      }

      // Navigate to page
      const response = await page.goto(url, {
        waitUntil: 'networkidle',
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
      const issues = detectIssues({
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
      this.emit<PageScanResult>({
        type: 'page',
        url,
        status: 'complete',
        httpStatus,
        issues,
        consoleLogs: this.config.captureConsoleLogs ? consoleLogs : undefined,
        networkRequests: this.config.captureNetworkRequests ? networkRequests : undefined,
        performance,
        screenshots,
        scannedAt: formatTimestamp(),
        duration: (Date.now() - startTime) / 1000,
      });

      // Emit non-critical issues
      if (this.config.progressive && this.config.prioritizeCritical) {
        issues
          .filter((i) => i.severity !== 'CRITICAL')
          .forEach((issue) => this.emit(issue));
      }
    } catch (error) {
      // Emit page failed
      this.emit<PageScanResult>({
        type: 'page',
        url,
        status: 'failed',
        duration: (Date.now() - startTime) / 1000,
      });
    } finally {
      await page.close();
    }
  }

  /**
   * Capture console log
   */
  private captureConsoleLog(msg: ConsoleMessage): ConsoleLog {
    return {
      type: msg.type() as any,
      message: msg.text(),
      source: msg.location().url,
      timestamp: formatTimestamp(),
    };
  }

  /**
   * Capture network request
   */
  private async captureNetworkRequest(response: any): Promise<NetworkRequest> {
    const request = response.request();

    return {
      url: response.url(),
      method: request.method(),
      status: response.status(),
      statusText: response.statusText(),
      duration: 0, // Timing data not available in Playwright Response API
      failed: response.status() >= 400,
    };
  }

  /**
   * Collect performance metrics
   */
  private async collectPerformance(page: Page): Promise<PerformanceMetrics> {
    const metrics = await page.evaluate(() => {
      const navigation = (performance as any).getEntriesByType('navigation')[0] as any;
      const paint = (performance as any).getEntriesByType('paint');

      return {
        loadTime: navigation ? navigation.loadEventEnd - navigation.fetchStart : 0,
        ttfb: navigation ? navigation.responseStart - navigation.requestStart : 0,
        lcp: paint.find((p: any) => p.name === 'largest-contentful-paint')?.startTime,
      };
    });

    return metrics;
  }

  /**
   * Capture screenshots
   */
  private async captureScreenshots(page: Page, url: string): Promise<Screenshot[]> {
    const screenshots: Screenshot[] = [];
    const viewportConfigs = {
      mobile: { width: 375, height: 667 },
      tablet: { width: 768, height: 1024 },
      desktop: { width: 1920, height: 1080 },
    };

    for (const viewport of this.config.viewports || ['desktop']) {
      const config = viewportConfigs[viewport];
      await page.setViewportSize(config);

      const filename = `${generateId()}-${viewport}.png`;
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
  private async discoverLinks(page: Page, currentUrl: string): Promise<void> {
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href]'))
        .map((a) => (a as HTMLAnchorElement).href)
        .filter((href) => href.startsWith('http'));
    });

    const baseUrl = new URL(this.config.baseUrl);

    for (const link of links) {
      try {
        const linkUrl = new URL(link);

        // Only same origin
        if (linkUrl.origin !== baseUrl.origin) continue;

        // Check include/exclude patterns
        if (!shouldIncludeUrl(link, this.config.includePatterns, this.config.excludePatterns)) {
          continue;
        }

        // Add to queue if not visited
        if (!this.visitedUrls.has(link) && !this.urlQueue.includes(link)) {
          this.urlQueue.push(link);
        }
      } catch (e) {
        // Invalid URL, skip
      }
    }
  }

  /**
   * Emit output
   */
  private emit<T extends ScanOutput>(output: T): void {
    if (this.onOutput) {
      this.onOutput(output);
    }
  }

  /**
   * Close browser
   */
  private async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
