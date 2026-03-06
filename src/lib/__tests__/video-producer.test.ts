import { describe, it, expect } from 'vitest';
import { VideoProducer } from '../video-producer';
import type { ScreenInfo } from '../capture-engine';
import * as fs from 'node:fs';
import * as path from 'node:path';

const mockScreen: ScreenInfo = {
  id: 'test-screen-1',
  name: 'Home Page',
  url: 'http://example.com',
  route: '/',
  screenshotPath: path.resolve('exports/test-video/mock.png'),
  description: 'The main landing page',
  elements: [
    {
      id: 1,
      type: 'button',
      label: 'Sign Up',
      selector: '#btn-signup',
      bounds: { x: 100, y: 200, width: 120, height: 40 },
    },
    {
      id: 2,
      type: 'input',
      label: 'Search',
      selector: 'input[type="text"]',
      bounds: { x: 300, y: 50, width: 200, height: 35 },
    },
    {
      id: 3,
      type: 'link',
      label: 'Dashboard',
      selector: 'a[href="/dashboard"]',
      bounds: { x: 50, y: 400, width: 100, height: 30 },
    },
  ],
};

describe('VideoProducer', () => {
  const outputDir = path.resolve('exports/test-video');

  it('should generate a video HTML file for a screen', async () => {
    fs.mkdirSync(outputDir, { recursive: true });
    // Create a mock screenshot file (1x1 PNG)
    const pngBuf = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    fs.writeFileSync(mockScreen.screenshotPath, pngBuf);

    const producer = new VideoProducer();
    const result = await producer.generateVideo(mockScreen, { outputDir });

    expect(result).toHaveProperty('videoPath');
    expect(result.screenId).toBe('test-screen-1');
    expect(result.screenName).toBe('Home Page');
    expect(fs.existsSync(result.videoPath)).toBe(true);

    // Check the HTML contains key elements
    const html = fs.readFileSync(result.videoPath, 'utf-8');
    expect(html).toContain('Home Page');
    expect(html).toContain('Sign Up');

    // Cleanup
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('should generate a demo page with all videos', async () => {
    fs.mkdirSync(outputDir, { recursive: true });
    const pngBuf = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    fs.writeFileSync(mockScreen.screenshotPath, pngBuf);

    const producer = new VideoProducer();
    const video = await producer.generateVideo(mockScreen, { outputDir });
    const demoPath = await producer.generateDemoPage([video]);

    expect(fs.existsSync(demoPath)).toBe(true);
    const html = fs.readFileSync(demoPath, 'utf-8');
    expect(html).toContain('ExplainIt');
    expect(html).toContain('Home Page');

    // Cleanup
    fs.rmSync(outputDir, { recursive: true, force: true });
  });
});
