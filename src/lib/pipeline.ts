import { CaptureEngine, type CaptureOptions, type CaptureResult } from './capture-engine';
import { VideoProducer, type VideoOptions, type VideoResult } from './video-producer';
import { PDFGenerator, type PDFOptions, type PDFResult } from './pdf-generator';
import { PDF_DETAIL_LEVELS } from './style-engine';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface PipelineInput {
  type: 'url' | 'repo' | 'build';
  value: string; // URL, repo path, or build dir path
  credentials?: { username: string; password: string };
  projectName?: string;
  language?: 'he' | 'en';
  orientation?: 'portrait' | 'landscape' | 'both';
  maxScreens?: number;
  /** Isolated export directory for this pipeline run. Defaults to exports/ */
  exportDir?: string;
  /** Video color theme — modern | clean | bold. Default: modern */
  videoTheme?: string;
  /** PDF detail level — minimal | standard | detailed. Default: standard */
  detailLevel?: string;
  /** Owner user ID — written to report.json for ownership checks */
  userId?: string;
  /** Whether to add watermark to output (free tier) */
  watermark?: boolean;
}

export interface PipelineStatus {
  stage: 'intake' | 'capture' | 'produce' | 'document' | 'done' | 'error';
  progress: number; // 0-100
  currentAgent: string;
  message: string;
  startedAt: string;
  updatedAt: string;
}

export interface PipelineResult {
  status: 'success' | 'partial' | 'error';
  capture?: CaptureResult;
  videos?: VideoResult[];
  pdf?: PDFResult;
  demoPagePath?: string;
  reportPath?: string;
  errors: string[];
}

export interface ReportJson {
  projectName: string;
  generatedAt: string;
  userId?: string;
  videoTheme?: string;
  detailLevel?: string;
  source?: 'url' | 'smart';
  screens: Array<{
    id: string;
    name: string;
    url: string;
    screenshotPath: string;
    videoPath?: string;
    status: 'ok' | 'error';
  }>;
  pdfPath?: string;
  demoPagePath?: string;
  totalScreens: number;
  totalVideos: number;
}

type StatusCallback = (status: PipelineStatus) => void;

export class Pipeline {
  private captureEngine: CaptureEngine;
  private videoProducer: VideoProducer;
  private pdfGenerator: PDFGenerator;
  private statusCallback?: StatusCallback;
  private currentStatus: PipelineStatus;

