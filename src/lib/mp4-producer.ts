/**
 * MP4 Producer — full narrated avatar video pipeline.
 *
 * Flow:
 *   1. Capture screenshots of the target URL using fixed step navigation
 *   2. Generate voiceover audio via ElevenLabs TTS
 *   3. Generate AI avatar video via HeyGen v2
 *   4. Stitch everything together with ffmpeg → final MP4
 *      Step A: Each PNG → labeled slide MP4 (4s, drawtext label, cursor overlay, red arrow)
 *      Step B: CTA slide (black bg, Hebrew + English text)
 *      Step C: Concat all slide MP4s
 *      Step D: Merge audio → -c:v copy -c:a aac -shortest → final.mp4
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

// ── Spotlight circle PNG (generated once, reused across runs) ──────────────
// 120×120 RGBA — gold ring (#FFD700), radius 55, linewidth 4
const SPOTLIGHT_PNG_PATH = path.resolve(OUTPUT_ROOT, 'spotlight.png');

// ── Windows font paths for drawtext ────────────────────────────────────────
const FONT_ARIAL  = 'C\\:/Windows/Fonts/arial.ttf';   // Latin
const FONT_DAVID  = 'C\\:/Windows/Fonts/david.ttf';   // Hebrew (David)

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

// ── Cursor/arrow positions [x, y] per slide on 1280x720 ────────────────────
// Coordinates confirmed from actual screenshot inspection:
// screen_000: upload dropzone at left panel, center ~x:140,y:190
// screen_001: image preview loaded, "Image loaded" status text at ~x:780,y:231
// screen_002: "Remove Background" button highlighted in left sidebar ~x:140,y:390
// screen_003: big green "Run Market Research" button center ~x:780,y:334
// screen_004: market research results panel, top of results ~x:780,y:300
// screen_005: Usage Dashboard header area ~x:640,y:178
const CURSOR_POSITIONS: [number, number][] = [
  [140, 190],  // Step 1: dropzone upload area (left panel center)
  [780, 231],  // Step 2: "Image loaded" status indicator (right panel)
  [140, 390],  // Step 3: "Remove Background" button (left sidebar)
  [780, 334],  // Step 4: "Run Market Research" green button (right panel)
  [780, 300],  // Step 5: market research results top area
  [640, 178],  // Step 6: Usage Dashboard stats area
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

/**
 * Ensure spotlight.png exists at OUTPUT_ROOT/spotlight.png.
 * 120×120 RGBA — gold ring (#FFD700), radius 55, stroke 4px.
 * Used as a professional "Apple-style" annotation circle overlay.
 */
