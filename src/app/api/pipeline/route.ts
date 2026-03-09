import { NextRequest, NextResponse } from 'next/server';
import { Pipeline, type PipelineInput } from '@/lib/pipeline';
import { validateUrl, validateResolvedIp, clampMaxScreens } from '@royea/shared-utils/validate-url';
import { checkRateLimit, getClientIp, HEAVY_LIMIT, API_READ_LIMIT } from '@royea/shared-utils/rate-limit';
import { getUserIdFromRequest } from '@/lib/auth';
import { getSubscription, PLANS } from '@/lib/payments';
import { shouldWatermark } from '@/lib/plan-guard';
import { prisma } from '@/lib/db';
import { getStyleProfile, analyzeAndUpdateStyle } from '@/lib/style-engine';

const MAX_CONCURRENT = 10;

// Mark stale pipelines (stuck in non-terminal state from a previous server instance) as errored.
// Runs once on first request via lazy init.
let stalePipelineRecoveryDone = false;
async function recoverStalePipelines() {
  if (stalePipelineRecoveryDone) return;
  stalePipelineRecoveryDone = true;
  try {
    const stale = await prisma.pipeline.updateMany({
      where: {
        stage: { notIn: ['done', 'error'] },
        // Only recover pipelines older than 2 minutes (avoid racing with genuinely running ones)
        updatedAt: { lt: new Date(Date.now() - 2 * 60 * 1000) },
      },
      data: {
        stage: 'error',
        progress: 100,
        error: 'Pipeline interrupted by server restart',
      },
    });
    if (stale.count > 0) {
      console.log(`[pipeline] Recovered ${stale.count} stale pipeline(s) from previous server instance`);
    }
  } catch (err) {
    console.error('[pipeline] Failed to recover stale pipelines:', err);
  }
}

// Credential patterns for scrubbing
const CREDENTIAL_PATTERNS = [
  /(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|auth)\s*[:=]\s*\S+/gi,
  /(?:Bearer|Basic)\s+[A-Za-z0-9+/=._-]+/g,
  /[A-Za-z0-9+/]{40,}/g,
];

