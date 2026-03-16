/**
 * MP4 Producer — full narrated avatar video pipeline.
 *
 * Flow:
 *   1. Capture screenshots of the target URL using fixed step navigation
 *   2. Generate voiceover audio via ElevenLabs TTS
 *   3. Generate AI avatar video via HeyGen v2
 *   4. Stitch everything together with ffmpeg → final MP4
 *      Step A: Each PNG → labeled slide MP4 (4 seconds + drawtext overlay)
 *      Step B: Concat all slide MP4s
 *      Step C: Merge audio with -c:v copy -c:a aac -shortest
 *
 * Graceful degradation:
 *   - If ElevenLabs fails  → silent slideshow
 *   - If HeyGen fails      → narrated slideshow (no avatar)
 *   - If both fail         → silent slideshow
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { acquireContext } from './browser-pool';

const execAsync = promisify(exec);

// ── Output directory (absolute, Windows-safe) ──────────────────────────────
const OUTPUT_ROOT = path.resolve(process.env.EXPORTS_DIR ?? './output');

// ── API endpoints ───────────────────────────────────────────────────────────
const ELEVENLABS_TTS_URL = (voiceId: string) =>
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

const HEYGEN_GENERATE_URL = 'https://api.heygen.com/v2/video/generate';
const HEYGEN_STATUS_URL = (videoId: string) =>
  `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`;

// ── Test product image path (Windows-accessible) ────────────────────────────
const TEST_PRODUCT_IMAGE = path.resolve(process.cwd(), 'test-product.jpg');

// ── Step labels for the 6 analyzer screenshot slides ────────────────────────
const STEP_LABELS = [
  'Step 1: Open ftable Analyzer dashboard',
  'Step 2: Drag & drop your product image',
  'Step 3: AI removes background automatically',
  'Step 4: AI runs deep market research',
  'Step 5: Get descriptions, SEO & pricing instantly',
  'Step 6: All analyses saved in your dashboard',
];

// ── Seconds each slide is shown in the video ────────────────────────────────
const SLIDE_DURATION_SEC = 4;

// ── Types ───────────────────────────────────────────────────────────────────

export interface Mp4ProducerInput {
  /** Target URL to screenshot */
  url: string;
  /** Narration script */
  script: string;
  /** ElevenLabs voice ID */
  voiceId: string;
  /** HeyGen avatar ID */
  avatarId: string;
  /** Absolute path for the output MP4 file */
  outputPath: string;
  /** HeyGen voice ID (defaults to English HeyGen voice) */
  heygenVoiceId?: string;
  /** Max screenshots to capture (default: 6) */
  maxScreenshots?: number;
}

export interface Mp4ProducerResult {
  outputPath: string;
  screenshotPaths: string[];
  hasAudio: boolean;
  hasAvatar: boolean;
  durationSeconds: number;
  errors: string[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

function ffmpegEscapePath(p: string): string {
  // On Windows, forward-slash paths work with ffmpeg; escape spaces with quotes at call site
  return p.replace(/\\/g, '/');
}

/** Escape a label string for ffmpeg drawtext.
 *  Rules:
 *   - Single quotes: replace ' with '\'' (end-quote, literal-quote, re-open-quote)
 *   - Colons: escape as \: (drawtext uses : as option separator)
 *   - Ampersands: escape as \& (safe in shell, avoids any filter-graph ambiguity)
 */
function escapeDrawtext(text: string): string {
  return text
    .replace(/'/g, "'\\''")   // ' → '\''
    .replace(/:/g, '\\:')     // : → \:
    .replace(/&/g, '\\&');    // & → \&
}

/** Poll HeyGen until completed, failed, or timeout */
async function pollHeyGenStatus(
  videoId: string,
  apiKey: string,
  maxWaitMs = 300_000,
  intervalMs = 5_000,
): Promise<string | null> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, intervalMs));
    const res = await fetch(HEYGEN_STATUS_URL(videoId), {
      headers: { 'X-Api-Key': apiKey },
    });
    if (!res.ok) continue;
    const data = await res.json();
    const info = data.data;
    if (info?.status === 'completed' && info.video_url) return info.video_url as string;
    if (info?.status === 'failed') throw new Error(`HeyGen render failed: ${info.error ?? 'unknown'}`);
  }
  throw new Error('HeyGen timed out after 5 minutes');
}