async function ensureSpotlightPng(): Promise<string> {
  try {
    const stat = await fs.stat(SPOTLIGHT_PNG_PATH);
    if (stat.size > 100) return SPOTLIGHT_PNG_PATH;
  } catch { /* will create below */ }

  await ensureDir(path.dirname(SPOTLIGHT_PNG_PATH));

  // Write Python script to a temp file to avoid inline escaping issues
  const tmpScript = path.join(path.dirname(SPOTLIGHT_PNG_PATH), '_make_spotlight.py');
  const outPathForPython = SPOTLIGHT_PNG_PATH.replace(/\\/g, '/');

  const pythonScript = [
    'import struct, zlib, os, math',
    'W, H = 120, 120',
    'CX, CY = 60, 60',
    'RADIUS, STROKE = 52, 4',
    'R_COLOR, G_COLOR, B_COLOR = 255, 215, 0',
    'raw_rows = []',
    'for y in range(H):',
    '    row = []',
    '    for x in range(W):',
    '        dist = math.sqrt((x-CX)**2+(y-CY)**2)',
    '        if abs(dist-RADIUS) <= STROKE/2:',
    '            edge_dist = abs(dist-RADIUS)',
    '            alpha = int(255*max(0,1-edge_dist/(STROKE/2+1)))',
    '            row.extend([R_COLOR,G_COLOR,B_COLOR,alpha])',
    '        else:',
    '            row.extend([0,0,0,0])',
    '    raw_rows.append(bytes([0]+row))',
    'def chunk(name,data):',
    '    c=name+data',
    '    return struct.pack(">I",len(data))+c+struct.pack(">I",zlib.crc32(c)&0xffffffff)',
    `sig=b'\\x89PNG\\r\\n\\x1a\\n'`,
    'ihdr=chunk(b"IHDR",struct.pack(">II",W,H)+bytes([8,6,0,0,0]))',
    'idat=chunk(b"IDAT",zlib.compress(b"".join(raw_rows),9))',
    'iend=chunk(b"IEND",b"")',
    'png_data=sig+ihdr+idat+iend',
    `out_path="${outPathForPython}"`,
    'os.makedirs(os.path.dirname(out_path),exist_ok=True)',
    'open(out_path,"wb").write(png_data)',
    'print(len(png_data))',
  ].join('\n');

  await fs.writeFile(tmpScript, pythonScript, 'utf-8');
  const { stdout } = await execAsync(`python3 "${tmpScript}"`, { timeout: 15_000 });
  await fs.unlink(tmpScript).catch(() => {});
  console.log('[mp4-producer] spotlight.png created, bytes:', stdout.trim());
  return SPOTLIGHT_PNG_PATH;
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

    // ── 5. Screenshot: trigger Remove Background, wait for result ────────
    if (results.length < maxScreenshots && imageUploaded) {
      try {
        // Click "Remove Background" in the left sidebar action list
        const rmBtn = page.locator('button:has-text("Remove Background")').first();
        if (await rmBtn.isEnabled({ timeout: 3_000 }).catch(() => false)) {
          await rmBtn.click();
          console.log('[mp4-producer] Clicked Remove Background, waiting for result...');
          // Wait up to 15s for BG removal to complete — look for result image or changed state
          await page.waitForTimeout(10_000);
          const ss2Path = path.join(outputDir, 'screen_002.png');
          await page.screenshot({ path: ss2Path, fullPage: false });
          results.push({ filePath: ss2Path, label: STEP_LABELS[2] });
          console.log('[mp4-producer] ss2: bg removed result captured');
        }
      } catch (err) {
        console.warn('[mp4-producer] Remove BG screenshot failed:', err);
      }
    }

    // ── 6. Screenshot: Market Research settings panel, then run it ────────
    if (results.length < maxScreenshots && imageUploaded) {
      try {
        // Click Market Research in the left sidebar — this opens the settings panel
        const mktBtn = page.locator('button:has-text("Market Research")').first();
        if (await mktBtn.isEnabled({ timeout: 3_000 }).catch(() => false)) {
          await mktBtn.click();
          await page.waitForTimeout(1_500);
          // Screenshot the settings panel (shows "Run Market Research" green button)
          const ss3Path = path.join(outputDir, 'screen_003.png');
          await page.screenshot({ path: ss3Path, fullPage: false });
          results.push({ filePath: ss3Path, label: STEP_LABELS[3] });
          console.log('[mp4-producer] ss3: market research settings panel');

          // Now click the green "Run Market Research" action button in the right panel
          if (results.length < maxScreenshots) {
            const runBtn = page.locator('button:has-text("Run Market Research")').first();
            if (await runBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
              await runBtn.click();
              console.log('[mp4-producer] Clicked Run Market Research, waiting for results...');
              // Wait up to 20s for market research API to return results
              await page.waitForTimeout(20_000);
            } else {
              // Fallback: wait without clicking
              await page.waitForTimeout(15_000);
            }
            const ss4Path = path.join(outputDir, 'screen_004.png');
            await page.screenshot({ path: ss4Path, fullPage: false });
            results.push({ filePath: ss4Path, label: STEP_LABELS[4] });
            console.log('[mp4-producer] ss4: market research results captured');
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
      model_id: 'eleven_v3',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.85,
        style: 0.4,
        use_speaker_boost: true,
      },
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

// ── Step 4: ffmpeg stitching ──────────────────────────────────────────────────
//
//  Step A: PNG → per-slide MP4 with:
//            - drawtext label (bottom, semi-transparent box)
//            - red arrow indicator (drawbox simulated arrow above cursor point)
//            - cursor.png overlay at cursor position
//  Step B: CTA slide (black bg, Hebrew + English text, gold URL)
//  Step C: Concat all slide MP4s → slides_all.mp4
//  Step D: Merge audio → -c:v copy -c:a aac -shortest → final.mp4

async function stitchWithFfmpeg(opts: {
  slides: { filePath: string; label: string }[];
  audioPath: string | null;
  avatarPath: string | null;
  outputPath: string;
  spotlightPngPath: string | null;
}): Promise<void> {
  const { slides, audioPath, avatarPath, outputPath, spotlightPngPath } = opts;

  if (slides.length === 0) {
    throw new Error('No screenshots to stitch');
  }

  const outDir = path.dirname(outputPath);
  const slidePaths: string[] = [];

  // ── Fix C: Calculate per-slide durations, extending last slide if audio is longer ──
  // Total slide budget = screenshotCount × 4s + 1 CTA × 4s
  // If audio runs longer, extend the last screenshot slide to fill the gap.
  const totalBaseDuration = (slides.length + 1) * SLIDE_DURATION_SEC; // +1 for CTA
  let audioDurationSec = 0;
  if (audioPath) {
    try {
      const { stdout: durOut } = await execAsync(
        `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${ffmpegEscapePath(audioPath)}"`,
        { timeout: 10_000 },
      );
      audioDurationSec = parseFloat(durOut.trim()) || 0;
      console.log(`[mp4-producer] Audio duration: ${audioDurationSec.toFixed(2)}s, slide budget: ${totalBaseDuration}s`);
    } catch {
      console.warn('[mp4-producer] Could not probe audio duration, using base slide durations');
    }
  }

  // Extra seconds needed on the last screenshot slide (never negative)
  const extraSec = Math.max(0, Math.ceil(audioDurationSec - totalBaseDuration));
  if (extraSec > 0) {
    console.log(`[mp4-producer] Extending last slide by ${extraSec}s to match audio`);
  }

  // ── Step A: Create one labeled MP4 per screenshot ──────────────────────
  for (let i = 0; i < slides.length; i++) {
    const { filePath, label } = slides[i];
    const slideOut = path.join(outDir, `slide_${String(i).padStart(3, '0')}.mp4`);
    const escapedIn = ffmpegEscapePath(filePath);
    const escapedOut = ffmpegEscapePath(slideOut);
    const safeLabel = escapeDrawtext(label);

    // Last screenshot slide gets extra time if audio exceeds slide budget
    const slideDur = (i === slides.length - 1)
      ? SLIDE_DURATION_SEC + extraSec
      : SLIDE_DURATION_SEC;

    // Spotlight position: center the 120x120 circle PNG on the point of interest
    const [cx, cy] = CURSOR_POSITIONS[i] ?? [640, 360];
    const spotX = cx - 60;  // offset so circle is centered on target
    const spotY = cy - 60;

    // Drawtext label at bottom — white bold on dark box
    const drawtext = [
      `text='${safeLabel}'`,
      `fontfile='${FONT_ARIAL}'`,
      `fontcolor=white`,
      `fontsize=28`,
      `box=1`,
      `boxcolor=black@0.7`,
      `boxborderw=12`,
      `x=(w-text_w)/2`,
      `y=h-th-20`,
    ].join(':');

    let slideCmd: string;

    const useSpotlight = spotlightPngPath !== null;
    const escapedSpotlight = spotlightPngPath ? ffmpegEscapePath(spotlightPngPath) : '';

    if (useSpotlight) {
      // Professional spotlight: scale+pad → drawtext label → overlay gold circle ring
      slideCmd = [
        'ffmpeg -y',
        `-loop 1 -i "${escapedIn}"`,
        `-i "${escapedSpotlight}"`,
        `-filter_complex`,
        `"[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,drawtext=${drawtext}[base];[1:v]format=rgba[ring];[base][ring]overlay=x=${spotX}:y=${spotY}[out]"`,
        `-map "[out]"`,
        `-t ${slideDur}`,
        `-c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p`,
        `-r 25`,
        `"${escapedOut}"`,
      ].join(' ');
    } else {
      // Fallback: scale+pad + drawtext only (no annotation)
      slideCmd = [
        'ffmpeg -y',
        `-loop 1 -i "${escapedIn}"`,
        `-vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,drawtext=${drawtext}"`,
        `-t ${slideDur}`,
        `-c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p`,
        `-r 25`,
        `"${escapedOut}"`,
      ].join(' ');
    }

    console.log(`[mp4-producer] Slide ${i} dur=${slideDur}s (${cx},${cy}):`, slideCmd.slice(0, 120) + '...');
    try {
      const { stderr } = await execAsync(slideCmd, { timeout: 120_000 });
      if (stderr) console.log(`[mp4-producer] slide ${i} stderr:`, stderr.slice(-200));
    } catch (err) {
      // If cursor overlay failed, retry without cursor
      console.warn(`[mp4-producer] Slide ${i} with cursor failed, retrying without:`, (err as Error).message?.slice(0, 120));
      const fallbackCmd = [
        'ffmpeg -y',
        `-loop 1 -i "${escapedIn}"`,
        `-vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,drawtext=${drawtext}"`,
        `-t ${slideDur}`,
        `-c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p`,
        `-r 25`,
        `"${escapedOut}"`,
      ].join(' ');
      const { stderr: fbErr } = await execAsync(fallbackCmd, { timeout: 120_000 });
      if (fbErr) console.log(`[mp4-producer] slide ${i} fallback stderr:`, fbErr.slice(-200));
    }
    slidePaths.push(slideOut);
  }

  // ── Step B: CTA slide (slide_006.mp4) ──────────────────────────────────
  // Hebrew text with David font + English fallback + gold URL line
  const ctaSlideOut = path.join(outDir, `slide_${String(slides.length).padStart(3, '0')}.mp4`);
  const escapedCtaOut = ffmpegEscapePath(ctaSlideOut);

  // Hebrew lines use david.ttf; URL line uses arial.ttf in gold
  const ctaCmd = [
    'ffmpeg -y',
    `-f lavfi -i "color=black:size=1280x720:duration=${SLIDE_DURATION_SEC}"`,
    `-vf "`,
    `drawtext=text='\\u05e0\\u05e1\\u05d5\\u05d5 \\u05d0\\u05ea ftable Analyzer \\u05d7\\u05d9\\u05e0\\u05dd'`,
    `:fontfile='${FONT_DAVID}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=240,`,
    `drawtext=text='5 \\u05e7\\u05e8\\u05d3\\u05d9\\u05d8\\u05d9\\u05dd - \\u05dc\\u05dc\\u05d0 \\u05e6\\u05d5\\u05e8\\u05da \\u05d1\\u05db\\u05e8\\u05d8\\u05d9\\u05e1 \\u05d0\\u05e9\\u05e8\\u05d0\\u05d9'`,
    `:fontfile='${FONT_DAVID}':fontcolor=white:fontsize=28:x=(w-text_w)/2:y=320,`,
    `drawtext=text='Try ftable Analyzer free - 5 credits, no credit card needed'`,
    `:fontfile='${FONT_ARIAL}':fontcolor=white:fontsize=22:x=(w-text_w)/2:y=390,`,
    `drawtext=text='analyzer.ftable.co.il'`,
    `:fontfile='${FONT_ARIAL}':fontcolor=#FFD700:fontsize=34:x=(w-text_w)/2:y=445"`,
    `-c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p -r 25`,
    `"${escapedCtaOut}"`,
  ].join(' ');

  console.log('[mp4-producer] CTA slide cmd:', ctaCmd.slice(0, 150) + '...');
  try {
    const { stderr: ctaErr } = await execAsync(ctaCmd, { timeout: 30_000 });
    if (ctaErr) console.log('[mp4-producer] CTA stderr:', ctaErr.slice(-200));
    slidePaths.push(ctaSlideOut);
    console.log('[mp4-producer] CTA slide created');
  } catch (err) {
    // Hebrew unicode escapes may fail on some builds — fall back to pure English CTA
    console.warn('[mp4-producer] CTA Hebrew failed, using English fallback:', (err as Error).message?.slice(0, 80));
    const ctaFallbackCmd = [
      'ffmpeg -y',
      `-f lavfi -i "color=black:size=1280x720:duration=${SLIDE_DURATION_SEC}"`,
      `-vf "`,
      `drawtext=text='Try ftable Analyzer free today'`,
      `:fontfile='${FONT_ARIAL}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=260,`,
      `drawtext=text='5 credits - no credit card needed'`,
      `:fontfile='${FONT_ARIAL}':fontcolor=white:fontsize=30:x=(w-text_w)/2:y=340,`,
      `drawtext=text='analyzer.ftable.co.il'`,
      `:fontfile='${FONT_ARIAL}':fontcolor=#FFD700:fontsize=36:x=(w-text_w)/2:y=420"`,
      `-c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p -r 25`,
      `"${escapedCtaOut}"`,
    ].join(' ');
    const { stderr: fbErr } = await execAsync(ctaFallbackCmd, { timeout: 30_000 });
    if (fbErr) console.log('[mp4-producer] CTA fallback stderr:', fbErr.slice(-200));
    slidePaths.push(ctaSlideOut);
    console.log('[mp4-producer] CTA fallback slide created');
  }

  // ── Step C: Concat all slides ──────────────────────────────────────────
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

  // ── Step D: Merge audio ────────────────────────────────────────────────
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

  // Estimate target duration: 6 screenshot slides + 1 CTA slide, each 4 seconds
  // Audio is trimmed via -shortest, so actual duration = min(slides, audio)
  const totalSlides = maxScreenshots + 1; // +1 for CTA
  const estimatedSlideDuration = totalSlides * SLIDE_DURATION_SEC;
  const wordCount = script.split(/\s+/).length;
  const audioDuration = Math.round((wordCount / 140) * 60);
  const targetDurationSeconds = Math.max(estimatedSlideDuration, audioDuration);

  // ── Ensure spotlight PNG exists ──────────────────────────────────────────
  let spotlightPngPath: string | null = null;
  try {
    spotlightPngPath = await ensureSpotlightPng();
    console.log('[mp4-producer] Spotlight PNG ready:', spotlightPngPath);
  } catch (err) {
    console.warn('[mp4-producer] Could not create cursor PNG, continuing without:', err);
  }

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
      spotlightPngPath,
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
