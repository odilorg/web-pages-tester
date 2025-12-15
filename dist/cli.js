#!/usr/bin/env node
"use strict";
/**
 * CLI for web-pages-tester
 * Optimized for Claude Code autonomous usage
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const fs = __importStar(require("fs"));
const scanner_1 = require("./core/scanner");
const program = new commander_1.Command();
/**
 * Generate issue statistics table
 */
function generateStatisticsTable(issues) {
    const stats = {};
    issues.forEach(issue => {
        if (!stats[issue.category]) {
            stats[issue.category] = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
        }
        stats[issue.category][issue.severity]++;
    });
    const categories = Object.keys(stats).sort();
    if (categories.length === 0)
        return '';
    let table = '\n╔════════════════════════╦══════════╦══════════╦══════════╦══════════╗\n';
    table += '║ Category               ║ CRITICAL ║ HIGH     ║ MEDIUM   ║ LOW      ║\n';
    table += '╠════════════════════════╬══════════╬══════════╬══════════╬══════════╣\n';
    categories.forEach(category => {
        const cat = stats[category];
        const name = category.padEnd(22);
        const crit = String(cat.CRITICAL || 0).padStart(8);
        const high = String(cat.HIGH || 0).padStart(8);
        const med = String(cat.MEDIUM || 0).padStart(8);
        const low = String(cat.LOW || 0).padStart(8);
        table += `║ ${name} ║ ${crit} ║ ${high} ║ ${med} ║ ${low} ║\n`;
    });
    table += '╚════════════════════════╩══════════╩══════════╩══════════╩══════════╝\n';
    return table;
}
program
    .name('web-tester')
    .description('Progressive web testing tool for Claude Code')
    .version('0.1.0');
program
    .command('scan')
    .description('Scan a website progressively')
    .argument('<url>', 'Base URL to scan')
    .option('-o, --output <path>', 'Output file path (JSONL)', '/tmp/web-tester/scan.jsonl')
    .option('-m, --max-pages <number>', 'Maximum pages to scan', '50')
    .option('--no-progressive', 'Disable progressive mode')
    .option('--no-screenshots', 'Disable screenshot capture')
    .option('--viewports <viewports>', 'Viewports to test (comma-separated)', 'desktop')
    .option('--wait-strategy <strategy>', 'Page load wait strategy (load|domcontentloaded|networkidle)', 'load')
    .option('--block-external', 'Block external resources (images, scripts from other domains)')
    .option('--block-resources <types>', 'Block specific resource types (image,font,media,stylesheet)')
    .option('--exclude <patterns>', 'URL patterns to exclude (comma-separated)')
    .option('--critical-only', 'Only report CRITICAL severity issues')
    .option('--min-severity <level>', 'Minimum severity to report (CRITICAL|HIGH|MEDIUM|LOW)')
    .action(async (url, options) => {
    console.log(`🔍 Scanning: ${url}`);
    console.log(`📄 Output: ${options.output}`);
    // Ensure output directory exists
    const outputDir = options.output.substring(0, options.output.lastIndexOf('/'));
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    // Create write stream for JSONL output
    const writeStream = fs.createWriteStream(options.output, { flags: 'w' });
    // Collect issues for statistics
    const allIssues = [];
    // Output handler
    const onOutput = (output) => {
        // Write to JSONL file
        writeStream.write(JSON.stringify(output) + '\n');
        // Collect issues
        if (output.type === 'issue') {
            allIssues.push(output);
        }
        // Console feedback for critical issues
        if (output.type === 'issue' && output.severity === 'CRITICAL') {
            console.log(`🚨 CRITICAL: ${output.message}`);
            if (output.file) {
                console.log(`   📁 ${output.file}:${output.line || 0}`);
            }
        }
        // Progress updates
        if (output.type === 'progress') {
            console.log(`📊 Progress: ${output.pagesScanned} pages scanned, ` +
                `${output.issuesFound} issues found (${output.criticalIssues} critical)`);
        }
        // Completion
        if (output.type === 'scan_complete') {
            console.log(`\n✅ Scan complete!\n` +
                `   Pages: ${output.totalPages}\n` +
                `   Issues: ${output.issuesFound}\n` +
                `   Duration: ${output.duration.toFixed(1)}s`);
            // Show statistics table
            if (allIssues.length > 0) {
                console.log(generateStatisticsTable(allIssues));
            }
        }
    };
    // Create scanner
    const scanner = new scanner_1.Scanner({
        baseUrl: url,
        maxPages: parseInt(options.maxPages),
        progressive: options.progressive,
        captureScreenshots: options.screenshots,
        viewports: options.viewports.split(','),
        outputPath: options.output,
        waitStrategy: options.waitStrategy,
        blockExternalResources: options.blockExternal || false,
        blockedResourceTypes: options.blockResources?.split(','),
        excludePatterns: options.exclude?.split(','),
        criticalOnly: options.criticalOnly || false,
        minSeverity: options.minSeverity,
    }, onOutput);
    try {
        await scanner.scan();
        writeStream.end();
        console.log(`\n📝 Report saved to: ${options.output}`);
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Scan failed:', error);
        writeStream.end();
        process.exit(1);
    }
});
program.parse();
//# sourceMappingURL=cli.js.map