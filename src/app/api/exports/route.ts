import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getUserIdFromRequest } from '@/lib/auth';
import { cleanupOldExports } from '@/lib/export-cleanup';

const EXPORTS_DIR = path.resolve('exports');

interface ExportItem {
  name: string;
  path: string;       // relative to exports/
  type: 'screenshot' | 'video' | 'pdf' | 'markdown' | 'json' | 'other';
  size: number;
  modified: string;
  servePath: string;   // URL to fetch this file
}

interface ExportRun {
  id: string;
  projectName: string;
  generatedAt: string;
  totalScreens: number;
  totalVideos: number;
  screenshots: ExportItem[];
  videos: ExportItem[];
  docs: ExportItem[];
  demoPagePath?: string;
  videoTheme?: string;
  detailLevel?: string;
  source?: string;
  report?: Record<string, unknown>;
}

function classifyFile(filename: string): ExportItem['type'] {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') return 'screenshot';
  if (ext === '.html') return 'video';
  if (ext === '.pdf') return 'pdf';
  if (ext === '.md') return 'markdown';
  if (ext === '.json') return 'json';
  return 'other';
}

function scanDir(dir: string, baseDir: string): ExportItem[] {
  if (!fs.existsSync(dir)) return [];
  const items: ExportItem[] = [];

  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (!stat.isFile()) continue;

    const relPath = path.relative(baseDir, full).replace(/\\/g, '/');
    items.push({
      name: entry,
      path: relPath,
      type: classifyFile(entry),
      size: stat.size,
      modified: stat.mtime.toISOString(),
      servePath: `/api/exports?file=${encodeURIComponent(relPath)}`,
    });
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

/** Safely resolve a file path within EXPORTS_DIR, preventing path traversal */
function resolveSafePath(fileParam: string): string | null {
  const resolvedExports = path.resolve(EXPORTS_DIR);
  const fullPath = path.resolve(EXPORTS_DIR, fileParam);

  if (!fullPath.startsWith(resolvedExports + path.sep) && fullPath !== resolvedExports) {
    return null;
  }
  return fullPath;
}

/** Read report.json for a run directory. Returns null if missing or invalid. */
function readReport(runDir: string): Record<string, unknown> | null {
  const reportPath = path.join(runDir, 'report.json');
  if (!fs.existsSync(reportPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
  } catch {
    return null;
  }
}

/** Check if a user owns a specific export run via report.json userId */
function userOwnsRun(report: Record<string, unknown> | null, userId: string | null): boolean {
  if (!userId) return false;
  // If report has no userId field (legacy), allow the owner check to pass
  // for backwards compatibility — will be tightened once all runs have userId
  if (!report || !report.userId) return true;
  return report.userId === userId;
}

/** Scan a single run directory for exports. */
function scanRun(runDir: string, runId: string): ExportRun | null {
  const report = readReport(runDir);
  if (!report) return null;

  const projectName = (report.projectName as string) || 'ExplainIt Project';
  const generatedAt = (report.generatedAt as string) || '';

  const screenshots = scanDir(path.join(runDir, 'screenshots'), EXPORTS_DIR)
    .filter(f => f.type === 'screenshot');
  const videos = scanDir(path.join(runDir, 'videos'), EXPORTS_DIR)
    .filter(f => f.type === 'video' && !f.name.startsWith('overview_') && f.name !== 'index.html');
  const videoExtras = scanDir(path.join(runDir, 'videos'), EXPORTS_DIR)
    .filter(f => f.name === 'index.html' || f.name.startsWith('overview_'));
  const docs = scanDir(path.join(runDir, 'docs'), EXPORTS_DIR);
  const demoPage = videoExtras.find(f => f.name === 'index.html');

  return {
    id: runId,
    projectName,
    generatedAt,
    totalScreens: screenshots.length,
    totalVideos: videos.length,
    screenshots,
    videos,
    docs,
    demoPagePath: demoPage?.servePath,
    videoTheme: (report.videoTheme as string) || undefined,
    detailLevel: (report.detailLevel as string) || undefined,
    source: (report.source as string) || undefined,
    report,
  };
}

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  const fileParam = request.nextUrl.searchParams.get('file');

  // Serve a specific file — publicly accessible by run path (unguessable runId acts as share token)
  // This enables WhatsApp/social sharing of demo pages and videos without requiring auth.
  // The listing endpoint below still requires auth.
  if (fileParam) {
    const fullPath = resolveSafePath(fileParam);

    if (!fullPath || !fs.existsSync(fullPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.html': 'text/html; charset=utf-8',
      '.json': 'application/json',
      '.md': 'text/markdown; charset=utf-8',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';

    const securityHeaders: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Security-Policy': "default-src 'self' 'unsafe-inline' data:; script-src 'none';",
      'X-Content-Type-Options': 'nosniff',
    };

    if (ext === '.html') {
      let html = fs.readFileSync(fullPath, 'utf-8');
      const fileDir = path.relative(EXPORTS_DIR, path.dirname(fullPath)).replace(/\\/g, '/');

      html = html.replace(
        /src="([^"]+\.(png|jpg|jpeg|webp|svg))"/gi,
        (_match, imgPath: string) => {
          if (imgPath.startsWith('http') || imgPath.startsWith('/')) return _match;
          const resolvedPath = fileDir ? `${fileDir}/${imgPath}` : imgPath;
          return `src="/api/exports?file=${encodeURIComponent(resolvedPath)}"`;
        }
      );

      html = html.replace(
        /href="([^"]+\.html)"/gi,
        (_match, htmlPath: string) => {
          if (htmlPath.startsWith('http') || htmlPath.startsWith('/')) return _match;
          const resolvedPath = fileDir ? `${fileDir}/${htmlPath}` : htmlPath;
          return `href="/api/exports?file=${encodeURIComponent(resolvedPath)}"`;
        }
      );

      // Inject OG meta tags for rich previews in WhatsApp/Telegram/social
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://explainit-one.vercel.app';
      const fileUrl = `${appUrl}/api/exports?file=${encodeURIComponent(fileParam)}`;

      // Try to find a screenshot in the same run to use as og:image
      const runId = fileParam.split('/')[0];
      let ogImage = '';
      if (runId) {
        const screenshotsDir = path.join(EXPORTS_DIR, runId, 'screenshots');
        if (fs.existsSync(screenshotsDir)) {
          const screenshots = fs.readdirSync(screenshotsDir).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
          if (screenshots.length > 0) {
            const firstScreenshot = `${runId}/screenshots/${screenshots[0]}`;
            ogImage = `${appUrl}/api/exports?file=${encodeURIComponent(firstScreenshot)}`;
          }
        }
      }

      // Extract title from HTML <title> tag if present
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      const ogTitle = titleMatch ? titleMatch[1] : 'ExplainIt Demo';

      const ogTags = `
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="Step-by-step explainer guide — generated by ExplainIt" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${fileUrl}" />
  ${ogImage ? `<meta property="og:image" content="${ogImage}" />\n  <meta property="og:image:width" content="400" />\n  <meta property="og:image:height" content="780" />` : ''}`;
      html = html.replace('</head>', `${ogTags}\n</head>`);

      return new NextResponse(html, { headers: securityHeaders });
    }

    const data = fs.readFileSync(fullPath);

    return new NextResponse(data, {
      headers: {
        ...securityHeaders,
        'Content-Length': String(data.length),
      },
    });
  }

  // List all export runs — require auth, filter by ownership
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Lazy cleanup of old exports (throttled, non-blocking)
  cleanupOldExports().catch(() => {});

  if (!fs.existsSync(EXPORTS_DIR)) {
    return NextResponse.json({ runs: [] });
  }

  const runs: ExportRun[] = [];

  // Scan per-pipeline subdirectories (new format: exports/{pipelineId}/)
  for (const entry of fs.readdirSync(EXPORTS_DIR)) {
    const entryPath = path.join(EXPORTS_DIR, entry);
    if (!fs.statSync(entryPath).isDirectory()) continue;

    // Skip legacy flat subdirs that aren't pipeline runs
    if (['screenshots', 'videos', 'docs', 'mockups'].includes(entry)) continue;

    const run = scanRun(entryPath, entry);
    if (run && userOwnsRun(run.report ?? null, userId)) {
      runs.push(run);
    }
  }

  // Also check for legacy flat layout (report.json at exports/ root)
  const legacyReport = readReport(EXPORTS_DIR);
  if (legacyReport && userOwnsRun(legacyReport, userId)) {
    const legacyRun = scanRun(EXPORTS_DIR, 'latest');
    if (legacyRun) runs.push(legacyRun);
  }

  // Sort newest first
  runs.sort((a, b) => (b.generatedAt || '').localeCompare(a.generatedAt || ''));

  // Strip userId from report before sending to client
  for (const run of runs) {
    if (run.report) {
      delete run.report.userId;
    }
  }

  return NextResponse.json({ runs });
}
