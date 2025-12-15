/**
 * Core types for web-pages-tester
 * Optimized for Claude Code progressive processing
 */

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type IssueCategory =
  | 'CONSOLE_ERROR'
  | 'NETWORK_FAILURE'
  | 'PERFORMANCE'
  | 'ACCESSIBILITY'
  | 'VISUAL_REGRESSION'
  | 'BROKEN_LINK'
  | 'MISSING_ELEMENT';

export interface Issue {
  id: string;
  type: 'issue';
  severity: Severity;
  category: IssueCategory;

  // Location
  url: string;
  file?: string;
  line?: number;
  column?: number;

  // Details
  message: string;
  snippet?: string;
  stackTrace?: string;

  // Fix suggestion
  fix?: FixSuggestion;
  autoFixable: boolean;

  timestamp: string;
}

export interface FixSuggestion {
  description: string;
  confidence: number; // 0-1
  operations: FixOperation[];
}

export interface FixOperation {
  type: 'EDIT' | 'BASH' | 'CREATE' | 'DELETE';
  file?: string;
  oldString?: string;
  newString?: string;
  command?: string;
  description?: string;
}

export interface ConsoleLog {
  type: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  source?: string;
  stackTrace?: string;
  timestamp: string;
}

export interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  statusText: string;
  duration: number;
  failed: boolean;
}

export interface PerformanceMetrics {
  loadTime: number;
  lcp?: number;  // Largest Contentful Paint
  inp?: number;  // Interaction to Next Paint
  cls?: number;  // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
}

export interface Screenshot {
  viewport: 'mobile' | 'tablet' | 'desktop';
  path: string;
  width: number;
  height: number;
}

export interface PageScanResult {
  type: 'page';
  url: string;
  status: 'scanning' | 'complete' | 'failed';
  httpStatus?: number;

  // Collected data
  issues?: Issue[];
  consoleLogs?: ConsoleLog[];
  networkRequests?: NetworkRequest[];
  performance?: PerformanceMetrics;
  screenshots?: Screenshot[];

  // Timing
  scannedAt?: string;
  duration?: number;
}

export interface ScanProgress {
  type: 'progress';
  pagesScanned: number;
  totalPages: number;
  issuesFound: number;
  criticalIssues: number;
}

export interface ScanStart {
  type: 'scan_start';
  runId: string;
  baseUrl: string;
  totalPages?: number;
  timestamp: string;
}

export interface ScanComplete {
  type: 'scan_complete';
  runId: string;
  totalPages: number;
  issuesFound: number;
  duration: number;
  timestamp: string;
}

export interface Pattern {
  type: 'pattern';
  name: string;
  description: string;
  occurrences: number;
  affectedFiles: string[];
  bulkFix?: FixSuggestion;
}

export interface PatternAnalysis {
  type: 'analysis';
  patterns: Pattern[];
  timestamp: string;
}

// Union type for all JSONL output lines
export type ScanOutput =
  | ScanStart
  | ScanProgress
  | PageScanResult
  | Issue
  | ScanComplete
  | PatternAnalysis;

export interface ScanConfig {
  baseUrl: string;
  maxPages?: number;
  maxDepth?: number;
  parallelPages?: number;
  viewports?: ('mobile' | 'tablet' | 'desktop')[];

  // Progressive mode
  progressive?: boolean;
  prioritizeCritical?: boolean;

  // Output
  outputPath?: string;
  format?: 'jsonl' | 'json';

  // Filtering
  includePatterns?: string[];
  excludePatterns?: string[];

  // Performance & Loading
  waitStrategy?: 'load' | 'domcontentloaded' | 'networkidle';
  blockExternalResources?: boolean;
  allowedDomains?: string[]; // External domains to allow (e.g., CDNs)
  blockedResourceTypes?: ('image' | 'stylesheet' | 'font' | 'media')[];

  // Issue Filtering
  criticalOnly?: boolean;
  minSeverity?: Severity;

  // Features
  captureScreenshots?: boolean;
  captureConsoleLogs?: boolean;
  captureNetworkRequests?: boolean;
  measurePerformance?: boolean;
  checkAccessibility?: boolean;
}
