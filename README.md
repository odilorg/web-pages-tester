# web-pages-tester

Progressive web testing tool optimized for Claude Code autonomous usage.

## Features

- **Progressive JSONL Output** - Real-time streaming of results for immediate action
- **Priority-Based Scanning** - Critical issues detected and reported first
- **Smart Fix Suggestions** - AI-powered fix recommendations with confidence scores
- **Multi-Viewport Screenshots** - Mobile, tablet, desktop testing
- **Performance Metrics** - Core Web Vitals (LCP, INP, CLS)
- **Console & Network Capture** - Full error and request logging

## Installation

```bash
git clone https://github.com/odilorg/web-pages-tester.git
cd web-pages-tester
pnpm install
pnpm build
```

## Usage

### Basic Scan

```bash
node dist/cli.js scan https://staging.jahongir-app.uz
```

### With Options

```bash
node dist/cli.js scan https://staging.jahongir-app.uz \
  --output /tmp/scan.jsonl \
  --max-pages 50 \
  --viewports desktop,mobile \
  --wait-strategy load \
  --block-external \
  --exclude "/admin/*,/api/internal/*" \
  --critical-only
```

**Available Options:**
- `-o, --output <path>` - Output file path (default: `/tmp/web-tester/scan.jsonl`)
- `-m, --max-pages <number>` - Maximum pages to scan (default: `50`)
- `--viewports <viewports>` - Viewports to test: `mobile`, `tablet`, `desktop` (comma-separated)
- `--wait-strategy <strategy>` - Page load strategy: `load` (default), `domcontentloaded`, `networkidle`
- `--block-external` - Block external resources (faster scans, may miss external issues)
- `--block-resources <types>` - Block specific types: `image`, `font`, `media`, `stylesheet`
- `--exclude <patterns>` - URL patterns to skip (comma-separated, supports wildcards)
- `--critical-only` - Only report CRITICAL severity issues
- `--min-severity <level>` - Minimum severity: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`
- `--no-progressive` - Disable progressive output
- `--no-screenshots` - Disable screenshot capture

## Output Format (JSONL)

Each line is a JSON object representing a scan event:

```jsonl
{"type":"scan_start","runId":"abc123","baseUrl":"https://...","timestamp":"..."}
{"type":"progress","pagesScanned":5,"totalPages":50,"issuesFound":2}
{"type":"issue","severity":"CRITICAL","message":"INSUFFICIENT_PATH",...}
{"type":"scan_complete","totalPages":47,"issuesFound":12,"duration":45.2}
```

## Issue Format

```json
{
  "type": "issue",
  "severity": "CRITICAL",
  "category": "CONSOLE_ERROR",
  "message": "INSUFFICIENT_PATH error",
  "file": "apps/web/src/components/Nav.tsx",
  "line": 3,
  "fix": {
    "description": "Replace next/link with next-intl Link",
    "confidence": 0.95,
    "operations": [
      {
        "type": "EDIT",
        "oldString": "import Link from 'next/link';",
        "newString": "import { Link } from '@/i18n/routing';"
      }
    ]
  },
  "autoFixable": true
}
```

## Issue Statistics

At the end of each scan, a summary table shows issues by category and severity:

```
╔════════════════════════╦══════════╦══════════╦══════════╦══════════╗
║ Category               ║ CRITICAL ║ HIGH     ║ MEDIUM   ║ LOW      ║
╠════════════════════════╬══════════╬══════════╬══════════╬══════════╣
║ CONSOLE_ERROR          ║        0 ║      155 ║       20 ║        0 ║
║ NETWORK_FAILURE        ║        0 ║       53 ║       53 ║        0 ║
║ PERFORMANCE            ║        0 ║        4 ║        0 ║        0 ║
╚════════════════════════╩══════════╩══════════╩══════════╩══════════╝
```

## Error Pattern Detection (22+ patterns)

The tool automatically detects and suggests fixes for common errors:

1. **INSUFFICIENT_PATH** (next-intl) - Replace `next/link` with next-intl routing
2. **Missing dependencies** - Auto-detects and suggests `pnpm add <package>`
3. **Network timeouts** - Suggests timeout increases or service checks
4. **Hydration mismatches** (React/Next.js) - SSR/CSR rendering differences
5. **CORS errors** - Missing Access-Control headers
6. **Memory leaks** - Out of memory or heap issues
7. **Undefined/null errors** - Suggests optional chaining (`?.`)
8. **React Hook errors** - Invalid hook call order
9. **ESLint/Prettier** - Indentation and formatting
10. **TypeScript errors** - Type mismatch issues
11. **Prisma errors** - Unique constraints, N+1 queries
12. **Environment variables** - Missing .env values
13. **Database connection** - Connection refused errors
14. **JWT/Auth tokens** - Invalid or expired tokens
15. **Rate limiting** (429) - Suggests exponential backoff
16. **Stale cache** - Redis or browser cache issues
17. **Missing images** (404) - Broken image paths
18. **Bundle size** - Large JavaScript bundles
19. **React keys** - Missing key props in lists
20. **Deprecated APIs** - Outdated method usage
21. **Infinite loops** - Maximum call stack exceeded
22. **And more...** - Continuously expanding pattern library

## Progressive Processing Example

```bash
# Start scan in background
node dist/cli.js scan https://staging.jahongir-app.uz --output /tmp/scan.jsonl &

# Process critical issues immediately
tail -f /tmp/scan.jsonl | \
  jq -c 'select(.type=="issue" and .severity=="CRITICAL")' | \
  while read issue; do
    echo "🚨 $(echo $issue | jq -r '.message')"
    # Apply fix here
  done
```

## Development

```bash
# Watch mode
pnpm dev

# Build
pnpm build

# Test
pnpm test
```

## Architecture

- **Core Scanner** (`src/core/scanner.ts`) - Playwright-based page scanning
- **Issue Detector** (`src/core/issue-detector.ts`) - Pattern-based issue detection & fix suggestions
- **CLI** (`src/cli.ts`) - Command-line interface
- **Types** (`src/types/`) - TypeScript definitions
- **Utils** (`src/utils/`) - Helper functions

## Roadmap

- [ ] AI integration (Claude API for advanced analysis)
- [ ] Visual regression detection
- [ ] Auto-fix engine
- [ ] Pattern analysis
- [ ] Scheduled scanning
- [ ] GitHub issue creation

## License

MIT