  constructor(onStatus?: StatusCallback) {
    this.captureEngine = new CaptureEngine();
    this.videoProducer = new VideoProducer();
    this.pdfGenerator = new PDFGenerator();
    this.statusCallback = onStatus;
    this.currentStatus = {
      stage: 'intake',
      progress: 0,
      currentAgent: 'Pipeline',
      message: 'Initializing...',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private updateStatus(update: Partial<PipelineStatus>) {
    this.currentStatus = {
      ...this.currentStatus,
      ...update,
      updatedAt: new Date().toISOString(),
    };
    this.statusCallback?.(this.currentStatus);
  }

  async run(input: PipelineInput): Promise<PipelineResult> {
    const errors: string[] = [];
    const projectName = input.projectName || 'ExplainIt Project';
    const baseDir = path.resolve(input.exportDir || 'exports');

    // Ensure export dirs exist
    await fs.promises.mkdir(path.join(baseDir, 'screenshots'), { recursive: true });
    await fs.promises.mkdir(path.join(baseDir, 'videos'), { recursive: true });
    await fs.promises.mkdir(path.join(baseDir, 'docs'), { recursive: true });

    // --- Stage 1: Intake ---
    this.updateStatus({
      stage: 'intake',
      progress: 5,
      currentAgent: 'Agent 1 - Product + QA Lead',
      message: 'Analyzing input and preparing spec...',
    });

    if (input.type !== 'url') {
      this.updateStatus({ stage: 'error', progress: 100, message: `Input type "${input.type}" is not yet implemented. Only "url" is supported.` });
      return { status: 'error', errors: [`Input type "${input.type}" not implemented`] };
    }

    const viewport = input.orientation === 'landscape'
      ? { width: 1920, height: 1080 }
      : { width: 1080, height: 1920 };

    const targetUrl = input.value;

    // --- Stage 2: Capture ---
    this.updateStatus({
      stage: 'capture',
      progress: 15,
      currentAgent: 'Agent 2 - Capture + Navigation Engineer',
      message: 'Discovering screens and taking screenshots...',
    });

    let captureResult: CaptureResult | undefined;
    try {
      const captureOptions: CaptureOptions = {
        maxScreens: input.maxScreens || 10,
        viewport,
        outputDir: path.join(baseDir, 'screenshots'),
        credentials: input.credentials,
      };
      captureResult = await this.captureEngine.captureUrl(targetUrl, captureOptions);
      this.updateStatus({ progress: 40, message: `Captured ${captureResult.screens.length} screens` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Capture failed: ${msg}`);
      this.updateStatus({ progress: 40, message: `Capture error: ${msg}` });
    }

    if (!captureResult || captureResult.screens.length === 0) {
      this.updateStatus({ stage: 'error', progress: 100, message: 'No screens captured' });
      return { status: 'error', errors: [...errors, 'No screens captured'] };
    }

    // Save screens.json and flows.json
    await fs.promises.writeFile(
      path.join(baseDir, 'screenshots', 'screens.json'),
      JSON.stringify(captureResult.screens, null, 2)
    );
    await fs.promises.writeFile(
      path.join(baseDir, 'screenshots', 'flows.json'),
      JSON.stringify(captureResult.flows, null, 2)
    );

    // --- Stage 3: Produce ---
    this.updateStatus({
      stage: 'produce',
      progress: 45,
      currentAgent: 'Agent 3 - Video Producer',
      message: 'Generating explainer videos...',
    });

    const videos: VideoResult[] = [];
    const videoOptions: VideoOptions = {
      width: viewport.width,
      height: viewport.height,
      outputDir: path.join(baseDir, 'videos'),
      language: input.language || 'he',
      theme: input.videoTheme || 'modern',
      watermark: input.watermark,
    };

    for (let i = 0; i < captureResult.screens.length; i++) {
      const screen = captureResult.screens[i];
      try {
        const video = await this.videoProducer.generateVideo(screen, videoOptions);
        videos.push(video);
        const pct = 45 + Math.round((i / captureResult.screens.length) * 25);
        this.updateStatus({ progress: pct, message: `Video ${i + 1}/${captureResult.screens.length}: ${screen.name}` });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Video for ${screen.name}: ${msg}`);
      }
    }

    // Generate demo page
    let demoPagePath: string | undefined;
    try {
      demoPagePath = await this.videoProducer.generateDemoPage(videos);
      this.updateStatus({ progress: 72, message: 'Demo page created' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Demo page: ${msg}`);
    }

    // --- Stage 4: Document ---
    this.updateStatus({
      stage: 'document',
      progress: 75,
      currentAgent: 'Agent 4 - PDF Doc + Annotation Designer',
      message: 'Generating PDF documentation...',
    });

    let pdfResult: PDFResult | undefined;
    try {
      const detailConfig = PDF_DETAIL_LEVELS[input.detailLevel || 'standard'] || PDF_DETAIL_LEVELS.standard;
      const pdfOptions: PDFOptions = {
        title: projectName,
        language: input.language || 'he',
        outputDir: path.join(baseDir, 'docs'),
        includeAnnotations: detailConfig.includeAnnotations,
      };
      pdfResult = await this.pdfGenerator.generateGuide(captureResult.screens, pdfOptions);
      this.updateStatus({ progress: 90, message: 'PDF guide generated' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`PDF generation: ${msg}`);
    }

    // --- Generate Report ---
    const report: ReportJson = {
      projectName,
      generatedAt: new Date().toISOString(),
      userId: input.userId,
      videoTheme: input.videoTheme || 'modern',
      detailLevel: input.detailLevel || 'standard',
      source: 'url',
      screens: captureResult.screens.map(s => {
        const video = videos.find(v => v.screenId === s.id);
        return {
          id: s.id,
          name: s.name,
          url: s.url,
          screenshotPath: s.screenshotPath,
          videoPath: video?.videoPath,
          status: 'ok' as const,
        };
      }),
      pdfPath: pdfResult?.pdfPath,
      demoPagePath,
      totalScreens: captureResult.screens.length,
      totalVideos: videos.length,
    };

    const reportPath = path.join(baseDir, 'report.json');
    await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));

    this.updateStatus({
      stage: 'done',
      progress: 100,
      currentAgent: 'Pipeline',
      message: `Complete! ${captureResult.screens.length} screens, ${videos.length} videos, PDF ready.`,
    });

    return {
      status: errors.length === 0 ? 'success' : 'partial',
      capture: captureResult,
      videos,
      pdf: pdfResult,
      demoPagePath,
      reportPath,
      errors,
    };
  }

  getStatus(): PipelineStatus {
    return { ...this.currentStatus };
  }
}