// ── Step 1: Capture screenshots ──────────────────────────────────────────────
//
// For analyzer.ftable.co.il: login with access code, inject a product image via
// the React fiber onChange handler (the only reliable headless approach for this
// React SPA — the DropZone's hidden file input only triggers state via React's
// synthetic onChange, which requires calling the fiber prop directly after
// Playwright's setInputFiles populates .files with real bytes).
//
// For other URLs: generic screenshot crawl (same-origin links).

async function captureScreenshots(
  url: string,
  outputDir: string,
  maxScreenshots: number,
): Promise<{ filePath: string; label: string }[]> {
  const isAnalyzer = url.includes('analyzer.ftable.co.il');

  if (isAnalyzer) {
    return captureAnalyzerScreenshots(outputDir, maxScreenshots);
  }
  return captureGenericScreenshots(url, outputDir, maxScreenshots);
}

/**
 * Capture screenshots of analyzer.ftable.co.il by:
 *   1. Logging in with access code
 *   2. Injecting a product image via React fiber to unlock all action buttons
 *   3. Taking screenshots at each meaningful app state
 */
async function captureAnalyzerScreenshots(
  outputDir: string,
  maxScreenshots: number,
): Promise<{ filePath: string; label: string }[]> {
  const pool = await acquireContext({ width: 1280, height: 720 });
  const results: { filePath: string; label: string }[] = [];

  try {
    const page = await pool.context.newPage();

    // ── 1. Login with access code ─────────────────────────────────────────
    try {
      await page.goto('https://analyzer.ftable.co.il', { waitUntil: 'networkidle', timeout: 30_000 });
    } catch {
      await page.waitForTimeout(3000);
    }
    await page.waitForTimeout(1500);

    const codeInput = page.locator('input[placeholder="Enter your code"]');
    if (await codeInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await codeInput.fill('1234');
      await page.locator('button:has-text("Enter")').click();
      await page.waitForTimeout(3000);
    }
    console.log('[mp4-producer] Logged in, URL:', page.url());

    // ── 2. Screenshot: clean dashboard ───────────────────────────────────
    const ss0Path = path.join(outputDir, 'screen_000.png');
    await page.screenshot({ path: ss0Path, fullPage: false });
    results.push({ filePath: ss0Path, label: STEP_LABELS[0] });
    console.log('[mp4-producer] ss0: dashboard captured');

    if (results.length >= maxScreenshots) {
      await page.close();
      return results;
    }

    // ── 3. Inject product image via React fiber ───────────────────────────
    // Make hidden input accessible, then use Playwright's CDP-backed setInputFiles
    // which properly populates .files with real bytes (unlike evaluate-based File construction).
    // Then call the React onChange prop directly via the fiber chain.
    const productImagePath = TEST_PRODUCT_IMAGE;
    let imageUploaded = false;

    try {
      // Check the test image exists
      await fs.access(productImagePath).catch(async () => {
        // Download a small product image if not present
        const res = await fetch('https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop');
        if (res.ok) {
          const buf = await res.arrayBuffer();
          await fs.writeFile(productImagePath, Buffer.from(buf));
        }
      });

      // Unhide input so Playwright's setInputFiles can reach it
      await page.evaluate(() => {
        const input = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement | null;
        if (input) {
          input.style.cssText = 'display:block!important;position:fixed!important;top:0!important;left:0!important;width:1px!important;height:1px!important;opacity:0.01!important;z-index:99999!important;pointer-events:auto!important';
        }
      });

      const inputLocator = page.locator('input[type="file"][accept="image/*"]');
      await inputLocator.setInputFiles(productImagePath);

      // Verify bytes were populated, then call React onChange via fiber
      const changeResult = await page.evaluate(() => {
        const input = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement | null;
        if (!input || !input.files?.[0] || input.files[0].size === 0) {
          return `size=${input?.files?.[0]?.size ?? 'no file'}`;
        }
        // Walk React fiber to find the onChange handler
        const fiberKey = Object.keys(input as unknown as Record<string, unknown>).find(
          (k: string) => k.startsWith('__reactFiber')
        );
        if (!fiberKey) {
          // Fallback: native change event
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return 'no fiber, dispatched native';
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let fiber = (input as any)[fiberKey];
        while (fiber) {
          const props = fiber.pendingProps || fiber.memoizedProps;
          if (props && typeof props.onChange === 'function') {
            try {
              props.onChange({ target: input, currentTarget: input, type: 'change' });
              return `onChange called via fiber, size=${input.files[0].size}`;
            } catch (e) {
              return `error: ${String(e)}`;
            }
          }
          fiber = fiber.return;
        }
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return 'no onChange in fiber, dispatched native';
      });
      console.log('[mp4-producer] Upload result:', changeResult);

      // Wait for FileReader + canvas processing in DropZone
      await page.waitForTimeout(4000);

      // Check if image preview appeared (confirms React state updated)
      imageUploaded = await page.$('[alt="Uploaded product preview"]').then(el => !!el).catch(() => false);
      console.log('[mp4-producer] Image uploaded to React state:', imageUploaded);
    } catch (err) {
      console.warn('[mp4-producer] Image injection failed:', err);
    }

    // ── 4. Screenshot: image loaded, actions ready ────────────────────────
    if (results.length < maxScreenshots) {
      const ss1Path = path.join(outputDir, 'screen_001.png');
      await page.screenshot({ path: ss1Path, fullPage: false });
      results.push({ filePath: ss1Path, label: STEP_LABELS[1] });
      console.log('[mp4-producer] ss1: image loaded state');
    }

    // ── 5. Screenshot: trigger Remove Background (free action) ───────────
    if (results.length < maxScreenshots && imageUploaded) {
      try {
        const rmBtn = page.locator('button:has-text("Remove Background")').first();
        if (await rmBtn.isEnabled({ timeout: 3_000 }).catch(() => false)) {
          await rmBtn.click();
          await page.waitForTimeout(8_000); // wait for bg removal API
          const ss2Path = path.join(outputDir, 'screen_002.png');
          await page.screenshot({ path: ss2Path, fullPage: false });
          results.push({ filePath: ss2Path, label: STEP_LABELS[2] });
          console.log('[mp4-producer] ss2: bg removed');
        }
      } catch (err) {
        console.warn('[mp4-producer] Remove BG screenshot failed:', err);
      }
    }

    // ── 6. Screenshot: Market Research results ────────────────────────────
    if (results.length < maxScreenshots && imageUploaded) {
      try {
        const mktBtn = page.locator('button:has-text("Market Research")').first();
        if (await mktBtn.isEnabled({ timeout: 3_000 }).catch(() => false)) {
          await mktBtn.click();
          await page.waitForTimeout(2_000);
          const ss3runPath = path.join(outputDir, 'screen_003.png');
          await page.screenshot({ path: ss3runPath, fullPage: false });
          results.push({ filePath: ss3runPath, label: STEP_LABELS[3] });
          console.log('[mp4-producer] ss3: market research running');

          if (results.length < maxScreenshots) {
            await page.waitForTimeout(12_000); // wait for research results
            const ss4Path = path.join(outputDir, 'screen_004.png');
            await page.screenshot({ path: ss4Path, fullPage: false });
            results.push({ filePath: ss4Path, label: STEP_LABELS[4] });
            console.log('[mp4-producer] ss4: market research results');
          }
        }
      } catch (err) {
        console.warn('[mp4-producer] Market Research screenshot failed:', err);
      }
    }

    // ── 7. Screenshot: Dashboard / history ───────────────────────────────
    if (results.length < maxScreenshots) {
      try {
        await page.goto('https://analyzer.ftable.co.il/dashboard', { waitUntil: 'networkidle', timeout: 20_000 });
        await page.waitForTimeout(2_000);
        const ss5Path = path.join(outputDir, 'screen_005.png');
        await page.screenshot({ path: ss5Path, fullPage: false });
        results.push({ filePath: ss5Path, label: STEP_LABELS[5] });
        console.log('[mp4-producer] ss5: dashboard page');
      } catch (err) {
        console.warn('[mp4-producer] Dashboard screenshot failed:', err);
      }
    }

    await page.close();
  } finally {
    await pool.release();
  }

  return results;
}

/** Generic screenshot crawl for non-analyzer URLs */
async function captureGenericScreenshots(
  url: string,
  outputDir: string,
  maxScreenshots: number,
): Promise<{ filePath: string; label: string }[]> {
  const pool = await acquireContext({ width: 1280, height: 720 });
  const results: { filePath: string; label: string }[] = [];

  try {
    const page = await pool.context.newPage();

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    } catch {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    }
    await page.waitForTimeout(2000);

    const origin = new URL(url).origin;
    const links: string[] = await page.evaluate((o: string) => {
      const anchors = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
      const seen = new Set<string>();
      seen.add(o + '/');
      for (const a of anchors) {
        try {
          const u = new URL(a.href);
          if (u.origin === o && !u.hash) seen.add(u.origin + u.pathname);
        } catch { /* skip */ }
      }
      return Array.from(seen);
    }, origin);

    const urlsToVisit = links.slice(0, maxScreenshots);

    for (let i = 0; i < urlsToVisit.length; i++) {
      const targetUrl = urlsToVisit[i];
      try {
        try {
          await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 20_000 });
        } catch {
          await page.waitForTimeout(2000);
        }
        await page.waitForTimeout(1500);
        const screenshotPath = path.join(outputDir, `screen_${String(i).padStart(3, '0')}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        const label = new URL(targetUrl).pathname.replace(/\//g, ' ').trim() || 'Homepage';
        results.push({ filePath: screenshotPath, label });
        console.log(`[mp4-producer] Screenshot ${i}: ${label}`);
      } catch (err) {
        console.warn(`[mp4-producer] Screenshot ${i} failed:`, err);
      }
    }

    await page.close();
  } finally {
    await pool.release();
  }

  return results;
}

// ── Step 2: ElevenLabs TTS ──────────────────────────────────────────────────

async function generateAudio(
  script: string,
  voiceId: string,
  outputPath: string,
): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set');

  const res = await fetch(ELEVENLABS_TTS_URL(voiceId), {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text: script,
      model_id: 'eleven_turbo_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => String(res.status));
    throw new Error(`ElevenLabs TTS failed: ${errText}`);
  }

  const buffer = await res.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(buffer));
}

// ── Step 3: HeyGen avatar video ─────────────────────────────────────────────

async function generateAvatarVideo(
  script: string,
  avatarId: string,
  heygenVoiceId: string,
  outputPath: string,
): Promise<void> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) throw new Error('HEYGEN_API_KEY is not set');

  // Submit generation job
  const submitRes = await fetch(HEYGEN_GENERATE_URL, {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_inputs: [{
        character: { type: 'avatar', avatar_id: avatarId, avatar_style: 'normal' },
        voice: { type: 'text', input_text: script, voice_id: heygenVoiceId },
        background: { type: 'color', value: '#0a0a0f' },
      }],
      dimension: { width: 400, height: 400 },
    }),
  });

  if (!submitRes.ok) {
    const err = await submitRes.json().catch(() => ({ error: { message: String(submitRes.status) } }));
    throw new Error(err?.error?.message ?? `HeyGen submit failed: ${submitRes.status}`);
  }

  const submitData = await submitRes.json();
  const videoId: string | undefined = submitData.data?.video_id;
  if (!videoId) throw new Error('No video_id returned from HeyGen');

  // Poll for completion
  const videoUrl = await pollHeyGenStatus(videoId, apiKey);
  if (!videoUrl) throw new Error('HeyGen did not return a video URL');

  // Download the avatar video
  const downloadRes = await fetch(videoUrl);
  if (!downloadRes.ok) throw new Error(`Failed to download HeyGen video: ${downloadRes.status}`);
  const buffer = await downloadRes.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(buffer));
}

// ── Step 4: ffmpeg stitching (3-step pipeline) ───────────────────────────────
//
//  Step A: PNG → per-slide MP4 with drawtext label (4 seconds each)
//  Step B: concat all slide MP4s → slides_all.mp4
//  Step C: merge audio → -c:v copy -c:a aac -shortest → final.mp4

async function stitchWithFfmpeg(opts: {
  slides: { filePath: string; label: string }[];
  audioPath: string | null;
  avatarPath: string | null;
  outputPath: string;
}): Promise<void> {
  const { slides, audioPath, avatarPath, outputPath } = opts;

  if (slides.length === 0) {
    throw new Error('No screenshots to stitch');
  }

  const outDir = path.dirname(outputPath);
  const slidePaths: string[] = [];

  // ── Step A: Create one labeled MP4 per screenshot ──────────────────────
  for (let i = 0; i < slides.length; i++) {
    const { filePath, label } = slides[i];
    const slideOut = path.join(outDir, `slide_${String(i).padStart(3, '0')}.mp4`);
    const escapedIn = ffmpegEscapePath(filePath);
    const escapedOut = ffmpegEscapePath(slideOut);
    const safeLabel = escapeDrawtext(label);

    const drawtext = [
      `text='${safeLabel}'`,
      `fontcolor=white`,
      `fontsize=32`,
      `box=1`,
      `boxcolor=black@0.6`,
      `boxborderw=15`,
      `x=(w-text_w)/2`,
      `y=h-th-30`,
    ].join(':');

    const slideCmd = [
      'ffmpeg -y',
      `-loop 1 -i "${escapedIn}"`,
      `-vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,drawtext=${drawtext}"`,
      `-t ${SLIDE_DURATION_SEC}`,
      `-c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p`,
      `-r 25`,
      `"${escapedOut}"`,
    ].join(' ');

    console.log(`[mp4-producer] Slide ${i}: ${slideCmd}`);
    const { stderr } = await execAsync(slideCmd, { timeout: 60_000 });
    if (stderr) console.log(`[mp4-producer] slide ${i} stderr:`, stderr.slice(-300));
    slidePaths.push(slideOut);
  }

  // ── Step B: Concat all slides ──────────────────────────────────────────
  const concatListPath = path.join(outDir, 'concat.txt');
  const concatContent = slidePaths
    .map(p => `file '${ffmpegEscapePath(p)}'`)
    .join('\n');
  await fs.writeFile(concatListPath, concatContent + '\n');

  const slidesAllPath = path.join(outDir, 'slides_all.mp4');
  const escapedConcat = ffmpegEscapePath(concatListPath);
  const escapedSlidesAll = ffmpegEscapePath(slidesAllPath);

  const concatCmd = [
    'ffmpeg -y',
    `-f concat -safe 0 -i "${escapedConcat}"`,
    `-c copy`,
    `"${escapedSlidesAll}"`,
  ].join(' ');

  console.log('[mp4-producer] Concat cmd:', concatCmd);
  const { stderr: concatStderr } = await execAsync(concatCmd, { timeout: 60_000 });
  if (concatStderr) console.log('[mp4-producer] concat stderr:', concatStderr.slice(-300));

  // ── Step C: Merge audio ────────────────────────────────────────────────
  const escapedOutput = ffmpegEscapePath(outputPath);

  let finalCmd: string;

  if (avatarPath && audioPath) {
    // Full: slides + audio + avatar overlay in bottom-right corner
    const escapedAudio = ffmpegEscapePath(audioPath);
    const escapedAvatar = ffmpegEscapePath(avatarPath);
    finalCmd = [
      'ffmpeg -y',
      `-i "${escapedSlidesAll}"`,
      `-i "${escapedAudio}"`,
      `-i "${escapedAvatar}"`,
      `-filter_complex "[2:v]scale=320:320[av];[0:v][av]overlay=W-w-20:H-h-20[out]"`,
      `-map "[out]" -map 1:a`,
      `-c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p`,
      `-c:a aac -b:a 128k`,
      `-shortest`,
      `-movflags +faststart`,
      `"${escapedOutput}"`,
    ].join(' ');
  } else if (audioPath) {
    // Narrated slideshow — no avatar
    // Fix 1: use -c:v copy so the video stream is not re-encoded,
    //         and -c:a aac -shortest to properly mux the audio track.
    const escapedAudio = ffmpegEscapePath(audioPath);
    finalCmd = [
      'ffmpeg -y',
      `-i "${escapedSlidesAll}"`,
      `-i "${escapedAudio}"`,
      `-c:v copy`,
      `-c:a aac -b:a 128k`,
      `-shortest`,
      `-movflags +faststart`,
      `"${escapedOutput}"`,
    ].join(' ');
  } else {
    // Silent slideshow — just copy
    finalCmd = [
      'ffmpeg -y',
      `-i "${escapedSlidesAll}"`,
      `-c copy`,
      `-movflags +faststart`,
      `"${escapedOutput}"`,
    ].join(' ');
  }

  console.log('[mp4-producer] Final merge cmd:', finalCmd);
  const { stderr: finalStderr } = await execAsync(finalCmd, { timeout: 120_000 });
  if (finalStderr) console.log('[mp4-producer] final merge stderr:', finalStderr.slice(-500));

  // Cleanup intermediates
  await fs.unlink(concatListPath).catch(() => {});
  for (const sp of slidePaths) await fs.unlink(sp).catch(() => {});
  await fs.unlink(slidesAllPath).catch(() => {});
}

