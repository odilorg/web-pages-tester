"use strict";
/**
 * Issue detection and fix suggestion engine
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectIssues = detectIssues;
const helpers_1 = require("../utils/helpers");
/**
 * Detect issues from collected data
 */
function detectIssues(context) {
    const issues = [];
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
function detectConsoleErrors(context) {
    return context.consoleLogs
        .filter((log) => log.type === 'error')
        .map((log) => {
        const issue = {
            id: (0, helpers_1.generateId)(),
            type: 'issue',
            severity: determineErrorSeverity(log.message),
            category: 'CONSOLE_ERROR',
            url: context.url,
            message: log.message,
            stackTrace: log.stackTrace,
            autoFixable: false,
            timestamp: (0, helpers_1.formatTimestamp)(),
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
function detectNetworkFailures(context) {
    return context.networkRequests
        .filter((req) => req.failed)
        .map((req) => ({
        id: (0, helpers_1.generateId)(),
        type: 'issue',
        severity: req.status === 404 ? 'MEDIUM' : 'HIGH',
        category: 'NETWORK_FAILURE',
        url: context.url,
        message: `Failed request: ${req.method} ${req.url} (${req.status})`,
        autoFixable: false,
        timestamp: (0, helpers_1.formatTimestamp)(),
    }));
}
/**
 * Detect performance issues
 */
function detectPerformanceIssues(context) {
    const issues = [];
    const perf = context.performance;
    // Slow page load
    if (perf.loadTime > 5000) {
        issues.push({
            id: (0, helpers_1.generateId)(),
            type: 'issue',
            severity: perf.loadTime > 10000 ? 'HIGH' : 'MEDIUM',
            category: 'PERFORMANCE',
            url: context.url,
            message: `Slow page load: ${Math.round(perf.loadTime)}ms (threshold: 5000ms)`,
            autoFixable: false,
            timestamp: (0, helpers_1.formatTimestamp)(),
        });
    }
    // Poor LCP
    if (perf.lcp && perf.lcp > 2500) {
        issues.push({
            id: (0, helpers_1.generateId)(),
            type: 'issue',
            severity: perf.lcp > 4000 ? 'HIGH' : 'MEDIUM',
            category: 'PERFORMANCE',
            url: context.url,
            message: `Poor LCP: ${Math.round(perf.lcp)}ms (threshold: 2500ms)`,
            autoFixable: false,
            timestamp: (0, helpers_1.formatTimestamp)(),
        });
    }
    return issues;
}
/**
 * Create 404 issue
 */
function create404Issue(context) {
    return {
        id: (0, helpers_1.generateId)(),
        type: 'issue',
        severity: 'MEDIUM',
        category: 'BROKEN_LINK',
        url: context.url,
        message: `Page returned ${context.httpStatus}`,
        autoFixable: false,
        timestamp: (0, helpers_1.formatTimestamp)(),
    };
}
/**
 * Determine error severity from message
 */
function determineErrorSeverity(message) {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('uncaught') ||
        lowerMessage.includes('fatal') ||
        lowerMessage.includes('critical')) {
        return 'CRITICAL';
    }
    if (lowerMessage.includes('error') ||
        lowerMessage.includes('exception') ||
        lowerMessage.includes('failed')) {
        return 'HIGH';
    }
    return 'MEDIUM';
}
/**
 * Extract file location from error message
 */
function extractLocation(message, source) {
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
function suggestFix(message, url) {
    const lowerMessage = message.toLowerCase();
    // 1. INSUFFICIENT_PATH error (next-intl)
    if (message.includes('INSUFFICIENT_PATH')) {
        return {
            description: "Replace next/link with next-intl Link",
            confidence: 0.95,
            operations: [{ type: 'EDIT', description: 'Update import statement', oldString: "import Link from 'next/link';", newString: "import { Link } from '@/i18n/routing';" }],
        };
    }
    // 2. Missing dependency
    if (message.includes('Cannot find module')) {
        const moduleMatch = message.match(/Cannot find module ['"](.+)['"]/);
        if (moduleMatch) {
            return {
                description: `Install missing dependency: ${moduleMatch[1]}`,
                confidence: 0.9,
                operations: [{ type: 'BASH', command: `pnpm add ${moduleMatch[1]}`, description: 'Install missing dependency' }],
            };
        }
    }
    // 3. Network timeout
    if (lowerMessage.includes('timeout') || lowerMessage.includes('etimedout')) {
        return { description: 'Increase timeout or check network connectivity', confidence: 0.7, operations: [{ type: 'BASH', description: 'Check if service is running' }] };
    }
    // 4. Hydration mismatch (React/Next.js)
    if (lowerMessage.includes('hydration') || lowerMessage.includes('hydrate')) {
        return { description: 'Fix server/client rendering mismatch - ensure HTML matches between server and client', confidence: 0.85, operations: [{ type: 'EDIT', description: 'Check for dynamic content in SSR' }] };
    }
    // 5. CORS errors
    if (lowerMessage.includes('cors') || lowerMessage.includes('access-control-allow-origin')) {
        return { description: 'Add CORS headers to API endpoint', confidence: 0.9, operations: [{ type: 'EDIT', description: 'Configure CORS middleware' }] };
    }
    // 6. Memory leaks
    if (lowerMessage.includes('out of memory') || lowerMessage.includes('heap')) {
        return { description: 'Investigate memory leak - check for uncleaned listeners or large object retention', confidence: 0.8, operations: [{ type: 'BASH', description: 'Profile with --inspect flag' }] };
    }
    // 7. Undefined is not an object/function
    if (lowerMessage.includes('undefined is not') || lowerMessage.includes('cannot read property')) {
        return { description: 'Add null/undefined checks before accessing properties', confidence: 0.85, operations: [{ type: 'EDIT', description: 'Add optional chaining (?.)' }] };
    }
    // 8. React Hook errors
    if (lowerMessage.includes('rendered more hooks') || lowerMessage.includes('hooks can only be called')) {
        return { description: 'Fix hook call order - hooks must be called in the same order on every render', confidence: 0.9, operations: [{ type: 'EDIT', description: 'Move hooks outside conditionals' }] };
    }
    // 9. ESLint/Prettier errors
    if (lowerMessage.includes('expected') && lowerMessage.includes('indent')) {
        return { description: 'Fix indentation', confidence: 0.95, operations: [{ type: 'BASH', command: 'npx prettier --write .', description: 'Run Prettier' }] };
    }
    // 10. TypeScript errors
    if (lowerMessage.includes('type') && lowerMessage.includes('not assignable')) {
        return { description: 'Fix TypeScript type mismatch', confidence: 0.75, operations: [{ type: 'EDIT', description: 'Update type annotations' }] };
    }
    // 11. Prisma errors
    if (lowerMessage.includes('prisma') && lowerMessage.includes('unique constraint')) {
        return { description: 'Handle duplicate entry - add upsert or unique check', confidence: 0.85, operations: [{ type: 'EDIT', description: 'Use upsert instead of create' }] };
    }
    // 12. N+1 Query pattern
    if (lowerMessage.includes('query') && lowerMessage.includes('loop')) {
        return { description: 'Fix N+1 query - use include/select to eager load relations', confidence: 0.9, operations: [{ type: 'EDIT', description: 'Add include to Prisma query' }] };
    }
    // 13. Environment variable missing
    if (lowerMessage.includes('env') || lowerMessage.includes('environment variable')) {
        return { description: 'Add missing environment variable to .env file', confidence: 0.85, operations: [{ type: 'EDIT', description: 'Update .env file' }] };
    }
    // 14. Database connection errors
    if (lowerMessage.includes('econnrefused') || lowerMessage.includes('connection refused')) {
        return { description: 'Database not running - start database service', confidence: 0.9, operations: [{ type: 'BASH', description: 'Check database status' }] };
    }
    // 15. JWT/Auth token errors
    if (lowerMessage.includes('jwt') || lowerMessage.includes('token') && lowerMessage.includes('invalid')) {
        return { description: 'Token expired or invalid - refresh authentication', confidence: 0.8, operations: [{ type: 'BASH', description: 'Clear cookies/localStorage' }] };
    }
    // 16. Rate limiting
    if (lowerMessage.includes('429') || lowerMessage.includes('too many requests')) {
        return { description: 'Rate limit exceeded - implement exponential backoff', confidence: 0.85, operations: [{ type: 'EDIT', description: 'Add retry logic with delay' }] };
    }
    // 17. Stale cache
    if (lowerMessage.includes('cache') && lowerMessage.includes('stale')) {
        return { description: 'Clear cache or reduce TTL', confidence: 0.75, operations: [{ type: 'BASH', command: 'redis-cli FLUSHALL', description: 'Clear Redis cache' }] };
    }
    // 18. Missing image/resource (404)
    if (message.includes('404') && lowerMessage.includes('image')) {
        return { description: 'Upload missing image or update image path', confidence: 0.8, operations: [{ type: 'EDIT', description: 'Fix image URL or upload file' }] };
    }
    // 19. Bundle size too large
    if (lowerMessage.includes('bundle') && lowerMessage.includes('size')) {
        return { description: 'Reduce bundle size - use code splitting and tree shaking', confidence: 0.7, operations: [{ type: 'EDIT', description: 'Add dynamic imports' }] };
    }
    // 20. React key prop missing
    if (lowerMessage.includes('key') && lowerMessage.includes('unique')) {
        return { description: 'Add unique key prop to list items', confidence: 0.95, operations: [{ type: 'EDIT', description: 'Add key={item.id}' }] };
    }
    // 21. Deprecated API usage
    if (lowerMessage.includes('deprecated')) {
        return { description: 'Update to new API - check migration guide', confidence: 0.75, operations: [{ type: 'EDIT', description: 'Replace deprecated method' }] };
    }
    // 22. Infinite loop/recursion
    if (lowerMessage.includes('maximum call stack') || lowerMessage.includes('infinite')) {
        return { description: 'Fix infinite recursion - add base case or loop condition', confidence: 0.9, operations: [{ type: 'EDIT', description: 'Add termination condition' }] };
    }
    return undefined;
}
//# sourceMappingURL=issue-detector.js.map