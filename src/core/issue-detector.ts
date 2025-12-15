/**
 * Issue detection and fix suggestion engine
 */

import {
  Issue,
  ConsoleLog,
  NetworkRequest,
  PerformanceMetrics,
  FixSuggestion,
  FixOperation,
} from '../types';
import { generateId, formatTimestamp } from '../utils/helpers';

interface DetectionContext {
  url: string;
  consoleLogs: ConsoleLog[];
  networkRequests: NetworkRequest[];
  performance?: PerformanceMetrics;
  httpStatus: number;
}

/**
 * Detect issues from collected data
 */
export function detectIssues(context: DetectionContext): Issue[] {
  const issues: Issue[] = [];

  // Console errors
  issues.push(...detectConsoleErrors(context));

  // Network failures
  issues.push(...detectNetworkFailures(context));

  // Performance issues
  if (context.performance) {
    issues.push(...detectPerformanceIssues(context));
  }

  // HTTP errors
  if (context.httpStatus >= 400) {
    issues.push(create404Issue(context));
  }

  return issues;
}

/**
 * Detect console errors
 */
function detectConsoleErrors(context: DetectionContext): Issue[] {
  return context.consoleLogs
    .filter((log) => log.type === 'error')
    .map((log) => {
      const issue: Issue = {
        id: generateId(),
        type: 'issue',
        severity: determineErrorSeverity(log.message),
        category: 'CONSOLE_ERROR',
        url: context.url,
        message: log.message,
        stackTrace: log.stackTrace,
        autoFixable: false,
        timestamp: formatTimestamp(),
      };

      // Try to extract file location
      const location = extractLocation(log.message, log.source);
      if (location) {
        issue.file = location.file;
        issue.line = location.line;
        issue.column = location.column;
      }

      // Generate fix suggestion
      issue.fix = suggestFix(log.message, context.url);
      issue.autoFixable = (issue.fix?.confidence ?? 0) > 0.8;

      return issue;
    });
}

/**
 * Detect network failures
 */
function detectNetworkFailures(context: DetectionContext): Issue[] {
  return context.networkRequests
    .filter((req) => req.failed)
    .map((req) => ({
      id: generateId(),
      type: 'issue' as const,
      severity: req.status === 404 ? 'MEDIUM' : 'HIGH',
      category: 'NETWORK_FAILURE' as const,
      url: context.url,
      message: `Failed request: ${req.method} ${req.url} (${req.status})`,
      autoFixable: false,
      timestamp: formatTimestamp(),
    }));
}

/**
 * Detect performance issues
 */
function detectPerformanceIssues(context: DetectionContext): Issue[] {
  const issues: Issue[] = [];
  const perf = context.performance!;

  // Slow page load
  if (perf.loadTime > 5000) {
    issues.push({
      id: generateId(),
      type: 'issue',
      severity: perf.loadTime > 10000 ? 'HIGH' : 'MEDIUM',
      category: 'PERFORMANCE',
      url: context.url,
      message: `Slow page load: ${Math.round(perf.loadTime)}ms (threshold: 5000ms)`,
      autoFixable: false,
      timestamp: formatTimestamp(),
    });
  }

  // Poor LCP
  if (perf.lcp && perf.lcp > 2500) {
    issues.push({
      id: generateId(),
      type: 'issue',
      severity: perf.lcp > 4000 ? 'HIGH' : 'MEDIUM',
      category: 'PERFORMANCE',
      url: context.url,
      message: `Poor LCP: ${Math.round(perf.lcp)}ms (threshold: 2500ms)`,
      autoFixable: false,
      timestamp: formatTimestamp(),
    });
  }

  return issues;
}

/**
 * Create 404 issue
 */
function create404Issue(context: DetectionContext): Issue {
  return {
    id: generateId(),
    type: 'issue',
    severity: 'MEDIUM',
    category: 'BROKEN_LINK',
    url: context.url,
    message: `Page returned ${context.httpStatus}`,
    autoFixable: false,
    timestamp: formatTimestamp(),
  };
}

/**
 * Determine error severity from message
 */
function determineErrorSeverity(message: string): Issue['severity'] {
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes('uncaught') ||
    lowerMessage.includes('fatal') ||
    lowerMessage.includes('critical')
  ) {
    return 'CRITICAL';
  }

  if (
    lowerMessage.includes('error') ||
    lowerMessage.includes('exception') ||
    lowerMessage.includes('failed')
  ) {
    return 'HIGH';
  }

  return 'MEDIUM';
}

/**
 * Extract file location from error message
 */
function extractLocation(
  message: string,
  source?: string
): { file: string; line?: number; column?: number } | null {
  // Try to extract from source
  if (source) {
    const match = source.match(/(.+):(\d+):(\d+)$/);
    if (match) {
      return {
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
      };
    }
  }

  // Try to extract from message
  const match = message.match(/at\s+(.+):(\d+):(\d+)/);
  if (match) {
    return {
      file: match[1],
      line: parseInt(match[2]),
      column: parseInt(match[3]),
    };
  }

  return null;
}

/**
 * Suggest fix based on error pattern
 */
function suggestFix(message: string, url: string): FixSuggestion | undefined {
  // INSUFFICIENT_PATH error (next-intl)
  if (message.includes('INSUFFICIENT_PATH')) {
    return {
      description: "Replace next/link with next-intl Link",
      confidence: 0.95,
      operations: [
        {
          type: 'EDIT',
          description: 'Update import statement',
          oldString: "import Link from 'next/link';",
          newString: "import { Link } from '@/i18n/routing';",
        },
      ],
    };
  }

  // Missing dependency
  if (message.includes('Cannot find module')) {
    const moduleMatch = message.match(/Cannot find module ['"](.+)['"]/);
    if (moduleMatch) {
      return {
        description: `Install missing dependency: ${moduleMatch[1]}`,
        confidence: 0.9,
        operations: [
          {
            type: 'BASH',
            command: `pnpm add ${moduleMatch[1]}`,
            description: 'Install missing dependency',
          },
        ],
      };
    }
  }

  // Network timeout
  if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
    return {
      description: 'Increase timeout or check network connectivity',
      confidence: 0.7,
      operations: [
        {
          type: 'BASH',
          description: 'Check if service is running',
        },
      ],
    };
  }

  return undefined;
}
