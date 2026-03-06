import { chromium, type Page } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { ScreenInfo, ElementInfo, FlowInfo, FlowStep } from './types';

// Re-export shared types for backwards compatibility
export type { ScreenInfo, ElementInfo, FlowInfo, FlowStep } from './types';

export interface CaptureOptions {
  maxScreens?: number;
  viewport?: { width: number; height: number };
  outputDir?: string;
  waitForSelector?: string;
  credentials?: { username: string; password: string };
}

export interface CaptureResult {
  screens: ScreenInfo[];
  flows: FlowInfo[];
  screenshotDir: string;
}

export class CaptureEngine {
  private defaultViewport = { width: 1080, height: 1920 };
  private defaultMaxScreens = 10;
  private defaultOutputDir = path.resolve('exports/screenshots');

  async captureUrl(url: string, options?: CaptureOptions): Promise<CaptureResult> {
    const maxScreens = options?.maxScreens || this.defaultMaxScreens;
    const viewport = options?.viewport || this.defaultViewport;
    const outputDir = options?.outputDir || this.defaultOutputDir;

    fs.mkdirSync(outputDir, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();

      // Handle credentials if provided
      if (options?.credentials) {
        await this.handleLogin(page, url, options.credentials);
      }

      // Discover screens
      const discoveredUrls = await this.discoverUrls(page, url, maxScreens);

      const screens: ScreenInfo[] = [];
      const flows: FlowInfo[] = [];

      for (const screenUrl of discoveredUrls) {
        try {
          const screen = await this.captureScreen(page, screenUrl, url, outputDir);
          screens.push(screen);

          const flow = this.generateFlow(screen);
          flows.push(flow);
        } catch (err) {
          console.error(`Failed to capture ${screenUrl}:`, err);
        }
      }

      await browser.close();

      return { screens, flows, screenshotDir: outputDir };
    } catch (err) {
      await browser.close();
      throw err;
    }
  }

