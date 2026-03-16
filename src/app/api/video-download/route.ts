/**
 * GET /api/video-download?run=<runId>
 *
 * Streams the final.mp4 for a given run ID from {EXPORTS_DIR}/<runId>/final.mp4
 * Returns 404 if the file does not exist yet.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'node:fs';
import * as path from 'node:path';

const OUTPUT_ROOT = path.resolve(process.env.EXPORTS_DIR ?? './output');

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get('run');

  if (!runId || !/^[0-9a-f-]{36}$/.test(runId)) {
    return NextResponse.json({ error: 'Invalid run ID' }, { status: 400 });
  }

  // Prevent path traversal
  const filePath = path.resolve(OUTPUT_ROOT, runId, 'final.mp4');
  if (!filePath.startsWith(OUTPUT_ROOT)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const stream = fs.createReadStream(filePath);

  const webStream = new ReadableStream({
    start(controller: ReadableStreamDefaultController) {
      stream.on('data', (chunk) => controller.enqueue(chunk));
      stream.on('end', () => controller.close());
      stream.on('error', (err) => controller.error(err));
    },
  });

  return new NextResponse(webStream, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(stat.size),
      'Content-Disposition': `attachment; filename="explainit-${runId.slice(0, 8)}.mp4"`,
      'Cache-Control': 'no-store',
    },
  });
}
