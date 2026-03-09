/**
 * Generate a real ClubGG demo for the /poker landing page proof section.
 * Uses the exact same SmartEngine + VideoProducer + PDFGenerator the app uses.
 *
 * Run: npx tsx scripts/generate-demo.ts
 */

import { SmartEngine, type SmartProject, type ProjectStep } from '../src/lib/smart-engine';
import { VideoProducer } from '../src/lib/video-producer';
import { PDFGenerator } from '../src/lib/pdf-generator';
import type { ScreenInfo, ElementInfo } from '../src/lib/types';
import * as fs from 'node:fs/promises';
import * as fss from 'node:fs';
import * as path from 'node:path';

const OUT_DIR = path.resolve('public/demo/clubgg');

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
        x: Math.round(h.x * 3.6),
        y: Math.round(h.y * 7.2),
        width: Math.round(h.width * 3.6),
        height: Math.round(h.height * 7.2),
      },
    })),
  };
}

async function main() {
  console.log('=== Generating ClubGG Demo ===');

  // 1. Generate project via SmartEngine
  const engine = new SmartEngine();
  const project: SmartProject = engine.analyze({
    request: 'clubgg',
    answers: { clubId: '827364', clubName: 'Aces High' },
    language: 'he',
  });

  console.log(`Project: ${project.title} (${project.steps.length} steps)`);

  // 2. Create directories
  const screenshotsDir = path.join(OUT_DIR, 'screenshots');
  const videosDir = path.join(OUT_DIR, 'videos');
  const docsDir = path.join(OUT_DIR, 'docs');
  const mockupsDir = path.join(OUT_DIR, 'mockups');
  await fs.mkdir(screenshotsDir, { recursive: true });
  await fs.mkdir(videosDir, { recursive: true });
  await fs.mkdir(docsDir, { recursive: true });
  await fs.mkdir(mockupsDir, { recursive: true });

  // 3. Write mockup HTML files
  for (const step of project.steps) {
    await engine.generateStepMockupImage(step, mockupsDir);
  }
  console.log('Mockup HTML files written');

  // 4. Try Playwright screenshots, fall back to placeholder
  const screenInfos: ScreenInfo[] = [];
  let usedPlaywright = false;

  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 400, height: 780 } });

    for (const step of project.steps) {
      const mockupPath = path.join(mockupsDir, `step_${step.id}.html`);
      if (fss.existsSync(mockupPath)) {
        const page = await context.newPage();
        await page.goto(`file:///${mockupPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });
        const screenshotPath = path.join(screenshotsDir, `step_${step.order}_${step.id}.png`);
        await page.screenshot({ path: screenshotPath });
        await page.close();
        screenInfos.push(stepToScreenInfo(step, screenshotPath));
      }
    }

    await context.close();
    await browser.close();
    usedPlaywright = true;
    console.log('Screenshots captured with Playwright');
  } catch (err) {
    console.log('Playwright not available, using placeholder screenshots');
    // Create minimal 1px placeholder PNGs
    const pngBuf = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    for (const step of project.steps) {
      const screenshotPath = path.join(screenshotsDir, `step_${step.order}_${step.id}.png`);
      await fs.writeFile(screenshotPath, pngBuf);
      screenInfos.push(stepToScreenInfo(step, screenshotPath));
    }
  }

  // 5. Generate videos
  const videoProducer = new VideoProducer();
  const videos: Awaited<ReturnType<typeof videoProducer.generateVideo>>[] = [];
  for (const screen of screenInfos) {
    const video = await videoProducer.generateVideo(screen, {
      outputDir: videosDir,
      language: 'he',
      width: 1080,
      height: 1920,
      theme: 'modern',
      watermark: false,
    });
    videos.push(video);
  }

  // Also generate overview video
  const overview = await videoProducer.generateOverviewVideo(
    screenInfos,
    project.title,
    {
      outputDir: videosDir,
      language: 'he',
      width: 1080,
      height: 1920,
      theme: 'modern',
      watermark: false,
    }
  );

  console.log(`Generated ${videos.length} videos + 1 overview`);

  // 6. Generate demo page
  const allVideos = [...videos, overview];
  const demoPath = await videoProducer.generateDemoPage(allVideos, videosDir);
  console.log(`Demo page: ${demoPath}`);

  // 7. Generate PDF
  const pdfGenerator = new PDFGenerator();
  const pdfResult = await pdfGenerator.generateGuide(screenInfos, {
    title: project.title,
    language: 'he',
    outputDir: docsDir,
    includeAnnotations: true,
  });
  console.log(`PDF: ${pdfResult.pdfPath} (${pdfResult.pageCount} pages)`);

  // 8. Write report.json
  const report = {
    projectName: project.title,
    generatedAt: new Date().toISOString(),
    platform: project.platform,
    clubId: '827364',
    clubName: 'Aces High',
    language: 'he',
    usedPlaywright,
    totalScreens: screenInfos.length,
    totalVideos: videos.length + 1,
    pdfPath: pdfResult.pdfPath,
    demoPagePath: demoPath,
    steps: project.steps.map(s => ({ order: s.order, title: s.title })),
  };
  await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));

  // 9. Create a root index.html that redirects to the demo page
  const rootIndex = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta http-equiv="refresh" content="0;url=videos/index.html"/>
<title>ClubGG Demo - Aces High | ExplainIt</title>
</head>
<body style="background:#0d0d1a;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;">
<p>Loading demo... <a href="videos/index.html" style="color:#818cf8;">Click here</a></p>
</body>
</html>`;
  await fs.writeFile(path.join(OUT_DIR, 'index.html'), rootIndex);

  console.log('\n=== Done ===');
  console.log(`Output: ${OUT_DIR}`);
  console.log(`Demo page: /demo/clubgg/videos/index.html`);
  console.log(`Mockups: /demo/clubgg/mockups/`);
  console.log(`PDF: ${path.relative(OUT_DIR, pdfResult.pdfPath)}`);
}

main().catch(err => {
  console.error('Generation failed:', err);
  process.exit(1);
});
