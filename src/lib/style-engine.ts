/**
 * Style DNA Engine — learns user documentation preferences from pipeline history.
 *
 * Adapted from PostPilot's Style DNA concept:
 * - PostPilot learns brand voice from social posts → injects into AI caption prompts
 * - ExplainIt learns documentation preferences from pipeline usage → applies as defaults + styling
 *
 * Dimensions:
 *  preferredLanguage    — most-used language across pipelines
 *  preferredOrientation — most-used orientation
 *  preferredMaxScreens  — average maxScreens setting
 *  detailLevel          — minimal | standard | detailed (user-settable)
 *  videoTheme           — modern | clean | bold (user-settable)
 *  includeAnnotations   — boolean (user-settable)
 */

import { prisma } from './db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StyleProfileData {
  preferredLanguage: string | null;
  preferredOrientation: string | null;
  preferredMaxScreens: number | null;
  detailLevel: string;
  videoTheme: string;
  includeAnnotations: boolean;
  analyzedPipelineCount: number;
  lastAnalyzedAt: string | null;
}

/** Subset of PipelineInput we extract from the stored JSON */
interface ParsedInput {
  language?: string;
  orientation?: string;
  maxScreens?: number;
}

// ---------------------------------------------------------------------------
// Video theme definitions
// ---------------------------------------------------------------------------

export interface VideoThemeColors {
  background: string;
  titleBg: string;
  ctaGradient: [string, string];
  progressGradient: [string, string, string];
  highlightColors: string[];
  textColor: string;
  subtextColor: string;
}

export const VIDEO_THEMES: Record<string, VideoThemeColors> = {
  modern: {
    background: '#0d0d1a',
    titleBg: 'rgba(13, 13, 26, 0.88)',
    ctaGradient: ['#ff4444', '#ff8800'],
    progressGradient: ['#ff4444', '#ff8800', '#ffcc00'],
    highlightColors: ['#ff4444', '#ff8800', '#ffcc00', '#44cc44', '#4488ff', '#aa44ff', '#ff44aa'],
    textColor: '#ffffff',
    subtextColor: '#cccccc',
  },
  clean: {
    background: '#f8f9fa',
    titleBg: 'rgba(248, 249, 250, 0.92)',
    ctaGradient: ['#2563eb', '#3b82f6'],
    progressGradient: ['#2563eb', '#3b82f6', '#60a5fa'],
    highlightColors: ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#be185d'],
    textColor: '#1e293b',
    subtextColor: '#64748b',
  },
  bold: {
    background: '#18181b',
    titleBg: 'rgba(24, 24, 27, 0.92)',
    ctaGradient: ['#e11d48', '#f43f5e'],
    progressGradient: ['#e11d48', '#f43f5e', '#fb923c'],
    highlightColors: ['#e11d48', '#f59e0b', '#10b981', '#6366f1', '#ec4899', '#14b8a6', '#f97316'],
    textColor: '#fafafa',
    subtextColor: '#a1a1aa',
  },
};

// ---------------------------------------------------------------------------
// PDF detail level definitions
// ---------------------------------------------------------------------------

export interface PDFDetailConfig {
  includeAnnotations: boolean;
  includeTOC: boolean;
  includeSummary: boolean;
  includeElementTable: boolean;
  maxElementsPerScreen: number;
  includeRouteInfo: boolean;
}

export const PDF_DETAIL_LEVELS: Record<string, PDFDetailConfig> = {
  minimal: {
    includeAnnotations: false,
    includeTOC: false,
    includeSummary: false,
    includeElementTable: false,
    maxElementsPerScreen: 0,
    includeRouteInfo: false,
  },
  standard: {
    includeAnnotations: true,
    includeTOC: true,
    includeSummary: true,
    includeElementTable: true,
    maxElementsPerScreen: 12,
    includeRouteInfo: true,
  },
  detailed: {
    includeAnnotations: true,
    includeTOC: true,
    includeSummary: true,
    includeElementTable: true,
    maxElementsPerScreen: 30,
    includeRouteInfo: true,
  },
};

// ---------------------------------------------------------------------------
// Get or create a user's style profile
// ---------------------------------------------------------------------------

export async function getStyleProfile(userId: string): Promise<StyleProfileData> {
  const profile = await prisma.styleProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  return {
    preferredLanguage: profile.preferredLanguage,
    preferredOrientation: profile.preferredOrientation,
    preferredMaxScreens: profile.preferredMaxScreens,
    detailLevel: profile.detailLevel,
    videoTheme: profile.videoTheme,
    includeAnnotations: profile.includeAnnotations,
    analyzedPipelineCount: profile.analyzedPipelineCount,
    lastAnalyzedAt: profile.lastAnalyzedAt?.toISOString() ?? null,
  };
}

// ---------------------------------------------------------------------------
// Update user-settable preferences
// ---------------------------------------------------------------------------

const VALID_DETAIL_LEVELS = ['minimal', 'standard', 'detailed'];
const VALID_VIDEO_THEMES = ['modern', 'clean', 'bold'];

