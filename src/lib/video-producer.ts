import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ScreenInfo } from './types';
import { VIDEO_THEMES, type VideoThemeColors } from './style-engine';

// Re-export shared types for backwards compatibility
export type { ScreenInfo, ElementInfo } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VideoOptions {
  width?: number;       // default 1080
  height?: number;      // default 1920
  fps?: number;         // default 30
  duration?: number;    // default 20 (seconds)
  outputDir?: string;   // default exports/videos
  language?: 'he' | 'en'; // default 'he'
  theme?: string;       // modern | clean | bold — default 'modern'
  watermark?: boolean;  // add "Made with ExplainIt" watermark (free tier)
}

export interface VideoResult {
  id: string;
  screenId: string;
  screenName: string;
  videoPath: string;      // path to the HTML animation file
  thumbnailPath: string;
  duration: number;
  format: string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1920;
const DEFAULT_FPS = 30;
const DEFAULT_DURATION = 20;
const DEFAULT_OUTPUT_DIR = 'exports/videos';
const DEFAULT_LANGUAGE: 'he' | 'en' = 'he';

// ---------------------------------------------------------------------------
// Helper: resolve options with defaults
// ---------------------------------------------------------------------------

function resolveOptions(opts?: VideoOptions) {
  const themeName = opts?.theme ?? 'modern';
  return {
    width: opts?.width ?? DEFAULT_WIDTH,
    height: opts?.height ?? DEFAULT_HEIGHT,
    fps: opts?.fps ?? DEFAULT_FPS,
    duration: opts?.duration ?? DEFAULT_DURATION,
    outputDir: opts?.outputDir ?? DEFAULT_OUTPUT_DIR,
    language: opts?.language ?? DEFAULT_LANGUAGE,
    theme: VIDEO_THEMES[themeName] ?? VIDEO_THEMES.modern,
    watermark: opts?.watermark ?? false,
  };
}

// ---------------------------------------------------------------------------
// Helper: ensure directory exists
// ---------------------------------------------------------------------------

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Helper: compute timing for element animations
// ---------------------------------------------------------------------------

function computeTimings(
  elementCount: number,
  totalDuration: number,
): { titleDur: number; ctaDur: number; perElement: number } {
  const titleDur = 2;    // seconds for title slide
  const ctaDur = 2;      // seconds for CTA at end
  const remaining = Math.max(totalDuration - titleDur - ctaDur, elementCount * 1);
  const perElement = elementCount > 0 ? remaining / elementCount : remaining;
  return { titleDur, ctaDur, perElement };
}

// ---------------------------------------------------------------------------
// Helper: generate a simple SVG thumbnail from a screenshot path
// ---------------------------------------------------------------------------

async function generateThumbnail(
  screenshotPath: string,
  outputPath: string,
  screenName: string,
  width: number,
  height: number,
): Promise<void> {
  const thumbWidth = Math.round(width / 4);
  const thumbHeight = Math.round(height / 4);
  const relScreenshot = path.basename(screenshotPath);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${thumbWidth}" height="${thumbHeight}">
  <rect width="100%" height="100%" fill="#1a1a2e"/>
  <image href="${relScreenshot}" x="0" y="0" width="${thumbWidth}" height="${thumbHeight}" opacity="0.6" preserveAspectRatio="xMidYMid slice"/>
  <rect x="0" y="${thumbHeight - 50}" width="${thumbWidth}" height="50" fill="rgba(0,0,0,0.7)"/>
  <text x="${thumbWidth / 2}" y="${thumbHeight - 20}" font-family="Arial, sans-serif" font-size="16" fill="white" text-anchor="middle">${escapeHtml(screenName)}</text>
</svg>`;

  await fs.writeFile(outputPath, svg, 'utf-8');
}

// ---------------------------------------------------------------------------
// Helper: escape HTML entities
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---------------------------------------------------------------------------
// Helper: colour palette for element highlights
// ---------------------------------------------------------------------------

function colorForIndex(i: number, theme: VideoThemeColors): string {
  return theme.highlightColors[i % theme.highlightColors.length];
}

// ---------------------------------------------------------------------------
// Build the self-contained HTML animation for a single screen
// ---------------------------------------------------------------------------

function buildWatermarkHtml(): string {
  return `
  <!-- Watermark -->
  <div class="watermark">Made with ExplainIt</div>`;
}

function buildWatermarkCss(): string {
  return `
  .watermark {
    position: absolute;
    z-index: 50;
    bottom: 12px;
    right: 16px;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255,255,255,0.45);
    font-family: 'Segoe UI', Arial, sans-serif;
    letter-spacing: 0.3px;
    pointer-events: none;
    text-shadow: 0 1px 4px rgba(0,0,0,0.5);
  }`;
}

function buildScreenAnimationHtml(
  screen: ScreenInfo,
  options: ReturnType<typeof resolveOptions>,
): string {
  const { width, height, duration, language, theme } = options;
  const isRtl = language === 'he';
  const dir = isRtl ? 'rtl' : 'ltr';

  const elements = screen.elements.slice(0, 12); // cap at 12 to keep sane
  const { titleDur, ctaDur, perElement } = computeTimings(elements.length, duration);

  const totalAnimDuration = duration;
  const screenshotRelPath = path.basename(screen.screenshotPath);

  // Build per-element keyframe CSS + overlay HTML -------------------------
  let elementStyles = '';
  let elementOverlays = '';
  let cursorKeyframes = '@keyframes cursorMove {\n';

  elements.forEach((el, i) => {
    const startPct = ((titleDur + i * perElement) / totalAnimDuration) * 100;
    const endPct = ((titleDur + (i + 1) * perElement) / totalAnimDuration) * 100;
    const midPct = (startPct + endPct) / 2;
    const color = colorForIndex(i, theme);

    // Highlight box animation
    elementStyles += `
    @keyframes highlight-${i} {
      0%, ${Math.max(startPct - 1, 0)}% { opacity: 0; transform: scale(0.8); }
      ${startPct}% { opacity: 1; transform: scale(1.05); }
      ${startPct + 2}% { opacity: 1; transform: scale(1); }
      ${endPct - 1}% { opacity: 1; transform: scale(1); }
      ${endPct}% { opacity: 0; transform: scale(0.9); }
      100% { opacity: 0; }
    }
    @keyframes callout-${i} {
      0%, ${Math.max(startPct + 1, 0)}% { opacity: 0; transform: translateY(8px); }
      ${startPct + 3}% { opacity: 1; transform: translateY(0); }
      ${endPct - 2}% { opacity: 1; transform: translateY(0); }
      ${endPct}% { opacity: 0; transform: translateY(-8px); }
      100% { opacity: 0; }
    }`;

    // Cursor keyframe segment
    const cx = el.bounds.x + el.bounds.width / 2;
    const cy = el.bounds.y + el.bounds.height / 2;
    cursorKeyframes += `  ${startPct}% { left: ${cx}px; top: ${cy}px; opacity: 1; }\n`;
    cursorKeyframes += `  ${midPct}% { left: ${cx}px; top: ${cy}px; opacity: 1; }\n`;

    // Highlight overlay div
    const bx = el.bounds.x;
    const by = el.bounds.y;
    const bw = el.bounds.width;
    const bh = el.bounds.height;

    elementOverlays += `
    <div class="highlight" style="
      left:${bx}px; top:${by}px; width:${bw}px; height:${bh}px;
      border-color:${color};
      box-shadow: 0 0 12px ${color}88;
      animation: highlight-${i} ${totalAnimDuration}s ease-in-out forwards;
    "></div>
    <div class="callout" style="
      left:${bx}px; top:${Math.max(by - 38, 4)}px;
      background:${color};
      animation: callout-${i} ${totalAnimDuration}s ease-in-out forwards;
    ">${escapeHtml(el.label || el.type)}</div>`;
  });

  // Cursor: hide before title, hide after CTA
  const ctaStartPct = ((totalAnimDuration - ctaDur) / totalAnimDuration) * 100;
  cursorKeyframes += `  0% { opacity: 0; left: ${width / 2}px; top: ${height / 2}px; }\n`;
  cursorKeyframes += `  ${((titleDur) / totalAnimDuration) * 100}% { opacity: 1; left: ${width / 2}px; top: ${height / 2}px; }\n`;
  cursorKeyframes += `  ${ctaStartPct}% { opacity: 0; }\n  100% { opacity: 0; }\n}\n`;

  // Title & CTA percentages
  const titleEndPct = (titleDur / totalAnimDuration) * 100;

  const ctaLabel = isRtl ? 'למידע נוסף' : 'Learn More';
  const titleLabel = escapeHtml(screen.name);
  const descLabel = escapeHtml(screen.description);

  return `<!DOCTYPE html>
<html lang="${language}" dir="${dir}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${titleLabel} - ExplainIt Video</title>
<meta property="og:title" content="${titleLabel}" />
<meta property="og:description" content="Step-by-step explainer — generated by ExplainIt" />
<meta property="og:type" content="website" />
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    margin: 0; padding: 0;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: ${theme.background};
    font-family: 'Segoe UI', Arial, sans-serif;
  }

  .viewport-scaler {
    width: ${width}px;
    height: ${height}px;
    transform-origin: top left;
    transform: scale(min(calc(100vw / ${width}), calc(100vh / ${height})));
    position: relative;
    overflow: hidden;
  }

  /* Screenshot layer */
  .screenshot {
    position: absolute;
    top: 0; left: 0;
    width: ${width}px;
    height: ${height}px;
    object-fit: contain;
    z-index: 1;
    animation: zoomPan ${totalAnimDuration}s ease-in-out forwards;
  }

  @keyframes zoomPan {
    0%   { transform: scale(1) translate(0, 0); }
    30%  { transform: scale(1.05) translate(-10px, -10px); }
    60%  { transform: scale(1.08) translate(5px, -15px); }
    100% { transform: scale(1) translate(0, 0); }
  }

  /* Highlights */
  .highlight {
    position: absolute;
    z-index: 10;
    border: 3px solid;
    border-radius: 6px;
    pointer-events: none;
    opacity: 0;
  }

  /* Callouts */
  .callout {
    position: absolute;
    z-index: 11;
    color: ${theme.textColor};
    font-size: 14px;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 4px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
  }

  /* Simulated cursor */
  .cursor {
    position: absolute;
    z-index: 20;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(255,255,255,0.85);
    border: 2px solid #333;
    pointer-events: none;
    animation: cursorMove ${totalAnimDuration}s ease-in-out forwards;
    transform: translate(-50%, -50%);
  }

  /* Title overlay */
  .title-overlay {
    position: absolute;
    z-index: 30;
    top: 0; left: 0;
    width: 100%; height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: ${theme.titleBg};
    animation: titleFade ${totalAnimDuration}s ease-in-out forwards;
  }

  @keyframes titleFade {
    0%   { opacity: 1; }
    ${titleEndPct - 2}% { opacity: 1; }
    ${titleEndPct}% { opacity: 0; pointer-events: none; }
    100% { opacity: 0; pointer-events: none; }
  }

  .title-overlay h1 {
    font-size: 42px;
    color: ${theme.textColor};
    margin-bottom: 16px;
    text-align: center;
    text-shadow: 0 2px 12px rgba(0,0,0,0.6);
  }

  .title-overlay p {
    font-size: 20px;
    color: ${theme.subtextColor};
    max-width: 80%;
    text-align: center;
    line-height: 1.5;
  }

  /* CTA overlay */
  .cta-overlay {
    position: absolute;
    z-index: 30;
    top: 0; left: 0;
    width: 100%; height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${theme.titleBg};
    opacity: 0;
    animation: ctaFade ${totalAnimDuration}s ease-in-out forwards;
  }

  @keyframes ctaFade {
    0%, ${ctaStartPct - 1}% { opacity: 0; }
    ${ctaStartPct + 1}% { opacity: 1; }
    100% { opacity: 1; }
  }

  .cta-overlay .cta-button {
    padding: 18px 48px;
    font-size: 28px;
    font-weight: 700;
    color: ${theme.textColor};
    background: linear-gradient(135deg, ${theme.ctaGradient[0]}, ${theme.ctaGradient[1]});
    border: none;
    border-radius: 12px;
    box-shadow: 0 4px 24px ${theme.ctaGradient[0]}66;
    cursor: pointer;
    animation: ctaPulse 1.2s ease-in-out infinite alternate;
  }

  @keyframes ctaPulse {
    from { transform: scale(1); }
    to   { transform: scale(1.06); }
  }

  /* Progress bar */
  .progress-bar {
    position: absolute;
    z-index: 40;
    bottom: 0; left: 0;
    height: 4px;
    background: linear-gradient(90deg, ${theme.progressGradient[0]}, ${theme.progressGradient[1]}, ${theme.progressGradient[2]});
    animation: progress ${totalAnimDuration}s linear forwards;
  }

  @keyframes progress {
    from { width: 0%; }
    to   { width: 100%; }
  }

  ${elementStyles}
  ${cursorKeyframes}
  ${options.watermark ? buildWatermarkCss() : ''}
</style>
</head>
<body>

  <div class="viewport-scaler">

  <!-- Screenshot background -->
  <img class="screenshot" src="${screenshotRelPath}" alt="screenshot"/>

  <!-- Title slide -->
  <div class="title-overlay">
    <h1>${titleLabel}</h1>
    <p>${descLabel}</p>
  </div>

  <!-- Element highlights & callouts -->
  ${elementOverlays}

  <!-- Cursor simulation -->
  <div class="cursor"></div>

  <!-- CTA -->
  <div class="cta-overlay">
    <button class="cta-button">${ctaLabel}</button>
  </div>

  <!-- Progress bar -->
  <div class="progress-bar"></div>

  ${options.watermark ? buildWatermarkHtml() : ''}

  </div>

</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Build overview video HTML (montage of multiple screens)
// ---------------------------------------------------------------------------

function buildOverviewAnimationHtml(
  screens: ScreenInfo[],
  projectName: string,
  options: ReturnType<typeof resolveOptions>,
): string {
  const { width, height, duration, language, theme } = options;
  const isRtl = language === 'he';
  const dir = isRtl ? 'rtl' : 'ltr';

  const totalAnimDuration = duration;
  const perScreen = screens.length > 0 ? (totalAnimDuration - 4) / screens.length : totalAnimDuration - 4; // 2s title + 2s CTA
  const titleEndPct = (2 / totalAnimDuration) * 100;
  const ctaStartPct = ((totalAnimDuration - 2) / totalAnimDuration) * 100;

  let screenStyles = '';
  let screenDivs = '';

  screens.forEach((screen, i) => {
    const startPct = ((2 + i * perScreen) / totalAnimDuration) * 100;
    const endPct = ((2 + (i + 1) * perScreen) / totalAnimDuration) * 100;
    const relPath = path.basename(screen.screenshotPath);

    screenStyles += `
    @keyframes slide-${i} {
      0%, ${Math.max(startPct - 1, 0)}% { opacity: 0; transform: scale(0.92) translateY(20px); }
      ${startPct + 1}% { opacity: 1; transform: scale(1) translateY(0); }
      ${endPct - 2}% { opacity: 1; transform: scale(1) translateY(0); }
      ${endPct}% { opacity: 0; transform: scale(1.04) translateY(-20px); }
      100% { opacity: 0; }
    }
    @keyframes label-${i} {
      0%, ${startPct + 2}% { opacity: 0; }
      ${startPct + 4}% { opacity: 1; }
      ${endPct - 3}% { opacity: 1; }
      ${endPct}% { opacity: 0; }
      100% { opacity: 0; }
    }`;

    screenDivs += `
    <div class="screen-slide" style="animation: slide-${i} ${totalAnimDuration}s ease-in-out forwards;">
      <img src="${relPath}" alt="${escapeHtml(screen.name)}"/>
    </div>
    <div class="screen-label" style="animation: label-${i} ${totalAnimDuration}s ease-in-out forwards;">
      ${escapeHtml(screen.name)}
    </div>`;
  });

  const ctaLabel = isRtl ? 'גלה עוד' : 'Discover More';

  return `<!DOCTYPE html>
