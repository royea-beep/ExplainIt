# ExplainIt — Automated Explainer Video & Documentation Generator

## Credits
- Roy (Creator & Product Visionary)
- Claude Opus (Co-Creator & Architecture)

## What This Is
A web app that transforms any website into professional explainer videos, annotated PDFs, and demo pages automatically. Two modes:
1. **URL Mode** — Paste a URL, the pipeline captures screenshots, generates videos, and creates a PDF guide
2. **Smart Mode** — Describe what to explain in free text. AI generates step-by-step guides with mockups (supports ClubGG, PPPoker, PokerBros platforms)

## Tech Stack
- Next.js 14 (App Router)
- TypeScript
- Playwright (screenshot capture + element detection)
- PDFKit (annotated PDF generation)
- HTML animation videos (no FFmpeg needed)
- Tailwind CSS
- Vitest (testing)

## Architecture
```
ExplainIt/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main UI — URL mode pipeline
│   │   ├── editor/page.tsx       # Smart Mode editor (phases: input → questions → editor → generate)
│   │   ├── results/page.tsx      # Export viewer with grid/list modes, lightbox
│   │   ├── components/header.tsx # App header with language toggle
│   │   ├── api/pipeline/         # POST: start pipeline, GET: poll status, DELETE: cancel
│   │   ├── api/smart/            # POST: process free-text request
│   │   ├── api/smart/generate/   # POST: generate videos+PDF from Smart Mode project
│   │   ├── api/capture/          # Screenshot capture endpoint
│   │   ├── api/exports/          # Serve generated files
│   │   └── api/generate/         # Direct generation endpoint
│   ├── lib/
│   │   ├── pipeline.ts           # 4-stage pipeline (intake → capture → produce → document)
│   │   ├── smart-engine.ts       # Platform templates + mockup HTML generator
│   │   ├── capture-engine.ts     # Playwright screenshot + element detection
│   │   ├── video-producer.ts     # HTML animation video generation
│   │   ├── pdf-generator.ts      # PDFKit annotated guide + Markdown companion
│   │   ├── validate-url.ts       # SSRF protection with DNS rebinding prevention
│   │   ├── rate-limit.ts         # In-memory rate limiter
│   │   ├── language-context.tsx  # Hebrew/English language context
│   │   └── types.ts              # Shared types
│   └── components/
│       └── ErrorBoundary.tsx     # React error boundary with recovery UI
├── exports/                      # Generated output (screenshots, videos, docs)
├── .env.example                  # Environment variables template
└── package.json
```

## Key Features
- URL pipeline with 4 AI agents (planning, capture, video, PDF)
- Smart Mode with platform-specific templates (ClubGG, PPPoker, PokerBros)
- Step editor with mockup previews, reordering, add/remove
- Bilingual support (Hebrew/English) with RTL
- SSRF protection with DNS rebinding prevention
- Rate limiting on all API endpoints
- Pipeline memory management with TTL cleanup
- Error boundary with recovery UI

## Development
- `npm run dev` — start Next.js dev server (port 3000)
- `npm run build` — production build
- `npm test` — run tests with Vitest
- Needs Playwright browsers: `npx playwright install chromium`

## Current Status
Full E2E working:
- URL mode: paste URL → captures screenshots → generates videos → creates PDF
- Smart mode: describe in text → AI generates steps → edit → generate videos+PDF
- Results page with grid/list view, lightbox, download
- 3 platform templates (ClubGG, PPPoker, PokerBros) + generic fallback
- Rate limiting, SSRF protection, error boundary
- Hebrew/English bilingual
- Zero TypeScript errors