function scrubCredentials(text: string): string {
  let result = text;
  for (const pattern of CREDENTIAL_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

// Track currently running pipeline IDs (only for concurrency control — state lives in DB)
const runningPipelines = new Set<string>();

export async function POST(request: NextRequest) {
  await recoverStalePipelines();

  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { billingCycleStart: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 });
  }

  const sub = await getSubscription(userId);
  const plan = sub?.plan ?? 'FREE';
  const limitConfig = PLANS[plan];
  const maxPipelines = limitConfig.pipelinesPerMonth;

  if (maxPipelines >= 0) {
    const count = await prisma.pipeline.count({
      where: {
        userId,
        createdAt: { gte: user.billingCycleStart },
      },
    });
    if (count >= maxPipelines) {
      return NextResponse.json(
        { error: `Pipeline limit reached (${maxPipelines}/${maxPipelines} for ${plan} this month). Upgrade for more.` },
        { status: 429 },
      );
    }
  }

  const ip = getClientIp(request);
  const limit = checkRateLimit(`pipeline:post:${ip}`, HEAVY_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  if (runningPipelines.size >= MAX_CONCURRENT) {
    return NextResponse.json({ error: 'Too many pipelines in progress. Please wait.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const inputType = body.type || 'url';
    const value = body.value;

    if (!value || typeof value !== 'string' || !value.trim()) {
      return NextResponse.json({ error: 'Missing URL' }, { status: 400 });
    }
    if (inputType !== 'url') {
      return NextResponse.json({ error: `Input type "${inputType}" is not yet implemented. Use "url".` }, { status: 400 });
    }

    const validation = validateUrl(value.trim());
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const parsed = new URL(validation.url);
    const dnsCheck = await validateResolvedIp(parsed.hostname);
    if (!dnsCheck.safe) {
      return NextResponse.json({ error: dnsCheck.error }, { status: 400 });
    }

    // Create DB record first to get the pipeline ID for export isolation
    const dbPipeline = await prisma.pipeline.create({
      data: {
        userId,
        stage: 'intake',
        progress: 0,
        message: 'Initializing...',
        currentAgent: 'Pipeline',
      },
    });

    const pipelineId = dbPipeline.id;

    // Load user's style profile for defaults
    const style = await getStyleProfile(userId);

    // Each pipeline gets its own isolated export workspace
    const input: PipelineInput = {
      type: 'url',
      value: value.trim(),
      projectName: body.projectName || 'ExplainIt Project',
      language: body.language ?? (style.preferredLanguage as 'he' | 'en' | undefined) ?? 'he',
      orientation: body.orientation ?? (style.preferredOrientation as 'portrait' | 'landscape' | undefined) ?? 'portrait',
      maxScreens: clampMaxScreens(body.maxScreens ?? style.preferredMaxScreens ?? undefined),
      credentials: body.credentials,
      exportDir: `exports/${pipelineId}`,
      videoTheme: body.videoTheme ?? style.videoTheme ?? 'modern',
      detailLevel: body.detailLevel ?? style.detailLevel ?? 'standard',
      userId,
      watermark: shouldWatermark(plan as 'FREE' | 'PRO' | 'TEAM'),
    };

    // Store scrubbed input in DB
    await prisma.pipeline.update({
      where: { id: pipelineId },
      data: { input: scrubCredentials(JSON.stringify(input)) },
    });

    runningPipelines.add(pipelineId);

    // Run pipeline with DB-backed status updates
    const pipeline = new Pipeline(async (status) => {
      try {
        await prisma.pipeline.update({
          where: { id: pipelineId },
          data: {
            stage: status.stage,
            progress: status.progress,
            message: status.message,
            currentAgent: status.currentAgent,
          },
        });
      } catch {
        // Non-fatal: status update failure shouldn't crash pipeline
      }
    });

    // Fire and forget — result persisted to DB on completion
    pipeline.run(input).then(async (result) => {
      const scrubbed = JSON.parse(scrubCredentials(JSON.stringify(result)));
      await prisma.pipeline.update({
        where: { id: pipelineId },
        data: {
          stage: 'done',
          progress: 100,
          message: `Complete! ${result.capture?.screens.length ?? 0} screens, ${result.videos?.length ?? 0} videos.`,
          result: JSON.stringify(scrubbed),
          error: result.errors.length > 0 ? result.errors.join('; ') : null,
        },
      });
    }).catch(async (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.pipeline.update({
        where: { id: pipelineId },
        data: { stage: 'error', progress: 100, error: msg },
      }).catch(() => {});
    }).finally(() => {
      runningPipelines.delete(pipelineId);
      // Auto-learn: update style profile from pipeline history (non-blocking)
      analyzeAndUpdateStyle(userId).catch(() => {});
    });

    // Return initial status
    return NextResponse.json({
      pipelineId,
      status: {
        stage: 'intake',
        progress: 0,
        currentAgent: 'Pipeline',
        message: 'Initializing...',
        startedAt: dbPipeline.createdAt.toISOString(),
        updatedAt: dbPipeline.createdAt.toISOString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  await recoverStalePipelines();

  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = getClientIp(request);
  const limit = checkRateLimit(`pipeline:get:${ip}`, API_READ_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const pipelineId = request.nextUrl.searchParams.get('id');
  if (!pipelineId) {
    return NextResponse.json({ error: 'Missing pipeline id' }, { status: 400 });
  }

  const dbPipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } });
  if (!dbPipeline) {
    return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
  }
  if (dbPipeline.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const status = {
    stage: dbPipeline.stage,
    progress: dbPipeline.progress,
    currentAgent: dbPipeline.currentAgent,
    message: dbPipeline.message,
    startedAt: dbPipeline.createdAt.toISOString(),
    updatedAt: dbPipeline.updatedAt.toISOString(),
  };

  const result = dbPipeline.result ? JSON.parse(dbPipeline.result) : null;

  return NextResponse.json({
    pipelineId,
    status,
    result,
    error: dbPipeline.error || null,
  });
}

export async function DELETE(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pipelineId = request.nextUrl.searchParams.get('id');
  if (!pipelineId) {
    return NextResponse.json({ error: 'Missing pipeline id' }, { status: 400 });
  }

  const dbPipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    select: { userId: true, stage: true },
  });
  if (!dbPipeline) {
    return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
  }
  if (dbPipeline.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.pipeline.update({
    where: { id: pipelineId },
    data: { cancelled: true, stage: 'error', error: 'Cancelled by user' },
  });

  return NextResponse.json({ success: true });
}
