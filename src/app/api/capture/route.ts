import { NextRequest, NextResponse } from 'next/server';
import { CaptureEngine } from '@/lib/capture-engine';
import { validateUrl, clampMaxScreens } from '@royea/shared-utils/validate-url';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, maxScreens, viewport, credentials } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    // Validate URL to prevent SSRF
    const validation = validateUrl(url.trim());
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const engine = new CaptureEngine();
    const result = await engine.captureUrl(validation.url, {
      maxScreens: clampMaxScreens(maxScreens),
      viewport: viewport || { width: 1080, height: 1920 },
      credentials,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
