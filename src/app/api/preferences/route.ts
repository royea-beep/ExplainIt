import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { getStyleProfile, updateStylePreferences, analyzeAndUpdateStyle, resetStyleProfile } from '@/lib/style-engine';

/**
 * GET /api/preferences — returns the user's Style DNA profile
 */
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await getStyleProfile(userId);
  return NextResponse.json(profile);
}

/**
 * PATCH /api/preferences — update user-settable style preferences
 * Body: { detailLevel?, videoTheme?, includeAnnotations? }
 */
export async function PATCH(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const profile = await updateStylePreferences(userId, {
      detailLevel: body.detailLevel,
      videoTheme: body.videoTheme,
      includeAnnotations: body.includeAnnotations,
    });
    return NextResponse.json(profile);
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

/**
 * POST /api/preferences — trigger a manual re-analysis of style from pipeline history
 */
export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await analyzeAndUpdateStyle(userId);
  return NextResponse.json(profile);
}

/**
 * DELETE /api/preferences — reset style profile to factory defaults
 */
export async function DELETE(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await resetStyleProfile(userId);
  return NextResponse.json(profile);
}
