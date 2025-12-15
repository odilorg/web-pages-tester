"use strict";
/**
 * Helper utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.formatTimestamp = formatTimestamp;
exports.shouldIncludeUrl = shouldIncludeUrl;
const crypto_1 = require("crypto");
/**
 * Generate unique ID
 */
function generateId() {
    return (0, crypto_1.randomBytes)(8).toString('hex');
}
/**
 * Format timestamp
 */
function formatTimestamp() {
    return new Date().toISOString();
}
/**
 * Check if URL should be included based on patterns
 */
function shouldIncludeUrl(url, includePatterns, excludePatterns) {
    // Check exclude patterns first
    if (excludePatterns) {
        for (const pattern of excludePatterns) {
            if (matchPattern(url, pattern)) {
                return false;
            }
        }
    }
    // Check include patterns
    if (includePatterns && includePatterns.length > 0) {
        for (const pattern of includePatterns) {
            if (matchPattern(url, pattern)) {
                return true;
            }
        }
        return false;
    }
    return true;
}
/**
 * Simple glob pattern matching
 */
function matchPattern(url, pattern) {
    const regex = pattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
    return new RegExp(regex).test(url);
}
//# sourceMappingURL=helpers.js.map