<html lang="${language}" dir="${dir}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(projectName)} - Overview - ExplainIt</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    margin: 0; padding: 0;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: ${theme.background};
    font-family: 'Segoe UI', Arial, sans-serif;
  }

  .viewport-scaler {
    width: ${width}px;
    height: ${height}px;
    transform-origin: top left;
    transform: scale(min(calc(100vw / ${width}), calc(100vh / ${height})));
    position: relative;
    overflow: hidden;
  }

  /* Title */
  .title-overlay {
    position: absolute; z-index: 30;
    top: 0; left: 0; width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    flex-direction: column;
    background: ${theme.titleBg};
    animation: titleFade ${totalAnimDuration}s ease-in-out forwards;
  }
  @keyframes titleFade {
    0% { opacity: 1; }
    ${titleEndPct - 1}% { opacity: 1; }
    ${titleEndPct}% { opacity: 0; pointer-events: none; }
    100% { opacity: 0; pointer-events: none; }
  }
  .title-overlay h1 { font-size: 48px; color: ${theme.textColor}; margin-bottom: 12px; text-align: center; }
  .title-overlay p { font-size: 22px; color: ${theme.subtextColor}; text-align: center; }

  /* Screen slides */
  .screen-slide {
    position: absolute; z-index: 5;
    top: 5%; left: 5%; width: 90%; height: 75%;
    opacity: 0;
  }
  .screen-slide img {
    width: 100%; height: 100%;
    object-fit: contain;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  }

  .screen-label {
    position: absolute; z-index: 10;
    bottom: 8%; left: 0; width: 100%;
    text-align: center;
    font-size: 28px; font-weight: 700; color: #fff;
    text-shadow: 0 2px 8px rgba(0,0,0,0.7);
    opacity: 0;
  }

  /* CTA */
  .cta-overlay {
    position: absolute; z-index: 30;
    top: 0; left: 0; width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    background: ${theme.titleBg};
    opacity: 0;
    animation: ctaFade ${totalAnimDuration}s ease-in-out forwards;
  }
  @keyframes ctaFade {
    0%, ${ctaStartPct - 1}% { opacity: 0; }
    ${ctaStartPct + 1}% { opacity: 1; }
    100% { opacity: 1; }
  }
  .cta-overlay .cta-button {
    padding: 18px 48px; font-size: 28px; font-weight: 700;
    color: ${theme.textColor}; background: linear-gradient(135deg, ${theme.ctaGradient[0]}, ${theme.ctaGradient[1]});
    border: none; border-radius: 12px;
    box-shadow: 0 4px 24px ${theme.ctaGradient[0]}66;
    animation: ctaPulse 1.2s ease-in-out infinite alternate;
  }
  @keyframes ctaPulse { from { transform: scale(1); } to { transform: scale(1.06); } }

  .progress-bar {
    position: absolute; z-index: 40; bottom: 0; left: 0;
    height: 4px;
    background: linear-gradient(90deg, ${theme.progressGradient[0]}, ${theme.progressGradient[1]}, ${theme.progressGradient[2]});
    animation: progress ${totalAnimDuration}s linear forwards;
  }
  @keyframes progress { from { width: 0%; } to { width: 100%; } }

  ${screenStyles}
  ${options.watermark ? buildWatermarkCss() : ''}