// ── Main export ─────────────────────────────────────────────────────────────

export async function produceMP4(input: Mp4ProducerInput): Promise<Mp4ProducerResult> {
  const {
    url,
    script,
    voiceId,
    avatarId,
    outputPath,
    heygenVoiceId = '2d5b0e6cf36f460aa7fc47e3eee4ba54', // HeyGen default English voice
    maxScreenshots = 6,
  } = input;

  const errors: string[] = [];

  // Ensure output directory exists
  const outDir = path.dirname(outputPath);
  await ensureDir(outDir);
  await ensureDir(OUTPUT_ROOT);

  const audioPath = path.join(outDir, 'audio.mp3');
  const avatarPath = path.join(outDir, 'avatar.mp4');

  // Estimate target duration from number of slides × 4 seconds
  // (actual duration is driven by slide count, audio is trimmed via -shortest)
  const estimatedSlideDuration = maxScreenshots * SLIDE_DURATION_SEC;
  const wordCount = script.split(/\s+/).length;
  const audioDuration = Math.round((wordCount / 140) * 60);
  const targetDurationSeconds = Math.max(estimatedSlideDuration, audioDuration);

  // ── Stage 1: Screenshots ────────────────────────────────────────────────
  const screenshotDir = path.join(outDir, 'screenshots');
  await ensureDir(screenshotDir);

  let slides: { filePath: string; label: string }[] = [];
  try {
    slides = await captureScreenshots(url, screenshotDir, maxScreenshots);
    console.log(`[mp4-producer] Captured ${slides.length} screenshots`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Screenshot capture failed: ${msg}`);
  }

  if (slides.length === 0) {
    errors.push('No screenshots captured — cannot produce video');
    return { outputPath, screenshotPaths: [], hasAudio: false, hasAvatar: false, durationSeconds: 0, errors };
  }

  const screenshotPaths = slides.map(s => s.filePath);

  // ── Stage 2: ElevenLabs audio ───────────────────────────────────────────
  let hasAudio = false;
  try {
    await generateAudio(script, voiceId, audioPath);
    hasAudio = true;
    console.log('[mp4-producer] Audio generated:', audioPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`ElevenLabs TTS failed (continuing without audio): ${msg}`);
    console.warn('[mp4-producer] ElevenLabs failed:', msg);
  }

  // ── Stage 3: HeyGen avatar ──────────────────────────────────────────────
  let hasAvatar = false;
  try {
    await generateAvatarVideo(script, avatarId, heygenVoiceId, avatarPath);
    hasAvatar = true;
    console.log('[mp4-producer] Avatar video generated:', avatarPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`HeyGen avatar failed (continuing without avatar): ${msg}`);
    console.warn('[mp4-producer] HeyGen failed:', msg);
  }

  // ── Stage 4: ffmpeg stitch ──────────────────────────────────────────────
  try {
    await stitchWithFfmpeg({
      slides,
      audioPath: hasAudio ? audioPath : null,
      avatarPath: hasAvatar ? avatarPath : null,
      outputPath,
    });
    console.log('[mp4-producer] Final MP4 written:', outputPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`ffmpeg stitch failed: ${msg}`);
    return { outputPath, screenshotPaths, hasAudio, hasAvatar, durationSeconds: targetDurationSeconds, errors };
  }

  return {
    outputPath,
    screenshotPaths,
    hasAudio,
    hasAvatar,
    durationSeconds: targetDurationSeconds,
    errors,
  };
}
