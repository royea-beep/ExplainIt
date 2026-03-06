import { NextRequest, NextResponse } from 'next/server';
import { VideoProducer } from '@/lib/video-producer';
import { PDFGenerator } from '@/lib/pdf-generator';
import type { ScreenInfo } from '@/lib/capture-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { screens, type, options } = body as {
      screens: ScreenInfo[];
      type: 'video' | 'pdf' | 'both';
      options?: Record<string, unknown>;
    };

    if (!screens || screens.length === 0) {
      return NextResponse.json({ error: 'Missing screens data' }, { status: 400 });
    }

    const result: Record<string, unknown> = {};

    if (type === 'video' || type === 'both') {
      const producer = new VideoProducer();
      const videos = [];
      for (const screen of screens) {
        const video = await producer.generateVideo(screen, options);
        videos.push(video);
      }
      const demoPage = await producer.generateDemoPage(videos);
      result.videos = videos;
      result.demoPage = demoPage;
    }

    if (type === 'pdf' || type === 'both') {
      const generator = new PDFGenerator();
      const pdf = await generator.generateGuide(screens, options);
      result.pdf = pdf;
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
