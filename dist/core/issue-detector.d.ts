/**
 * Issue detection and fix suggestion engine
 */
import { Issue, ConsoleLog, NetworkRequest, PerformanceMetrics } from '../types';
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
export declare function detectIssues(context: DetectionContext): Issue[];
export {};
//# sourceMappingURL=issue-detector.d.ts.map