  async discoverScreens(url: string): Promise<ScreenInfo[]> {
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: this.defaultViewport });
      const page = await context.newPage();
      const urls = await this.discoverUrls(page, url, this.defaultMaxScreens);
      await browser.close();

      return urls.map((u) => {
        const parsedUrl = new URL(u);
        return {
          id: uuidv4(),
          name: this.urlToName(parsedUrl.pathname),
          url: u,
          route: parsedUrl.pathname,
          screenshotPath: '',
          description: '',
          elements: [],
        };
      });
    } catch (err) {
      await browser.close();
      throw err;
    }
  }

  async takeScreenshot(url: string, name: string): Promise<string> {
    const outputDir = this.defaultOutputDir;
    fs.mkdirSync(outputDir, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: this.defaultViewport });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      const filePath = path.join(outputDir, `${name}.png`);
      await page.screenshot({ path: filePath, fullPage: true });
      await browser.close();

      return filePath;
    } catch (err) {
      await browser.close();
      throw err;
    }
  }

  private async handleLogin(
    page: Page,
    url: string,
    credentials: { username: string; password: string }
  ): Promise<void> {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Try common login form patterns
    const usernameSelectors = [
      'input[type="email"]',
      'input[name="username"]',
      'input[name="email"]',
      'input[name="user"]',
      '#username',
      '#email',
    ];
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      '#password',
    ];

    for (const sel of usernameSelectors) {
      const el = await page.$(sel);
      if (el) {
        await el.fill(credentials.username);
        break;
      }
    }

    for (const sel of passwordSelectors) {
      const el = await page.$(sel);
      if (el) {
        await el.fill(credentials.password);
        break;
      }
    }

    // Try to submit
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Log in")',
      'button:has-text("Sign in")',
      'button:has-text("Login")',
    ];

    for (const sel of submitSelectors) {
      const el = await page.$(sel);
      if (el) {
        await el.click();
        await page.waitForLoadState('networkidle').catch(() => {});
        break;
      }
    }
  }

  private async discoverUrls(page: Page, baseUrl: string, maxScreens: number): Promise<string[]> {
    try {
      await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
    } catch {
      // Try with domcontentloaded if networkidle times out
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }

    const baseOrigin = new URL(baseUrl).origin;

    // Collect all same-origin links
    const links = await page.evaluate((origin: string) => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      const urls = new Set<string>();

      for (const a of anchors) {
        try {
          const href = (a as HTMLAnchorElement).href;
          const url = new URL(href);
          if (url.origin === origin && !url.hash && !href.includes('mailto:') && !href.includes('tel:')) {
            urls.add(url.origin + url.pathname);
          }
        } catch {
          // Skip invalid URLs
        }
      }

      return Array.from(urls);
    }, baseOrigin);

    // Always include the base URL first
    const basePathUrl = baseOrigin + new URL(baseUrl).pathname;
    const allUrls = [basePathUrl, ...links.filter((l) => l !== basePathUrl)];

    // Deduplicate and limit
    const unique = Array.from(new Set(allUrls)).slice(0, maxScreens);
    return unique;
  }

  private async captureScreen(
    page: Page,
    url: string,
    baseUrl: string,
    outputDir: string
  ): Promise<ScreenInfo> {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    } catch {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }

    const parsedUrl = new URL(url);
    const screenId = uuidv4();
    const name = this.urlToName(parsedUrl.pathname);
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');

    // Take screenshot
    const screenshotPath = path.join(outputDir, `${safeName}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    // Get page title/description
    const title = await page.title();
    const description = title || `Screen: ${name}`;

    // Detect elements
    const elements = await this.detectElements(page);

    return {
      id: screenId,
      name,
      url,
      route: parsedUrl.pathname,
      screenshotPath,
      description,
      elements,
    };
  }

  private async detectElements(page: Page): Promise<ElementInfo[]> {
    const elements: ElementInfo[] = [];

    const selectors = [
      { selector: 'button', type: 'button' },
      { selector: 'input', type: 'input' },
      { selector: 'a', type: 'link' },
      { selector: 'nav', type: 'nav' },
      { selector: 'h1, h2, h3', type: 'heading' },
      { selector: 'form', type: 'form' },
      { selector: '[role="button"]', type: 'button' },
      { selector: 'select', type: 'select' },
      { selector: 'textarea', type: 'input' },
    ];

    let idCounter = 1;

    for (const { selector, type } of selectors) {
      const els = await page.$$(selector);
      for (const el of els) {
        if (idCounter > 20) break; // Limit to 20 elements

        try {
          const box = await el.boundingBox();
          if (!box || box.width < 5 || box.height < 5) continue;

          const label = await el.evaluate((node: Element) => {
            return (
              node.getAttribute('aria-label') ||
              node.textContent?.trim().slice(0, 50) ||
              node.getAttribute('placeholder') ||
              node.getAttribute('name') ||
              node.tagName.toLowerCase()
            );
          });

          elements.push({
            id: idCounter++,
            type,
            label: label || type,
            selector,
            bounds: {
              x: Math.round(box.x),
              y: Math.round(box.y),
              width: Math.round(box.width),
              height: Math.round(box.height),
            },
          });
        } catch {
          // Skip elements that can't be inspected
        }
      }
    }

    return elements;
  }

  private generateFlow(screen: ScreenInfo): FlowInfo {
    const steps: FlowStep[] = [];
    let order = 1;

    // Add a "view" step first
    steps.push({
      order: order++,
      action: 'navigate',
      target: screen.url,
      description: `Navigate to ${screen.name}`,
    });

    // Add steps for key elements (up to 5)
    const keyElements = screen.elements.slice(0, 5);
    for (const el of keyElements) {
      let action = 'observe';
      if (el.type === 'button') action = 'click';
      else if (el.type === 'input') action = 'fill';
      else if (el.type === 'link') action = 'click';

      steps.push({
        order: order++,
        action,
        target: el.selector,
        description: `${action === 'click' ? 'Click' : action === 'fill' ? 'Fill in' : 'View'} "${el.label}"`,
      });
    }

    return {
      id: uuidv4(),
      name: `${screen.name} Flow`,
      screenId: screen.id,
      steps,
    };
  }

  private urlToName(pathname: string): string {
    if (pathname === '/' || pathname === '') return 'Home';
    const segments = pathname.split('/').filter(Boolean);
    return segments
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' '))
      .join(' > ');
  }
}
