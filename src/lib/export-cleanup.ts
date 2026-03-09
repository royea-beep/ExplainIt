/**
 * Export Cleanup — removes old/orphaned export directories.
 *
 * Runs as a lazy singleton on exports API requests.
 * Default retention: 7 days for completed runs.
 */

import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';

const EXPORTS_DIR = path.resolve('exports');
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Run at most once per hour

let lastCleanupAt = 0;

/**
 * Remove export directories older than the retention period.
 * Safe: only removes directories with a report.json (confirmed runs).
 * Skips legacy flat subdirs (screenshots, videos, docs, mockups).
 */
export async function cleanupOldExports(): Promise<{ removed: string[]; errors: string[] }> {
  const now = Date.now();

  // Throttle: don't run more than once per hour
  if (now - lastCleanupAt < CHECK_INTERVAL_MS) {
    return { removed: [], errors: [] };
  }
  lastCleanupAt = now;

  const removed: string[] = [];
  const errors: string[] = [];

  if (!fs.existsSync(EXPORTS_DIR)) return { removed, errors };

  const skipDirs = new Set(['screenshots', 'videos', 'docs', 'mockups']);

  try {
    const entries = await fsp.readdir(EXPORTS_DIR);

    for (const entry of entries) {
      if (skipDirs.has(entry)) continue;

      const entryPath = path.join(EXPORTS_DIR, entry);
      const stat = await fsp.stat(entryPath).catch(() => null);
      if (!stat || !stat.isDirectory()) continue;

      const reportPath = path.join(entryPath, 'report.json');
      const hasReport = fs.existsSync(reportPath);

      // Determine age from report.json generatedAt or directory mtime
      let createdAt = stat.mtimeMs;
      if (hasReport) {
        try {
          const report = JSON.parse(await fsp.readFile(reportPath, 'utf-8'));
          if (report.generatedAt) {
            createdAt = new Date(report.generatedAt).getTime();
          }
        } catch {
          // Use mtime fallback
        }
      }

      const age = now - createdAt;
      if (age > RETENTION_MS) {
        try {
          await fsp.rm(entryPath, { recursive: true, force: true });
          removed.push(entry);
        } catch (err) {
          errors.push(`${entry}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  } catch (err) {
    errors.push(`scan: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (removed.length > 0) {
    console.log(`[export-cleanup] Removed ${removed.length} old export(s): ${removed.join(', ')}`);
  }

  return { removed, errors };
}
