import { NextRequest, NextResponse } from 'next/server';
import { SmartEngine, type SmartProject, type ProjectStep } from '@/lib/smart-engine';
import { VideoProducer } from '@/lib/video-producer';
import { PDFGenerator } from '@/lib/pdf-generator';
import type { ScreenInfo, ElementInfo } from '@/lib/types';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { acquireContext } from '@/lib/browser-pool';
import * as path from 'node:path';
import { checkRateLimit, getClientIp, API_WRITE_LIMIT } from '@royea/shared-utils/rate-limit';
import { sanitizeForLlm } from '@royea/prompt-guard';
import { PDF_DETAIL_LEVELS, analyzeAndUpdateStyle } from '@/lib/style-engine';
import { getUserIdFromRequest } from '@/lib/auth';
import { getUserPlan, canUseSmartMode, canUseSmartModeFree, shouldWatermark } from '@/lib/plan-guard';
import { prisma } from '@/lib/db';

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
  const userId = await getUserIdFromRequest(request);
  const plan = await getUserPlan(userId);
  const addWatermark = shouldWatermark(plan);

  const ip = getClientIp(request);
  const limit = checkRateLimit(`generate:${ip}`, API_WRITE_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } }
    );
  }

  try {
    const body = await request.json();
    const project: SmartProject = body.project;
    const videoTheme: string = body.videoTheme || 'modern';
    const detailLevel: string = body.detailLevel || 'standard';
    const existingRunId: string | undefined = body.existingRunId;

    // Check if this is a re-generation of an existing run the user owns
    let isOwnerRegeneration = false;
    if (existingRunId && /^smart_\d+$/.test(existingRunId) && userId) {
      const existingDir = path.resolve(`exports/${existingRunId}`);
      const reportPath = path.join(existingDir, 'report.json');
      if (fs.existsSync(reportPath)) {
        try {
          const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
          if (report.userId === userId) isOwnerRegeneration = true;
        } catch { /* invalid report, treat as new */ }
      }
    }

    // Plan gating: PRO+ users always pass. Re-generations always pass.
    // New generations for FREE users check the trial limit.
    if (!canUseSmartMode(plan) && !isOwnerRegeneration) {
      if (userId) {
        const trial = await canUseSmartModeFree(userId);
        if (!trial.allowed) {
          return NextResponse.json(
            {
              error: `Free trial used (${trial.used}/${trial.limit}). Upgrade to PRO for unlimited Smart Mode.`,
              upgradeRequired: true,
              currentPlan: plan,
            },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json(
          {
            error: 'Sign in to try Smart Mode for free.',
            upgradeRequired: true,
            authRequired: true,
            currentPlan: plan,
          },
          { status: 403 }
        );
      }
    }

    if (!project || !project.steps || project.steps.length === 0) {
      return NextResponse.json({ error: 'No steps in project' }, { status: 400 });
    }

    // Sanitize user-editable text fields (block injection, preserve PII for output)
    project.title = sanitizeForLlm(project.title, { maskPii: false });
    for (const step of project.steps) {
      step.title = sanitizeForLlm(step.title, { maskPii: false });
      step.description = sanitizeForLlm(step.description, { maskPii: false });
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

    // Determine runId: reuse existing run (re-generation) or create new
    let runId: string;
    let isRegeneration = false;
    if (existingRunId && /^smart_\d+$/.test(existingRunId)) {
      const existingDir = path.resolve(`exports/${existingRunId}`);
      const existingReport = fs.existsSync(path.join(existingDir, 'report.json'))
        ? JSON.parse(fs.readFileSync(path.join(existingDir, 'report.json'), 'utf-8'))
        : null;
      // Verify user owns this run
      if (existingReport && existingReport.userId === userId) {
        runId = existingRunId;
        isRegeneration = true;
      } else {
        runId = `smart_${Date.now()}`;
      }
    } else {
      runId = `smart_${Date.now()}`;
    }

    const baseExportDir = path.resolve(`exports/${runId}`);
    const screenshotsDir = path.join(baseExportDir, 'screenshots');
    const videosDir = path.join(baseExportDir, 'videos');
    const docsDir = path.join(baseExportDir, 'docs');
    await fsp.mkdir(screenshotsDir, { recursive: true });
    await fsp.mkdir(videosDir, { recursive: true });
    await fsp.mkdir(docsDir, { recursive: true });

    // Step 1: Generate mockup HTML files and screenshot them with Playwright
    const engine = new SmartEngine();
    const screenInfos: ScreenInfo[] = [];

    const pool = await acquireContext({ width: 400, height: 780 });
    try {
      for (const step of project.steps) {
        const mockupPath = await engine.generateStepMockupImage(step, path.join(baseExportDir, 'mockups'));

        if (mockupPath && fs.existsSync(mockupPath)) {
          const page = await pool.context.newPage();
          await page.goto(`file:///${mockupPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });
          const screenshotPath = path.join(screenshotsDir, `step_${step.order}_${step.id}.png`);
          await page.screenshot({ path: screenshotPath });
          await page.close();

          screenInfos.push(stepToScreenInfo(step, screenshotPath));
        } else {
          const screenshotPath = path.join(screenshotsDir, `step_${step.order}_${step.id}.png`);
          const pngBuf = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            'base64'
          );
          await fsp.writeFile(screenshotPath, pngBuf);
          screenInfos.push(stepToScreenInfo(step, screenshotPath));
        }
      }
    } finally {
      await pool.release();
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
        theme: videoTheme,
        watermark: addWatermark,
      });
      videos.push(video);
    }

    // Generate demo page
    const demoPath = await videoProducer.generateDemoPage(videos);

    // Step 3: Generate PDF
    const pdfGenerator = new PDFGenerator();
    const detailConfig = PDF_DETAIL_LEVELS[detailLevel] || PDF_DETAIL_LEVELS.standard;
    const pdfResult = await pdfGenerator.generateGuide(screenInfos, {
      title: project.title,
      language: project.language,
      outputDir: docsDir,
      includeAnnotations: detailConfig.includeAnnotations,
    });

    // Step 4: Save report (with userId and style metadata for ownership + display)
    const report = {
      projectName: project.title,
      generatedAt: new Date().toISOString(),
      userId: userId || undefined,
      videoTheme,
      detailLevel,
      source: 'smart' as const,
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

    await fsp.writeFile(path.join(baseExportDir, 'report.json'), JSON.stringify(report, null, 2));

    // Save screens.json
    await fsp.writeFile(
      path.join(screenshotsDir, 'screens.json'),
      JSON.stringify(screenInfos, null, 2)
    );

    // Create Pipeline DB record only for NEW generations (not re-generations)
    // This ensures the free trial counter only increments once per project
    if (userId && !isRegeneration) {
      const pipelineInput = JSON.stringify({
        language: project.language,
        orientation: 'portrait',
        maxScreens: project.steps.length,
        videoTheme,
        detailLevel,
      });

      await prisma.pipeline.create({
        data: {
          userId,
          stage: 'done',
          progress: 100,
          message: `Smart Mode: ${screenInfos.length} screens, ${videos.length} videos.`,
          currentAgent: 'SmartEngine',
          input: pipelineInput,
          result: JSON.stringify({ totalScreens: screenInfos.length, totalVideos: videos.length }),
        },
      }).catch(() => {}); // Non-fatal

      // Trigger style learning (non-blocking)
      analyzeAndUpdateStyle(userId).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      runId,
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
