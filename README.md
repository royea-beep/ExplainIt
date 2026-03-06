# ExplainIt

Turn any website or web app into professional explainer videos, demo pages, and annotated PDF documentation — automatically.

## Features

- **Screenshot Capture** — Playwright-powered automated navigation and screenshot capture
- **Video Generation** — Animated HTML explainer videos with highlights, callouts, and transitions
- **PDF Documentation** — Annotated PDF guides with numbered elements, arrows, and descriptions
- **Multi-Agent Pipeline** — 4-agent system (QA Lead, Capture Engineer, Video Producer, PDF Designer)
- **Mobile-First UI** — Dark-themed responsive web interface
- **Hebrew + English** — Full RTL support

## Quick Start

```bash
# Install dependencies
npm install

# Install Playwright browser
npx playwright install chromium

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
npm start
```

## Usage

1. Open the app at `http://localhost:3000`
2. Enter a URL, repository path, or build directory
3. Configure: project name, orientation (portrait/landscape), max screens, language
4. Click "Start Production"
5. Wait for the 4-agent pipeline to complete
6. Find outputs in `/exports`:
   - `/exports/screenshots/` — PNG screenshots + `screens.json` + `flows.json`
   - `/exports/videos/` — HTML animation videos + `index.html` demo page
   - `/exports/docs/` — PDF guide + Markdown version
   - `/exports/report.json` — Full report with all file paths and statuses

## API

### POST /api/pipeline
Start a full pipeline run.
```json
{
  "type": "url",
  "value": "https://example.com",
  "projectName": "My App",
  "language": "he",
  "orientation": "portrait",
  "maxScreens": 5
}
```

### GET /api/pipeline?id=pipeline_xxx
Poll pipeline status.

### POST /api/capture
Capture screenshots only.

### POST /api/generate
Generate videos and/or PDF from screen data.

## Architecture

```
src/
  lib/
    capture-engine.ts   — Playwright screenshot + element detection
    video-producer.ts   — HTML animation video generation
    pdf-generator.ts    — PDFKit annotated document generation
    pipeline.ts         — 4-stage orchestrator
  app/
    page.tsx            — Main UI (React, mobile-first)
    api/
      pipeline/         — Full pipeline API
      capture/          — Screenshot API
      generate/         — Video/PDF generation API
```

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Playwright (screenshots + navigation)
- PDFKit (PDF generation)
- Vitest (testing)

## Tests

- 4 test suites, 9 tests
- Unit tests for capture engine, video producer, PDF generator
- E2E integration test: full pipeline (capture -> video -> PDF)
