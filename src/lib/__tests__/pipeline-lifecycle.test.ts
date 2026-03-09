import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { Pipeline, type PipelineInput } from '../pipeline';

describe('pipeline export isolation', () => {
  it('should write outputs to the specified exportDir', async () => {
    const exportDir = path.join(process.cwd(), 'exports', `test_${Date.now()}`);

    // Create a minimal pipeline run that will fail at capture (no real URL)
    // but should still create the directory structure
    const pipeline = new Pipeline();
    const input: PipelineInput = {
      type: 'url',
      value: 'http://localhost:19999', // will fail to connect — that's OK
      exportDir,
    };

    const result = await pipeline.run(input);

    // Pipeline should have created the export directory structure
    const screenshotsDir = path.join(exportDir, 'screenshots');
    const videosDir = path.join(exportDir, 'videos');
    const docsDir = path.join(exportDir, 'docs');

    const [ssExists, vidExists, docsExists] = await Promise.all([
      fs.stat(screenshotsDir).then(() => true).catch(() => false),
      fs.stat(videosDir).then(() => true).catch(() => false),
      fs.stat(docsDir).then(() => true).catch(() => false),
    ]);

    expect(ssExists).toBe(true);
    expect(vidExists).toBe(true);
    expect(docsExists).toBe(true);

    // The result should be an error (can't connect) but the dirs exist
    expect(result.status).toBe('error');

    // Cleanup
    await fs.rm(exportDir, { recursive: true, force: true });
  });

  it('should use default exports/ when no exportDir specified', async () => {
    const pipeline = new Pipeline();
    const input: PipelineInput = {
      type: 'url',
      value: 'http://localhost:19999',
      // no exportDir — should default to exports/
    };

    const result = await pipeline.run(input);
    expect(result.status).toBe('error'); // expected — no server

    // Default exports/ dirs should exist
    const defaultDir = path.resolve('exports');
    const exists = await fs.stat(defaultDir).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('two pipelines with different exportDirs should not conflict', async () => {
    const dir1 = path.join(process.cwd(), 'exports', `test_a_${Date.now()}`);
    const dir2 = path.join(process.cwd(), 'exports', `test_b_${Date.now()}`);

    const p1 = new Pipeline();
    const p2 = new Pipeline();

    // Run both concurrently — they should not interfere
    const [r1, r2] = await Promise.all([
      p1.run({ type: 'url', value: 'http://localhost:19998', exportDir: dir1 }),
      p2.run({ type: 'url', value: 'http://localhost:19997', exportDir: dir2 }),
    ]);

    // Both should fail (no server) but have separate dirs
    expect(r1.status).toBe('error');
    expect(r2.status).toBe('error');

    const [d1Exists, d2Exists] = await Promise.all([
      fs.stat(path.join(dir1, 'screenshots')).then(() => true).catch(() => false),
      fs.stat(path.join(dir2, 'screenshots')).then(() => true).catch(() => false),
    ]);
    expect(d1Exists).toBe(true);
    expect(d2Exists).toBe(true);

    // Cleanup
    await Promise.all([
      fs.rm(dir1, { recursive: true, force: true }),
      fs.rm(dir2, { recursive: true, force: true }),
    ]);
  });
});
