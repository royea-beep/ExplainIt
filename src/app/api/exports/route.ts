import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'node:fs';
import * as path from 'node:path';

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

  // Ensure the resolved path is within the exports directory
  if (!fullPath.startsWith(resolvedExports + path.sep) && fullPath !== resolvedExports) {
    return null;
  }
  return fullPath;
}

export async function GET(request: NextRequest) {
  const fileParam = request.nextUrl.searchParams.get('file');

  // Serve a specific file
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

    // CSP header for all served content
    const securityHeaders: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Security-Policy': "default-src 'self' 'unsafe-inline' data:; script-src 'none';",
      'X-Content-Type-Options': 'nosniff',
    };

    // For HTML video files, rewrite relative image src to absolute API paths
    if (ext === '.html') {
      let html = fs.readFileSync(fullPath, 'utf-8');
      const fileDir = path.relative(EXPORTS_DIR, path.dirname(fullPath)).replace(/\\/g, '/');

      // Rewrite src="something.png" to use the exports API
      html = html.replace(
        /src="([^"]+\.(png|jpg|jpeg|webp|svg))"/gi,
        (_match, imgPath: string) => {
          if (imgPath.startsWith('http') || imgPath.startsWith('/')) return _match;
          const resolvedPath = fileDir ? `${fileDir}/${imgPath}` : imgPath;
          return `src="/api/exports?file=${encodeURIComponent(resolvedPath)}"`;
        }
      );

      // Rewrite href="something.html" to use the exports API
      html = html.replace(
        /href="([^"]+\.html)"/gi,
        (_match, htmlPath: string) => {
          if (htmlPath.startsWith('http') || htmlPath.startsWith('/')) return _match;
          const resolvedPath = fileDir ? `${fileDir}/${htmlPath}` : htmlPath;
          return `href="/api/exports?file=${encodeURIComponent(resolvedPath)}"`;
        }
      );

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

  // List all exports
  if (!fs.existsSync(EXPORTS_DIR)) {
    return NextResponse.json({ runs: [] });
  }

  const screenshots = scanDir(path.join(EXPORTS_DIR, 'screenshots'), EXPORTS_DIR)
    .filter(f => f.type === 'screenshot');
  const videos = scanDir(path.join(EXPORTS_DIR, 'videos'), EXPORTS_DIR)
    .filter(f => f.type === 'video' && !f.name.startsWith('overview_') && f.name !== 'index.html');
  const videoExtras = scanDir(path.join(EXPORTS_DIR, 'videos'), EXPORTS_DIR)
    .filter(f => f.name === 'index.html' || f.name.startsWith('overview_'));
  const docs = scanDir(path.join(EXPORTS_DIR, 'docs'), EXPORTS_DIR);

  // Read report.json if exists
  let report: Record<string, unknown> | undefined;
  let projectName = 'ExplainIt Project';
  let generatedAt = '';
  const reportPath = path.join(EXPORTS_DIR, 'report.json');
  if (fs.existsSync(reportPath)) {
    try {
      report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      projectName = (report?.projectName as string) || projectName;
      generatedAt = (report?.generatedAt as string) || '';
    } catch { /* ignore */ }
  }

  const demoPage = videoExtras.find(f => f.name === 'index.html');

  const run: ExportRun = {
    id: 'latest',
    projectName,
    generatedAt,
    totalScreens: screenshots.length,
    totalVideos: videos.length,
    screenshots,
    videos,
    docs,
    demoPagePath: demoPage?.servePath,
    report,
  };

  return NextResponse.json({ runs: [run] });
}
