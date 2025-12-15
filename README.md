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
  --viewports desktop,mobile
```

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
