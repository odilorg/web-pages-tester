/**
 * Helper utilities
 */

import { randomBytes } from 'crypto';

/**
 * Generate unique ID
 */
export function generateId(): string {
  return randomBytes(8).toString('hex');
}

/**
 * Format timestamp
 */
export function formatTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Check if URL should be included based on patterns
 */
export function shouldIncludeUrl(
  url: string,
  includePatterns?: string[],
  excludePatterns?: string[]
): boolean {
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
function matchPattern(url: string, pattern: string): boolean {
  const regex = pattern
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  return new RegExp(regex).test(url);
}
