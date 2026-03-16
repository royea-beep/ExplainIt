/**
 * POST /api/generate-video
 *
 * Accepts: { url, script, voiceId, avatarId }
 * Runs the mp4-producer pipeline and returns { outputPath, downloadUrl } or { error }.
 *
 * The output file is served via the existing /api/exports route
 * using the same relative path convention the rest of the app uses.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { produceMP4 } from '@/lib/mp4-producer';

// Default values for the ftable Analyzer demo
const DEFAULT_URL = 'https://analyzer.ftable.co.il';
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // ElevenLabs "Bella" — clear, modern SaaS voice
const DEFAULT_AVATAR_ID = 'Abigail_expressive_2024112501'; // HeyGen English avatar
const DEFAULT_HEYGEN_VOICE_ID = '2d5b0e6cf36f460aa7fc47e3eee4ba54'; // HeyGen EN default

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const url: string = body.url || DEFAULT_URL;
    const voiceId: string = body.voiceId || DEFAULT_VOICE_ID;
    const avatarId: string = body.avatarId || DEFAULT_AVATAR_ID;
    const heygenVoiceId: string = body.heygenVoiceId || DEFAULT_HEYGEN_VOICE_ID;

    if (!url || !url.startsWith('http')) {
      return NextResponse.json({ error: 'url must be a valid http/https URL' }, { status: 400 });
    }

    // Auto-generate a default demo script if none provided
    const defaultScript = `Meet ftable Analyzer — the AI tool built for e-commerce sellers. Start by uploading any product image — just drag and drop. Our AI instantly removes the background and prepares your image for analysis. Then watch as the AI runs deep market research on your product. You get professional product descriptions, SEO content, pricing recommendations — all generated in seconds. Every analysis is saved in your dashboard history for easy access. Try it free — 5 credits, no credit card needed. Go to analyzer dot ftable dot co dot il`;
    const script: string = (body.script && body.script.trim().length >= 10) ? body.script : defaultScript;

    // Each run gets its own isolated output directory
    const runId = crypto.randomUUID();
    const outputDir = path.resolve(process.env.EXPORTS_DIR ?? './output', runId);
    const outputPath = path.join(outputDir, 'final.mp4');

    const result = await produceMP4({
      url,
      script,
      voiceId,
      avatarId,
      heygenVoiceId,
      outputPath,
      maxScreenshots: 6,
    });

    // Build a downloadUrl that works with the existing /api/exports route
    // The exports route strips everything up to and including "exports/" —
    // our output is at {EXPORTS_DIR}/ so we serve it directly
    // by exposing a /api/video-download route path.
    const downloadUrl = `/api/video-download?run=${encodeURIComponent(runId)}`;

    return NextResponse.json({
      outputPath: result.outputPath,
      downloadUrl,
      runId,
      hasAudio: result.hasAudio,
      hasAvatar: result.hasAvatar,
      durationSeconds: result.durationSeconds,
      screenshotCount: result.screenshotPaths.length,
      warnings: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/generate-video] Unhandled error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
