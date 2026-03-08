import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { Pipeline, type PipelineInput } from '@/lib/pipeline';
import { validateUrl, validateResolvedIp, clampMaxScreens } from '@royea/shared-utils/validate-url';
import { checkRateLimit, getClientIp, HEAVY_LIMIT, API_READ_LIMIT } from '@royea/shared-utils/rate-limit';
import { getUserIdFromRequest } from '@/lib/auth';
import { getSubscription, PLANS } from '@/lib/payments';
import { prisma } from '@/lib/db';

const MAX_PIPELINES = 10;
const PIPELINE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Credential patterns for scrubbing
const CREDENTIAL_PATTERNS = [
  /(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|auth)\s*[:=]\s*\S+/gi,
  /(?:Bearer|Basic)\s+[A-Za-z0-9+/=._-]+/g,
  /[A-Za-z0-9+/]{40,}/g, // long base64-like strings
];

function scrubCredentials(text: string): string {
  let result = text;
  for (const pattern of CREDENTIAL_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

interface PipelineEntry {
  pipeline: Pipeline;
  promise: Promise<unknown>;
  result?: unknown;
  error?: string;
  cancelled?: boolean;
  createdAt: number;
}

// Store active pipelines in memory
const activePipelines = new Map<string, PipelineEntry>();

// TTL cleanup — run every 5 minutes
setInterval(() => {
  const now = Date.now();
  activePipelines.forEach((entry, key) => {
    if (now - entry.createdAt > PIPELINE_TTL_MS) {
      activePipelines.delete(key);
    }
  });
}, 5 * 60 * 1000);

export async function POST(request: NextRequest) {
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
        {
          error: `Pipeline limit reached (${maxPipelines}/${maxPipelines} for ${plan} this month). Upgrade for more.`,
        },
        { status: 429 }
      );
    }
  }

  // Rate limit
  const ip = getClientIp(request);
  const limit = checkRateLimit(`pipeline:post:${ip}`, HEAVY_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } }
    );
  }

  // Max concurrent pipelines
  const activePipelineCount = Array.from(activePipelines.values()).filter(e => !e.result && !e.error).length;
  if (activePipelineCount >= MAX_PIPELINES) {
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

    // Validate URL to prevent SSRF
    const validation = validateUrl(value.trim());
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // DNS rebinding protection — resolve hostname and check resolved IPs
    const parsed = new URL(validation.url);
    const dnsCheck = await validateResolvedIp(parsed.hostname);
    if (!dnsCheck.safe) {
      return NextResponse.json({ error: dnsCheck.error }, { status: 400 });
    }

    const input: PipelineInput = {
      type: 'url',
      value: value.trim(),
      projectName: body.projectName || 'ExplainIt Project',
      language: body.language === 'en' ? 'en' : 'he',
      orientation: body.orientation === 'landscape' ? 'landscape' : 'portrait',
      maxScreens: clampMaxScreens(body.maxScreens),
      credentials: body.credentials,
    };

    await prisma.pipeline.create({
      data: { userId },
    });

    const pipelineId = `pipeline_${randomUUID()}`;
    const pipeline = new Pipeline();

    const promise = pipeline.run(input).then(result => {
      const entry = activePipelines.get(pipelineId);
      if (entry) {
        // Scrub credentials from any text in the result
        if (result && typeof result === 'object') {
          const scrubbed = JSON.parse(scrubCredentials(JSON.stringify(result)));
          entry.result = scrubbed;
        } else {
          entry.result = result;
        }
      }
      return result;
    }).catch(err => {
      const entry = activePipelines.get(pipelineId);
      if (entry) entry.error = err instanceof Error ? err.message : String(err);
    });

    activePipelines.set(pipelineId, { pipeline, promise, createdAt: Date.now() });

    return NextResponse.json({ pipelineId, status: pipeline.getStatus() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`pipeline:get:${ip}`, API_READ_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } }
    );
  }

  const pipelineId = request.nextUrl.searchParams.get('id');

  if (!pipelineId) {
    return NextResponse.json({ error: 'Missing pipeline id' }, { status: 400 });
  }

  const entry = activePipelines.get(pipelineId);
  if (!entry) {
    return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
  }

  const status = entry.pipeline.getStatus();
  const result = entry.result || null;

  // Clean up completed pipelines after result is fetched
  if (result || entry.error) {
    // Keep for a few more polls, then clean up on next TTL sweep
  }

  return NextResponse.json({ pipelineId, status, result, error: entry.error || null });
}

export async function DELETE(request: NextRequest) {
  const pipelineId = request.nextUrl.searchParams.get('id');

  if (!pipelineId) {
    return NextResponse.json({ error: 'Missing pipeline id' }, { status: 400 });
  }

  const entry = activePipelines.get(pipelineId);
  if (!entry) {
    return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
  }

  entry.cancelled = true;
  return NextResponse.json({ success: true });
}
