import { NextRequest, NextResponse } from 'next/server';
import { SmartEngine, type SmartProject, type ProjectStep } from '@/lib/smart-engine';
import { VideoProducer } from '@/lib/video-producer';
import { PDFGenerator } from '@/lib/pdf-generator';
import type { ScreenInfo, ElementInfo } from '@/lib/types';
import { chromium } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { checkRateLimit, getClientIp, GENERATE_LIMIT } from '@/lib/rate-limit';

// Validate step ID to prevent path traversal
function isValidStepId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

// Convert a smart project step into a ScreenInfo for video/PDF generation
function stepToScreenInfo(step: ProjectStep, screenshotPath: string): ScreenInfo {
  return {
    id: step.id,
    name: `${step.order}. ${step.title}`,
    url: '',
    route: `step-${step.order}`,
    screenshotPath,
    description: step.description,
    elements: step.highlights.map((h): ElementInfo => ({
      id: h.id,
      type: 'highlight',
      label: h.label,
      selector: '',
      bounds: {
        x: Math.round(h.x * 3.6),   // scale to ~360px mockup
        y: Math.round(h.y * 7.2),   // scale to ~720px mockup
        width: Math.round(h.width * 3.6),
        height: Math.round(h.height * 7.2),
      },
    })),
  };
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`generate:${ip}`, GENERATE_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } }
    );
  }

  try {
    const body = await request.json();
    const project: SmartProject = body.project;

    if (!project || !project.steps || project.steps.length === 0) {
      return NextResponse.json({ error: 'No steps in project' }, { status: 400 });
    }

    // Cap steps at 20
    if (project.steps.length > 20) {
      return NextResponse.json({ error: 'Too many steps (max 20)' }, { status: 400 });
    }

    // Validate all step IDs
    for (const step of project.steps) {
      if (!isValidStepId(step.id)) {
        return NextResponse.json({ error: `Invalid step ID: ${step.id}` }, { status: 400 });
      }
    }

    const screenshotsDir = path.resolve('exports/screenshots');
    const videosDir = path.resolve('exports/videos');
    const docsDir = path.resolve('exports/docs');
    fs.mkdirSync(screenshotsDir, { recursive: true });
    fs.mkdirSync(videosDir, { recursive: true });
    fs.mkdirSync(docsDir, { recursive: true });

    // Step 1: Generate mockup HTML files and screenshot them with Playwright
    const engine = new SmartEngine();
    const screenInfos: ScreenInfo[] = [];

    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: { width: 400, height: 780 } });

      for (const step of project.steps) {
        const mockupPath = engine.generateStepMockupImage(step, path.resolve('exports/mockups'));

        if (mockupPath && fs.existsSync(mockupPath)) {
          // Screenshot the mockup HTML
          const page = await context.newPage();
          await page.goto(`file:///${mockupPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });
          const screenshotPath = path.join(screenshotsDir, `step_${step.order}_${step.id}.png`);
          await page.screenshot({ path: screenshotPath });
          await page.close();

          screenInfos.push(stepToScreenInfo(step, screenshotPath));
        } else {
          // No mockup - create a simple colored placeholder screenshot
          const screenshotPath = path.join(screenshotsDir, `step_${step.order}_${step.id}.png`);
          const pngBuf = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            'base64'
          );
          fs.writeFileSync(screenshotPath, pngBuf);
          screenInfos.push(stepToScreenInfo(step, screenshotPath));
        }
      }
    } finally {
      await browser.close();
    }

    // Step 2: Generate videos
    const videoProducer = new VideoProducer();
    const videos: Awaited<ReturnType<typeof videoProducer.generateVideo>>[] = [];
    for (const screen of screenInfos) {
      const video = await videoProducer.generateVideo(screen, {
        outputDir: videosDir,
        language: project.language,
        width: 1080,
        height: 1920,
      });
      videos.push(video);
    }

    // Generate demo page
    const demoPath = await videoProducer.generateDemoPage(videos);

    // Step 3: Generate PDF
    const pdfGenerator = new PDFGenerator();
    const pdfResult = await pdfGenerator.generateGuide(screenInfos, {
      title: project.title,
      language: project.language,
      outputDir: docsDir,
      includeAnnotations: true,
    });

    // Step 4: Save report
    const report = {
      projectName: project.title,
      generatedAt: new Date().toISOString(),
      platform: project.platform,
      screens: screenInfos.map((s, i) => ({
        id: s.id,
        name: s.name,
        url: s.url,
        screenshotPath: s.screenshotPath,
        videoPath: videos[i]?.videoPath,
        status: 'ok',
      })),
      pdfPath: pdfResult.pdfPath,
      demoPagePath: demoPath,
      totalScreens: screenInfos.length,
      totalVideos: videos.length,
    };

    fs.writeFileSync(path.resolve('exports/report.json'), JSON.stringify(report, null, 2));

    // Save screens.json
    fs.writeFileSync(
      path.join(screenshotsDir, 'screens.json'),
      JSON.stringify(screenInfos, null, 2)
    );

    return NextResponse.json({
      success: true,
      totalScreens: screenInfos.length,
      totalVideos: videos.length,
      pdfPages: pdfResult.pageCount,
      demoPagePath: demoPath,
      pdfPath: pdfResult.pdfPath,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
