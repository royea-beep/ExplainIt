import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pipeline } from '../pipeline';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';

let server: http.Server;
let serverUrl: string;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    if (req.url === '/' || req.url === '/index.html') {
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Demo App</title></head>
        <body style="background:#f5f5f5; padding:20px;">
          <nav style="background:#333; color:white; padding:10px;">
            <a href="/" style="color:white; margin-right:10px;">Home</a>
            <a href="/features" style="color:white; margin-right:10px;">Features</a>
          </nav>
          <h1>Demo Application</h1>
          <p>Welcome to our demo app.</p>
          <button style="background:blue; color:white; padding:10px 20px; border:none; border-radius:5px;">
            Get Started
          </button>
        </body>
        </html>
      `);
    } else if (req.url === '/features') {
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Demo App - Features</title></head>
        <body style="background:#f5f5f5; padding:20px;">
          <h1>Features</h1>
          <ul>
            <li>Feature 1</li>
            <li>Feature 2</li>
          </ul>
        </body>
        </html>
      `);
    } else {
      res.statusCode = 404;
      res.end('<html><body>Not Found</body></html>');
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        serverUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  // Cleanup exports
  const testExports = path.resolve('exports');
  if (fs.existsSync(testExports)) {
    // Don't delete the whole dir, just clean test artifacts
  }
});

describe('Pipeline - E2E', () => {
  it('should run full pipeline: capture -> video -> PDF', async () => {
    const statuses: string[] = [];
    const pipeline = new Pipeline((status) => {
      statuses.push(status.stage);
    });

    const result = await pipeline.run({
      type: 'url',
      value: serverUrl,
      projectName: 'Test Project',
      language: 'en',
      orientation: 'portrait',
      maxScreens: 2,
    });

    // Should have screens
    expect(result.capture).toBeDefined();
    expect(result.capture!.screens.length).toBeGreaterThanOrEqual(1);

    // Should have videos
    expect(result.videos).toBeDefined();
    expect(result.videos!.length).toBeGreaterThanOrEqual(1);

    // Should have PDF
    expect(result.pdf).toBeDefined();
    expect(result.pdf!.pdfPath).toBeDefined();
    expect(fs.existsSync(result.pdf!.pdfPath)).toBe(true);

    // Should have report
    expect(result.reportPath).toBeDefined();
    expect(fs.existsSync(result.reportPath!)).toBe(true);

    // Verify report content
    const report = JSON.parse(fs.readFileSync(result.reportPath!, 'utf-8'));
    expect(report.projectName).toBe('Test Project');
    expect(report.totalScreens).toBeGreaterThanOrEqual(1);

    // Should have gone through stages
    expect(statuses).toContain('intake');
    expect(statuses).toContain('capture');
    expect(statuses).toContain('produce');
    expect(statuses).toContain('document');
  }, 120000); // Allow 2 minutes for full pipeline
});