export async function updateStylePreferences(
  userId: string,
  prefs: {
    detailLevel?: string;
    videoTheme?: string;
    includeAnnotations?: boolean;
  },
): Promise<StyleProfileData> {
  const data: Record<string, unknown> = {};

  if (prefs.detailLevel && VALID_DETAIL_LEVELS.includes(prefs.detailLevel)) {
    data.detailLevel = prefs.detailLevel;
  }
  if (prefs.videoTheme && VALID_VIDEO_THEMES.includes(prefs.videoTheme)) {
    data.videoTheme = prefs.videoTheme;
  }
  if (typeof prefs.includeAnnotations === 'boolean') {
    data.includeAnnotations = prefs.includeAnnotations;
  }

  const profile = await prisma.styleProfile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  return {
    preferredLanguage: profile.preferredLanguage,
    preferredOrientation: profile.preferredOrientation,
    preferredMaxScreens: profile.preferredMaxScreens,
    detailLevel: profile.detailLevel,
    videoTheme: profile.videoTheme,
    includeAnnotations: profile.includeAnnotations,
    analyzedPipelineCount: profile.analyzedPipelineCount,
    lastAnalyzedAt: profile.lastAnalyzedAt?.toISOString() ?? null,
  };
}

// ---------------------------------------------------------------------------
// Reset style profile to factory defaults (clears learned data)
// ---------------------------------------------------------------------------

export async function resetStyleProfile(userId: string): Promise<StyleProfileData> {
  const profile = await prisma.styleProfile.upsert({
    where: { userId },
    create: { userId },
    update: {
      preferredLanguage: null,
      preferredOrientation: null,
      preferredMaxScreens: null,
      detailLevel: 'standard',
      videoTheme: 'modern',
      includeAnnotations: true,
      analyzedPipelineCount: 0,
      lastAnalyzedAt: null,
    },
  });

  return {
    preferredLanguage: profile.preferredLanguage,
    preferredOrientation: profile.preferredOrientation,
    preferredMaxScreens: profile.preferredMaxScreens,
    detailLevel: profile.detailLevel,
    videoTheme: profile.videoTheme,
    includeAnnotations: profile.includeAnnotations,
    analyzedPipelineCount: profile.analyzedPipelineCount,
    lastAnalyzedAt: profile.lastAnalyzedAt?.toISOString() ?? null,
  };
}

// ---------------------------------------------------------------------------
// Analyze pipeline history and update learned defaults
// ---------------------------------------------------------------------------

export async function analyzeAndUpdateStyle(userId: string): Promise<StyleProfileData> {
  // Fetch last 20 completed pipelines
  const pipelines = await prisma.pipeline.findMany({
    where: { userId, stage: 'done' },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { input: true },
  });

  if (pipelines.length === 0) {
    return getStyleProfile(userId);
  }

  // Parse inputs
  const inputs: ParsedInput[] = pipelines
    .map((p) => {
      try { return JSON.parse(p.input) as ParsedInput; }
      catch { return null; }
    })
    .filter((x): x is ParsedInput => x !== null);

  if (inputs.length === 0) {
    return getStyleProfile(userId);
  }

  // Aggregate language preference (majority vote)
  const langCounts: Record<string, number> = {};
  for (const inp of inputs) {
    if (inp.language) {
      langCounts[inp.language] = (langCounts[inp.language] || 0) + 1;
    }
  }
  const preferredLanguage = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Aggregate orientation preference (majority vote)
  const orientCounts: Record<string, number> = {};
  for (const inp of inputs) {
    if (inp.orientation) {
      orientCounts[inp.orientation] = (orientCounts[inp.orientation] || 0) + 1;
    }
  }
  const preferredOrientation = Object.entries(orientCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Average maxScreens
  const maxScreenValues = inputs.filter(i => typeof i.maxScreens === 'number').map(i => i.maxScreens!);
  const preferredMaxScreens = maxScreenValues.length > 0
    ? Math.round(maxScreenValues.reduce((a, b) => a + b, 0) / maxScreenValues.length)
    : null;

  const profile = await prisma.styleProfile.upsert({
    where: { userId },
    create: {
      userId,
      preferredLanguage,
      preferredOrientation,
      preferredMaxScreens,
      analyzedPipelineCount: pipelines.length,
      lastAnalyzedAt: new Date(),
    },
    update: {
      preferredLanguage,
      preferredOrientation,
      preferredMaxScreens,
      analyzedPipelineCount: pipelines.length,
      lastAnalyzedAt: new Date(),
    },
  });

  return {
    preferredLanguage: profile.preferredLanguage,
    preferredOrientation: profile.preferredOrientation,
    preferredMaxScreens: profile.preferredMaxScreens,
    detailLevel: profile.detailLevel,
    videoTheme: profile.videoTheme,
    includeAnnotations: profile.includeAnnotations,
    analyzedPipelineCount: profile.analyzedPipelineCount,
    lastAnalyzedAt: profile.lastAnalyzedAt?.toISOString() ?? null,
  };
}