</style>
</head>
<body>

  <div class="viewport-scaler">

  <div class="title-overlay">
    <h1>${escapeHtml(projectName)}</h1>
    <p>${isRtl ? 'סקירת מסכים' : 'Screen Overview'}</p>
  </div>

  ${screenDivs}

  <div class="cta-overlay">
    <button class="cta-button">${ctaLabel}</button>
  </div>

  <div class="progress-bar"></div>

  ${options.watermark ? buildWatermarkHtml() : ''}

  </div>

</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Build demo / gallery page
// ---------------------------------------------------------------------------

function buildDemoPageHtml(videos: VideoResult[]): string {
  let cards = '';
  videos.forEach((v) => {
    const thumbRel = path.basename(v.thumbnailPath);
    const videoRel = path.basename(v.videoPath);
    cards += `
      <div class="card">
        <a href="${videoRel}" target="_blank">
          <img src="${thumbRel}" alt="${escapeHtml(v.screenName)}" class="thumb"/>
        </a>
        <div class="card-body">
          <h3>${escapeHtml(v.screenName)}</h3>
          <span class="badge">${v.duration}s</span>
          <a href="${videoRel}" target="_blank" class="play-btn">Play</a>
        </div>
      </div>`;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>ExplainIt - Video Gallery</title>
<meta property="og:title" content="ExplainIt Video Gallery" />
<meta property="og:description" content="Step-by-step explainer videos — generated by ExplainIt" />
<meta property="og:type" content="website" />
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    background: #111122;
    color: #eee;
    padding: 40px 20px;
  }
  h1 { text-align: center; margin-bottom: 8px; font-size: 36px; }
  .subtitle { text-align: center; color: #888; margin-bottom: 40px; font-size: 16px; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 24px;
    max-width: 1200px;
    margin: 0 auto;
  }
  .card {
    background: #1a1a2e;
    border-radius: 12px;
    overflow: hidden;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .card:hover, .card:active { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
  .thumb {
    width: 100%;
    height: 180px;
    object-fit: cover;
    display: block;
    background: #0d0d1a;
  }
  .card-body {
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 44px;
  }
  .card-body h3 { flex: 1; font-size: 16px; }
  .badge {
    background: #333;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 12px;
    color: #aaa;
  }
  .play-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
    padding: 6px 16px;
    background: linear-gradient(135deg, #ff4444, #ff8800);
    color: #fff;
    text-decoration: none;
    border-radius: 6px;
    font-weight: 600;
    font-size: 14px;
  }
  .play-btn:hover, .play-btn:active { opacity: 0.9; }
  @media (hover: none) {
    .card:active { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
    .play-btn:active { opacity: 0.85; }
  }
  .whatsapp-share {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin: 48px auto 24px;
    padding: 14px 32px;
    min-height: 48px;
    background: #25D366;
    color: #fff;
    font-size: 18px;
    font-weight: 700;
    border: none;
    border-radius: 12px;
    text-decoration: none;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(37,211,102,0.3);
    transition: opacity 0.2s;
  }
  .whatsapp-share:hover, .whatsapp-share:active { opacity: 0.9; }
  .whatsapp-share svg { flex-shrink: 0; }
</style>
</head>
<body>
  <h1>ExplainIt Videos</h1>
  <p class="subtitle">Click a thumbnail or Play to view the animated explainer</p>
  <div class="grid">
    ${cards}
  </div>
  <div style="text-align:center;">
    <a class="whatsapp-share" href="#" onclick="window.open('https://api.whatsapp.com/send?text='+encodeURIComponent('Check out this ExplainIt video gallery! '+window.location.href),'_blank');return false;"
      <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      Share on WhatsApp
    </a>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// VideoProducer class
// ---------------------------------------------------------------------------

export class VideoProducer {
  /**
   * Generate an animated explainer video (HTML) for a single screen.
   */
  async generateVideo(
    screen: ScreenInfo,
    options?: VideoOptions,
  ): Promise<VideoResult> {
    const opts = resolveOptions(options);
    const outputDir = path.resolve(opts.outputDir);
    await ensureDir(outputDir);

    const id = randomUUID();
    const safeScreenName = screen.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const videoFileName = `${safeScreenName}_${id.slice(0, 8)}.html`;
    const thumbFileName = `${safeScreenName}_${id.slice(0, 8)}_thumb.svg`;
    const videoPath = path.join(outputDir, videoFileName);
    const thumbnailPath = path.join(outputDir, thumbFileName);

    // Copy screenshot into output dir so relative paths work
    const screenshotDest = path.join(outputDir, path.basename(screen.screenshotPath));
    try {
      await fs.copyFile(path.resolve(screen.screenshotPath), screenshotDest);
    } catch {
      // If copy fails (file may already exist or same path), proceed anyway
    }

    // Build and write HTML animation
    const html = buildScreenAnimationHtml(screen, opts);
    await fs.writeFile(videoPath, html, 'utf-8');

    // Generate thumbnail
    await generateThumbnail(screen.screenshotPath, thumbnailPath, screen.name, opts.width, opts.height);

    return {
      id,
      screenId: screen.id,
      screenName: screen.name,
      videoPath,
      thumbnailPath,
      duration: opts.duration,
      format: 'html',
    };
  }

  /**
   * Generate an overview video that shows a montage of all screens.
   */
  async generateOverviewVideo(
    screens: ScreenInfo[],
    projectName: string,
    options?: VideoOptions,
  ): Promise<VideoResult> {
    const opts = resolveOptions(options);
    // Overview videos are a bit longer by default
    const overviewDuration = Math.max(opts.duration, screens.length * 4 + 4);
    const adjustedOpts = { ...opts, duration: overviewDuration };
    const outputDir = path.resolve(opts.outputDir);
    await ensureDir(outputDir);

    const id = randomUUID();
    const videoFileName = `overview_${id.slice(0, 8)}.html`;
    const thumbFileName = `overview_${id.slice(0, 8)}_thumb.svg`;
    const videoPath = path.join(outputDir, videoFileName);
    const thumbnailPath = path.join(outputDir, thumbFileName);

    // Copy all screenshots into output dir
    for (const screen of screens) {
      const dest = path.join(outputDir, path.basename(screen.screenshotPath));
      try {
        await fs.copyFile(path.resolve(screen.screenshotPath), dest);
      } catch {
        // Proceed if copy fails
      }
    }

    const html = buildOverviewAnimationHtml(screens, projectName, adjustedOpts);
    await fs.writeFile(videoPath, html, 'utf-8');

    // Thumbnail from first screen
    const firstScreenshot = screens.length > 0 ? screens[0].screenshotPath : '';
    if (firstScreenshot) {
      await generateThumbnail(firstScreenshot, thumbnailPath, projectName, opts.width, opts.height);
    } else {
      // Fallback: simple SVG placeholder
      const tw = Math.round(opts.width / 4);
      const th = Math.round(opts.height / 4);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="${th}">
        <rect width="100%" height="100%" fill="#1a1a2e"/>
        <text x="${tw / 2}" y="${th / 2}" font-family="Arial" font-size="18" fill="#fff" text-anchor="middle" dominant-baseline="middle">${escapeHtml(projectName)}</text>
      </svg>`;
      await fs.writeFile(thumbnailPath, svg, 'utf-8');
    }

    return {
      id,
      screenId: 'overview',
      screenName: `${projectName} Overview`,
      videoPath,
      thumbnailPath,
      duration: overviewDuration,
      format: 'html',
    };
  }

  /**
   * Generate a demo gallery page that embeds all videos as clickable cards.
   * Returns the absolute path to the generated index.html.
   */
  async generateDemoPage(
    videos: VideoResult[],
    outputDir?: string,
  ): Promise<string> {
    const resolvedDir = path.resolve(outputDir ?? DEFAULT_OUTPUT_DIR);
    await ensureDir(resolvedDir);

    const indexPath = path.join(resolvedDir, 'index.html');
    const html = buildDemoPageHtml(videos);
    await fs.writeFile(indexPath, html, 'utf-8');

    return indexPath;
  }
}
