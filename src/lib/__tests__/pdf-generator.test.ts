import { describe, it, expect } from 'vitest';
import { PDFGenerator } from '../pdf-generator';
import type { ScreenInfo } from '../capture-engine';
import * as fs from 'node:fs';
import * as path from 'node:path';

const mockScreens: ScreenInfo[] = [
  {
    id: 'screen-1',
    name: 'Home',
    url: 'http://example.com',
    route: '/',
    screenshotPath: path.resolve('exports/test-pdf/mock1.png'),
    description: 'Main landing page',
    elements: [
      { id: 1, type: 'button', label: 'Get Started', selector: '#cta', bounds: { x: 100, y: 200, width: 150, height: 40 } },
      { id: 2, type: 'nav', label: 'Navigation', selector: 'nav', bounds: { x: 0, y: 0, width: 400, height: 60 } },
    ],
  },
  {
    id: 'screen-2',
    name: 'About',
    url: 'http://example.com/about',
    route: '/about',
    screenshotPath: path.resolve('exports/test-pdf/mock2.png'),
    description: 'About page with company info',
    elements: [
      { id: 1, type: 'heading', label: 'About Us', selector: 'h1', bounds: { x: 50, y: 100, width: 300, height: 50 } },
    ],
  },
];

describe('PDFGenerator', () => {
  const outputDir = path.resolve('exports/test-pdf');

  it('should generate a PDF guide', async () => {
    fs.mkdirSync(outputDir, { recursive: true });

    // Create mock screenshot files
    const pngBuf = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    for (const screen of mockScreens) {
      fs.writeFileSync(screen.screenshotPath, pngBuf);
    }

    const generator = new PDFGenerator();
    const result = await generator.generateGuide(mockScreens, {
      title: 'Test Guide',
      outputDir,
      language: 'en',
    });

    expect(result).toHaveProperty('pdfPath');
    expect(result).toHaveProperty('mdPath');
    expect(result.pageCount).toBeGreaterThan(0);
    expect(fs.existsSync(result.pdfPath)).toBe(true);
    expect(fs.existsSync(result.mdPath)).toBe(true);

    // Check PDF has content
    const pdfStats = fs.statSync(result.pdfPath);
    expect(pdfStats.size).toBeGreaterThan(100);

    // Check MD has content
    const mdContent = fs.readFileSync(result.mdPath, 'utf-8');
    expect(mdContent).toContain('Home');
    expect(mdContent).toContain('About');

    // Cleanup
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('should generate markdown version', async () => {
    fs.mkdirSync(outputDir, { recursive: true });
    const pngBuf = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    for (const screen of mockScreens) {
      fs.writeFileSync(screen.screenshotPath, pngBuf);
    }

    const generator = new PDFGenerator();
    const result = await generator.generateGuide(mockScreens, {
      title: 'MD Test',
      outputDir,
      language: 'he',
    });

    const md = fs.readFileSync(result.mdPath, 'utf-8');
    expect(md).toContain('# MD Test');
    expect(md).toContain('Home');
    expect(md).toContain('Get Started');

    // Cleanup
    fs.rmSync(outputDir, { recursive: true, force: true });
  });
});
