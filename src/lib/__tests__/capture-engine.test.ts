import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CaptureEngine } from '../capture-engine';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Simple test server
let server: http.Server;
let serverUrl: string;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    if (req.url === '/' || req.url === '/index.html') {
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Test App - Home</title></head>
        <body>
          <nav>
            <a href="/">Home</a>
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
          </nav>
          <h1>Welcome to Test App</h1>
          <button id="btn-signup">Sign Up</button>
          <input type="text" placeholder="Search..." />
          <a href="/dashboard">Dashboard</a>
        </body>
        </html>
      `);
    } else if (req.url === '/about') {
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Test App - About</title></head>
        <body>
          <nav><a href="/">Home</a><a href="/about">About</a></nav>
          <h1>About Us</h1>
          <p>We are a test app.</p>
        </body>
        </html>
      `);
    } else if (req.url === '/contact') {
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Test App - Contact</title></head>
        <body>
          <nav><a href="/">Home</a></nav>
          <h1>Contact</h1>
          <form><input type="email" placeholder="Email" /><button type="submit">Send</button></form>
        </body>
        </html>
      `);
    } else {
      res.statusCode = 404;
      res.end('<html><body><h1>Not Found</h1></body></html>');
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
});

describe('CaptureEngine', () => {
  it('should discover screens from a URL', async () => {
    const engine = new CaptureEngine();
    const screens = await engine.discoverScreens(serverUrl);
    expect(screens.length).toBeGreaterThanOrEqual(1);
    expect(screens[0]).toHaveProperty('url');
    expect(screens[0]).toHaveProperty('name');
  });

  it('should capture screenshots', async () => {
    const outputDir = path.resolve('exports/test-screenshots');
    fs.mkdirSync(outputDir, { recursive: true });

    const engine = new CaptureEngine();
    const result = await engine.captureUrl(serverUrl, {
      maxScreens: 3,
      viewport: { width: 1080, height: 1920 },
      outputDir,
    });

    expect(result.screens.length).toBeGreaterThanOrEqual(1);
    expect(result.flows.length).toBeGreaterThanOrEqual(1);

    // Check that screenshot files exist
    for (const screen of result.screens) {
      expect(fs.existsSync(screen.screenshotPath)).toBe(true);
    }

    // Cleanup
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('should take a single screenshot', async () => {
    const outputDir = path.resolve('exports/test-single');
    fs.mkdirSync(outputDir, { recursive: true });

    const engine = new CaptureEngine();
    const filePath = await engine.takeScreenshot(serverUrl, 'home');
    expect(fs.existsSync(filePath)).toBe(true);

    // Cleanup
    fs.rmSync(outputDir, { recursive: true, force: true });
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  it('should detect page elements', async () => {
    const outputDir = path.resolve('exports/test-elements');
    fs.mkdirSync(outputDir, { recursive: true });

    const engine = new CaptureEngine();
    const result = await engine.captureUrl(serverUrl, {
      maxScreens: 1,
      outputDir,
    });

    expect(result.screens[0].elements.length).toBeGreaterThan(0);

    // Cleanup
    fs.rmSync(outputDir, { recursive: true, force: true });
  });
});
