/**
 * Core scanner - Progressive web page testing with Playwright
 * Optimized for Claude Code autonomous usage
 */
import { ScanConfig, ScanOutput } from '../types';
export declare class Scanner {
    private browser;
    private config;
    private visitedUrls;
    private urlQueue;
    private pagesScanned;
    private issuesFound;
    private criticalIssues;
    private onOutput?;
    constructor(config: ScanConfig, onOutput?: (output: ScanOutput) => void);
    /**
     * Start the scan
     */
    scan(): Promise<void>;
    /**
     * Scan a single page
     */
    private scanPage;
    /**
     * Capture console log
     */
    private captureConsoleLog;
    /**
     * Capture network request
     */
    private captureNetworkRequest;
    /**
     * Collect performance metrics
     */
    private collectPerformance;
    /**
     * Capture screenshots
     */
    private captureScreenshots;
    /**
     * Discover links on page
     */
    private discoverLinks;
    /**
     * Emit output
     */
    private emit;
    /**
     * Close browser
     */
    private close;
}
//# sourceMappingURL=scanner.d.ts.map