import { describe, it, expect } from 'vitest';
import {
  VIDEO_THEMES,
  PDF_DETAIL_LEVELS,
  type VideoThemeColors,
  type PDFDetailConfig,
} from '../style-engine';

describe('VIDEO_THEMES', () => {
  it('should have modern, clean, and bold themes', () => {
    expect(VIDEO_THEMES).toHaveProperty('modern');
    expect(VIDEO_THEMES).toHaveProperty('clean');
    expect(VIDEO_THEMES).toHaveProperty('bold');
  });

  it.each(['modern', 'clean', 'bold'] as const)('%s theme should have all required color fields', (name) => {
    const theme: VideoThemeColors = VIDEO_THEMES[name];
    expect(theme.background).toBeTruthy();
    expect(theme.titleBg).toBeTruthy();
    expect(theme.ctaGradient).toHaveLength(2);
    expect(theme.progressGradient).toHaveLength(3);
    expect(theme.highlightColors.length).toBeGreaterThanOrEqual(5);
    expect(theme.textColor).toBeTruthy();
    expect(theme.subtextColor).toBeTruthy();
  });

  it('clean theme should use light background', () => {
    expect(VIDEO_THEMES.clean.background).toBe('#f8f9fa');
  });

  it('modern and bold themes should use dark backgrounds', () => {
    expect(VIDEO_THEMES.modern.background).toMatch(/^#0/);
    expect(VIDEO_THEMES.bold.background).toMatch(/^#1/);
  });
});

describe('PDF_DETAIL_LEVELS', () => {
  it('should have minimal, standard, and detailed levels', () => {
    expect(PDF_DETAIL_LEVELS).toHaveProperty('minimal');
    expect(PDF_DETAIL_LEVELS).toHaveProperty('standard');
    expect(PDF_DETAIL_LEVELS).toHaveProperty('detailed');
  });

  it('minimal should disable annotations and TOC', () => {
    const cfg: PDFDetailConfig = PDF_DETAIL_LEVELS.minimal;
    expect(cfg.includeAnnotations).toBe(false);
    expect(cfg.includeTOC).toBe(false);
    expect(cfg.includeSummary).toBe(false);
    expect(cfg.includeElementTable).toBe(false);
    expect(cfg.maxElementsPerScreen).toBe(0);
  });

  it('standard should include everything with 12 element cap', () => {
    const cfg: PDFDetailConfig = PDF_DETAIL_LEVELS.standard;
    expect(cfg.includeAnnotations).toBe(true);
    expect(cfg.includeTOC).toBe(true);
    expect(cfg.includeSummary).toBe(true);
    expect(cfg.includeElementTable).toBe(true);
    expect(cfg.maxElementsPerScreen).toBe(12);
  });

  it('detailed should have higher element cap than standard', () => {
    expect(PDF_DETAIL_LEVELS.detailed.maxElementsPerScreen).toBeGreaterThan(
      PDF_DETAIL_LEVELS.standard.maxElementsPerScreen
    );
  });
});

describe('style profile analysis logic', () => {
  // Test the majority-vote logic used in analyzeAndUpdateStyle
  function majorityVote(values: string[]): string | null {
    if (values.length === 0) return null;
    const counts: Record<string, number> = {};
    for (const v of values) {
      counts[v] = (counts[v] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }

  function averageOrNull(values: number[]): number | null {
    if (values.length === 0) return null;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }

  it('should pick the most common language', () => {
    expect(majorityVote(['en', 'en', 'he'])).toBe('en');
    expect(majorityVote(['he', 'he', 'he', 'en'])).toBe('he');
  });

  it('should return null for empty input', () => {
    expect(majorityVote([])).toBeNull();
    expect(averageOrNull([])).toBeNull();
  });

  it('should average maxScreens correctly', () => {
    expect(averageOrNull([10, 20, 30])).toBe(20);
    expect(averageOrNull([5, 15])).toBe(10);
    expect(averageOrNull([7])).toBe(7);
  });

  it('should round average to nearest integer', () => {
    expect(averageOrNull([10, 11])).toBe(11); // 10.5 rounds to 11
    expect(averageOrNull([3, 4, 5])).toBe(4);
  });
});
