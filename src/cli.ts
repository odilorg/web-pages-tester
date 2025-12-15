#!/usr/bin/env node
/**
 * CLI for web-pages-tester
 * Optimized for Claude Code autonomous usage
 */

import { Command } from 'commander';
import * as fs from 'fs';
import { Scanner } from './core/scanner';
import { ScanOutput } from './types';

const program = new Command();

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
  .action(async (url: string, options) => {
    console.log(`🔍 Scanning: ${url}`);
    console.log(`📄 Output: ${options.output}`);

    // Ensure output directory exists
    const outputDir = options.output.substring(0, options.output.lastIndexOf('/'));
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create write stream for JSONL output
    const writeStream = fs.createWriteStream(options.output, { flags: 'w' });

    // Output handler
    const onOutput = (output: ScanOutput) => {
      // Write to JSONL file
      writeStream.write(JSON.stringify(output) + '\n');

      // Console feedback for critical issues
      if (output.type === 'issue' && output.severity === 'CRITICAL') {
        console.log(`🚨 CRITICAL: ${output.message}`);
        if (output.file) {
          console.log(`   📁 ${output.file}:${output.line || 0}`);
        }
      }

      // Progress updates
      if (output.type === 'progress') {
        console.log(
          `📊 Progress: ${output.pagesScanned} pages scanned, ` +
          `${output.issuesFound} issues found (${output.criticalIssues} critical)`
        );
      }

      // Completion
      if (output.type === 'scan_complete') {
        console.log(
          `\n✅ Scan complete!\n` +
          `   Pages: ${output.totalPages}\n` +
          `   Issues: ${output.issuesFound}\n` +
          `   Duration: ${output.duration.toFixed(1)}s`
        );
      }
    };

    // Create scanner
    const scanner = new Scanner(
      {
        baseUrl: url,
        maxPages: parseInt(options.maxPages),
        progressive: options.progressive,
        captureScreenshots: options.screenshots,
        viewports: options.viewports.split(','),
        outputPath: options.output,
      },
      onOutput
    );

    try {
      await scanner.scan();
      writeStream.end();
      console.log(`\n📝 Report saved to: ${options.output}`);
      process.exit(0);
    } catch (error) {
      console.error('❌ Scan failed:', error);
      writeStream.end();
      process.exit(1);
    }
  });

program.parse();
